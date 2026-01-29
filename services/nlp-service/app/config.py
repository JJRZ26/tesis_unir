from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "NLP Service"
    app_version: str = "1.0.0"
    debug: bool = False

    # spaCy model
    spacy_model: str = "es_core_news_md"

    # Sentence Transformers model (multilingual)
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"

    # Processing settings
    max_text_length: int = 10000

    class Config:
        env_file = ".env"
        env_prefix = "NLP_"


@lru_cache
def get_settings() -> Settings:
    return Settings()
