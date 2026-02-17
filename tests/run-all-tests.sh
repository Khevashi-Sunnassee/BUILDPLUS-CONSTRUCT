#!/bin/bash
set -e

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
RESET="\033[0m"

RESULTS_DIR="tests/results"
mkdir -p "$RESULTS_DIR"

FRONTEND_PASS=0
BACKEND_PASS=0
SMOKE_PASS=0
CRUD_PASS=0
LOAD_PASS=0
FRONTEND_FAIL=0
BACKEND_FAIL=0
SMOKE_FAIL=0
CRUD_FAIL=0

echo -e "${BOLD}${CYAN}"
echo "========================================================================"
echo "  BuildPlus AI - Comprehensive Test Suite"
echo "  $(date)"
echo "========================================================================"
echo -e "${RESET}"

run_test_suite() {
  local name="$1"
  local config="$2"
  local pattern="$3"
  local output_file="$4"

  echo -e "\n${BOLD}${YELLOW}--- $name ---${RESET}\n"

  if npx vitest run $pattern --config "$config" --reporter=verbose 2>&1 | tee "$output_file"; then
    return 0
  else
    return 1
  fi
}

SKIP_FRONTEND="${SKIP_FRONTEND:-false}"
SKIP_BACKEND="${SKIP_BACKEND:-false}"
SKIP_SMOKE="${SKIP_SMOKE:-false}"
SKIP_CRUD="${SKIP_CRUD:-false}"
SKIP_LOAD="${SKIP_LOAD:-false}"

for arg in "$@"; do
  case "$arg" in
    --skip-frontend) SKIP_FRONTEND=true ;;
    --skip-backend) SKIP_BACKEND=true ;;
    --skip-smoke) SKIP_SMOKE=true ;;
    --skip-crud) SKIP_CRUD=true ;;
    --skip-load) SKIP_LOAD=true ;;
    --frontend-only) SKIP_BACKEND=true; SKIP_SMOKE=true; SKIP_CRUD=true; SKIP_LOAD=true ;;
    --backend-only) SKIP_FRONTEND=true; SKIP_LOAD=true ;;
    --load-only) SKIP_FRONTEND=true; SKIP_BACKEND=true; SKIP_SMOKE=true; SKIP_CRUD=true ;;
    --help)
      echo "Usage: bash tests/run-all-tests.sh [options]"
      echo ""
      echo "Options:"
      echo "  --skip-frontend   Skip frontend component tests"
      echo "  --skip-backend    Skip backend API tests"
      echo "  --skip-smoke      Skip API smoke tests"
      echo "  --skip-crud       Skip CRUD flow tests"
      echo "  --skip-load       Skip load tests"
      echo "  --frontend-only   Run only frontend tests"
      echo "  --backend-only    Run only backend tests (API + smoke + CRUD)"
      echo "  --load-only       Run only load tests"
      echo "  --help            Show this help message"
      exit 0
      ;;
  esac
done

TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

if [ "$SKIP_FRONTEND" != "true" ]; then
  TOTAL_SUITES=$((TOTAL_SUITES + 1))
  echo -e "\n${BOLD}${YELLOW}[1/5] Frontend Component Tests (100% page coverage)${RESET}\n"
  if npx vitest run --config vitest.config.frontend.ts --reporter=verbose 2>&1 | tee "$RESULTS_DIR/frontend.log"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
    echo -e "\n${GREEN}Frontend tests: PASSED${RESET}"
  else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo -e "\n${RED}Frontend tests: FAILED${RESET}"
  fi
fi

if [ "$SKIP_BACKEND" != "true" ]; then
  TOTAL_SUITES=$((TOTAL_SUITES + 1))
  echo -e "\n${BOLD}${YELLOW}[2/5] Backend API Integration Tests${RESET}\n"
  if npx vitest run --config vitest.config.ts \
    tests/api-endpoints.test.ts \
    tests/api-security.test.ts \
    tests/api-company-isolation.test.ts \
    tests/api-crud-flows.test.ts \
    tests/api-routes.test.ts \
    tests/health-endpoints.test.ts \
    tests/validation-schemas.test.ts \
    tests/job-phases.test.ts \
    tests/panel-lifecycle.test.ts \
    tests/financial-calculations.test.ts \
    tests/middleware-sanitize.test.ts \
    --reporter=verbose 2>&1 | tee "$RESULTS_DIR/backend.log"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
    echo -e "\n${GREEN}Backend tests: PASSED${RESET}"
  else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo -e "\n${RED}Backend tests: FAILED${RESET}"
  fi
fi

if [ "$SKIP_SMOKE" != "true" ]; then
  TOTAL_SUITES=$((TOTAL_SUITES + 1))
  echo -e "\n${BOLD}${YELLOW}[3/5] API Smoke Tests (All Endpoints)${RESET}\n"
  if npx vitest run --config vitest.config.ts tests/api-smoke.test.ts --reporter=verbose 2>&1 | tee "$RESULTS_DIR/smoke.log"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
    echo -e "\n${GREEN}Smoke tests: PASSED${RESET}"
  else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo -e "\n${RED}Smoke tests: FAILED${RESET}"
  fi
fi

if [ "$SKIP_CRUD" != "true" ]; then
  TOTAL_SUITES=$((TOTAL_SUITES + 1))
  echo -e "\n${BOLD}${YELLOW}[4/5] CRUD Flow Integration Tests${RESET}\n"
  if npx vitest run --config vitest.config.ts \
    tests/e2e-critical-flows.test.ts \
    tests/e2e-documents.test.ts \
    tests/e2e-hire-booking.test.ts \
    tests/e2e-panels.test.ts \
    tests/e2e-progress-claims.test.ts \
    tests/e2e-rbac-auth.test.ts \
    tests/e2e-tasks.test.ts \
    tests/sales-pipeline.test.ts \
    --reporter=verbose 2>&1 | tee "$RESULTS_DIR/crud.log"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
    echo -e "\n${GREEN}CRUD flow tests: PASSED${RESET}"
  else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo -e "\n${RED}CRUD flow tests: FAILED${RESET}"
  fi
fi

if [ "$SKIP_LOAD" != "true" ]; then
  TOTAL_SUITES=$((TOTAL_SUITES + 1))
  echo -e "\n${BOLD}${YELLOW}[5/5] Load Test (300+ Concurrent Users)${RESET}\n"
  if npx tsx tests/load-test.ts 2>&1 | tee "$RESULTS_DIR/load.log"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
    echo -e "\n${GREEN}Load test: PASSED${RESET}"
  else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    echo -e "\n${RED}Load test: FAILED${RESET}"
  fi
fi

echo -e "\n${BOLD}${CYAN}"
echo "========================================================================"
echo "  TEST RESULTS SUMMARY"
echo "========================================================================"
echo -e "${RESET}"
echo -e "  Suites Run:    $TOTAL_SUITES"
echo -e "  Suites Passed: ${GREEN}$PASSED_SUITES${RESET}"
echo -e "  Suites Failed: ${RED}$FAILED_SUITES${RESET}"
echo ""
echo "  Results saved to: $RESULTS_DIR/"
echo ""

if [ "$FAILED_SUITES" -gt 0 ]; then
  echo -e "  ${BOLD}${RED}OVERALL: FAILED${RESET}"
  exit 1
else
  echo -e "  ${BOLD}${GREEN}OVERALL: PASSED${RESET}"
  exit 0
fi
