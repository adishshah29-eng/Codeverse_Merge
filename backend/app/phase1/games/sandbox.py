"""Run team-submitted Python (Phase 1 Alarm System + Printing Press) safely.

Layers of protection, from always-on to best available:

1. Concurrency cap per worker, so a burst of submissions cannot starve the
   API of CPU (callers get a "busy, retry" result instead).
2. A fresh temporary working directory containing only the files the stage
   needs (never the answer key or application source).
3. A scrubbed environment: no secret keys, database paths or other secrets
   are inherited from the server process.
4. Resource limits: CPU seconds, address space, file size, open files, no
   core dumps; the whole process group is killed on timeout.
5. bubblewrap (`bwrap`), when available: separate mount/PID/network/IPC
   namespaces with a read-only view of the Python runtime only. The
   application code, .env files and the rest of the filesystem are not
   visible, and there is no network access.

CODE_SANDBOX=bwrap makes (5) mandatory (fail closed); "auto" uses it when it
works on the host; "none" disables it (local development only).
"""
from __future__ import annotations

import logging
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Optional, Union

from app.settings import settings

try:  # POSIX only; on Windows (local development) limits are skipped.
    import resource
except ImportError:
    resource = None

logger = logging.getLogger(__name__)

_semaphore = threading.BoundedSemaphore(max(1, settings.code_exec_max_concurrent))
_bwrap_checked = False
_bwrap_path: Optional[str] = None

# Hard cap on what we read back from the child, to protect server memory.
_MAX_OUTPUT_BYTES = 8 * 1024 * 1024


@dataclass
class RunResult:
    stdout: str
    stderr: str
    returncode: int
    timed_out: bool = False
    busy: bool = False


def _clean_env(workdir: str) -> dict:
    env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "HOME": workdir,
        "TMPDIR": workdir,
        "LANG": "C.UTF-8",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONUNBUFFERED": "1",
        "MPLBACKEND": "Agg",
        "MPLCONFIGDIR": workdir,
        # Keep numeric libraries single-threaded so one run uses one core.
        "OMP_NUM_THREADS": "1",
        "OPENBLAS_NUM_THREADS": "1",
        "MKL_NUM_THREADS": "1",
        "NUMEXPR_NUM_THREADS": "1",
    }
    if os.name == "nt":  # Windows needs these for Python to start at all
        env["SYSTEMROOT"] = os.environ.get("SYSTEMROOT", r"C:\Windows")
        env["PATH"] = os.path.dirname(sys.executable)
    return env


def _limits(timeout_seconds: int):
    if resource is None:
        return None
    memory = settings.code_exec_memory_mb * 1024 * 1024

    def apply() -> None:
        # Best effort: platforms differ in which limits they support. macOS, for example, refuses to set
        # RLIMIT_AS, and an exception here would abort the child before it starts ("Exception occurred in
        # preexec_fn"). Each limit is therefore applied on its own and skipped when the OS says no.
        wanted = [
            (resource.RLIMIT_CPU, (timeout_seconds + 1, timeout_seconds + 2)),
            (resource.RLIMIT_FSIZE, (64 * 1024 * 1024, 64 * 1024 * 1024)),
            (resource.RLIMIT_NOFILE, (256, 256)),
            (resource.RLIMIT_CORE, (0, 0)),
        ]
        if sys.platform != "darwin":
            wanted.insert(1, (resource.RLIMIT_AS, (memory, memory)))
        for which, value in wanted:
            try:
                resource.setrlimit(which, value)
            except (ValueError, OSError):
                pass

    return apply


def _python_runtime_dirs() -> list[str]:
    """Directories the sandboxed interpreter needs to see (read-only)."""
    dirs = {sys.prefix, sys.base_prefix, sys.exec_prefix, sys.base_exec_prefix}
    real = os.path.realpath(sys.executable)
    dirs.add(str(Path(real).parent.parent))
    return sorted(d for d in dirs if d and os.path.isdir(d))


def _bwrap_command(workdir: str, argv: list[str]) -> list[str]:
    cmd = [
        _bwrap_path or "bwrap",
        "--die-with-parent",
        "--new-session",
        "--unshare-all",          # no network, own PID/IPC/UTS/mount namespaces
        "--cap-drop", "ALL",
        "--ro-bind", "/usr", "/usr",
        "--ro-bind-try", "/lib", "/lib",
        "--ro-bind-try", "/lib64", "/lib64",
        "--ro-bind-try", "/bin", "/bin",
        "--ro-bind-try", "/etc/alternatives", "/etc/alternatives",
        "--ro-bind-try", "/etc/ld.so.cache", "/etc/ld.so.cache",
        "--proc", "/proc",
        "--dev", "/dev",
        "--tmpfs", "/tmp",
    ]
    for directory in _python_runtime_dirs():
        if not directory.startswith("/usr/"):
            cmd += ["--ro-bind", directory, directory]
    cmd += ["--bind", workdir, "/sandbox", "--chdir", "/sandbox", "--clearenv"]
    for key, value in _clean_env("/sandbox").items():
        cmd += ["--setenv", key, value]
    return cmd + ["--"] + argv


def _bwrap_available() -> bool:
    global _bwrap_checked, _bwrap_path
    if _bwrap_checked:
        return _bwrap_path is not None
    _bwrap_checked = True
    path = shutil.which("bwrap")
    if not path:
        return False
    _bwrap_path = path
    with tempfile.TemporaryDirectory(prefix="cv-probe-") as workdir:
        try:
            probe = subprocess.run(
                _bwrap_command(workdir, [sys.executable, "-I", "-c", "import numpy; print('ok')"]),
                capture_output=True, text=True, timeout=30,
            )
            if probe.returncode == 0 and probe.stdout.strip() == "ok":
                return True
            logger.warning("bubblewrap probe failed (rc=%s): %s", probe.returncode, probe.stderr.strip()[:500])
        except (OSError, subprocess.SubprocessError) as exc:
            logger.warning("bubblewrap probe failed: %s", exc)
    _bwrap_path = None
    return False


def sandbox_mode() -> str:
    """The isolation mode that will actually be used: 'bwrap', 'none' or 'unavailable'."""
    mode = settings.code_sandbox.lower()
    if mode == "none":
        return "none"
    if _bwrap_available():
        return "bwrap"
    return "unavailable" if mode == "bwrap" else "none"


def log_sandbox_status() -> None:
    mode = sandbox_mode()
    if mode == "bwrap":
        logger.info("Code sandbox: bubblewrap isolation active")
    elif mode == "unavailable":
        logger.error("Code sandbox: CODE_SANDBOX=bwrap but bubblewrap is not usable; code execution is disabled")
    else:
        level = logging.WARNING if settings.is_production else logging.INFO
        logger.log(level, "Code sandbox: running WITHOUT bubblewrap isolation (rlimits + clean env only)")


def run_python(
    script: str,
    timeout_seconds: int,
    data_files: Iterable[Path] = (),
    extra_files: Optional[Mapping[str, Union[str, bytes]]] = None,
) -> RunResult:
    """Execute `script` as main.py in an isolated temp dir and capture output.

    `extra_files` maps relative paths (sub-directories allowed) to contents written into
    the working directory before the run. Paths are validated so a caller can never write
    outside the temp directory or replace main.py.
    """
    if not _semaphore.acquire(timeout=settings.code_exec_queue_timeout):
        return RunResult("", "Execution servers are busy. Please try again in a few seconds.", -1, busy=True)
    try:
        mode = sandbox_mode()
        if mode == "unavailable":
            return RunResult("", "Code execution sandbox is unavailable. Contact the organizers.", -1)

        with tempfile.TemporaryDirectory(prefix="cv-run-") as workdir:
            os.chmod(workdir, 0o700)
            for data_file in data_files:
                shutil.copyfile(data_file, os.path.join(workdir, data_file.name))
            root = os.path.realpath(workdir)
            for rel, content in (extra_files or {}).items():
                target = os.path.realpath(os.path.join(root, rel))
                if not target.startswith(root + os.sep) or target == os.path.join(root, "main.py"):
                    raise ValueError(f"Illegal sandbox file path: {rel!r}")
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, "wb") as handle:
                    handle.write(content if isinstance(content, bytes) else content.encode("utf-8"))
            with open(os.path.join(workdir, "main.py"), "w", encoding="utf-8") as handle:
                handle.write(script)

            argv = [sys.executable, "-I", "main.py"]
            if mode == "bwrap":
                cmd, env, cwd = _bwrap_command(workdir, argv), {}, workdir
            else:
                cmd, env, cwd = argv, _clean_env(workdir), workdir

            proc = subprocess.Popen(
                cmd,
                cwd=cwd,
                env=env,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=_limits(timeout_seconds),
                start_new_session=os.name != "nt",
            )
            try:
                stdout, stderr = proc.communicate(timeout=timeout_seconds)
                timed_out = False
            except subprocess.TimeoutExpired:
                try:
                    if os.name == "nt":
                        proc.kill()
                    else:
                        os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                stdout, stderr = proc.communicate()
                timed_out = True

            return RunResult(
                stdout=stdout[:_MAX_OUTPUT_BYTES].decode("utf-8", errors="replace"),
                stderr=stderr[:_MAX_OUTPUT_BYTES].decode("utf-8", errors="replace"),
                returncode=proc.returncode if not timed_out else -1,
                timed_out=timed_out,
            )
    finally:
        _semaphore.release()
