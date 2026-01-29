from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "OCR Service"
    app_version: str = "1.0.0"
    debug: bool = False

    # Tesseract configuration
    tesseract_cmd: str | None = None  # Path to tesseract executable if not in PATH
    tesseract_lang: str = "spa+eng"  # Spanish + English

    # Image processing
    max_image_size: int = 10 * 1024 * 1024  # 10MB
    allowed_extensions: list[str] = ["jpg", "jpeg", "png", "bmp", "tiff", "webp"]

    class Config:
        env_file = ".env"
        env_prefix = "OCR_"


@lru_cache
def get_settings() -> Settings:
    return Settings()
