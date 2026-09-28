"""Regressões da configuração Docker (docker-compose.yml e frontend/Dockerfile)."""

import json
import re
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
COMPOSE_FILE = REPO_ROOT / "docker-compose.yml"
FRONTEND_DOCKERFILE = REPO_ROOT / "frontend" / "Dockerfile"
FRONTEND_PACKAGE = REPO_ROOT / "frontend" / "package.json"

pytestmark = pytest.mark.skipif(
    not COMPOSE_FILE.exists(), reason="arquivos Docker fora da árvore (ex.: dentro da imagem)"
)


def load_compose() -> dict:
    return yaml.safe_load(COMPOSE_FILE.read_text(encoding="utf-8"))


def version_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def test_frontend_espera_backend_saudavel() -> None:
    services = load_compose()["services"]

    assert "healthcheck" in services["backend"]
    depends_on = services["frontend"]["depends_on"]
    assert isinstance(depends_on, dict), "depends_on em lista ignora o healthcheck"
    assert depends_on["backend"]["condition"] == "service_healthy"


def test_imagem_node_do_frontend_atende_engines() -> None:
    engines = json.loads(FRONTEND_PACKAGE.read_text(encoding="utf-8"))["engines"]["node"]
    minimum = re.fullmatch(r">=\s*(\d+(?:\.\d+)*)", engines.strip())
    assert minimum, f"formato de engines.node não suportado: {engines!r}"

    image = re.search(
        r"^FROM\s+node:(\d+(?:\.\d+)*)\S*\s+AS\s+build", FRONTEND_DOCKERFILE.read_text(), re.M
    )
    assert image, "estágio de build com imagem node:<versão> não encontrado"

    # Uma tag só com o major (ex.: node:22) resolve para a versão mais recente dessa linha.
    image_version = version_tuple(image.group(1))
    required = version_tuple(minimum.group(1))
    assert image_version >= required[: len(image_version)]
