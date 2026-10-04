from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "LabTrack"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # --- SEC-3: Secret key MUST come from .env, no insecure default ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days

    # --- P1.2: CORS allowed origins (comma-separated in .env) ---
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Database — PostgreSQL connection settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_HOST: Optional[str] = None  # Docker override (e.g. "db" service name)
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "labtrack"
    POSTGRES_PORT: str = "5432"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379


    @property
    def db_host(self) -> str:
        """Use POSTGRES_HOST if set (Docker), otherwise fall back to POSTGRES_SERVER."""
        return self.POSTGRES_HOST or self.POSTGRES_SERVER

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.db_host}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def cors_origins(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

settings = Settings()
