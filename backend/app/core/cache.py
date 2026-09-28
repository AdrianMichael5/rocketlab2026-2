"""Cache em memória, por processo, para leituras caras e muito repetidas.

Guarda o resultado já montado pelo service durante `ttl_seconds`. Escritas que alteram
filmes ou avaliações chamam `clear()` depois do commit, então uma leitura nunca vê dado
anterior a uma escrita já confirmada. O TTL cobre apenas mudanças feitas por fora da API
(ex.: o seed). Cada processo tem o próprio cache: com vários workers seria preciso um cache
compartilhado (Redis).
"""

import time
from collections.abc import Awaitable, Callable, Hashable
from typing import Any, TypeVar

from app.core.config import get_settings

T = TypeVar("T")

# Limita a memória: cada combinação de busca/filtro/página vira uma entrada.
DEFAULT_MAX_ENTRIES = 512


class TTLCache:
    """Mapa chave → valor com expiração por tempo e número máximo de entradas."""

    def __init__(
        self,
        ttl_seconds: float,
        max_entries: int = DEFAULT_MAX_ENTRIES,
        clock: Callable[[], float] = time.monotonic,
        enabled: bool = True,
    ) -> None:
        if ttl_seconds <= 0 or max_entries <= 0:
            raise ValueError("ttl_seconds e max_entries devem ser positivos")
        self.enabled = enabled
        self._ttl = ttl_seconds
        self._max_entries = max_entries
        self._clock = clock
        self._entries: dict[Hashable, tuple[float, Any]] = {}
        # Muda a cada clear(): uma leitura que atravessou uma escrita não grava o resultado.
        self._generation = 0

    def __len__(self) -> int:
        return len(self._entries)

    def clear(self) -> None:
        self._entries.clear()
        self._generation += 1

    async def get_or_load(self, key: Hashable, loader: Callable[[], Awaitable[T]]) -> T:
        """Devolve o valor em cache ou executa `loader` e guarda o resultado."""

        if not self.enabled:
            return await loader()

        entry = self._entries.get(key)
        if entry is not None and entry[0] > self._clock():
            return entry[1]

        generation = self._generation
        value = await loader()
        if generation == self._generation:
            self._store(key, value)
        return value

    def _store(self, key: Hashable, value: Any) -> None:
        now = self._clock()
        self._entries.pop(key, None)
        if len(self._entries) >= self._max_entries:
            self._evict(now)
        self._entries[key] = (now + self._ttl, value)

    def _evict(self, now: float) -> None:
        expired = [key for key, (expires_at, _) in self._entries.items() if expires_at <= now]
        for key in expired:
            del self._entries[key]
        if len(self._entries) >= self._max_entries:
            # dict preserva a ordem de inserção: a primeira chave é a mais antiga.
            del self._entries[next(iter(self._entries))]


_settings = get_settings()
response_cache = TTLCache(ttl_seconds=_settings.cache_ttl_seconds, enabled=_settings.cache_enabled)
