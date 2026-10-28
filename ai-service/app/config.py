"""
Configuration module for the AI service.
Reads environment variables with sensible defaults for Mock and OpenRouter free models.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    port: int = 8000
    ai_provider: str = "mock"  # "mock" or "openrouter" or "free_tier"
    ai_model: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    ai_api_key: str = ""
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_site_url: str = "http://localhost:3000"
    openrouter_app_name: str = "CaseMind"
    ai_request_timeout_seconds: int = 15

    @property
    def effective_api_key(self) -> str:
        """Returns the configured API key for OpenRouter."""
        return self.openrouter_api_key or self.ai_api_key

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
