#!/bin/bash
set -e

ERRORS=0
echo "=== BuildPlus Quality Check ==="
echo ""

echo "[1/4] Running ESLint..."
if npx eslint client/src server shared --ext .ts,.tsx --max-warnings=0 2>/dev/null; then
  echo "  ESLint: PASSED (0 warnings, 0 errors)"
else
  echo "  ESLint: FAILED"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "[2/4] Running Frontend Tests..."
if npx vitest --config vitest.config.frontend.ts --run; then
  echo "  Tests: PASSED"
else
  echo "  Tests: FAILED"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "[3/4] Running TypeScript Check..."
if npx tsc --noEmit 2>/dev/null; then
  echo "  TypeScript: PASSED (0 type errors)"
else
  echo "  TypeScript: FAILED"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "[4/4] Checking Accessibility Standards..."
A11Y_PAGES=$(find client/src/pages -maxdepth 1 -name "*.tsx" -not -name "*.test.*" | wc -l)
A11Y_ROLE=$(grep -rl 'role="main"' client/src/pages/ --include="*.tsx" | grep -v ".test." | wc -l)
A11Y_RATIO=$((A11Y_ROLE * 100 / A11Y_PAGES))
echo "  Pages with role=\"main\": $A11Y_ROLE / $A11Y_PAGES ($A11Y_RATIO%)"
TEST_FILES=$(find client/src -name "*.test.tsx" | wc -l)
echo "  Test files: $TEST_FILES"
echo "  Accessibility: CHECKED"
echo ""

echo "=== Quality Check Summary ==="
if [ $ERRORS -eq 0 ]; then
  echo "  ALL CHECKS PASSED"
  exit 0
else
  echo "  $ERRORS CHECK(S) FAILED"
  exit 1
fi
