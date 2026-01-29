from fastapi import APIRouter, HTTPException
import logging
from .schemas import (
    TextInput,
    AnalysisResponse,
    EntitiesResponse,
    IntentClassificationResponse,
    EmbeddingResponse,
    HealthResponse,
    EntityResponse,
    IntentResponse,
)
from ..services import NLPService
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
nlp_service = NLPService()
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    status = nlp_service.get_status()
    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.app_version,
        **status,
    )


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_text(input_data: TextInput):
    """Perform full NLP analysis on text."""
    try:
        result = nlp_service.analyze(input_data.text)

        return AnalysisResponse(
            text=result["text"],
            entities=[EntityResponse(**e) for e in result["entities"]],
            intent=IntentResponse(**result["intent"]),
            alternative_intents=[IntentResponse(**i) for i in result["alternative_intents"]],
            word_count=result["word_count"],
            char_count=result["char_count"],
        )

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/entities", response_model=EntitiesResponse)
async def extract_entities(input_data: TextInput):
    """Extract entities from text."""
    try:
        entities = nlp_service.extract_entities(input_data.text)

        return EntitiesResponse(
            text=input_data.text,
            entities=[
                EntityResponse(
                    type=e.type,
                    value=e.value,
                    confidence=e.confidence,
                    start_pos=e.start_pos,
                    end_pos=e.end_pos,
                    normalized_value=e.normalized_value,
                )
                for e in entities
            ],
        )

    except Exception as e:
        logger.error(f"Entity extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/intent", response_model=IntentClassificationResponse)
async def classify_intent(input_data: TextInput):
    """Classify user intent."""
    try:
        intent, confidence = nlp_service.classify_intent(input_data.text)
        alternatives = nlp_service.intent_classifier.classify_with_alternatives(
            input_data.text, top_k=3
        )

        return IntentClassificationResponse(
            text=input_data.text,
            intent=IntentResponse(type=intent.value, confidence=round(confidence, 3)),
            alternatives=[
                IntentResponse(type=i.value, confidence=round(c, 3))
                for i, c in alternatives
            ],
        )

    except Exception as e:
        logger.error(f"Intent classification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embedding", response_model=EmbeddingResponse)
async def get_embedding(input_data: TextInput):
    """Get embedding vector for text."""
    try:
        embedding = nlp_service.get_embedding(input_data.text)

        if embedding is None:
            raise HTTPException(
                status_code=503,
                detail="Embedding model not available",
            )

        return EmbeddingResponse(
            text=input_data.text,
            embedding=embedding,
            dimensions=len(embedding),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Embedding generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
