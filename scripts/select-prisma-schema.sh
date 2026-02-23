#!/bin/sh
# Select Prisma Schema Based on PRISMA_TARGET Environment Variable
# This script copies the appropriate schema file to prisma/schema.prisma

set -e

TARGET="${PRISMA_TARGET:-sqlite}"

if [ "$TARGET" = "postgres" ]; then
    SOURCE_SCHEMA="prisma/schema.postgres.prisma"
    SELECTED_SCHEMA="postgresql"
else
    SOURCE_SCHEMA="prisma/schema.sqlite.prisma"
    SELECTED_SCHEMA="sqlite"
fi

# Check if source schema exists
if [ ! -f "$SOURCE_SCHEMA" ]; then
    echo "ERROR: Schema file not found: $SOURCE_SCHEMA" >&2
    exit 1
fi

# Copy selected schema to main schema file
cp "$SOURCE_SCHEMA" "prisma/schema.prisma"
echo "✓ Selected Prisma schema: $SELECTED_SCHEMA"
echo "  Source: $SOURCE_SCHEMA"
echo "  Destination: prisma/schema.prisma"


