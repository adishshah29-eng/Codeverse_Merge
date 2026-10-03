from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Heist Game"
    secret_key: str = "change-me-in-production-heist-secret"
    database_url: str = f"sqlite:///{BACKEND_ROOT / 'heist.db'}"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    admin_username: str = "admin"
    admin_password: str = "admin"

    cookie_secure: bool = False

    ctf_base_path: str = "/ctf"
    hard_mode_header: bool = True
    puzzle2_code: str = "IVB-LEVEL2-5K8"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"


settings = Settings()
