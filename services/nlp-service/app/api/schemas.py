from pydantic import BaseModel, Field
from typing import Optional
from ..models import EntityType, IntentType


class TextInput(BaseModel):
    """Input text for NLP processing."""
    text: str = Field(..., min_length=1, max_length=10000)


class EntityResponse(BaseModel):
    """Extracted entity response."""
    type: EntityType
    value: str
    confidence: float
    start_pos: Optional[int] = None
    end_pos: Optional[int] = None
    normalized_value: Optional[str] = None


class IntentResponse(BaseModel):
    """Intent classification response."""
    type: str
    confidence: float


class AnalysisResponse(BaseModel):
    """Full NLP analysis response."""
    text: str
    entities: list[EntityResponse]
    intent: IntentResponse
    alternative_intents: list[IntentResponse]
    word_count: int
    char_count: int


class EntitiesResponse(BaseModel):
    """Entity extraction only response."""
    text: str
    entities: list[EntityResponse]


class IntentClassificationResponse(BaseModel):
    """Intent classification only response."""
    text: str
    intent: IntentResponse
    alternatives: list[IntentResponse]


class EmbeddingResponse(BaseModel):
    """Text embedding response."""
    text: str
    embedding: list[float]
    dimensions: int


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str
    spacy_model: str
    spacy_loaded: bool
    embedding_model: str
    embedding_loaded: bool
