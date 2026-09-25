"""Dependências e parâmetros HTTP compartilhados entre os routers de domínio."""

from typing import Annotated

from fastapi import Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
# Limite superior mantém o OFFSET dentro do INTEGER de 64 bits do SQLite.
MAX_PAGE = 10_000
SK_MAX_LENGTH = 64

DbSession = Annotated[AsyncSession, Depends(get_db)]
# Chaves substitutas (sk_*) são hashes SHA-256 em hexadecimal: 64 caracteres.
SkPathId = Annotated[str, Path(max_length=SK_MAX_LENGTH)]
PageParam = Annotated[int, Query(ge=1, le=MAX_PAGE)]
PageSizeParam = Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)]
