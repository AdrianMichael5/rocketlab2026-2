import httpx
import pytest

from app.core.cache import response_cache
from scripts.benchmark import BenchmarkError, run_benchmark, summarize

MOVIES_URL = "/api/v1/movies"


def test_summarize_computes_mean_median_min_and_max() -> None:
    timing = summarize([4.0, 1.0, 2.0, 9.0])

    assert timing.media_ms == 4.0
    assert timing.mediana_ms == 3.0
    assert (timing.min_ms, timing.max_ms) == (1.0, 9.0)


def test_summarize_rejects_empty_samples() -> None:
    with pytest.raises(ValueError):
        summarize([])


@pytest.mark.usefixtures("catalog")
@pytest.mark.parametrize("enabled", [True, False])
async def test_run_benchmark_measures_both_modes_and_restores_cache_state(
    client: httpx.AsyncClient, enabled: bool
) -> None:
    # O estado original do cache é restaurado pela fixture clear_response_cache.
    response_cache.enabled = enabled

    result = await run_benchmark(client, MOVIES_URL, calls=3)

    assert result.chamadas == 3
    assert result.sem_cache.min_ms > 0
    assert result.com_cache.min_ms > 0
    assert result.ganho > 0
    assert response_cache.enabled is enabled


@pytest.mark.usefixtures("catalog")
async def test_run_benchmark_fails_on_non_200_response(client: httpx.AsyncClient) -> None:
    with pytest.raises(BenchmarkError, match="404"):
        await run_benchmark(client, "/api/v1/nao-existe", calls=1)
