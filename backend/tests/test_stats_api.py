from decimal import Decimal

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.movies.models import (
    DimGenre,
    DimMovie,
    DimReview,
    FactMoviePerformance,
    MovieReview,
)

STATS_URL = "/api/v1/stats"


def _reviews(*notas: float) -> list[MovieReview]:
    return [MovieReview(nome=f"U{i}", nota=nota, comentario="ok") for i, nota in enumerate(notas)]


def _reviewed(sk: str, titulo: str, *notas: float, **fields: object) -> DimMovie:
    """Filme com avaliações e dim_reviews coerente (como o service mantém)."""

    return DimMovie(
        sk_movie_id=sk,
        id_filme=sk,
        titulo=titulo,
        reviews=_reviews(*notas),
        reviews_summary=DimReview(
            qtd_avaliacoes_usuarios=len(notas), nota_media_usuarios=sum(notas) / len(notas)
        ),
        **fields,
    )


def _performance(
    orcamento: str | None = None,
    receita: str | None = None,
    lucro: str = "0",
    nota_imdb: float | None = None,
    nota_tmdb: float | None = None,
) -> FactMoviePerformance:
    return FactMoviePerformance(
        orcamento_usd=None if orcamento is None else Decimal(orcamento),
        receita_usd=None if receita is None else Decimal(receita),
        lucro_usd=Decimal(lucro),
        nota_imdb=nota_imdb,
        nota_tmdb=nota_tmdb,
    )


async def _seed(factory: async_sessionmaker[AsyncSession], movies: list[DimMovie]) -> None:
    async with factory() as session:
        session.add_all(movies)
        await session.commit()


async def _get_stats(client: httpx.AsyncClient) -> dict:
    response = await client.get(STATS_URL)
    assert response.status_code == 200
    return response.json()


async def test_stats_on_empty_database(client: httpx.AsyncClient) -> None:
    body = await _get_stats(client)

    assert body == {
        "resumo": {"total_filmes": 0, "total_avaliacoes": 0, "media_geral": None},
        "top_avaliados": [],
        "top_lucro": [],
        "generos": [],
        "filmes_por_ano": [],
    }


async def test_resumo_counts_movies_and_reviews_and_rounds_overall_average(
    client: httpx.AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    await _seed(
        session_factory,
        [
            _reviewed("m1", "Um", 10, 9),
            _reviewed("m2", "Dois", 7),
            DimMovie(sk_movie_id="m3", id_filme="m3", titulo="Sem avaliação"),
        ],
    )

    resumo = (await _get_stats(client))["resumo"]

    # Média de todas as avaliações (não das médias por filme): 26 / 3 = 8,67.
    assert resumo == {"total_filmes": 3, "total_avaliacoes": 3, "media_geral": 8.7}


async def test_top_avaliados_requires_three_reviews_and_breaks_ties(
    client: httpx.AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    await _seed(
        session_factory,
        [
            _reviewed("m1", "Poucas", 10, 10),
            _reviewed("m2", "Beta", 8, 8, 8),
            _reviewed("m3", "alfa", 8, 8, 8),
            _reviewed("m4", "Mais votos", 8, 8, 8, 8),
            _reviewed(
                "m5",
                "Topo",
                9,
                9,
                9,
                ano_lancamento=2020,
                url_poster="https://img/topo.jpg",
            ),
        ],
    )

    top = (await _get_stats(client))["top_avaliados"]

    assert [item["titulo"] for item in top] == ["Topo", "Mais votos", "alfa", "Beta"]
    assert top[0] == {
        "sk_movie_id": "m5",
        "titulo": "Topo",
        "ano_lancamento": 2020,
        "url_poster": "https://img/topo.jpg",
        "nota_media": 9.0,
        "qtd_avaliacoes": 3,
    }


async def test_top_avaliados_is_limited_to_ten(
    client: httpx.AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    await _seed(
        session_factory,
        [_reviewed(f"m{i:02d}", f"Filme {i:02d}", i % 11, i % 11, i % 11) for i in range(12)],
    )

    top = (await _get_stats(client))["top_avaliados"]

    assert len(top) == 10
    assert top[0]["nota_media"] == 10


async def test_top_lucro_ignores_movies_without_budget_or_revenue(
    client: httpx.AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    def movie(sk: str, titulo: str, performance: FactMoviePerformance) -> DimMovie:
        return DimMovie(sk_movie_id=sk, id_filme=sk, titulo=titulo, performance=performance)

    await _seed(
        session_factory,
        [
            movie("m1", "Completo", _performance("10", "510", "500")),
            # Sem orçamento o "lucro" do CSV é a própria receita: fica fora.
            movie("m2", "Sem orçamento", _performance(None, "9000", "9000")),
            movie("m3", "Sem receita", _performance("100", None, "-100")),
            movie("m4", "Prejuízo", _performance("300", "100", "-200")),
            DimMovie(
                sk_movie_id="m5",
                id_filme="m5",
                titulo="Maior",
                ano_lancamento=2019,
                url_poster="https://img/maior.jpg",
                performance=_performance("1000", "3000", "2000.50"),
            ),
        ],
    )

    top = (await _get_stats(client))["top_lucro"]

    assert [item["titulo"] for item in top] == ["Maior", "Completo", "Prejuízo"]
    assert top[0] == {
        "sk_movie_id": "m5",
        "titulo": "Maior",
        "ano_lancamento": 2019,
        "url_poster": "https://img/maior.jpg",
        "lucro_usd": 2000.5,
    }


async def test_top_lucro_is_limited_to_ten(
    client: httpx.AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    await _seed(
        session_factory,
        [
            DimMovie(
                sk_movie_id=f"m{i:02d}",
                id_filme=f"m{i:02d}",
                titulo=f"Filme {i:02d}",
                performance=_performance("1", str(i + 1), str(i)),
            )
            for i in range(12)
        ],
    )

    top = (await _get_stats(client))["top_lucro"]

    assert len(top) == 10
    assert top[0]["lucro_usd"] == 11


async def test_generos_compare_user_imdb_and_tmdb_on_reviewed_movies(
    client: httpx.AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    drama = DimGenre(sk_genre_id="g-drama", nome_genero="Drama")
    terror = DimGenre(sk_genre_id="g-terror", nome_genero="Terror")
    vazio = DimGenre(sk_genre_id="g-vazio", nome_genero="Sem avaliações")
    await _seed(
        session_factory,
        [
            _reviewed(
                "m1",
                "A",
                10,
                10,
                10,
                genres=[drama],
                performance=_performance(nota_imdb=8.0, nota_tmdb=7.0),
            ),
            # nota_tmdb = 0 no CSV significa "sem votos": não entra na média.
            _reviewed(
                "m2",
                "B",
                6,
                genres=[drama, terror],
                performance=_performance(nota_imdb=6.0, nota_tmdb=0.0),
            ),
            # Filme sem avaliação de usuário fica fora da comparação.
            DimMovie(
                sk_movie_id="m3",
                id_filme="m3",
                titulo="C",
                genres=[drama, vazio],
                performance=_performance(nota_imdb=1.0, nota_tmdb=1.0),
            ),
        ],
    )

    generos = (await _get_stats(client))["generos"]

    assert generos == [
        {
            "genero": "Drama",
            "qtd_filmes_avaliados": 2,
            "qtd_avaliacoes": 4,
            # Ponderada por avaliação: (10 + 10 + 10 + 6) / 4 = 9.
            "media_usuarios": 9.0,
            "media_imdb": 7.0,
            "media_tmdb": 7.0,
        },
        {
            "genero": "Terror",
            "qtd_filmes_avaliados": 1,
            "qtd_avaliacoes": 1,
            "media_usuarios": 6.0,
            "media_imdb": 6.0,
            "media_tmdb": None,
        },
    ]


async def test_filmes_por_ano_counts_movies_in_ascending_year_order(
    client: httpx.AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    def movie(sk: str, ano: int | None) -> DimMovie:
        return DimMovie(sk_movie_id=sk, id_filme=sk, titulo=sk, ano_lancamento=ano)

    await _seed(
        session_factory,
        [movie("m1", 2020), movie("m2", 2018), movie("m3", 2020), movie("m4", None)],
    )

    anos = (await _get_stats(client))["filmes_por_ano"]

    assert anos == [{"ano": 2018, "qtd_filmes": 1}, {"ano": 2020, "qtd_filmes": 2}]


@pytest.mark.parametrize("method", ["post", "patch", "delete"])
async def test_stats_is_read_only(client: httpx.AsyncClient, method: str) -> None:
    response = await client.request(method.upper(), STATS_URL)

    assert response.status_code == 405
