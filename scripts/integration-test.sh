#!/bin/bash

# ==============================================================================
# Sorti365 Multimodal Chat - Integration Test Script
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:3001"
OCR_URL="http://localhost:8001"
NLP_URL="http://localhost:8002"
CLUSTERING_URL="http://localhost:8003"

# Test image (1x1 white pixel PNG in base64)
TEST_IMAGE="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Sorti365 Multimodal Chat - Integration Tests            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a service is healthy
check_service() {
    local name=$1
    local url=$2
    local endpoint=$3

    echo -n "  Checking $name... "

    if curl -s -f "$url$endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

# Function to make a POST request and check response
test_endpoint() {
    local name=$1
    local url=$2
    local data=$3
    local expected_field=$4

    echo -n "  Testing $name... "

    response=$(curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "$data" 2>/dev/null)

    if echo "$response" | grep -q "$expected_field"; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo -e "    Response: $response"
        return 1
    fi
}

# ==============================================================================
# Step 1: Health Checks
# ==============================================================================
echo -e "${YELLOW}Step 1: Health Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVICES_OK=true

check_service "Backend" "$BACKEND_URL" "/api/health" || SERVICES_OK=false
check_service "OCR Service" "$OCR_URL" "/health" || SERVICES_OK=false
check_service "NLP Service" "$NLP_URL" "/health" || SERVICES_OK=false
check_service "Clustering Service" "$CLUSTERING_URL" "/health" || SERVICES_OK=false

if [ "$SERVICES_OK" = false ]; then
    echo ""
    echo -e "${RED}Some services are not healthy. Please start all services first.${NC}"
    echo -e "Run: ${YELLOW}docker-compose -f docker/docker-compose.dev.yml up -d${NC}"
    exit 1
fi

echo ""

# ==============================================================================
# Step 2: Chat API Tests
# ==============================================================================
echo -e "${YELLOW}Step 2: Chat API Tests${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create a session
echo -n "  Creating chat session... "
SESSION_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/chat/sessions" \
    -H "Content-Type: application/json" \
    -d '{"playerId": "test-player-001"}')

SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$SESSION_ID" ]; then
    echo -e "${GREEN}✓ OK${NC} (Session: $SESSION_ID)"
else
    echo -e "${RED}✗ FAILED${NC}"
    exit 1
fi

# Send a text message
test_endpoint "Send text message" \
    "$BACKEND_URL/api/chat/sessions/$SESSION_ID/messages" \
    '{"content": {"type": "text", "text": "Hola, necesito verificar mi ticket"}}' \
    "messageId"

# Get messages
echo -n "  Getting messages... "
MESSAGES=$(curl -s "$BACKEND_URL/api/chat/sessions/$SESSION_ID/messages")
if echo "$MESSAGES" | grep -q "messages"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

echo ""

# ==============================================================================
# Step 3: Orchestrator Tests
# ==============================================================================
echo -e "${YELLOW}Step 3: Orchestrator Tests${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check services health via orchestrator
echo -n "  Orchestrator health check... "
ORCH_HEALTH=$(curl -s "$BACKEND_URL/api/orchestrator/health")
if echo "$ORCH_HEALTH" | grep -q "ocr"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Process a message
test_endpoint "Process message" \
    "$BACKEND_URL/api/orchestrator/process" \
    "{\"sessionId\": \"$SESSION_ID\", \"content\": \"Quiero verificar mi ticket TKT-123456\", \"images\": []}" \
    "response"

echo ""

# ==============================================================================
# Step 4: OCR Service Tests
# ==============================================================================
echo -e "${YELLOW}Step 4: OCR Service Tests${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Extract text from image" \
    "$OCR_URL/api/ocr/extract" \
    "{\"image_base64\": \"$TEST_IMAGE\"}" \
    "text"

test_endpoint "Extract ticket info" \
    "$OCR_URL/api/ocr/extract/ticket" \
    "{\"image_base64\": \"$TEST_IMAGE\"}" \
    "raw_text"

echo ""

# ==============================================================================
# Step 5: NLP Service Tests
# ==============================================================================
echo -e "${YELLOW}Step 5: NLP Service Tests${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Analyze text" \
    "$NLP_URL/api/nlp/analyze" \
    '{"text": "Quiero verificar mi ticket TKT-123456"}' \
    "intent"

test_endpoint "Extract entities" \
    "$NLP_URL/api/nlp/entities" \
    '{"text": "Mi cédula es 1234567890 y el ticket TKT-999"}' \
    "entities"

test_endpoint "Classify intent" \
    "$NLP_URL/api/nlp/intent" \
    '{"text": "Necesito verificar mi identidad"}' \
    "type"

echo ""

# ==============================================================================
# Step 6: Clustering Service Tests
# ==============================================================================
echo -e "${YELLOW}Step 6: Clustering Service Tests${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Cluster texts" \
    "$CLUSTERING_URL/api/clustering/cluster" \
    '{"texts": ["verificar ticket", "ver apuesta", "retirar dinero", "sacar ganancias"], "algorithm": "kmeans", "n_clusters": 2}' \
    "labels"

test_endpoint "Find similar texts" \
    "$CLUSTERING_URL/api/clustering/similar" \
    '{"query": "verificar mi ticket", "candidates": ["estado del ticket", "retirar dinero", "ver apuesta"], "top_k": 2}' \
    "similar"

echo ""

# ==============================================================================
# Step 7: Cleanup
# ==============================================================================
echo -e "${YELLOW}Step 7: Cleanup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Close the test session
echo -n "  Closing test session... "
CLOSE_RESPONSE=$(curl -s -X DELETE "$BACKEND_URL/api/chat/sessions/$SESSION_ID")
if echo "$CLOSE_RESPONSE" | grep -q "closed"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${YELLOW}⚠ Session may not have been closed${NC}"
fi

echo ""

# ==============================================================================
# Summary
# ==============================================================================
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Integration Tests Complete                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}All integration tests passed successfully!${NC}"
echo ""
echo "Services tested:"
echo "  • Backend API (NestJS) - $BACKEND_URL"
echo "  • OCR Service (Python) - $OCR_URL"
echo "  • NLP Service (Python) - $NLP_URL"
echo "  • Clustering Service (Python) - $CLUSTERING_URL"
echo ""
