from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="API_", env_file=".env", extra="ignore")

    app_name: str = "Barbershop API"
    host: str = "0.0.0.0"
    port: int = 8000
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    database_url: str = "postgresql+psycopg://barbershop:barbershop@postgres:5432/barbershop"
    upload_dir: str = "uploads"
    cors_origins: list[str] = ["http://localhost:3001", "http://localhost:3002", "http://localhost:3003"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: list[str] | str):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
