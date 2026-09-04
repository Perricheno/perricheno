# src/types/

## Что тут лежит

Два файла с общими TypeScript-типами, не привязанными к конкретному модулю: глобальные ambient-декларации для окружения Node и клиентский тип пользователя.

## Зачем существует

Хранит типы, которые нужны сразу нескольким частям клиентского кода (например, `User` используется и в `AdminContext.tsx`, и в `LoginModal.tsx`), а также технический файл, устраняющий ошибки редактора по глобальным Node-объектам.

## Как использовать

`user.ts` импортируется явно: `import { User } from "@/types/user"`. `globals.d.ts` — ambient-декларация, TypeScript подключает её автоматически по `tsconfig.json` (не импортируется руками).

## Ключевые файлы

| Файл | Что в нём |
|---|---|
| `globals.d.ts` | Объявляет `namespace NodeJS` с `ProcessEnv`/`Process` и глобальный `process`, чтобы редактор не подсвечивал ошибки по Node-глобалам, если `node_modules` не установлен локально; согласно комментарию в файле, на сервере эти декларации сливаются с настоящими `@types/node` без конфликта. |
| `user.ts` | Интерфейс `User` — клиентское представление пользователя: `id`, `telegram_id`, `username`, `first_name`, `photo_url`, `created_at`, тарифное поле `plan_tier`, счётчики использования (`daily_chars_used`, `weekly_chars_used`, `monthly_chars_used`, `purchased_chars`, `daily_visuals_used`, `purchased_visuals`, `daily_reports_used`, `purchased_reports`), `is_banned`, `isAdmin`. Соответствует (но не идентичен один в один) модели `User` в `prisma/schema.prisma` — подробный разбор полей БД: [`../../docs/data_model.md`](../../docs/data_model.md). |

## Известные ограничения / технический долг

- ~~`User.plan_tier` и `User.account_tier` — оба присутствуют и здесь, как два похожих по смыслу поля~~ — **[ИСПРАВЛЕНО, Фаза 4, 2026-09-04]**: `account_tier` удалён полностью (поле в схеме, все чтения/записи в коде, тип здесь). Расследование показало, что реальную квоту всегда проверял только `plan_tier` (`checkAndDeductUsage` в `src/lib/db.ts`), а `account_tier` писали/читали лишь два места — админский экшен `set_tier` и статус баланса в Telegram-боте — из-за чего отображаемый тариф мог разойтись с реально применяемым лимитом. См. [`../../docs/REVIEW.md`](../../docs/REVIEW.md), пункт 20.
