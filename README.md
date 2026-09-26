# RocketLab 2026.2 — repositório base

Base inicial para evoluir a atividade do RocketLab 2026.2. Ela preserva a organização do backend,
o modelo relacional do catálogo de filmes em SQLAlchemy 2.0 e o histórico de
migrações com Alembic, a API de filmes e avaliações e o frontend em React.

> **Nota:** `RocketLab` é apenas o nome de referência desta base. O diretório,
> nome do pacote, título da API e arquivo do banco podem ser renomeados para o
> que preferirem; eles não representam uma exigência da
> estrutura-base.

## Estrutura

```text
.
├── backend/
│   ├── app/
│   │   ├── api/v1/        # ponto de composição dos futuros routers
│   │   ├── core/          # configurações e logging
│   │   ├── db/            # Base ORM, engine e sessões
│   │   └── movies/        # modelos SQLAlchemy do domínio de filmes
│   ├── migrations/        # ambiente e revisões Alembic
│   └── tests/
├── frontend/
│   └── src/
│       ├── api/           # cliente HTTP tipado, tipos espelhando o backend, React Query
│       ├── components/    # Layout (cabeçalho/navegação) e StarRating
│       ├── pages/         # páginas das rotas
│       └── styles/        # tema escuro (variáveis CSS globais)
└── README.md
```

## Execução

Requer Python 3.11 ou superior.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

A API mínima ficará disponível em `http://localhost:8000`; use
`http://localhost:8000/docs` para a documentação automática. O endpoint
`GET /health` permite conferir se a aplicação iniciou corretamente.

## Frontend

Vite + React + TypeScript, com React Router e TanStack Query. Requer Node 22.12 ou
superior (exigência do Vitest 5; o Vite 8 aceita a partir do 20.19).

```bash
cd frontend
npm install
cp .env.example .env   # opcional: sem ele, a API padrão é http://localhost:8000/api/v1
npm run dev            # http://localhost:5173 (origem já liberada no CORS do backend)
```

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | checagem de tipos (`tsc -b`) + build de produção em `dist/` |
| `npm run lint` | ESLint |
| `npm test` | testes (Vitest + Testing Library) |
| `npm run test:coverage` | testes com cobertura |

Decisões do frontend:

- `VITE_API_URL` define a URL base da API, **incluindo** `/api/v1`.
- Os tipos em `src/api/types.ts` são mantidos à mão e usam os mesmos nomes de campo dos
  schemas do backend (`app/movies/schemas.py`, `app/reviews/schemas.py`); atualize-os
  junto com qualquer mudança de contrato.
- Erros da API viram `ApiError` com `status` e `fieldErrors` (`{campo, mensagem}`, a
  partir dos 422 do FastAPI); falha de rede usa `status` 0. Consultas não são repetidas
  em erros 4xx.
- Estilo com CSS Modules e variáveis CSS em `src/styles/theme.css` (tema escuro
  inspirado na paleta do Letterboxd), sem framework de UI.
- `StarRating` exibe a nota 0–10 como 5 estrelas com meia (`estrelas = nota / 2`,
  arredondado à meia estrela mais próxima). No modo de entrada, oferece de ½ a 5
  estrelas e devolve a nota 1–10; nota 0 não é selecionável pelas estrelas.

## API de filmes (`/api/v1/movies`)

| Método | Rota | Sucesso | Erros |
|---|---|---|---|
| GET | `/api/v1/movies` | 200 `{items, total, page, page_size}` | 422 |
| GET | `/api/v1/movies/{sk_movie_id}` | 200 | 404 |
| POST | `/api/v1/movies` | 201 com o detalhe | 409, 422 |
| PATCH | `/api/v1/movies/{sk_movie_id}` | 200 com o detalhe | 404, 409, 422 |
| DELETE | `/api/v1/movies/{sk_movie_id}` | 204 | 404 |

Decisões da escrita de filmes:

- Campos aceitos: `titulo` (obrigatório na criação), `id_filme`, `ano_lancamento`
  (1888–2100), `data_lancamento`, `sinopse`, `duracao_minutos` (0 = desconhecida),
  `status_filme`, `url_poster`, `diretores` e `generos`. Campos fora dessa lista → 422.
- `url_poster` precisa ser uma URL `http(s)` absoluta (como as do TMDB); outros esquemas
  (`javascript:`, `data:`, caminhos relativos) → 422.
- `sinopse`, `status_filme` e `url_poster` vazios ou só com espaços são gravados como NULL,
  seguindo a regra da carga dos CSVs.
- Erros 422 de consistência (ano × data já salva) usam o mesmo formato de `detail` do
  FastAPI: `[{"loc": ["body", campo], "msg": ..., "type": "value_error"}]`.
- `id_filme` omitido é gerado como `local-<uuid hex>`; um `id_filme` já usado → **409**.
- `data_lancamento` sem `ano_lancamento` preenche o ano; os dois divergentes → 422.
- Gêneros são reaproveitados pelo nome sem diferenciar caixa ("drama" → "Drama");
  diretores pelo nome exato (a unicidade de `dim_people` é por nome + tipo).
- No PATCH só os campos enviados mudam; `diretores`/`generos` substituem a lista
  inteira (`[]` limpa) e não aceitam `null`, assim como `titulo` e `id_filme`.
  Trocar diretores preserva atores e roteiristas.
- DELETE remove avaliações, resumo, métricas e vínculos via `ON DELETE CASCADE`;
  pessoas, gêneros e produtoras permanecem.

## API de avaliações

| Método | Rota | Sucesso | Erros |
|---|---|---|---|
| GET | `/api/v1/movies/{sk_movie_id}/reviews` | 200 `{items, total, page, page_size}` | 404, 422 |
| POST | `/api/v1/movies/{sk_movie_id}/reviews` | 201 com a avaliação | 404, 422 |
| DELETE | `/api/v1/reviews/{sk_movie_review_id}` | 204 | 404, 422 |

Decisões das avaliações:

- **Escala 0–10, não 1–5.** O enunciado fala em notas de 1 a 5, mas os dados
  (`movies_reviews.csv`) e a CHECK do banco usam 0–10. A API mantém 0–10 e o
  frontend exibe 5 estrelas com meia estrela: `nota = estrelas × 2`. Por isso o POST
  só aceita múltiplos de 0.5 (`7.3` → 422); notas antigas do CSV (ex.: 9.8) continuam
  válidas na leitura.
- POST aceita apenas `nome` (1–120), `nota` (número de 0 a 10) e `comentario`
  (1–4000). Textos são aparados antes de validar; só espaços → 422. `nota` precisa ser
  número JSON: `true` ou `"7.5"` → 422. Campos extras → 422.
- Criar ou remover avaliação recalcula `dim_reviews` na mesma transação:
  `qtd_avaliacoes_usuarios = COUNT` e `nota_media_usuarios = ROUND(AVG, 2)`. Sem
  avaliações restantes, fica `qtd = 0` e `média = null`. O seed usa o mesmo
  arredondamento.
- GET lista da mais recente para a mais antiga; avaliações com o mesmo `created_at`
  (resolução de segundos) saem pela ordem de inserção, a mais nova primeiro.
- `created_at` é gerado pelo banco em UTC e retornado com fuso
  (`2026-09-25T16:53:25Z`).

## Banco de dados e migrações

O modelo usa um esquema estrela para o catálogo de filmes:

- dimensões de filmes, gêneros, pessoas, produtoras e resumo de avaliações;
- fato de desempenho financeiro e de engajamento;
- tabelas de associação N:N entre filmes, gêneros, produtoras e pessoas;

O schema corresponde aos nove arquivos CSV atuais da camada Diamond, com a
adição de `movie_reviews`: uma avaliação individual por linha, na escala 0–10.
A tabela aceita diretamente as colunas `sk_movie_review_id`, `sk_movie_id`,
`nome`, `nota` e `comentario` do CSV enviado separadamente. `created_at` é
gerado pelo banco. O contexto generativo não faz parte desta base.

O repositório não inclui CSVs nem rotinas de carga. Para usar avaliações,
importe primeiro os filmes em `dim_movies` e depois o CSV de `movie_reviews`.

As tabelas são criadas exclusivamente pelo Alembic. Para evoluir os modelos,
crie uma revisão e aplique-a:

```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "descreva a alteração"
.venv/bin/alembic upgrade head
```

O banco padrão é SQLite local em `backend/rocketlab.db`. Ajuste
`DATABASE_URL` no arquivo `.env` para usar outro banco compatível.
