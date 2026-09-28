[![CI](https://github.com/AdrianMichael5/rocketlab2026-2/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AdrianMichael5/rocketlab2026-2/actions/workflows/ci.yml)

# RocketLab Filmes — Sistema de Avaliação de Filmes

Projeto do **Visagio Rocket Lab 2026**: um catálogo de ~95 mil filmes com busca,
cadastro e avaliações. O usuário é o administrador do catálogo (não há login).

## Funcionalidades

- **Catálogo paginado** com busca por trecho do título (sem diferenciar maiúsculas),
  filtros por gênero e ano e ordenação por título, ano ou nota. O estado da busca fica
  na URL, então dá para compartilhar o link ou usar o botão Voltar do navegador.
- **Detalhe do filme**: sinopse, elenco, ficha técnica (direção, gêneros, duração,
  roteiro, produtoras), bilheteria e notas externas (TMDB/IMDb).
- **Avaliações**: nome, nota de 0 a 10 e comentário. A média e a quantidade de
  avaliações são atualizadas na hora, no detalhe e no catálogo.
- **Cadastro, edição e remoção de filmes**, com diretores e gêneros como etiquetas.
  Gêneros e pessoas já existentes são reaproveitados pelo nome. A remoção pede
  confirmação.
- **Insights** (`/insights`): números gerais, top 10 por média dos usuários e por
  lucro (clicáveis até o detalhe), média por gênero, filmes por ano e comparação
  usuários × IMDb × TMDB por gênero, em gráficos com tabela de dados alternativa.
- **Acessível e responsivo**: WCAG 2.2 AA verificado com axe em 320px, 768px e 1280px,
  uso completo pelo teclado e títulos de aba por página.

## Stack

| Camada | Tecnologias |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic 2, SQLite (aiosqlite) |
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, CSS Modules |
| Testes | pytest + httpx; Vitest + Testing Library; Playwright + axe-core (E2E e acessibilidade) |
| Qualidade | Ruff (backend), ESLint + `tsc` (frontend) |

## Pré-requisitos

- **Python 3.11 ou superior**
- **Node.js 22.12 ou superior** (exigência do Vitest 5)
- **Os CSVs de dados** da camada Diamond (não versionados; veja o passo 4 abaixo)
- Para os testes E2E: **Google Chrome** instalado ou o Chromium do Playwright (veja
  [Testes E2E](#testes-e2e-playwright))

Para rodar só com Docker, basta o **Docker com Compose v2** e os CSVs (veja
[Rodando com Docker](#rodando-com-docker)).

## Como rodar

Os comandos abaixo partem da raiz do repositório. Onde o comando muda entre sistemas,
há uma versão para **Windows (PowerShell)** e outra para **Linux/Mac**.

### Backend

**1. Criar e ativar o ambiente virtual**

Windows (PowerShell):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
```

> Se o PowerShell bloquear o script de ativação, libere para o usuário atual uma única
> vez: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Linux/Mac:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

Com o ambiente ativado, os comandos dos próximos passos são iguais nos dois sistemas.

**2. Instalar as dependências** (inclui as de teste e lint)

```bash
python -m pip install -e ".[dev]"
```

**3. Criar o `.env`**

Windows: `Copy-Item .env.example .env` · Linux/Mac: `cp .env.example .env`

Os valores padrão já funcionam. As variáveis disponíveis são:

| Variável | Padrão | Para que serve |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./rocketlab.db` | Banco de dados (arquivo `backend/rocketlab.db`) |
| `BACKEND_CORS_ORIGINS` | `["http://localhost:5173"]` | Origens liberadas no CORS (a do frontend) |
| `ENVIRONMENT` | `local` | Em `local`, o SQLAlchemy registra cada SQL no console |
| `LOG_LEVEL` | `INFO` | Nível de log |

**4. Colocar os CSVs em `backend/data/`**

O seed espera estes arquivos, com estes nomes, direto em `backend/data/`:

```text
backend/data/
├── dim_genres.csv
├── dim_companies.csv
├── dim_people.csv
├── dim_movies.csv
├── bridge_movie_genre.csv
├── bridge_movie_company.csv
├── bridge_movie_person.csv
├── fact_movies_performance.csv
├── movies_reviews.csv
└── dim_reviews.csv        # opcional: é ignorado (veja "Decisões técnicas")
```

Os CSVs estão no `.gitignore` e não vão para o repositório.

**5. Criar as tabelas**

```bash
alembic upgrade head
```

O schema é criado só pelo Alembic, nunca por `create_all`.

**6. Carregar os dados (seed)**

```bash
python -m scripts.seed
```

- **Duração:** carrega ~1,7 milhão de linhas em cerca de **3 minutos** e mostra o progresso
  de cada tabela.
- **Pode rodar de novo:** o seed limpa e recarrega tudo numa única transação. Se algo
  falhar, o banco fica como estava.
- **Cuidado:** avaliações e filmes criados pela aplicação são apagados ao rodar de novo.

**7. Subir a API**

```bash
uvicorn app.main:app --reload
```

- API: <http://localhost:8000>
- Documentação interativa (Swagger): <http://localhost:8000/docs>
- Checagem de saúde: <http://localhost:8000/health>

### Frontend

Em outro terminal, a partir da raiz do repositório:

**1. Instalar as dependências**

```bash
cd frontend
npm install
```

**2. Criar o `.env`** (opcional)

Windows: `Copy-Item .env.example .env` · Linux/Mac: `cp .env.example .env`

A única variável é `VITE_API_URL`, a URL base da API **incluindo** `/api/v1`. Sem o
arquivo, o padrão é `http://localhost:8000/api/v1`.

**3. Subir o servidor de desenvolvimento**

```bash
npm run dev
```

Acesse <http://localhost:5173>. Essa origem já está liberada no CORS do backend.

Para gerar a versão de produção: `npm run build` (sai em `frontend/dist/`).

## Rodando com Docker

Alternativa aos passos acima: o `docker-compose.yml` da raiz sobe o backend e o frontend
sem precisar instalar Python ou Node na máquina.

| Serviço | Imagem | Endereço |
|---|---|---|
| `backend` | `python:3.12-slim` + uvicorn | <http://localhost:8000> (Swagger em `/docs`) |
| `frontend` | build com `node:22`, servido pelo `nginx` | <http://localhost:5173> |

**1. Colocar os CSVs em `backend/data/`** (mesmos arquivos do passo 4 do backend). A
pasta é montada no container como **somente leitura**.

**2. Subir os serviços**

```bash
docker compose up --build -d
```

Ao iniciar, o backend roda `alembic upgrade head` antes do servidor. O banco SQLite fica
no volume nomeado `db-data`, então os dados continuam lá depois de `docker compose down`.

**3. Carregar os dados** (sob demanda, só na primeira vez ou para recarregar tudo)

```bash
docker compose run --rm backend python -m scripts.seed
```

Leva cerca de 1 a 2 minutos (~1,7 milhão de linhas). O seed apaga e recarrega as tabelas,
então rode com a aplicação sem uso. As migrações também rodam antes do seed, então ele
funciona mesmo com o volume vazio.

**Comandos úteis**

```bash
docker compose logs -f backend                 # acompanhar os logs da API
docker compose down                            # parar (mantém o banco)
docker compose down -v                         # parar e apagar o banco (volume db-data)
```

**URL da API no frontend.** O Vite grava `VITE_API_URL` no bundle durante o build, então
a variável é um *build arg* (padrão `http://localhost:8000/api/v1`, o endereço que o
**navegador** usa para chegar na API). Para trocar, refaça a imagem do frontend:

```bash
VITE_API_URL=http://meu-host:8000/api/v1 docker compose build frontend
```

Se mudar a origem do frontend, ajuste também `BACKEND_CORS_ORIGINS` no
`docker-compose.yml`.

> As portas 8000 e 5173 são as mesmas do ambiente local: pare o `uvicorn` e o
> `npm run dev` antes de subir os containers.

## Testes

### Backend

Com o ambiente virtual ativado, dentro de `backend/`:

```bash
ruff check .                                   # lint
pytest                                         # 181 testes (API, modelos, seed, concorrência)
pytest --cov=app --cov-report=term-missing     # com cobertura (~99%)
```

Os testes usam SQLite em memória e não tocam no `rocketlab.db`.

### Frontend (unitários e de componentes)

Dentro de `frontend/`:

```bash
npm run lint            # ESLint
npm run build           # checagem de tipos + build
npm test                # 322 testes (Vitest + Testing Library)
npm run test:coverage   # com cobertura (~99%)
```

### Testes E2E (Playwright)

Os testes E2E cobrem os fluxos de ponta a ponta:

- buscar filme, abrir detalhe e avaliar;
- cadastrar, editar e remover filme;
- acessibilidade (axe) e layout em 320px, 768px e 1280px;
- navegação só pelo teclado.

Dentro de `frontend/`:

```bash
npm run test:e2e        # roda tudo, sem janela
npm run test:e2e:ui     # modo interativo do Playwright
```

**Não é preciso subir nada antes.** O Playwright inicia sozinho:

- uma API na porta **8001**, com um banco descartável (`backend/e2e.db`) criado do zero
  pelo Alembic;
- um frontend na porta **5174**.

O banco de desenvolvimento não é tocado. O único requisito é que o venv do backend
exista (passos 1 e 2 do backend).

Por padrão, os testes usam o **Google Chrome** instalado na máquina. Para usar o
Chromium que acompanha o Playwright (por exemplo, em CI):

Windows (PowerShell):

```powershell
npx playwright install chromium
$env:PW_CHANNEL = "chromium"; npm run test:e2e
```

Linux/Mac:

```bash
npx playwright install chromium
PW_CHANNEL=chromium npm run test:e2e
```

O relatório HTML fica em `frontend/playwright-report/` (`npx playwright show-report`).

## Endpoints principais

Todas as rotas ficam sob `/api/v1`. A documentação completa, com os schemas, está em
`/docs`.

| Método | Rota | Descrição | Respostas |
|---|---|---|---|
| GET | `/movies` | Lista paginada. Parâmetros: `q` (trecho do título), `genero`, `ano`, `ordem` (`titulo` \| `ano` \| `nota`), `page`, `page_size` (padrão 20, máx. 100) | 200, 422 |
| GET | `/movies/{sk_movie_id}` | Detalhe: dados, diretores, gêneros, elenco, bilheteria, média | 200, 404 |
| POST | `/movies` | Cadastra filme (`titulo` obrigatório; `diretores` e `generos` como listas) | 201, 409, 422 |
| PATCH | `/movies/{sk_movie_id}` | Atualiza só os campos enviados | 200, 404, 409, 422 |
| DELETE | `/movies/{sk_movie_id}` | Remove o filme com avaliações, métricas e vínculos | 204, 404 |
| GET | `/movies/{sk_movie_id}/reviews` | Avaliações paginadas, mais recentes primeiro | 200, 404 |
| POST | `/movies/{sk_movie_id}/reviews` | Cria avaliação (`nome`, `nota`, `comentario`) e recalcula a média | 201, 404, 422 |
| DELETE | `/reviews/{sk_movie_review_id}` | Remove avaliação e recalcula a média | 204, 404 |
| GET | `/genres` | Gêneros que têm filmes (para o filtro do catálogo) | 200 |
| GET | `/stats` | Números gerais, rankings e médias por gênero e ano (página de insights) | 200 |
| GET | `/health` | Saúde da aplicação (fora de `/api/v1`) | 200 |

Listagens paginadas devolvem sempre `{ "items": [...], "total", "page", "page_size" }`.
Erros de validação (422) seguem o formato padrão do FastAPI, que o frontend usa para
mostrar a mensagem ao lado do campo certo.

Exemplo de cadastro:

```json
POST /api/v1/movies
{
  "titulo": "Interestelar",
  "ano_lancamento": 2014,
  "duracao_minutos": 169,
  "diretores": ["Christopher Nolan"],
  "generos": ["Ficção científica", "Drama"]
}
```

## Estrutura de pastas

```text
.
├── backend/
│   ├── app/
│   │   ├── api/            # dependências comuns (sessão, paginação) e router v1
│   │   ├── core/           # configurações (.env) e logging
│   │   ├── db/             # Base ORM, engine e sessões
│   │   ├── movies/         # domínio de filmes: models, schemas, repository, service, router
│   │   ├── reviews/        # domínio de avaliações (mesma divisão em camadas)
│   │   ├── genres/         # listagem de gêneros
│   │   ├── stats/          # agregações da página de insights (GET /stats)
│   │   └── main.py         # criação da aplicação FastAPI
│   ├── migrations/         # ambiente e revisões do Alembic
│   ├── scripts/seed.py     # carga dos CSVs
│   ├── data/               # CSVs (não versionados)
│   ├── tests/              # pytest
│   ├── Dockerfile          # imagem da API (migra ao subir; ver docker-entrypoint.sh)
│   └── docker-entrypoint.sh
├── frontend/
│   ├── src/
│   │   ├── api/            # cliente HTTP tipado, tipos da API, chaves do React Query
│   │   ├── components/     # componentes reutilizáveis (cards, nota, modal, etiquetas…)
│   │   ├── hooks/          # hooks genéricos (debounce, título da aba)
│   │   ├── pages/          # uma página por rota + subpastas por tela
│   │   ├── styles/         # tema (variáveis CSS globais)
│   │   └── test/           # utilitários dos testes (mock da API, render com providers)
│   ├── e2e/                # testes Playwright: specs, page objects e subida da API de teste
│   ├── playwright.config.ts
│   ├── Dockerfile          # build com Node e site estático no nginx
│   └── nginx.conf          # fallback de SPA para as rotas do React Router
├── docker-compose.yml      # backend + frontend (ver "Rodando com Docker")
└── README.md
```

Backend e frontend são organizados **por domínio**. No backend, cada domínio separa as
camadas de rota, regra de negócio e acesso a dados (`router` → `service` →
`repository`).

## Decisões técnicas

### Nota de 0 a 10 em todo o sistema

O enunciado cita, como exemplo, notas de 1 a 5 estrelas. Os dados recebidos
(`movies_reviews.csv`) usam a escala **0 a 10**, e a tabela tem uma `CHECK` com esse
intervalo. Trocar a escala exigiria converter as avaliações existentes e perderia
precisão (há notas como 9,8). Por isso o sistema inteiro usa **0 a 10**:

- **Banco e API**: o POST de avaliação aceita de 0 a 10 em múltiplos de 0,5 (`7.3` → 422).
  As notas antigas do CSV, como 9,8, continuam válidas.
- **Formulário**: a nota é escolhida entre os inteiros de 0 a 10, em um grupo de opções
  que também funciona pelo teclado (setas).
- **Exibição**: cada avaliação mostra a nota como "8/10"; a média do filme aparece com uma
  casa decimal ("7,5/10"), no catálogo e no detalhe.

### `dim_reviews` recalculada em vez de carregada do CSV

`dim_reviews.csv` (quantidade e média de avaliações por filme) **não bate** com as
avaliações individuais de `movies_reviews.csv`. Comparando os dois arquivos:

| Problema | Filmes afetados |
|---|---|
| Filme com avaliações que não aparece no `dim_reviews.csv` | 14.561 (de 40.267 avaliados) |
| Quantidade de avaliações diferente | 4.503 |
| Mesma quantidade, mas média diferente | 4.091 |

Por isso o seed **ignora** `dim_reviews.csv` e, depois de carregar `movie_reviews`,
recalcula o resumo com `COUNT` e `ROUND(AVG, 2)`: 40.267 filmes com resumo. A mesma
regra é aplicada pela API: criar ou remover uma avaliação recalcula o resumo daquele
filme **na mesma transação**. Assim, a média exibida nunca diverge das avaliações.

### Diretores como lista

Diretor não é uma coluna de `dim_movies`. É uma pessoa em `dim_people` com
`tipo_pessoa = "Diretor"`, ligada ao filme por `bridge_movie_person`. Como a ponte
permite vários diretores por filme (e **9.380 filmes** dos dados têm mais de um), a
API expõe `diretores: list[str]` em vez de um campo único. Assim nenhum dado é
descartado.

- **Ao salvar**, cada nome é procurado em `dim_people` (única por nome + tipo) e
  reaproveitado; só nomes novos são criados. Gêneros seguem a mesma ideia, por nome
  e sem diferenciar maiúsculas ("drama" usa o "Drama" existente).
- **No PATCH**, enviar `diretores` substitui a lista inteira (`[]` limpa). Atores e
  roteiristas do filme são preservados.

### Inserção em lote no seed

O volume é grande: 95 mil filmes, 424 mil pessoas e 745 mil vínculos filme–pessoa. O
ORM linha a linha (`session.add` por registro) levaria dezenas de minutos e muita
memória. O seed usa então:

- **`INSERT` do SQLAlchemy Core** com várias linhas por comando, em **lotes de 5.000**,
  lendo cada CSV em streaming (sem carregar o arquivo inteiro na memória);
- **uma única transação** para toda a carga: ou entra tudo, ou nada;
- **conversões na leitura**:
  - string vazia vira `NULL`;
  - `qtd_tmdb`/`qtd_imdb` chegam como float (`"2375.0"`) e viram inteiro;
  - `data_lancamento` vira `date`;
  - aspas extras no início e no fim das sinopses são removidas;
- **ordem de dependências**: dimensões → pontes → fato → avaliações → recálculo de
  `dim_reviews`.

Resultado: a carga completa leva cerca de 3 minutos.

### Insights: agregações no SQL e regras sobre os dados

`GET /stats` faz todas as contas no banco (`COUNT`, `AVG`, `SUM`, `GROUP BY`,
`ORDER BY … LIMIT 10`); o Python só monta a resposta. Os dados pediram algumas regras:

- **Top 10 por lucro só entre filmes com orçamento e receita informados.** Sem um
  deles, o `lucro_usd` do CSV é a própria receita (ou −orçamento), o que colocaria no
  ranking filmes cujo custo é desconhecido.
- **Notas IMDb/TMDB iguais a 0 ficam fora das médias** (`NULLIF`): no CSV, 0 significa
  "sem votos" (36 mil filmes no TMDB).
- **A comparação usuários × IMDb × TMDB usa só filmes com avaliação de usuário**, para
  as três médias falarem do mesmo conjunto. A média dos usuários é ponderada por
  avaliação (soma das notas / quantidade).
- **Top 10 por média** exige 3 ou mais avaliações; empates vão para quem tem mais
  avaliações e depois para o título.
- **Desempenho:** a migração `0003` cria índices de cobertura em
  `movie_reviews(sk_movie_id, nota)` e `fact_movies_performance(sk_movie_id, nota_imdb,
  nota_tmdb)` e roda `ANALYZE` (o seed também roda); sem as estatísticas o SQLite
  ignora esses índices. Com a base completa, o endpoint caiu de ~1 s para ~0,3 s.
- **Gráficos com Recharts**, carregados só na rota `/insights` (chunk separado). As
  cores das séries são os matizes do tema escurecidos e validados para daltonismo; cada
  gráfico tem a tabela de dados equivalente.

### Outras decisões

- **Paginação no servidor** com resposta `{items, total, page, page_size}`, em vez de
  devolver 95 mil filmes de uma vez.
- **`duracao_minutos = 0`** significa duração desconhecida (é o que os dados usam) e
  aparece como "—".
- **Filmes sem pôster** (~8 mil) ou com imagem quebrada mostram um pôster genérico.
- **Remoção em cascata** (`ON DELETE CASCADE`): remover um filme apaga avaliações,
  resumo, métricas e vínculos, mas mantém pessoas, gêneros e produtoras, que podem
  estar em outros filmes.
- **Escritas concorrentes** que violariam unicidade (dois cadastros simultâneos
  criando o mesmo gênero novo, por exemplo) são barradas pelo banco e devolvem **409**
  em vez de erro 500.
- **Sem biblioteca de UI**: tema escuro em variáveis CSS e CSS Modules. As cores foram
  checadas quanto a contraste (texto ≥ 4,5:1, contornos de campos ≥ 3:1).
