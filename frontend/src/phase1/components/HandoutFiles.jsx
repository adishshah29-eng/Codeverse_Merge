import React, { useEffect, useState } from "react";
import { ChevronRight, Copy, Check, Download, FileCode2, FilePlus2 } from "lucide-react";
import { stageApi } from "../api";

// The stage's handout, in the page (no zip): every file is listed, text files open inline with Copy / Save / "Use in
// editor", and binaries (the CTF programs) are single-file downloads.
const formatSize = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`);

export default function HandoutFiles({ stageId, spec, disabled, onUse }) {
  const [files, setFiles] = useState(null);
  const [starters, setStarters] = useState({});
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const [cache, setCache] = useState({});
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let alive = true;
    setFiles(null);
    setOpen(null);
    setCache({});
    stageApi
      .listFiles(stageId)
      .then((res) => {
        if (!alive) return;
        setFiles(res.files);
        setStarters(res.starters || {});
      })
      .catch((err) => alive && setError(err.message || "Could not load the handout."));
    return () => {
      alive = false;
    };
  }, [stageId]);

  const toggle = async (file) => {
    if (file.kind !== "text") return;
    if (open === file.path) return setOpen(null);
    setOpen(file.path);
    if (cache[file.path] === undefined) {
      try {
        const res = await stageApi.readFile(stageId, file.path);
        setCache((prev) => ({ ...prev, [file.path]: res.content }));
      } catch (err) {
        setCache((prev) => ({ ...prev, [file.path]: `# ${err.message}` }));
      }
    }
  };

  const copy = async (path) => {
    const text = cache[path] ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(path);
    setTimeout(() => setCopied(""), 1500);
  };

  const save = (path) => {
    const url = URL.createObjectURL(new Blob([cache[path] ?? ""], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = path.split("/").pop();
    link.click();
    URL.revokeObjectURL(url);
  };

  // Where "Use in editor" puts a file: an explicit starter mapping, else the same path if it's something you submit.
  const target = (path) => {
    if (starters[path]) return starters[path];
    if (spec?.mode === "single" && spec.names?.includes(path)) return path;
    if (spec?.mode === "multi" && (spec.names?.includes(path) || (spec.prefix && path.startsWith(spec.prefix)))) return path;
    return null;
  };

  const btn = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-beige-dim text-xs font-medium text-beige hover:bg-beige hover:text-ink disabled:opacity-40";

  return (
    <section aria-label="Handout files">
      <h3 className="label">Handout files <span className="normal-case tracking-normal font-normal text-beige-faint">· everything you need, right here</span></h3>
      {error && <p className="mt-2 text-sm text-red-text">{error}</p>}
      {!files && !error && <p className="mt-2 text-sm text-beige-dim">Loading files…</p>}
      <ul className="mt-3 border border-rule divide-y divide-rule">
        {(files || []).map((file) => {
          const isOpen = open === file.path;
          const dest = target(file.path);
          return (
            <li key={file.path} className="bg-coal">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  onClick={() => toggle(file)}
                  disabled={file.kind !== "text"}
                  aria-expanded={isOpen}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  {file.kind === "text" ? (
                    <ChevronRight className={`w-4 h-4 shrink-0 text-beige-dim transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  ) : (
                    <FileCode2 className="w-4 h-4 shrink-0 text-beige-dim" />
                  )}
                  <span className="font-mono text-[13px] text-beige truncate">{file.path}</span>
                  <span className="text-xs text-beige-faint shrink-0">{formatSize(file.size)}</span>
                </button>
                {file.kind !== "text" && (
                  <a href={stageApi.fileUrl(stageId, file.path)} className={btn}>
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                )}
              </div>
              {isOpen && (
                <div className="border-t border-rule">
                  <pre className="code-surface max-h-80 overflow-auto px-3.5 py-3 m-0 border-0 whitespace-pre">
                    {cache[file.path] === undefined ? "Loading…" : cache[file.path]}
                  </pre>
                  <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-rule">
                    <button onClick={() => copy(file.path)} className={btn}>
                      {copied === file.path ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === file.path ? "Copied" : "Copy"}
                    </button>
                    <button onClick={() => save(file.path)} className={btn}>
                      <Download className="w-3.5 h-3.5" /> Save file
                    </button>
                    {dest && (
                      <button disabled={disabled} onClick={() => onUse(dest, cache[file.path] ?? "")} className={btn}>
                        <FilePlus2 className="w-3.5 h-3.5" /> Use as {dest} in editor
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
