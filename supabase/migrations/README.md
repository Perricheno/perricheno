# supabase/migrations/

## Что тут лежит

Три «сырых» SQL-файла для ручного выполнения в SQL-редакторе Supabase: `2026-04-22-storage-migration.sql`, `20260422_citations.sql`, `20260423_space.sql`.

## ⚠️ Важно: это не актуальный источник схемы

Как и [`../../migrations/`](../../migrations/README.md) в корне репозитория, эта папка описывает схему БД из более раннего этапа проекта (Supabase как БД + Supabase Auth/Storage), которая **не совпадает** с тем, что сейчас создаёт `npx prisma db push` из `prisma/schema.prisma` (см. [`../../prisma/README.md`](../../prisma/README.md)) — единственного актуального источника схемы (см. также [`../../docs/data_model.md`](../../docs/data_model.md)). Отличия, которые делают эти файлы непригодными как документацию текущей БД:

- Таблицы в lowercase (`citations`, `spaces`, `space_files`) вместо PascalCase-моделей Prisma (`Citation`, `Space`, `SpaceFile`).
- RLS-политики на `auth.uid()` — конвенция Supabase Auth, которым проект не пользуется (аутентификация — через Telegram + собственная JWT-сессия, `src/lib/session.ts`).
- Код приложения (`src/lib/citations-db.ts`, `src/lib/space-db.ts`, `src/lib/storage.ts`) обращается к данным исключительно через Prisma Client и MinIO — ни к Supabase Storage, ни к таблицам, которые создали бы эти файлы.

## Ключевые файлы

| Файл | Что в нём |
|---|---|
| `2026-04-22-storage-migration.sql` | Создаёт Supabase Storage bucket `agent-uploads`, добавляет колонки `storage_path`/`file_size`/`mime_type` в (Supabase-версию) `agent_uploads`, настраивает RLS storage-политики. Текущая система хранения файлов — MinIO ([`../../src/lib/README.md`](../../src/lib/README.md), файл `storage.ts`), не Supabase Storage. |
| `20260422_citations.sql` | DDL для таблицы `citations` (менеджер библиографии): `doi`/`arxiv_id`/`isbn`, массивы `authors`/`tags`, `bibtex`, `cite_key`. По данным [`../../docs/data_model.md`](../../docs/data_model.md), здесь был constraint `UNIQUE(user_id, cite_key)`, которого **нет** в актуальной Prisma-модели `Citation` — то есть в реальной рабочей схеме два одинаковых `cite_key` у одного пользователя технически возможны (см. [`../../docs/REVIEW.md`](../../docs/REVIEW.md), раздел «Можно отложить»). |
| `20260423_space.sql` | DDL для таблиц совместного LaTeX-редактора (`spaces`, файлы, версии, коллабораторы, приглашения) — Supabase-версия того, что сейчас в Prisma-моделях `Space`/`SpaceFile`/`SpaceVersion`/`SpaceCollaborator`/`SpaceInvite`. |

## Известные ограничения / технический долг

Как и для `migrations/` в корне — эти файлы рискуют быть приняты за актуальную документацию схемы. Требует уточнения у владельца, можно ли их удалить или стоит явно пометить как архив. См. [`../../docs/REVIEW.md`](../../docs/REVIEW.md), пункт 10.
