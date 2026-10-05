from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
VENDOR = ROOT / "vendor"


class Settings(BaseSettings):
    # backend/.env is read for local development. In production the same
    # variables are supplied by systemd (EnvironmentFile), which takes priority.
    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), extra="ignore")

    app_name: str = "CODEVERSE 2.0"
    # "development" or "production". Production enables strict startup checks.
    environment: str = "development"
    log_level: str = "INFO"
    # Serve interactive API docs at /api/docs. Keep disabled in production.
    enable_docs: bool = False

    secret_key: str = ""
    database_url: str = ""
    # Restricted read-only role used for the Phase 2 / Stage 1 SQL console.
    # See supabase/schema.sql (forensic_reader). Required in production.
    forensic_database_url: str = ""
    db_pool_size: int = 5
    db_max_overflow: int = 5

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    # Optional: legacy HS256 JWT secret (Supabase > Project Settings > API).
    # When set, team sessions are verified locally instead of calling Supabase
    # on every request. Projects using asymmetric signing keys are verified
    # via the public JWKS endpoint automatically.
    supabase_jwt_secret: str = ""

    admin_username: str = ""
    admin_password: str = ""

    stage1_deletion_key: str = ""
    ctf_puzzle3_code: str = ""
    ctf_control_token: str = ""
    stage4_shutdown_code: str = ""
    stage4_sequence: str = ""

    cookie_secure: bool = False

    ctf_base_path: str = "/ctf"
    hard_mode_header: bool = True
    # Comma-separated list. Leave empty when the frontend and API share an
    # origin (the normal Nginx deployment) — no CORS is needed then.
    cors_origins: str = ""

    # Phase 1 code execution (Alarm System + Printing Press stages).
    # "auto": use bubblewrap if available, "bwrap": require it, "none": no isolation.
    code_sandbox: str = "auto"
    code_exec_max_concurrent: int = 2   # per worker process
    code_exec_queue_timeout: float = 20.0
    code_exec_memory_mb: int = 1536

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def production_problems(self) -> list[str]:
        problems = []
        if len(self.secret_key) < 32:
            problems.append("SECRET_KEY must be at least 32 characters")
        for name in ("database_url", "forensic_database_url", "supabase_url",
                     "supabase_anon_key", "supabase_service_role_key",
                     "admin_username", "admin_password"):
            if not getattr(self, name):
                problems.append(f"{name.upper()} is not set")
        if len(self.admin_password) < 12:
            problems.append("ADMIN_PASSWORD must be at least 12 characters")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE must be true behind HTTPS")
        if self.code_sandbox.lower() == "none":
            problems.append("CODE_SANDBOX=none is not allowed in production (use bwrap)")
        if "*" in self.cors_origin_list:
            problems.append("CORS_ORIGINS must not contain '*'")
        return problems


settings = Settings()
