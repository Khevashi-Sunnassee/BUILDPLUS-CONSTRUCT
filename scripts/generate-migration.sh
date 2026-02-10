#!/bin/bash
# Generate a new Drizzle migration
# Usage: bash scripts/generate-migration.sh
# Run this BEFORE deploying to production when schema has changed

echo "Generating new migration from schema changes..."
npx drizzle-kit generate
echo ""
echo "Migration generated. Check the migrations/ directory for new files."
echo "Commit the new migration file before deploying."
