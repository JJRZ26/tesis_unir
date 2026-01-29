import logging
from typing import Optional
from sentence_transformers import SentenceTransformer
import numpy as np
from ..models import IntentType
from ..config import get_settings

logger = logging.getLogger(__name__)


class IntentClassifier:
    """Classify user intent using semantic similarity with Sentence-BERT."""

    def __init__(self, model: Optional[SentenceTransformer] = None):
        self.settings = get_settings()

        if model:
            self.model = model
        else:
            try:
                self.model = SentenceTransformer(self.settings.embedding_model)
                logger.info(f"Loaded embedding model: {self.settings.embedding_model}")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {str(e)}")
                self.model = None

        # Intent examples for similarity matching
        self.intent_examples = {
            IntentType.TICKET_VERIFICATION: [
                "quiero verificar mi ticket",
                "consultar estado de mi apuesta",
                "revisar mi boleto",
                "ver resultado de mi ticket",
                "mi ticket ganó",
                "verificar comprobante de apuesta",
                "estado de mi jugada",
                "como va mi apuesta",
            ],
            IntentType.KYC_START: [
                "quiero verificar mi identidad",
                "como verifico mi cuenta",
                "necesito verificar mi documento",
                "proceso de verificación",
                "validar mi cedula",
                "subir documentos de identidad",
                "verificación KYC",
            ],
            IntentType.KYC_UPLOAD: [
                "aquí está mi cédula",
                "envío mi documento",
                "adjunto mi identificación",
                "foto de mi cedula",
                "selfie con documento",
                "imagen de mi ID",
            ],
            IntentType.ACCOUNT_QUERY: [
                "cual es mi saldo",
                "ver mi balance",
                "estado de mi cuenta",
                "mis datos de cuenta",
                "información de mi perfil",
                "cambiar contraseña",
                "actualizar datos",
            ],
            IntentType.BET_HISTORY: [
                "historial de apuestas",
                "mis apuestas anteriores",
                "ver jugadas pasadas",
                "registro de mis tickets",
                "cuanto he apostado",
                "mis ultimas apuestas",
            ],
            IntentType.COMPLAINT: [
                "quiero hacer un reclamo",
                "tengo un problema",
                "no funciona",
                "error en mi cuenta",
                "me cobraron mal",
                "no me pagaron",
                "queja",
                "esto está mal",
            ],
            IntentType.GENERAL_QUESTION: [
                "tengo una pregunta",
                "como funciona",
                "que es",
                "pueden ayudarme",
                "necesito información",
                "donde puedo ver",
                "como hago para",
            ],
            IntentType.GREETING: [
                "hola",
                "buenos días",
                "buenas tardes",
                "buenas noches",
                "que tal",
                "hey",
                "saludos",
            ],
            IntentType.FAREWELL: [
                "adiós",
                "hasta luego",
                "chao",
                "gracias por todo",
                "nos vemos",
                "bye",
                "hasta pronto",
            ],
        }

        # Pre-compute embeddings for intent examples
        self.intent_embeddings = {}
        if self.model:
            self._precompute_embeddings()

    def _precompute_embeddings(self):
        """Pre-compute embeddings for all intent examples."""
        for intent, examples in self.intent_examples.items():
            embeddings = self.model.encode(examples)
            self.intent_embeddings[intent] = embeddings
            logger.debug(f"Computed embeddings for intent: {intent}")

    def classify(self, text: str) -> tuple[IntentType, float]:
        """
        Classify the intent of the input text.

        Returns:
            Tuple of (IntentType, confidence_score)
        """
        if not self.model:
            return IntentType.UNKNOWN, 0.0

        # Get embedding for input text
        text_embedding = self.model.encode([text])[0]

        best_intent = IntentType.UNKNOWN
        best_score = 0.0

        # Compare with each intent's examples
        for intent, embeddings in self.intent_embeddings.items():
            # Calculate cosine similarity with all examples
            similarities = self._cosine_similarity(text_embedding, embeddings)
            max_similarity = float(np.max(similarities))

            if max_similarity > best_score:
                best_score = max_similarity
                best_intent = intent

        # Apply threshold
        if best_score < 0.5:
            return IntentType.UNKNOWN, best_score

        return best_intent, best_score

    def classify_with_alternatives(
        self, text: str, top_k: int = 3
    ) -> list[tuple[IntentType, float]]:
        """
        Classify intent and return top-k alternatives.

        Returns:
            List of (IntentType, confidence_score) tuples
        """
        if not self.model:
            return [(IntentType.UNKNOWN, 0.0)]

        text_embedding = self.model.encode([text])[0]

        scores = []
        for intent, embeddings in self.intent_embeddings.items():
            similarities = self._cosine_similarity(text_embedding, embeddings)
            max_similarity = float(np.max(similarities))
            scores.append((intent, max_similarity))

        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)

        return scores[:top_k]

    def _cosine_similarity(
        self, vec1: np.ndarray, vec2: np.ndarray
    ) -> np.ndarray:
        """Calculate cosine similarity between vec1 and all vectors in vec2."""
        # Normalize vectors
        vec1_norm = vec1 / np.linalg.norm(vec1)

        if len(vec2.shape) == 1:
            vec2_norm = vec2 / np.linalg.norm(vec2)
        else:
            vec2_norm = vec2 / np.linalg.norm(vec2, axis=1, keepdims=True)

        return np.dot(vec2_norm, vec1_norm)

    def get_embedding(self, text: str) -> Optional[list[float]]:
        """Get embedding vector for text."""
        if not self.model:
            return None
        return self.model.encode([text])[0].tolist()
