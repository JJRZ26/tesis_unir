from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ImageInput(BaseModel):
    """Input image for OCR processing."""
    base64: Optional[str] = Field(None, description="Base64 encoded image")
    url: Optional[str] = Field(None, description="URL to image")


class ExtractionType(str, Enum):
    """Type of extraction to perform."""
    GENERAL = "general"
    TICKET = "ticket"
    DOCUMENT = "document"


class OCRRequest(BaseModel):
    """Request for OCR processing."""
    image: ImageInput
    extraction_type: ExtractionType = ExtractionType.GENERAL
    language: Optional[str] = Field(None, description="Override default language")


class OCRResponse(BaseModel):
    """Response from OCR processing."""
    success: bool
    text: Optional[str] = None
    confidence: Optional[float] = None
    word_count: Optional[int] = None
    language: Optional[str] = None
    error: Optional[str] = None


class TicketExtractionResponse(BaseModel):
    """Response from ticket extraction."""
    success: bool
    ticket_id: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    date: Optional[str] = None
    events: list[str] = []
    raw_text: Optional[str] = None
    error: Optional[str] = None


class DocumentExtractionResponse(BaseModel):
    """Response from document extraction."""
    success: bool
    document_number: Optional[str] = None
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    expiration_date: Optional[str] = None
    nationality: Optional[str] = None
    raw_text: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str
    tesseract_version: str
