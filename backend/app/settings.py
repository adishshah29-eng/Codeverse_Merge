from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / "vendor"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Heist Game"
    secret_key: str = ""
    database_url: str = ""

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
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
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"


settings = Settings()
