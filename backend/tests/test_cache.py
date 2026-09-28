import pytest
from pydantic import ValidationError

from app.core.cache import TTLCache
from app.core.config import Settings

TTL = 60.0


class FakeClock:
    """Relógio controlado pelo teste, para expirar entradas sem sleep."""

    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class CountingLoader:
    """Loader assíncrono que conta chamadas e devolve um valor novo a cada uma."""

    def __init__(self) -> None:
        self.calls = 0

    async def __call__(self) -> str:
        self.calls += 1
        return f"valor-{self.calls}"


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def cache(clock: FakeClock) -> TTLCache:
    return TTLCache(ttl_seconds=TTL, clock=clock)


async def test_second_call_with_same_key_is_served_from_cache(cache: TTLCache) -> None:
    loader = CountingLoader()

    first = await cache.get_or_load("k", loader)
    second = await cache.get_or_load("k", loader)

    assert first == second == "valor-1"
    assert loader.calls == 1


async def test_different_keys_are_cached_separately(cache: TTLCache) -> None:
    loader = CountingLoader()

    a = await cache.get_or_load(("movies", 1), loader)
    b = await cache.get_or_load(("movies", 2), loader)

    assert (a, b) == ("valor-1", "valor-2")
    assert loader.calls == 2


async def test_entry_expires_after_ttl(cache: TTLCache, clock: FakeClock) -> None:
    loader = CountingLoader()
    await cache.get_or_load("k", loader)

    clock.now += TTL - 0.001
    assert await cache.get_or_load("k", loader) == "valor-1"

    clock.now += 0.001
    assert await cache.get_or_load("k", loader) == "valor-2"
    assert loader.calls == 2


async def test_clear_forces_reload(cache: TTLCache) -> None:
    loader = CountingLoader()
    await cache.get_or_load("k", loader)

    cache.clear()

    assert len(cache) == 0
    assert await cache.get_or_load("k", loader) == "valor-2"


async def test_disabled_cache_always_calls_loader_and_stores_nothing(cache: TTLCache) -> None:
    loader = CountingLoader()
    cache.enabled = False

    await cache.get_or_load("k", loader)
    await cache.get_or_load("k", loader)

    assert loader.calls == 2
    assert len(cache) == 0


async def test_falsy_values_are_cached(cache: TTLCache) -> None:
    calls = 0

    async def empty_list() -> list[str]:
        nonlocal calls
        calls += 1
        return []

    await cache.get_or_load("generos", empty_list)
    await cache.get_or_load("generos", empty_list)

    assert calls == 1


async def test_loader_error_is_propagated_and_not_cached(cache: TTLCache) -> None:
    async def boom() -> str:
        raise RuntimeError("falha no banco")

    with pytest.raises(RuntimeError, match="falha no banco"):
        await cache.get_or_load("k", boom)

    assert len(cache) == 0


async def test_result_loaded_across_a_clear_is_not_stored(cache: TTLCache) -> None:
    """Leitura iniciada antes de uma escrita não pode repovoar o cache com dado antigo."""

    async def load_while_write_happens() -> str:
        cache.clear()  # escrita concluída enquanto a leitura ainda estava no banco
        return "antigo"

    assert await cache.get_or_load("k", load_while_write_happens) == "antigo"

    loader = CountingLoader()
    assert await cache.get_or_load("k", loader) == "valor-1"


async def test_full_cache_evicts_expired_entries_first(clock: FakeClock) -> None:
    cache = TTLCache(ttl_seconds=TTL, max_entries=2, clock=clock)
    loader = CountingLoader()
    await cache.get_or_load("velha", loader)
    clock.now += TTL / 2
    await cache.get_or_load("nova", loader)
    clock.now += TTL / 2  # "velha" expirou, "nova" ainda vale

    await cache.get_or_load("terceira", loader)

    assert len(cache) == 2
    assert await cache.get_or_load("nova", loader) == "valor-2"


async def test_full_cache_evicts_oldest_entry_when_none_expired(clock: FakeClock) -> None:
    cache = TTLCache(ttl_seconds=TTL, max_entries=2, clock=clock)
    loader = CountingLoader()
    for key in ("a", "b", "c"):
        await cache.get_or_load(key, loader)

    assert len(cache) == 2
    assert await cache.get_or_load("c", loader) == "valor-3"
    assert await cache.get_or_load("b", loader) == "valor-2"
    assert await cache.get_or_load("a", loader) == "valor-4"


@pytest.mark.parametrize("ttl", [0, -1])
def test_settings_reject_non_positive_ttl_with_clear_message(ttl: float) -> None:
    with pytest.raises(ValidationError, match="cache_ttl_seconds"):
        Settings(cache_ttl_seconds=ttl)


def test_rejects_non_positive_limits() -> None:
    with pytest.raises(ValueError):
        TTLCache(ttl_seconds=0)
    with pytest.raises(ValueError):
        TTLCache(ttl_seconds=TTL, max_entries=0)
