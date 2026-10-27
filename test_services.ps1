# Test script for CaseMind Backend (3000) & AI Service (8000)
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " CaseMind Backend (3000) & AI Service (8000)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Test Backend Health (Port 3000)
Write-Host "`n[1] Checking Backend Health (http://localhost:3000/api/v1/health)..." -ForegroundColor Yellow
try {
    $backendRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/health" -Method Get -TimeoutSec 3
    Write-Host "Backend Health: OK -> " -ForegroundColor Green -NoNewline
    Write-Host ($backendRes | ConvertTo-Json -Compress)
} catch {
    Write-Host "Backend is not running on port 3000: $_" -ForegroundColor Red
}

# 2. Test AI Service Health (Port 8000)
Write-Host "`n[2] Checking AI Service Health (http://localhost:8000/health)..." -ForegroundColor Yellow
try {
    $aiHealth = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 3
    Write-Host "AI Service Health: OK -> " -ForegroundColor Green -NoNewline
    Write-Host ($aiHealth | ConvertTo-Json -Compress)
} catch {
    Write-Host "AI Service is not running on port 8000: $_" -ForegroundColor Red
}

# 3. Test AI Service /classify (using NVIDIA Nemotron 3 Ultra on OpenRouter)
Write-Host "`n[3] Testing AI /classify (Internet Connectivity)..." -ForegroundColor Yellow
try {
    $classifyBody = @{
        message = "My Wi-Fi keeps disconnecting every few minutes"
        allowedIssueTypes = @("internet_connectivity")
    } | ConvertTo-Json

    $classifyRes = Invoke-RestMethod -Uri "http://localhost:8000/internal/v1/classify" `
        -Method Post `
        -ContentType "application/json" `
        -Body $classifyBody `
        -TimeoutSec 20

    Write-Host "Classify Result: SUCCESS -> " -ForegroundColor Green
    $classifyRes | Format-List
} catch {
    Write-Host "Classify call failed: $_" -ForegroundColor Red
}

# 4. Test AI Service /extract-outcome
Write-Host "`n[4] Testing AI /extract-outcome..." -ForegroundColor Yellow
try {
    $outcomeBody = @{
        message = "I tried restarting the router but the internet is still down"
        currentStepKey = "router_power_cycle"
    } | ConvertTo-Json

    $outcomeRes = Invoke-RestMethod -Uri "http://localhost:8000/internal/v1/extract-outcome" `
        -Method Post `
        -ContentType "application/json" `
        -Body $outcomeBody `
        -TimeoutSec 20

    Write-Host "Outcome Result: SUCCESS -> " -ForegroundColor Green
    $outcomeRes | Format-List
} catch {
    Write-Host "Outcome call failed: $_" -ForegroundColor Red
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " Testing complete!                       " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
