# prisma/

## Что тут лежит

Единственный файл — `schema.prisma` (393 строки, 30 моделей). Никакого `prisma/migrations/` в проекте нет.

## Зачем существует

`schema.prisma` — единственный источник истины о структуре БД (PostgreSQL). Приложение не использует версионированные Prisma-миграции: схема применяется на прод командой `npx prisma db push` (см. `deploy.sh:104-105`), которая приводит реальную БД в соответствие с текущим файлом схемы напрямую, без истории миграций. Полный разбор каждой модели, связей и индексов — [`../docs/data_model.md`](../docs/data_model.md).

## Как использовать

Не импортируется — `schema.prisma` читается Prisma CLI (`npx prisma generate`, вызывается в `npm run build`, и `npx prisma db push` в `deploy.sh`). Сгенерированный клиент импортируется из кода как `@prisma/client` (обёрнут в `src/lib/prisma.ts`).

## Ключевые файлы

| Файл | Что в нём |
|---|---|
| `schema.prisma` | `generator client { provider = "prisma-client-js" }`, `datasource db { provider = "postgresql" }`, далее 30 моделей, сгруппированных комментариями на блоки: Users & Core (`User`, `Task`, `Transaction`, `UsageLog`, `PromoCode`/`PromoUsage`, `SystemConfig`, `SystemNotification`, `LatexError`, `AuthRequest`, `Receipt`, `Session`, `BotSession`, `ProcessedPayment`), Agent & AI (`AgentSession`, `ChatSession`/`ChatMessage`, `VisualAsset`, `AgentUpload`), Spaces (`Space`, `SpaceFile`, `SpaceVersion`, `SpaceCollaborator`, `SpaceInvite`), Citations (`Citation`, `CitationCollection`/`CitationCollectionItem`), R Studio (`RSession`). Полный разбор — [`../docs/data_model.md`](../docs/data_model.md). |
| `../prisma.config.ts` (в корне репозитория, не внутри `prisma/`) | Конфиг Prisma 7 нового формата: путь к схеме, путь к папке миграций (`prisma/migrations` — задан, но на диске не создан, так как миграции не используются), и `datasource.url` с локальным дефолтом на случай отсутствия `DATABASE_URL`. Комментарий в файле объясняет, что внешних импортов намеренно нет — код должен работать в отдельных Docker-контейнерах, где `node_modules/prisma` может отсутствовать. |

## Известные ограничения / технический долг

- Отсутствие `prisma/migrations/` и версионированной истории схемы — при `db push` Prisma сравнивает текущую БД со `schema.prisma` и применяет разницу немедленно; откатить конкретное изменение штатными средствами Prisma нельзя. `deploy.sh` при этом больше не использует `--accept-data-loss` (это было исправлено с прошлого аудита — см. [`../docs/REVIEW.md`](../docs/REVIEW.md), таблица несоответствий, пункт 8) и падает при деструктивных изменениях, а не применяет их молча.
- ~~В корне репозитория дополнительно лежали устаревшие SQL-файлы (`../migrations/`, `../supabase/migrations/`)~~ — **[ИСПРАВЛЕНО, Фаза 4, 2026-09-04]**: удалены целиком после проверки, что ни один автоматический процесс их не использовал (см. [`../docs/REVIEW.md`](../docs/REVIEW.md), пункт 19/находка про мёртвые миграции).
- Не проиндексированы явно (`@@index` отсутствует) внешние ключи на `User` в нескольких моделях (`UsageLog`, `Task`, `SystemNotification`, `LatexError`, `VisualAsset`, `Citation`, `CitationCollection`) — см. [`../docs/REVIEW.md`](../docs/REVIEW.md), пункт 10.
