# src/lib/

## Что тут лежит

Слой бизнес-логики и доступа к данным всего приложения. Всё, что обращается к Prisma/Postgres, MinIO, Telegram Bot API или собирает LaTeX/аналитические конвейеры, живёт здесь, а не в `src/app/api/*`, откуда эти функции импортируются.

## Зачем существует

Next.js App Router поощряет писать логику прямо в роут-хендлерах (`route.ts`) и server actions — в этом проекте общая для нескольких роутов логика (лимиты пользователя, CRUD над сессиями, генерация PDF-чеков и т.д.) вынесена сюда, чтобы не дублироваться между `src/app/api/**` и Telegram-ботом (`telegram-bot/`, который вызывает те же HTTP API, а не импортирует эти файлы напрямую).

## Как использовать

Импортируется напрямую из server-компонентов, server actions и route-хендлеров: `import { prisma } from "@/lib/prisma"`, `import { getUserById } from "@/lib/db"` и т.д. Отдельно не запускается.

## Подпапки — куда смотреть дальше

- **[`agent/`](agent/README.md)** — конвейер генерации научного LaTeX-отчёта (6 стадий) + база знаний для промптов LLM. Подробный README внутри.
- **[`analytics/`](analytics/README.md)** — конвейер генерации визуализаций/графиков (R/Python) из загруженных данных. Подробный README внутри.

## Ключевые файлы верхнего уровня

| Файл | Что в нём |
|---|---|
| `db.ts` (666 строк) | Главный CRUD-модуль: пользователи, `AgentSession`, `AgentUpload`, тарифные лимиты (`PLAN_LIMITS`, `PDF_STAGING_CAPS`), списание символов/визуализаций/отчётов (`checkAndDeductUsage`), реферальная программа, промокоды. Также содержит вызовы Telegram Bot API (`sendMessage`/`editMessageText`/`deleteMessage`) и планировщик на `setInterval`, запускаемый как побочный эффект импорта модуля — см. `docs/REVIEW.md`, пункт 11 («god file»). Подробности бизнес-правил — [`../../docs/business_logic.md`](../../docs/business_logic.md), раздел 2. |
| `prisma.ts` | Инициализирует единственный `PrismaClient` (через `@prisma/adapter-pg` поверх `pg.Pool`), кэширует его в `global` в dev-режиме, чтобы hot-reload не плодил новые подключения. |
| `session.ts` | Выпуск и проверка сессионной JWT-куки `perricheno_session` (библиотека `jose`). При отсутствии `SESSION_SECRET` намеренно бросает исключение при старте — фолбэк-секрет убран. Хранит IP/геолокацию и user-agent устройства в БД при логине. |
| `telegram-auth.ts` | Проверка подписи Telegram Login Widget (HMAC-SHA256 по алгоритму Telegram) через `verifyTelegramAuth()`. Требует `TELEGRAM_BOT_TOKEN` — бросает исключение, если не задан. |
| `storage.ts` | Клиент MinIO (`minio` SDK) для загрузки/скачивания пользовательских файлов; лимит файла 50 МБ. Обратите внимание — `accessKey`/`secretKey` MinIO имеют захардкоженные значения по умолчанию, если переменные окружения не заданы (см. `docs/REVIEW.md`, пункт про хардкод секретов). |
| `citations-db.ts` (192 строки) | CRUD для менеджера цитирования: `Citation` и `CitationCollection` через Prisma. Помечен `import 'server-only'`. |
| `space-db.ts` (594 строки) | CRUD для совместного LaTeX-редактора (Space): проекты, файлы, версии, коллабораторы, приглашения, роли (`owner`/`editor`/`viewer`). Помечен `import 'server-only'`. Подробности матрицы прав — [`../../docs/business_logic.md`](../../docs/business_logic.md), раздел 7. |
| `r-db.ts` | CRUD для сессий R Studio (`RSession`): хранит план/результаты генерации графиков в `results_json`. |
| `json-canvas.ts` | Чистые TypeScript-типы по спецификации [JSON Canvas 1.0](https://jsoncanvas.org/) (узлы text/file/link, рёбра) — используется страницей `/canvas`. Логики в файле нет, только интерфейсы. |
| `receiptGenerator.ts` (143 строки) | Генерация и сохранение PDF-чека об оплате (`generateAndStoreReceipt`) через `JSZip`; апсертит запись в модель `Receipt`. |
| `server-init.ts` | Однократная серверная инициализация (`initializeServer()`) — на момент чтения запускает только `startCleanupTask()` из `analytics/fileManager.ts` (очистка временных файлов аналитики). Флаг `initialized` в модульной переменной защищает от повторного запуска в рамках одного процесса. |
| `utils.ts` | Единственная функция `cn()` — обёртка `clsx` + `tailwind-merge` для условных Tailwind-классов. Стандартный shadcn/ui-паттерн. |
| `db-supabase-temp.ts` | Мёртвый файл-заглушка: 3 строки комментариев ("This is a placeholder so I can build it up correctly"), не импортируется нигде в проекте. Кандидат на удаление. |

## Известные ограничения / технический долг

- `db.ts` — «god file» с побочным эффектом (`setInterval`-планировщик на импорт модуля), смешивает домены (пользователи + Telegram API + биллинг-лимиты) — [`../../docs/REVIEW.md`](../../docs/REVIEW.md), пункт 11.
- Хардкод дефолтных секретов MinIO в `storage.ts` — [`../../docs/REVIEW.md`](../../docs/REVIEW.md), пункт 3.
- Ни одного тестового файла на эту логику (лимиты, идемпотентность, права доступа в Space) — [`../../docs/REVIEW.md`](../../docs/REVIEW.md), раздел «Отсутствие тестов на критичную логику».
- `db-supabase-temp.ts` — мёртвый код, оставшийся от миграции на Supabase.
