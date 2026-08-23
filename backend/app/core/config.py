from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_expiry_minutes: int = 30
    jwt_refresh_expiry_days: int = 7
    blockchain_rpc_url: str
    contract_address: str
    backend_wallet_private_key: str
    cors_allowed_origin: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()