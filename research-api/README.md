# research-api

Go-сервис поиска научных публикаций. Не заглушка и не локальный поиск по своей базе — реально дёргает два открытых внешних API (arXiv и OpenAlex) и возвращает нормализованный список статей. Собственной базы данных, кэша или индексации у сервиса нет — каждый запрос идёт наружу заново.

Кто вызывает и что происходит при недоступности — [`../docs/integrations.md`](../docs/integrations.md) (вызывается из `src/app/api/agent/scholar/search/route.ts`, без ретраев на стороне сайта). Отдельно от этого сервиса на самом сайте есть ещё поиск через CrossRef/arXiv напрямую (`/api/citations/search`) — они не связаны, `research-api` использует только arXiv и OpenAlex.

## API (по факту чтения `main.go`)

### `GET /health`
Возвращает `200 OK` с телом `OK` (без проверки доступности arXiv/OpenAlex).

### `POST /search`
Request:
```json
{
  "query": "graph neural networks",
  "source": "openalex",
  "maxResults": 10,
  "yearFrom": "2020",
  "authors": "Yann LeCun"
}
```
- `query` — поисковая фраза; если пусто — используется `"science"` как дефолт.
- `source` — `"openalex"` переключает на OpenAlex; любое другое значение (включая отсутствие поля) — идёт запрос в **arXiv** (это дефолтная ветка).
- `maxResults` — если `<= 0`, подставляется `10`.
- `yearFrom` — фильтр "не раньше года"; `"Any"` или пусто — без фильтра.
- `authors` — фильтр по автору; `"None"` или пусто — без фильтра.

Response:
```json
{
  "query": "graph neural networks",
  "articles": [
    { "title": "...", "summary": "...", "authors": ["..."], "year": 2023, "url": "...", "doi": "..." }
  ]
}
```

### Ветка arXiv (`fetchArxiv`)
Дергает `https://export.arxiv.org/api/query` (Atom/XML), с `search_query=(ti:"..." OR abs:"...")` (плюс `AND au:"..."` если задан автор), `sortBy=relevance` — в коде явно закомментировано, что раньше сортировка была по дате и это давало нерелевантные результаты. При HTTP 503 от arXiv — один повтор через 1 секунду. XML парсится через `encoding/xml`.

### Ветка OpenAlex (`fetchOpenAlex`)
Дергает `https://api.openalex.org/works` с `search=`, `sort=relevance_score:desc`, `select=...` (обрезка полей ответа), `mailto=admin@perricheno.com` (это добавляет запрос в "polite pool" OpenAlex — более высокий и стабильный rate-limit, не является утечкой реального адреса). Фильтры по году (`publication_year:>N-1`) и автору (`raw_author_name.search:`) собираются в `&filter=`.

Оба пути дополнительно чистят текст через `cleanLatex()` — убирают HTML/JATS-теги (`<sup>`, `<jats:p>` и т.п.) и разворачивают частые LaTeX-макросы (`\emph{}`, `\mathcal{}` и др.), потому что abstract'ы из обоих источников иногда приходят с разметкой внутри обычного текстового поля.

Никакого API-ключа ни arXiv, ни OpenAlex не требуют для этого объёма запросов — сервис работает анонимно (в OpenAlex — как "polite pool" через `mailto`).

## Сборка и запуск локально

```bash
# из директории research-api/
docker build -t research-api .
docker run --rm -p 8080:8080 research-api

curl http://localhost:8080/health
curl -X POST http://localhost:8080/search \
  -H "Content-Type: application/json" \
  -d '{"query": "transformer attention", "source": "openalex", "maxResults": 5}'
```

`Dockerfile` — двухстадийная сборка: `golang:1.22-alpine` компилирует бинарь, финальный образ — голый `alpine:latest` (никаких системных зависимостей не нужно, весь функционал — чистые HTTP-запросы). Порт зашит в коде как `8080` (`main.go:47`, без чтения из `os.Getenv`), в `Dockerfile` `EXPOSE 8080`.

В `docker-compose.yml` сервис не публикует порт наружу — доступен другим контейнерам как `research-api:8080`. Реальный `docker build`/`docker run` в рамках аудита не выполнялся.

## Ключевые файлы

- `main.go` — весь сервис: HTTP-роутинг, оба клиента (arXiv/OpenAlex), очистка текста.
- `Dockerfile` — сборка на `golang:1.22-alpine` → `alpine:latest`.

## Известные ограничения

- **Порт `8080` захардкожен в коде**, а не читается из переменной окружения (в отличие от `r-compiler`/`python-compiler`, где есть `PORT`) — изменить его можно только правкой `main.go`.
- **Нет аутентификации** на HTTP-уровне — как и у остальных внутренних Go-сервисов, полагается на то, что порт не выставлен наружу.
- **Нет кэширования и нет ретраев** (кроме одного зашитого повтора для arXiv 503) — при недоступности внешнего API сервис сразу возвращает `500` с текстом ошибки.
- Fallback-адрес `RESEARCH_API_URL` на стороне сайта (`http://127.0.0.1:8080`) не совпадает с именем сервиса в docker-сети (`research-api`) — подробнее см. [`../docs/config_and_env.md`](../docs/config_and_env.md), в проде не проявляется, т.к. `docker-compose.yml` всегда передаёт правильное значение явно.
- Реальный `docker build`/`docker run` не выполнялся в рамках этого аудита.
