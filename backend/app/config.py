from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    anthropic_api_key: str = Field(default="", env="ANTHROPIC_API_KEY")
    gemini_api_key: str = Field(default="", env="GEMINI_API_KEY")
    database_url: str = Field(
        default="sqlite+aiosqlite:///./nova_writer.db", env="DATABASE_URL"
    )

    # Model assignments per agent (Gemini models)
    agent_models: dict[str, str] = {
        "world_builder": "gemini-3.1-flash-lite-preview",
        "prose_writer": "gemini-3.1-flash-lite-preview",
        "literary_editor": "gemini-3.1-flash-lite-preview",
        "logline_creator": "gemini-3.1-flash-lite-preview",
        "scientific_advisor": "gemini-3.1-flash-lite-preview",
        "persona_creator": "gemini-3.1-flash-lite-preview",
        "chapter_beats_creator": "gemini-3.1-flash-lite-preview",
        "scene_outliner": "gemini-3.1-flash-lite-preview",
        "dialogue_specialist": "gemini-3.1-flash-lite-preview",
        "continuity_editor": "gemini-3.1-flash-lite-preview",
    }

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
