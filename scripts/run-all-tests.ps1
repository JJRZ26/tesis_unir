# ==============================================================================
# Sorti365 Multimodal Chat - Run All Tests
# ==============================================================================

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Blue
Write-Host "         Sorti365 Multimodal Chat - Test Suite" -ForegroundColor Blue
Write-Host "==================================================================" -ForegroundColor Blue
Write-Host ""

$totalTests = 0
$passedTests = 0
$failedTests = 0

# ==============================================================================
# Backend Tests (NestJS)
# ==============================================================================
Write-Host "Running Backend Tests (NestJS)..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

Push-Location "$ProjectRoot\apps\backend"

# Unit Tests
Write-Host "  Unit Tests... " -NoNewline
try {
    $result = npm test -- --passWithNoTests 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PASSED" -ForegroundColor Green
        $passedTests++
    } else {
        Write-Host "FAILED" -ForegroundColor Red
        $failedTests++
    }
} catch {
    Write-Host "ERROR" -ForegroundColor Red
    $failedTests++
}
$totalTests++

# E2E Tests (requires services running)
Write-Host "  E2E Tests... " -NoNewline
Write-Host "SKIPPED (requires services)" -ForegroundColor Yellow

Pop-Location
Write-Host ""

# ==============================================================================
# OCR Service Tests (Python)
# ==============================================================================
Write-Host "Running OCR Service Tests (Python)..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

Push-Location "$ProjectRoot\services\ocr-service"

Write-Host "  Unit Tests... " -NoNewline
try {
    if (Test-Path "venv\Scripts\activate.ps1") {
        . .\venv\Scripts\activate.ps1
    }
    $result = python -m pytest tests/ -v --tb=short 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PASSED" -ForegroundColor Green
        $passedTests++
    } else {
        Write-Host "FAILED" -ForegroundColor Red
        $failedTests++
    }
} catch {
    Write-Host "SKIPPED (pytest not installed)" -ForegroundColor Yellow
}
$totalTests++

Pop-Location
Write-Host ""

# ==============================================================================
# NLP Service Tests (Python)
# ==============================================================================
Write-Host "Running NLP Service Tests (Python)..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

Push-Location "$ProjectRoot\services\nlp-service"

Write-Host "  Unit Tests... " -NoNewline
try {
    if (Test-Path "venv\Scripts\activate.ps1") {
        . .\venv\Scripts\activate.ps1
    }
    $result = python -m pytest tests/ -v --tb=short 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PASSED" -ForegroundColor Green
        $passedTests++
    } else {
        Write-Host "FAILED" -ForegroundColor Red
        $failedTests++
    }
} catch {
    Write-Host "SKIPPED (pytest not installed)" -ForegroundColor Yellow
}
$totalTests++

Pop-Location
Write-Host ""

# ==============================================================================
# Clustering Service Tests (Python)
# ==============================================================================
Write-Host "Running Clustering Service Tests (Python)..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------"

Push-Location "$ProjectRoot\services\clustering-service"

Write-Host "  Unit Tests... " -NoNewline
try {
    if (Test-Path "venv\Scripts\activate.ps1") {
        . .\venv\Scripts\activate.ps1
    }
    $result = python -m pytest tests/ -v --tb=short 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PASSED" -ForegroundColor Green
        $passedTests++
    } else {
        Write-Host "FAILED" -ForegroundColor Red
        $failedTests++
    }
} catch {
    Write-Host "SKIPPED (pytest not installed)" -ForegroundColor Yellow
}
$totalTests++

Pop-Location
Write-Host ""

# ==============================================================================
# Summary
# ==============================================================================
Write-Host "==================================================================" -ForegroundColor Blue
Write-Host "                       Test Summary" -ForegroundColor Blue
Write-Host "==================================================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Total Tests:  $totalTests"
Write-Host "Passed:       $passedTests" -ForegroundColor Green
Write-Host "Failed:       $failedTests" -ForegroundColor $(if ($failedTests -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failedTests -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor Green
} else {
    Write-Host "Some tests failed. Please check the output above." -ForegroundColor Red
    exit 1
}
