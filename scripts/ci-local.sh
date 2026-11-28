#!/usr/bin/env bash
# Runs the steps of .github/workflows/ci.yml on this computer, in the same order, so a pull request
# can be checked before it is pushed and while GitHub Actions is down (billing).
#
#   bash scripts/ci-local.sh              both jobs
#   bash scripts/ci-local.sh static       lint, types, tests, build
#   bash scripts/ci-local.sh integration  tests against a PostgreSQL in a temporary Docker container
#
# SonarCloud is not run here: it needs the SONAR_TOKEN secret and only runs on GitHub.
set -euo pipefail
cd "$(dirname "$0")/.."

job="${1:-all}"
static() {
  echo "== Lint, Types, Tests & Build"
  npm ci
  npm run format:check
  npx tsc --noEmit
  npm run lint
  npm run knip
  npm run test:coverage
  npm run build
}

integration() {
  echo "== Integration Tests (PostgreSQL)"
  name="ci-local-pg-$$" # not local: the EXIT trap runs after this function has returned
  # No fixed port: Docker picks a free one, so it never clashes with the database of docker compose.
  docker run -d --rm --name "$name" -p 127.0.0.1::5432 \
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tripbook_test \
    postgres:16-alpine >/dev/null
  trap 'docker stop "$name" >/dev/null 2>&1 || true' EXIT

  until docker exec "$name" pg_isready -U postgres -d tripbook_test >/dev/null 2>&1; do sleep 1; done

  local port
  port="$(docker port "$name" 5432/tcp | head -1 | sed 's/.*://')"
  export DATABASE_URL="postgresql://postgres:postgres@localhost:$port/tripbook_test"
  npm ci
  npx prisma migrate deploy
  npm run seed
  npm run test:integration
}

case "$job" in
  static) static ;;
  integration) integration ;;
  all) static; integration ;;
  *) echo "usage: $0 [static|integration|all]" >&2; exit 2 ;;
esac
echo "CI local: $job passed"
