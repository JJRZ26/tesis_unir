from enum import Enum
from pydantic import BaseModel
from typing import Optional


class EntityType(str, Enum):
    """Types of entities that can be extracted."""
    TICKET_ID = "ticket_id"
    DOCUMENT_NUMBER = "document_number"
    PERSON_NAME = "person_name"
    DATE = "date"
    MONEY = "money"
    EVENT = "event"
    TEAM = "team"
    SPORT = "sport"
    PHONE = "phone"
    EMAIL = "email"
    UNKNOWN = "unknown"


class IntentType(str, Enum):
    """Types of user intents."""
    TICKET_VERIFICATION = "ticket_verification"
    KYC_START = "kyc_start"
    KYC_UPLOAD = "kyc_upload"
    ACCOUNT_QUERY = "account_query"
    BET_HISTORY = "bet_history"
    COMPLAINT = "complaint"
    GENERAL_QUESTION = "general_question"
    GREETING = "greeting"
    FAREWELL = "farewell"
    UNKNOWN = "unknown"


class ExtractedEntity(BaseModel):
    """Represents an extracted entity from text."""
    type: EntityType
    value: str
    confidence: float
    start_pos: Optional[int] = None
    end_pos: Optional[int] = None
    normalized_value: Optional[str] = None
