# scripts/ (корень репозитория)

## Что тут лежит

8 одноразовых скриптов для ручного запуска (`node scripts/x.js` / `npx tsx scripts/x.ts`), написанных для переноса данных между тремя историческими хранилищами проекта: локальный SQLite → Supabase (Postgres + Storage) → текущий self-hosted Postgres (Prisma) + MinIO.

## Зачем существует

Документирует (кодом, не текстом) путь миграции инфраструктуры проекта. **Это не часть текущего пайплайна деплоя** — ни один файл отсюда не вызывается из `deploy.sh` (в нём есть только `npx prisma db push`, скрипты из этой папки не упоминаются) и не вызывается из `package.json` → `scripts` (там только `dev`/`build`/`start`/`lint`). Запускались вручную владельцем проекта на конкретных этапах миграции и сейчас представляют историческую, а не действующую логику.

**Не путать с [`../src/scripts/`](../src/scripts/README.md)** — там лежит несвязанный одноразовый dev-скрипт для тестирования server actions, не про миграцию БД.

## Как использовать

Не используется в текущей работе системы. Если когда-либо понадобится повторить перенос данных (например, восстановление из старого дампа) — каждый скрипт ожидает переменные окружения (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MINIO_*`) и путь к файлу SQLite (`perricheno_real.db` в корне репозитория).

## Ключевые файлы

| Файл | Назначение (по факту чтения кода) |
|---|---|
| `migrate-to-supabase.js` | Первый этап: читает таблицы из локального SQLite (`better-sqlite3`, файл `perricheno_real.db`) и записывает их в Supabase через `@supabase/supabase-js`. |
| `supabase-schema.sql` | DDL-схема Postgres (`CREATE TABLE users`, `tasks`, и т.д. в snake_case), подготовленная для применения в Supabase перед переносом данных из SQLite — «целевая» схема для `migrate-to-supabase.js`. |
| `inspect-sqlite.mjs` | Диагностический read-only скрипт: открывает `perricheno_real.db` и печатает список таблиц, число строк и колонки каждой (использовался для проверки содержимого SQLite перед/во время миграции). |
| `migrate.js` | Второй этап: тянет данные по REST API Supabase (`fetch` на `${supabaseUrl}/rest/v1/...`) и пишет их напрямую в self-hosted Postgres через `pg.Pool`/`DATABASE_URL`, с маппингом snake_case-таблиц Supabase на PascalCase-модели Prisma (`tableMapping`). |
| `migrate-full.js` | Более полная версия `migrate.js` — та же логика (Supabase REST → self-hosted Postgres), но с пагинацией по 1000 строк (`fetchAll`) для таблиц, которые не помещаются в один REST-запрос. |
| `migrate-fix.js` | Точечный «доисправляющий» проход: повторно мигрирует только конкретные проблемные таблицы (`agent_sessions`, `agent_uploads`, `transactions`, `system_notifications`), включая переименование колонок (`columnRenames`, например `read` → `is_read` для `SystemNotification`). |
| `migrate-uploads.js` | Специализированная миграция именно `agent_uploads`: в две фазы — сначала лёгкие колонки-метаданные (`LIGHT_COLS`), отдельно тяжёлые (`text_content`, `images_json`), чтобы не упереться в лимиты одного запроса на больших файлах. |
| `migrate-to-minio.ts` | Третий этап: переносит файлы из локальной директории `data/uploads/` в MinIO (`minio` SDK) — перенос уже после того, как БД была на self-hosted Postgres. |

## Известные ограничения / технический долг

- Все скрипты хранят логику подключения к трём разным системам хранения (SQLite, Supabase, self-hosted Postgres/MinIO) без общей переиспользуемой конфигурации — каждый файл сам объявляет `Pool`/`createClient`/`Minio.Client".
- Скрипты полагаются на `.env.local` (`inspect-sqlite.mjs`, вручную парсящий файл построчно) или на переменные окружения, заданные в шелле — единого способа запуска (npm-скрипта) нет.
- Отдельных находок код-ревью по этим файлам в `docs/REVIEW.md` нет — они не относятся к рантайму продакшена, поэтому не разбирались построчно на безопасность.
