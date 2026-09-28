"""Mede o tempo de resposta de um endpoint GET com e sem o cache em memória.

Uso (a partir de backend/, com o banco já populado via `python -m scripts.seed`):

    python -m scripts.benchmark
    python -m scripts.benchmark --path "/api/v1/movies?q=star" --calls 50

As chamadas vão direto ao app via httpx.ASGITransport, sem servidor nem rede: os tempos
medem só o trabalho da API (roteamento, consultas ao banco e serialização).
"""

import argparse
import asyncio
import logging
import statistics
import sys
import time
from dataclasses import dataclass

import httpx

from app.core.cache import response_cache
from app.core.logging import configure_logging
from app.db.session import engine
from app.main import app

DEFAULT_PATH = "/api/v1/movies"
DEFAULT_CALLS = 20
MS_PER_SECOND = 1000

logger = logging.getLogger("scripts.benchmark")


class BenchmarkError(Exception):
    """O endpoint medido não respondeu 200."""


@dataclass(frozen=True)
class Timing:
    media_ms: float
    mediana_ms: float
    min_ms: float
    max_ms: float


@dataclass(frozen=True)
class BenchmarkResult:
    path: str
    chamadas: int
    sem_cache: Timing
    com_cache: Timing

    @property
    def ganho(self) -> float:
        """Quantas vezes a média com cache é mais rápida que sem cache."""

        return self.sem_cache.media_ms / self.com_cache.media_ms


def summarize(samples_ms: list[float]) -> Timing:
    if not samples_ms:
        raise ValueError("nenhuma amostra para resumir")
    return Timing(
        media_ms=statistics.fmean(samples_ms),
        mediana_ms=statistics.median(samples_ms),
        min_ms=min(samples_ms),
        max_ms=max(samples_ms),
    )


async def _measure(client: httpx.AsyncClient, path: str, calls: int) -> list[float]:
    samples: list[float] = []
    for _ in range(calls):
        started = time.perf_counter()
        response = await client.get(path)
        elapsed_ms = (time.perf_counter() - started) * MS_PER_SECOND
        if response.status_code != 200:
            raise BenchmarkError(f"GET {path} respondeu {response.status_code}")
        samples.append(elapsed_ms)
    return samples


async def run_benchmark(
    client: httpx.AsyncClient, path: str = DEFAULT_PATH, calls: int = DEFAULT_CALLS
) -> BenchmarkResult:
    """Mede `calls` chamadas sem cache e depois `calls` com cache (a 1ª com cache é miss)."""

    was_enabled = response_cache.enabled
    try:
        response_cache.enabled = False
        await _measure(client, path, 1)  # aquecimento: pool de conexões e imports tardios
        sem_cache = summarize(await _measure(client, path, calls))

        response_cache.enabled = True
        response_cache.clear()
        com_cache = summarize(await _measure(client, path, calls))
    finally:
        response_cache.enabled = was_enabled
        response_cache.clear()
    return BenchmarkResult(path=path, chamadas=calls, sem_cache=sem_cache, com_cache=com_cache)


def _format(label: str, timing: Timing) -> str:
    return (
        f"{label:<10} média {timing.media_ms:8.2f} ms | mediana {timing.mediana_ms:8.2f} ms"
        f" | mín {timing.min_ms:8.2f} ms | máx {timing.max_ms:8.2f} ms"
    )


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--path", default=DEFAULT_PATH, help="caminho do GET a medir")
    parser.add_argument("--calls", type=int, default=DEFAULT_CALLS, help="chamadas por modo")
    args = parser.parse_args(argv)
    if args.calls < 1:
        parser.error("--calls deve ser pelo menos 1")
    return args


async def main(argv: list[str] | None = None) -> None:
    configure_logging()
    args = _parse_args(argv)
    # No ambiente local o engine loga cada SQL; o custo do log distorceria as medições.
    engine.sync_engine.echo = False
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://bench") as client:
            result = await run_benchmark(client, args.path, args.calls)
    finally:
        await engine.dispose()

    print(f"GET {result.path} — {result.chamadas} chamadas por modo")
    print(_format("sem cache", result.sem_cache))
    print(_format("com cache", result.com_cache))
    print(f"ganho: {result.ganho:.1f}x na média")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except BenchmarkError as exc:
        logger.error("Benchmark abortado: %s", exc)
        sys.exit(1)
