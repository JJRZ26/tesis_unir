import spacy
import logging
from typing import Optional
from sentence_transformers import SentenceTransformer
from .entity_extractor import EntityExtractor
from .intent_classifier import IntentClassifier
from ..models import IntentType, ExtractedEntity
from ..config import get_settings

logger = logging.getLogger(__name__)


class NLPService:
    """Main NLP service that combines entity extraction and intent classification."""

    def __init__(self):
        self.settings = get_settings()
        self._nlp = None
        self._model = None
        self._entity_extractor = None
        self._intent_classifier = None

    @property
    def nlp(self):
        """Lazy load spaCy model."""
        if self._nlp is None:
            try:
                self._nlp = spacy.load(self.settings.spacy_model)
                logger.info(f"Loaded spaCy model: {self.settings.spacy_model}")
            except OSError:
                logger.warning(
                    f"Model {self.settings.spacy_model} not found. "
                    "Run: python -m spacy download es_core_news_md"
                )
                self._nlp = spacy.blank("es")
        return self._nlp

    @property
    def embedding_model(self):
        """Lazy load sentence transformer model."""
        if self._model is None:
            try:
                self._model = SentenceTransformer(self.settings.embedding_model)
                logger.info(f"Loaded embedding model: {self.settings.embedding_model}")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {str(e)}")
                self._model = None
        return self._model

    @property
    def entity_extractor(self):
        """Lazy load entity extractor."""
        if self._entity_extractor is None:
            self._entity_extractor = EntityExtractor(self.nlp)
        return self._entity_extractor

    @property
    def intent_classifier(self):
        """Lazy load intent classifier."""
        if self._intent_classifier is None:
            self._intent_classifier = IntentClassifier(self.embedding_model)
        return self._intent_classifier

    def analyze(self, text: str) -> dict:
        """
        Perform full NLP analysis on text.

        Returns:
            Dictionary with entities, intent, and metadata
        """
        # Truncate text if too long
        if len(text) > self.settings.max_text_length:
            text = text[: self.settings.max_text_length]

        # Extract entities
        entities = self.entity_extractor.extract_entities(text)

        # Classify intent
        intent, intent_confidence = self.intent_classifier.classify(text)

        # Get alternative intents
        alternatives = self.intent_classifier.classify_with_alternatives(text, top_k=3)

        return {
            "text": text,
            "entities": [e.model_dump() for e in entities],
            "intent": {
                "type": intent.value,
                "confidence": round(intent_confidence, 3),
            },
            "alternative_intents": [
                {"type": i.value, "confidence": round(c, 3)} for i, c in alternatives
            ],
            "word_count": len(text.split()),
            "char_count": len(text),
        }

    def extract_entities(self, text: str) -> list[ExtractedEntity]:
        """Extract entities from text."""
        if len(text) > self.settings.max_text_length:
            text = text[: self.settings.max_text_length]
        return self.entity_extractor.extract_entities(text)

    def classify_intent(self, text: str) -> tuple[IntentType, float]:
        """Classify user intent."""
        if len(text) > self.settings.max_text_length:
            text = text[: self.settings.max_text_length]
        return self.intent_classifier.classify(text)

    def get_embedding(self, text: str) -> Optional[list[float]]:
        """Get embedding vector for text."""
        if len(text) > self.settings.max_text_length:
            text = text[: self.settings.max_text_length]
        return self.intent_classifier.get_embedding(text)

    def get_status(self) -> dict:
        """Get service status."""
        return {
            "spacy_model": self.settings.spacy_model,
            "spacy_loaded": self._nlp is not None,
            "embedding_model": self.settings.embedding_model,
            "embedding_loaded": self._model is not None,
        }
