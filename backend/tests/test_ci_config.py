"""Regressões do workflow de CI (.github/workflows/ci.yml)."""

import json
import re
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CI_FILE = REPO_ROOT / ".github" / "workflows" / "ci.yml"
FRONTEND_PACKAGE = REPO_ROOT / "frontend" / "package.json"

pytestmark = pytest.mark.skipif(
    not (REPO_ROOT / ".git").exists(), reason="fora do repositório (ex.: dentro da imagem)"
)


def load_workflow() -> dict:
    return yaml.safe_load(CI_FILE.read_text(encoding="utf-8"))


def version_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def step_with(job: dict, action: str) -> dict:
    return next(step for step in job["steps"] if step.get("uses", "").startswith(action))


def run_commands(job: dict) -> list[str]:
    return [step["run"] for step in job["steps"] if "run" in step]


def test_ci_roda_em_push_e_pull_request_para_main() -> None:
    workflow = load_workflow()
    # PyYAML (YAML 1.1) lê a chave "on" como o booleano True.
    triggers = workflow.get("on", workflow.get(True))

    assert triggers["push"]["branches"] == ["main"]
    assert triggers["pull_request"]["branches"] == ["main"]


def test_jobs_backend_e_frontend_rodam_em_paralelo() -> None:
    jobs = load_workflow()["jobs"]

    assert {"backend", "frontend"} <= set(jobs)
    assert "needs" not in jobs["backend"]
    assert "needs" not in jobs["frontend"]


def test_job_backend_usa_python_312_e_roda_lint_e_testes() -> None:
    backend = load_workflow()["jobs"]["backend"]
    setup = step_with(backend, "actions/setup-python")

    assert str(setup["with"]["python-version"]) == "3.12"
    assert setup["with"]["cache"] == "pip"
    assert run_commands(backend) == ["pip install -e '.[dev]'", "ruff check .", "pytest"]


def test_job_frontend_roda_lint_e_build() -> None:
    frontend = load_workflow()["jobs"]["frontend"]

    assert step_with(frontend, "actions/setup-node")["with"]["cache"] == "npm"
    assert run_commands(frontend) == ["npm ci", "npm run lint", "npm run build"]


def test_node_do_ci_atende_engines() -> None:
    engines = json.loads(FRONTEND_PACKAGE.read_text(encoding="utf-8"))["engines"]["node"]
    minimum = re.fullmatch(r">=\s*(\d+(?:\.\d+)*)", engines.strip())
    assert minimum, f"formato de engines.node não suportado: {engines!r}"

    frontend = load_workflow()["jobs"]["frontend"]
    node_version = str(step_with(frontend, "actions/setup-node")["with"]["node-version"])

    # Só o major (ex.: 22) resolve para a versão mais recente dessa linha.
    ci_version = version_tuple(node_version)
    required = version_tuple(minimum.group(1))
    assert ci_version >= required[: len(ci_version)]
