FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Dependências primeiro, para aproveitar o cache de camadas.
COPY pyproject.toml ./
COPY app ./app
RUN pip install .

COPY alembic.ini docker-entrypoint.sh ./
COPY migrations ./migrations
COPY scripts ./scripts

# /app/db recebe o volume nomeado do SQLite; criado aqui para nascer com o dono certo.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /app/db \
    && chown appuser:appuser /app/db \
    && chmod +x docker-entrypoint.sh
USER appuser

ENV DATABASE_URL=sqlite+aiosqlite:////app/db/rocketlab.db

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
