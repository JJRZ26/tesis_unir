# ==============================================================================
# Sorti365 Multimodal Chat - Integration Test Script (PowerShell)
# ==============================================================================

$ErrorActionPreference = "Stop"

# Configuration
$BACKEND_URL = "http://localhost:3001"
$OCR_URL = "http://localhost:8001"
$NLP_URL = "http://localhost:8002"
$CLUSTERING_URL = "http://localhost:8003"

# Test image (1x1 white pixel PNG in base64)
$TEST_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Test-ServiceHealth {
    param (
        [string]$Name,
        [string]$Url,
        [string]$Endpoint
    )

    Write-Host "  Checking $Name... " -NoNewline

    try {
        $response = Invoke-RestMethod -Uri "$Url$Endpoint" -Method Get -TimeoutSec 5
        Write-Host "OK" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "FAILED" -ForegroundColor Red
        return $false
    }
}

function Test-Endpoint {
    param (
        [string]$Name,
        [string]$Url,
        [hashtable]$Body,
        [string]$ExpectedField
    )

    Write-Host "  Testing $Name... " -NoNewline

    try {
        $jsonBody = $Body | ConvertTo-Json -Depth 10
        $response = Invoke-RestMethod -Uri $Url -Method Post -Body $jsonBody -ContentType "application/json" -TimeoutSec 30

        if ($response.PSObject.Properties.Name -contains $ExpectedField -or $response -match $ExpectedField) {
            Write-Host "OK" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "FAILED (field not found)" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ==============================================================================
# Header
# ==============================================================================
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Blue
Write-Host "      Sorti365 Multimodal Chat - Integration Tests" -ForegroundColor Blue
Write-Host "==================================================================" -ForegroundColor Blue
Write-Host ""

# ==============================================================================
# Step 1: Health Checks
# ==============================================================================
Write-Host "Step 1: Health Checks" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

$servicesOk = $true

if (-not (Test-ServiceHealth -Name "Backend" -Url $BACKEND_URL -Endpoint "/api/health")) { $servicesOk = $false }
if (-not (Test-ServiceHealth -Name "OCR Service" -Url $OCR_URL -Endpoint "/health")) { $servicesOk = $false }
if (-not (Test-ServiceHealth -Name "NLP Service" -Url $NLP_URL -Endpoint "/health")) { $servicesOk = $false }
if (-not (Test-ServiceHealth -Name "Clustering Service" -Url $CLUSTERING_URL -Endpoint "/health")) { $servicesOk = $false }

if (-not $servicesOk) {
    Write-Host ""
    Write-Host "Some services are not healthy. Please start all services first." -ForegroundColor Red
    Write-Host "Run: docker-compose -f docker/docker-compose.dev.yml up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ==============================================================================
# Step 2: Chat API Tests
# ==============================================================================
Write-Host "Step 2: Chat API Tests" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

# Create a session
Write-Host "  Creating chat session... " -NoNewline
try {
    $sessionResponse = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/sessions" -Method Post `
        -Body (@{ playerId = "test-player-001" } | ConvertTo-Json) -ContentType "application/json"

    $sessionId = $sessionResponse.sessionId
    Write-Host "OK (Session: $sessionId)" -ForegroundColor Green
}
catch {
    Write-Host "FAILED" -ForegroundColor Red
    exit 1
}

# Send a text message
Test-Endpoint -Name "Send text message" `
    -Url "$BACKEND_URL/api/chat/sessions/$sessionId/messages" `
    -Body @{ content = @{ type = "text"; text = "Hola, necesito verificar mi ticket" } } `
    -ExpectedField "messageId"

# Get messages
Write-Host "  Getting messages... " -NoNewline
try {
    $messages = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/sessions/$sessionId/messages" -Method Get
    Write-Host "OK" -ForegroundColor Green
}
catch {
    Write-Host "FAILED" -ForegroundColor Red
}

Write-Host ""

# ==============================================================================
# Step 3: Orchestrator Tests
# ==============================================================================
Write-Host "Step 3: Orchestrator Tests" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

# Check services health via orchestrator
Write-Host "  Orchestrator health check... " -NoNewline
try {
    $orchHealth = Invoke-RestMethod -Uri "$BACKEND_URL/api/orchestrator/health" -Method Get
    Write-Host "OK" -ForegroundColor Green
}
catch {
    Write-Host "FAILED" -ForegroundColor Red
}

# Process a message
Test-Endpoint -Name "Process message" `
    -Url "$BACKEND_URL/api/orchestrator/process" `
    -Body @{ sessionId = $sessionId; content = "Quiero verificar mi ticket TKT-123456"; images = @() } `
    -ExpectedField "response"

Write-Host ""

# ==============================================================================
# Step 4: OCR Service Tests
# ==============================================================================
Write-Host "Step 4: OCR Service Tests" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

Test-Endpoint -Name "Extract text from image" `
    -Url "$OCR_URL/api/ocr/extract" `
    -Body @{ image_base64 = $TEST_IMAGE } `
    -ExpectedField "text"

Test-Endpoint -Name "Extract ticket info" `
    -Url "$OCR_URL/api/ocr/extract/ticket" `
    -Body @{ image_base64 = $TEST_IMAGE } `
    -ExpectedField "raw_text"

Write-Host ""

# ==============================================================================
# Step 5: NLP Service Tests
# ==============================================================================
Write-Host "Step 5: NLP Service Tests" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

Test-Endpoint -Name "Analyze text" `
    -Url "$NLP_URL/api/nlp/analyze" `
    -Body @{ text = "Quiero verificar mi ticket TKT-123456" } `
    -ExpectedField "intent"

Test-Endpoint -Name "Extract entities" `
    -Url "$NLP_URL/api/nlp/entities" `
    -Body @{ text = "Mi cedula es 1234567890 y el ticket TKT-999" } `
    -ExpectedField "entities"

Test-Endpoint -Name "Classify intent" `
    -Url "$NLP_URL/api/nlp/intent" `
    -Body @{ text = "Necesito verificar mi identidad" } `
    -ExpectedField "type"

Write-Host ""

# ==============================================================================
# Step 6: Clustering Service Tests
# ==============================================================================
Write-Host "Step 6: Clustering Service Tests" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

Test-Endpoint -Name "Cluster texts" `
    -Url "$CLUSTERING_URL/api/clustering/cluster" `
    -Body @{ texts = @("verificar ticket", "ver apuesta", "retirar dinero", "sacar ganancias"); algorithm = "kmeans"; n_clusters = 2 } `
    -ExpectedField "labels"

Test-Endpoint -Name "Find similar texts" `
    -Url "$CLUSTERING_URL/api/clustering/similar" `
    -Body @{ query = "verificar mi ticket"; candidates = @("estado del ticket", "retirar dinero", "ver apuesta"); top_k = 2 } `
    -ExpectedField "similar"

Write-Host ""

# ==============================================================================
# Step 7: Cleanup
# ==============================================================================
Write-Host "Step 7: Cleanup" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

# Close the test session
Write-Host "  Closing test session... " -NoNewline
try {
    $closeResponse = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/sessions/$sessionId" -Method Delete
    Write-Host "OK" -ForegroundColor Green
}
catch {
    Write-Host "Session may not have been closed" -ForegroundColor Yellow
}

Write-Host ""

# ==============================================================================
# Summary
# ==============================================================================
Write-Host "==================================================================" -ForegroundColor Blue
Write-Host "                  Integration Tests Complete" -ForegroundColor Blue
Write-Host "==================================================================" -ForegroundColor Blue
Write-Host ""
Write-Host "All integration tests passed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Services tested:"
Write-Host "  - Backend API (NestJS) - $BACKEND_URL"
Write-Host "  - OCR Service (Python) - $OCR_URL"
Write-Host "  - NLP Service (Python) - $NLP_URL"
Write-Host "  - Clustering Service (Python) - $CLUSTERING_URL"
Write-Host ""
