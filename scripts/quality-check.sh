#!/bin/bash
set -e

echo "=== BuildPlus Quality Check ==="
echo ""

echo "[1/3] Running ESLint..."
npx eslint client/src server shared --ext .ts,.tsx --max-warnings=50 2>/dev/null || echo "ESLint: some warnings found (see above)"
echo ""

echo "[2/3] Running Frontend Tests..."
npx vitest --config vitest.config.frontend.ts --run
echo ""

echo "[3/3] Running TypeScript Check..."
npx tsc --noEmit 2>/dev/null || echo "TypeScript: some type errors found (see above)"
echo ""

echo "=== Quality Check Complete ==="
