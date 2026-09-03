# src/i18n/

## Что тут лежит

Конфигурация интернационализации на базе `next-intl`: список поддерживаемых локалей, обёртки над навигацией с учётом локали и загрузчик файлов переводов.

## Зачем существует

Next.js App Router использует сегмент `[locale]` (`src/app/[locale]/...`) для мультиязычности; `next-intl` требует единую точку конфигурации локалей (`routing.ts`), из которой строятся типобезопасные `Link`/`useRouter` (`navigation.ts`) и серверный резолвер сообщений на конкретный запрос (`request.ts`).

## Как использовать

Импортируется по всему `src/app/[locale]/**` и `src/components/**`: `import { Link, useRouter } from "@/i18n/navigation"` вместо `next/link`/`next/navigation`, чтобы ссылки автоматически учитывали текущую локаль. `request.ts` подключается автоматически плагином `next-intl` (см. `next.config.ts`), напрямую в компонентах не импортируется.

## Ключевые файлы

| Файл | Что в нём |
|---|---|
| `routing.ts` | `defineRouting({ locales: ["ru", "en", "kz"], defaultLocale: "ru" })` — единственный источник правды о поддерживаемых языках. |
| `navigation.ts` | `createNavigation(routing)` — экспортирует локале-осведомлённые `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`. |
| `request.ts` | Серверный конфиг для `next-intl`: по текущей локали запроса (с фолбэком на `defaultLocale`, если локаль не из списка) подгружает соответствующий JSON из `../../messages/{locale}.json` (файлы `messages/ru.json`, `messages/en.json`, `messages/kz.json` в корне репозитория, не в `src/`). |

## Известные ограничения / технический долг

Специфичных находок по этой директории в `docs/REVIEW.md` нет.
