from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Clustering Service"
    app_version: str = "1.0.0"
    debug: bool = False

    # Embedding model for text clustering
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"

    # Default clustering parameters
    default_min_cluster_size: int = 5
    default_min_samples: int = 3
    default_n_clusters: int = 5

    class Config:
        env_file = ".env"
        env_prefix = "CLUSTERING_"


@lru_cache
def get_settings() -> Settings:
    return Settings()
