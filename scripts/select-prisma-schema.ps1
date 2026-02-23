# Select Prisma Schema Based on PRISMA_TARGET Environment Variable
# This script copies the appropriate schema file to prisma/schema.prisma

param(
    [string]$Target = $env:PRISMA_TARGET
)

$ErrorActionPreference = "Stop"

# Determine target schema
if ($Target -eq "postgres") {
    $sourceSchema = "prisma\schema.postgres.prisma"
    $selectedSchema = "postgresql"
} else {
    $sourceSchema = "prisma\schema.sqlite.prisma"
    $selectedSchema = "sqlite"
}

# Check if source schema exists
if (-not (Test-Path $sourceSchema)) {
    Write-Host "ERROR: Schema file not found: $sourceSchema" -ForegroundColor Red
    exit 1
}

# Copy selected schema to main schema file
try {
    Copy-Item -Path $sourceSchema -Destination "prisma\schema.prisma" -Force
    Write-Host "✓ Selected Prisma schema: $selectedSchema" -ForegroundColor Green
    Write-Host "  Source: $sourceSchema" -ForegroundColor Gray
    Write-Host "  Destination: prisma\schema.prisma" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Failed to copy schema file: $_" -ForegroundColor Red
    exit 1
}


