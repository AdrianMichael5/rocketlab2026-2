#!/bin/sh
# Aplica as migrações antes de qualquer comando (servidor ou seed).
set -e

alembic upgrade head

exec "$@"
