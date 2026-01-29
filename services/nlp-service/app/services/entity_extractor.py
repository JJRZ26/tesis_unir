import spacy
import re
import logging
from typing import Optional
from ..models import EntityType, ExtractedEntity
from ..config import get_settings

logger = logging.getLogger(__name__)


class EntityExtractor:
    """Extract entities from text using spaCy and custom patterns."""

    def __init__(self, nlp: Optional[spacy.Language] = None):
        self.settings = get_settings()

        if nlp:
            self.nlp = nlp
        else:
            try:
                self.nlp = spacy.load(self.settings.spacy_model)
                logger.info(f"Loaded spaCy model: {self.settings.spacy_model}")
            except OSError:
                logger.warning(f"Model {self.settings.spacy_model} not found. Using blank model.")
                self.nlp = spacy.blank("es")

        # Custom patterns for domain-specific entities
        self.patterns = {
            EntityType.TICKET_ID: [
                r"(?:ticket|boleto|comprobante|no\.?|#|id)\s*:?\s*(\d{6,})",
                r"^(\d{8,})$",
            ],
            EntityType.DOCUMENT_NUMBER: [
                r"(?:cedula|c\.?c\.?|documento|dni)\s*:?\s*#?\s*([\d\.-]+)",
                r"(?:numero|no\.?)\s*:?\s*([\d]{6,12})",
            ],
            EntityType.MONEY: [
                r"\$\s*([\d,]+\.?\d*)",
                r"([\d,]+\.?\d*)\s*(?:USD|COP|MXN|PEN|pesos|dolares)",
            ],
            EntityType.PHONE: [
                r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}",
            ],
            EntityType.EMAIL: [
                r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
            ],
            EntityType.DATE: [
                r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
                r"(\d{4}[/-]\d{1,2}[/-]\d{1,2})",
            ],
        }

        # Sports and teams keywords
        self.sports_keywords = [
            "futbol", "fútbol", "soccer", "baloncesto", "basketball", "tenis",
            "beisbol", "béisbol", "baseball", "boxeo", "mma", "ufc",
        ]
        self.team_patterns = [
            r"(?:vs\.?|versus|contra)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)",
            r"([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)\s+(?:vs\.?|versus|contra)",
        ]

    def extract_entities(self, text: str) -> list[ExtractedEntity]:
        """Extract all entities from text."""
        entities = []

        # Extract using custom patterns
        entities.extend(self._extract_with_patterns(text))

        # Extract using spaCy NER
        entities.extend(self._extract_with_spacy(text))

        # Extract sports/teams
        entities.extend(self._extract_sports_entities(text))

        # Deduplicate entities
        entities = self._deduplicate_entities(entities)

        return entities

    def _extract_with_patterns(self, text: str) -> list[ExtractedEntity]:
        """Extract entities using regex patterns."""
        entities = []

        for entity_type, patterns in self.patterns.items():
            for pattern in patterns:
                for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
                    value = match.group(1) if match.groups() else match.group(0)
                    entities.append(
                        ExtractedEntity(
                            type=entity_type,
                            value=value,
                            confidence=0.85,
                            start_pos=match.start(),
                            end_pos=match.end(),
                            normalized_value=self._normalize_value(entity_type, value),
                        )
                    )

        return entities

    def _extract_with_spacy(self, text: str) -> list[ExtractedEntity]:
        """Extract entities using spaCy NER."""
        entities = []
        doc = self.nlp(text)

        # Map spaCy labels to our entity types
        label_mapping = {
            "PER": EntityType.PERSON_NAME,
            "PERSON": EntityType.PERSON_NAME,
            "DATE": EntityType.DATE,
            "MONEY": EntityType.MONEY,
            "ORG": EntityType.TEAM,
            "GPE": EntityType.UNKNOWN,
            "LOC": EntityType.UNKNOWN,
        }

        for ent in doc.ents:
            entity_type = label_mapping.get(ent.label_, EntityType.UNKNOWN)
            if entity_type != EntityType.UNKNOWN:
                entities.append(
                    ExtractedEntity(
                        type=entity_type,
                        value=ent.text,
                        confidence=0.75,
                        start_pos=ent.start_char,
                        end_pos=ent.end_char,
                    )
                )

        return entities

    def _extract_sports_entities(self, text: str) -> list[ExtractedEntity]:
        """Extract sports and team entities."""
        entities = []
        text_lower = text.lower()

        # Check for sports
        for sport in self.sports_keywords:
            if sport in text_lower:
                idx = text_lower.index(sport)
                entities.append(
                    ExtractedEntity(
                        type=EntityType.SPORT,
                        value=sport,
                        confidence=0.9,
                        start_pos=idx,
                        end_pos=idx + len(sport),
                    )
                )

        # Check for teams (vs patterns)
        for pattern in self.team_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                team = match.group(1).strip()
                if len(team) > 2:  # Filter out very short matches
                    entities.append(
                        ExtractedEntity(
                            type=EntityType.TEAM,
                            value=team,
                            confidence=0.7,
                            start_pos=match.start(),
                            end_pos=match.end(),
                        )
                    )

        return entities

    def _normalize_value(self, entity_type: EntityType, value: str) -> str:
        """Normalize extracted value based on entity type."""
        if entity_type == EntityType.DOCUMENT_NUMBER:
            return re.sub(r"[^\d]", "", value)
        elif entity_type == EntityType.TICKET_ID:
            return re.sub(r"[^\d]", "", value)
        elif entity_type == EntityType.MONEY:
            return value.replace(",", "").strip()
        elif entity_type == EntityType.PHONE:
            return re.sub(r"[^\d+]", "", value)
        return value

    def _deduplicate_entities(
        self, entities: list[ExtractedEntity]
    ) -> list[ExtractedEntity]:
        """Remove duplicate entities, keeping highest confidence."""
        seen = {}
        for entity in entities:
            key = (entity.type, entity.value)
            if key not in seen or entity.confidence > seen[key].confidence:
                seen[key] = entity
        return list(seen.values())
