from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr
from typing import Optional, List
from pathlib import Path
from sqlalchemy.engine import URL, make_url

class Settings(BaseSettings):
    PROJECT_NAME: str = "LabTrack"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # --- SEC-3: Secret key MUST come from .env, no insecure default ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days

    # bcrypt work factor (tests may lower it via env to speed up)
    BCRYPT_ROUNDS: int = 12
    # Activation / password-setup token lifetime
    ACTIVATION_TOKEN_EXPIRE_HOURS: int = 72

    # --- P1.2: CORS allowed origins (comma-separated in .env) ---
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Database — PostgreSQL connection settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_HOST: Optional[str] = None  # Docker override (e.g. "db" service name)
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "labtrack"
    POSTGRES_PORT: str = "5432"
    # Optional full override (used by tests / disposable databases)
    DATABASE_URL: Optional[str] = None
    # Never log SQL (and bound parameters such as password hashes) unless explicitly enabled
    SQL_ECHO: bool = False

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    SMTP_ENABLED: bool = True
    SMTP_USER: str = ""
    SMTP_PASSWORD: SecretStr = SecretStr("")
    SMTP_FROM_NAME: str = "LabTrack"
    SMTP_TIMEOUT_SECONDS: int = 10

    # Production startup never loads demo users or equipment automatically.
    BOOTSTRAP_ADMIN_EMAIL: str = ''
    BOOTSTRAP_ADMIN_NAME: str = 'System Administrator'
    BOOTSTRAP_ADMIN_PASSWORD: SecretStr = SecretStr('')
    DB_STARTUP_ATTEMPTS: int = 30

    @property
    def email_enabled(self) -> bool:
        return self.SMTP_ENABLED

    @property
    def email_ready(self) -> bool:
        return self.smtp_ready

    @property
    def smtp_ready(self) -> bool:
        return bool(self.SMTP_ENABLED and self.SMTP_USER
                    and self.SMTP_PASSWORD.get_secret_value().replace(' ', ''))

    @property
    def db_host(self) -> str:
        """Use POSTGRES_HOST if set (Docker), otherwise fall back to POSTGRES_SERVER."""
        return self.POSTGRES_HOST or self.POSTGRES_SERVER

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            url = make_url(self.DATABASE_URL)
            if url.drivername in ('postgres', 'postgresql'):
                url = url.set(drivername='postgresql+asyncpg')
            # Hosted providers commonly supply libpq's sslmode parameter.
            if 'sslmode' in url.query:
                query = dict(url.query)
                query.setdefault('ssl', query.pop('sslmode'))
                url = url.set(query=query)
        else:
            url = URL.create('postgresql+asyncpg', username=self.POSTGRES_USER,
                             password=self.POSTGRES_PASSWORD, host=self.db_host,
                             port=int(self.POSTGRES_PORT), database=self.POSTGRES_DB)
        return url.render_as_string(hide_password=False)

    @property
    def cors_origins(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[2] / ".env", case_sensitive=True, extra="ignore")

settings = Settings()
