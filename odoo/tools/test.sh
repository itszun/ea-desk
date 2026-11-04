#!/usr/bin/env bash
# Run the ea_desk test suite on the working-tree code, in the separate ea_test
# database, so production numbering and data are never touched.
set -euo pipefail
cd "$(dirname "$0")/.."
mode=-u
docker exec ea-desk-db-1 psql -U odoo -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='ea_test'" | grep -q 1 || mode=-i
docker compose -f docker-compose.dev.yml run --rm -T --no-deps odoo odoo -d ea_test "$mode" ea_desk --stop-after-init --test-enable --test-tags /ea_desk --db-filter='^ea_test$' 2>&1 \
  | grep -E "odoo.tests.result|(FAIL|ERROR): Test" || true
