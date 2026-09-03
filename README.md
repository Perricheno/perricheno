# Perricheno

SaaS для автоматической генерации научных документов (LaTeX-отчёты, диплом, лабораторные и т.д.) и статистических визуализаций, с Telegram-ботом как основным пользовательским интерфейсом (плюс веб-панель на Next.js). Есть также совместный LaTeX-редактор, менеджер библиографии, поиск публикаций и R-сессии для графиков.

Полная техническая документация — в [`docs/`](docs/) (см. раздел «Где искать что» ниже). Этот README — про то, как поднять проект локально и как он устроен на верхнем уровне; всё написано и проверено по факту чтения кода и (где явно отмечено) реального запуска команд на момент аудита 2026-09-02, коммит `244ecb7`.

---

## Архитектура верхнего уровня

Один Next.js-монолит + шесть вспомогательных сервисов, все — в Docker, все общаются через внутреннюю docker-сеть `cloudflare` (перед ней снаружи стоит, судя по названию сети и переменным `WEBHOOK_DOMAIN`, Cloudflare Tunnel/прокси — сама интеграция с Cloudflare API в коде не найдена, это чисто сетевой слой).

```
                         ┌────────────────────┐
  Telegram‑пользователь ─┤   telegram-bot      │  Node/TS, Telegraf
                         │   (порт 3033→3001)  │  вебхук или long-polling
                         └─────────┬───────────┘
                                   │ HTTP (внутренний)
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│  perricheno-site (порт 3002→3000) — Next.js 16 / App Router   │
│  ├─ 90 route.ts под src/app/api  (см. docs/api_reference.md)  │
│  ├─ Prisma 7 → Postgres                                       │
│  └─ MinIO (S3) для файлов                                     │
└───┬──────────┬──────────┬──────────────┬───────────┬──────────┘
    │          │          │              │           │
    ▼          ▼          ▼              ▼           ▼
r-compiler  python-    research-api  pdf-extractor  ws-server
(Go+R,      compiler   (Go, поиск    (Go+gin, OCR/  (Node, Yjs
внутр.      (Go+Python,публикаций)   извлечение     websocket,
только)     внутр.                  текста)        порт 3035,
            только)                                совм. редактирование)

postgres (внутр.) · minio (порты 9000/9001 — см. docs/REVIEW.md, это открытая проблема)
```

Подробности по каждому сервису — README в соответствующей папке (см. ниже) и `docs/integrations.md`.

## Стек

- **Веб**: Next.js 16.1.6 (App Router, Turbopack), React 19.2.3, TypeScript 5, Tailwind 4, next-intl (ru/en/kz).
- **Данные**: PostgreSQL + Prisma 7 (`@prisma/adapter-pg`), MinIO (S3-совместимое хранилище файлов).
- **Микросервисы**: Go (r-compiler, python-compiler, research-api, pdf-extractor), Node (ws-server — Yjs CRDT для совместного редактирования, telegram-bot — Telegraf).
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`) — typecheck → SSH-деплой на прод при пуше в `main`, без промежуточного review-гейта (см. `docs/IMPROVEMENT_PLAN.md`).

## Быстрый старт

### Вариант A — только веб-приложение, без Docker (для фронтенд-правок, часть функций не будет работать без БД)

Проверено на этой машине (Node v24.18.0, npm 11.16.0) 2026-09-02:

```bash
npm ci                 # ✔ верифицировано — 759 пакетов, ~1 мин
npx prisma generate    # ✔ верифицировано — Prisma Client v7.8.0 сгенерирован
npm run dev            # ✔ верифицировано — стартует и отдаёт HTTP 200 на /ru
                        #   даже БЕЗ файла .env (страницы, не обращающиеся к БД, рендерятся)
```
Реальный лог первого успешного запуска: `✓ Ready in 14.3s`, `GET /ru 200`.

**Важные нюансы, которые всплыли при проверке:**
- `npm ci` печатает предупреждение `allow-scripts`: несколько пакетов (`@prisma/engines`, `prisma`, `sharp`, `@swc/core` и др.) не выполнили install/postinstall-скрипты автоматически (защита npm 11). На `prisma generate` это не повлияло — он сработал. Если после `npm ci` что-то не собирается (особенно `sharp` для оптимизации изображений) — выполнить `npm run approve-builds` и переустановить.
- В репозитории **нет `.env.example`** — переменные окружения нужно завести вручную по списку в [`docs/config_and_env.md`](docs/config_and_env.md). Как минимум `DATABASE_URL` и `SESSION_SECRET` понадобятся для любой страницы, использующей сессию/БД (без `SESSION_SECRET` `src/lib/session.ts` бросает исключение при первом обращении).
- Локально на Windows фоновая задача очистки временных файлов аналитики падает в лог (`ENOENT ... C:\tmp\analytics-data`) — не критично, не роняет сервер, подробности в `docs/REVIEW.md`.

### Вариант B — полный стек через Docker Compose (то, что реально крутится в проде)

Эта часть — по чтению `docker-compose.yml`/`deploy.sh`, **не прогонялась целиком** в рамках этого аудита (требует реальных секретов сторонних сервисов и поднимает 8 контейнеров, включая Postgres/MinIO) — синтаксис `docker-compose.yml` проверен (`docker compose config` проходит при наличии `.env`), сама последовательность — нет.

```bash
# 1. Внешняя docker-сеть, которую docker-compose.yml ожидает готовой заранее
docker network create cloudflare

# 2. .env в корне — по списку docs/config_and_env.md (файла-примера нет, см. выше)

# 3. Поднять всё
docker compose up -d --build
```
Здоровье сервисов проверяется встроенными healthcheck'ами (`docker compose ps`); прод-деплой поверх этого добавляет ещё логику отката образа и поэтапной пересборки — см. [`deploy.sh`](deploy.sh) построчно, он читаем и специально закомментирован по-русски-английски смешанно с объяснением каждого шага.

## Переменные окружения

Полный список (47 переменных, кто их читает, обязательные/опциональные) — [`docs/config_and_env.md`](docs/config_and_env.md). Секретов в этом README и там — нет, только имена и назначение.

## Где искать что

| Вопрос | Ответ |
|---|---|
| Какие есть API-эндпоинты и что они принимают/отдают | [`docs/api_reference.md`](docs/api_reference.md) — все 90 `route.ts`, 119 эндпоинтов |
| Как считаются лимиты/тарифы/биллинг, как устроен пайплайн генерации отчёта | [`docs/business_logic.md`](docs/business_logic.md) |
| Схема БД, связи, индексы | [`docs/data_model.md`](docs/data_model.md) + [`prisma/schema.prisma`](prisma/schema.prisma) — источник истины |
| С какими внешними сервисами говорит проект (Telegram, Kaspi, CryptoCloud, LLM, MinIO, DOI/CrossRef...) | [`docs/integrations.md`](docs/integrations.md) |
| Какие коды ошибок возвращает API | [`docs/error_codes.md`](docs/error_codes.md) |
| Переменные окружения | [`docs/config_and_env.md`](docs/config_and_env.md) |
| Непонятные термины (Space, AgentSession, doc_type, share_id...) | [`docs/glossary.md`](docs/glossary.md) |
| Известные баги/техдолг/security-находки | [`docs/REVIEW.md`](docs/REVIEW.md) |
| Предложения по процессу разработки (на апрув, не внедрено) | [`docs/IMPROVEMENT_PLAN.md`](docs/IMPROVEMENT_PLAN.md) |
| Что лежит в конкретной папке (`src/lib/agent`, `telegram-bot/`, `r-compiler/` и т.д.) | README.md в соответствующей папке — см. ниже |

## README по подпапкам

Каждая директория с самостоятельным смыслом (сервис/модуль/слой) имеет свой `README.md` с назначением, ключевыми файлами и известными ограничениями. Не размножал README там, где директория — это просто набор мелких однотипных файлов без отдельной логики (например, внутри `src/app/api/*/[id]` каждой отдельной ручки) — там достаточно `docs/api_reference.md`.

## Тестирование

**[Обновлено, Фаза 3, 2026-09-03]** 39 тестов на Vitest, бьющих в реальный Postgres (без моков БД) — биллинг (оба вебхука CryptoCloud), промокоды, списание/начисление лимитов, Telegram-аутентификация, сессии. Подробности, как запустить локально и полный список — [`tests/README.md`](tests/README.md). CI (`.github/workflows/deploy.yml`, job `test`) блокирует деплой при красных тестах, не только при ошибках типов.

`npm run lint` пока не подключён к CI (см. `docs/IMPROVEMENT_PLAN.md`).

## Деплой

`git push` в `main` → GitHub Actions (`typecheck` → SSH на прод-сервер) → `deploy.sh` на сервере делает `git reset --hard`, выборочно пересобирает изменившиеся сервисы, `prisma db push` (без `--accept-data-loss`), health-check, автооткат образа при неудаче. Промежуточного ревью/approval нет — см. `docs/IMPROVEMENT_PLAN.md`, пункт 1.
