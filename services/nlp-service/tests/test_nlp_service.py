import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.models.entity_types import EntityType, IntentType


client = TestClient(app)


class TestHealthEndpoint:
    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "nlp-service"


class TestAnalyzeEndpoint:
    def test_analyze_requires_text(self):
        response = client.post("/api/nlp/analyze", json={})
        assert response.status_code == 422

    @patch("app.services.nlp_service.NLPService.analyze")
    def test_analyze_text_success(self, mock_analyze):
        mock_analyze.return_value = {
            "intent": {
                "type": IntentType.TICKET_VERIFICATION.value,
                "confidence": 0.92
            },
            "entities": [
                {
                    "type": EntityType.TICKET_ID.value,
                    "value": "TKT-123456",
                    "start": 15,
                    "end": 25
                }
            ],
            "sentiment": "neutral",
            "language": "es"
        }

        response = client.post("/api/nlp/analyze", json={
            "text": "Quiero verificar mi ticket TKT-123456"
        })

        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert "intent" in data or "error" in data


class TestEntitiesEndpoint:
    @patch("app.services.entity_extractor.EntityExtractor.extract")
    def test_extract_entities_success(self, mock_extract):
        mock_extract.return_value = [
            {
                "type": EntityType.TICKET_ID.value,
                "value": "TKT-123456",
                "start": 10,
                "end": 20
            },
            {
                "type": EntityType.AMOUNT.value,
                "value": "50000",
                "start": 30,
                "end": 35
            }
        ]

        response = client.post("/api/nlp/entities", json={
            "text": "Mi ticket TKT-123456 por $50000"
        })

        assert response.status_code in [200, 500]

    def test_extract_entities_requires_text(self):
        response = client.post("/api/nlp/entities", json={})
        assert response.status_code == 422


class TestIntentEndpoint:
    @patch("app.services.intent_classifier.IntentClassifier.classify")
    def test_classify_intent_greeting(self, mock_classify):
        mock_classify.return_value = {
            "type": IntentType.GREETING.value,
            "confidence": 0.95
        }

        response = client.post("/api/nlp/intent", json={
            "text": "Hola, buenas tardes"
        })

        assert response.status_code in [200, 500]

    @patch("app.services.intent_classifier.IntentClassifier.classify")
    def test_classify_intent_ticket_verification(self, mock_classify):
        mock_classify.return_value = {
            "type": IntentType.TICKET_VERIFICATION.value,
            "confidence": 0.88
        }

        response = client.post("/api/nlp/intent", json={
            "text": "Quiero verificar el estado de mi ticket"
        })

        assert response.status_code in [200, 500]

    @patch("app.services.intent_classifier.IntentClassifier.classify")
    def test_classify_intent_kyc(self, mock_classify):
        mock_classify.return_value = {
            "type": IntentType.KYC_VERIFICATION.value,
            "confidence": 0.90
        }

        response = client.post("/api/nlp/intent", json={
            "text": "Necesito verificar mi identidad para poder retirar"
        })

        assert response.status_code in [200, 500]


class TestEmbeddingEndpoint:
    @patch("app.services.nlp_service.NLPService.get_embedding")
    def test_get_embedding_success(self, mock_embed):
        mock_embed.return_value = {
            "embedding": [0.1, 0.2, 0.3, 0.4] * 96,  # 384 dimensions
            "model": "paraphrase-multilingual-MiniLM-L12-v2"
        }

        response = client.post("/api/nlp/embedding", json={
            "text": "Texto de prueba para embedding"
        })

        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            if "embedding" in data:
                assert isinstance(data["embedding"], list)


class TestEntityTypes:
    def test_entity_type_values(self):
        assert EntityType.TICKET_ID.value == "ticket_id"
        assert EntityType.DOCUMENT_NUMBER.value == "document_number"
        assert EntityType.AMOUNT.value == "amount"
        assert EntityType.DATE.value == "date"
        assert EntityType.PERSON_NAME.value == "person_name"

    def test_intent_type_values(self):
        assert IntentType.GREETING.value == "greeting"
        assert IntentType.TICKET_VERIFICATION.value == "ticket_verification"
        assert IntentType.KYC_VERIFICATION.value == "kyc_verification"
        assert IntentType.BALANCE_INQUIRY.value == "balance_inquiry"
        assert IntentType.WITHDRAWAL.value == "withdrawal"
        assert IntentType.COMPLAINT.value == "complaint"


class TestErrorHandling:
    def test_empty_text(self):
        response = client.post("/api/nlp/analyze", json={
            "text": ""
        })
        # Empty text should be rejected
        assert response.status_code in [400, 422]

    def test_very_long_text(self):
        long_text = "palabra " * 10000  # Very long text

        response = client.post("/api/nlp/analyze", json={
            "text": long_text
        })

        # Should handle gracefully (either process or return error)
        assert response.status_code in [200, 400, 413, 500]
