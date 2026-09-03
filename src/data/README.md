# src/data/

## Что тут лежит

Три файла: один живой рантайм-конфиг (`settings.json`) и два TypeScript-модуля со статическим текстом (`privacy_content.ts`, `terms_content.ts`), которые, по факту проверки импортов, **нигде в приложении не используются**.

## Зачем существует

`settings.json` — это персистентное хранилище настроек экспериментальной страницы чата (`/chat`, компонент `src/components/ChatPage.tsx`): вебхуки n8n, выбранная модель, системный промпт, температура. Читается и перезаписывается server actions `getSettings`/`saveSettings` из `src/app/actions.ts` (`SETTINGS_FILE = path.join(process.cwd(), "src", "data", "settings.json")`) — то есть это не просто дефолт, а файл, в который приложение реально пишет при сохранении настроек через UI.

`privacy_content.ts`/`terms_content.ts`, судя по всему, были более ранней версией контента страниц Privacy/Terms (текст на английском и русском прямо в TS-константах `PRIVACY_CONTENT`/`TERMS_CONTENT`). Актуальные страницы (`src/app/[locale]/privacy/page.tsx`, `src/app/[locale]/terms/page.tsx`) читают контент из `.md`-файлов в [`../content/`](../content/README.md) через `fs.readFileSync`, а не из этих констант — грep по всему репозиторию не находит ни одного импорта `PRIVACY_CONTENT`/`TERMS_CONTENT`/`privacy_content`/`terms_content` за пределами самих этих файлов.

## Как использовать

`settings.json` не импортируется как модуль — с ним работают исключительно через `getSettings()`/`saveSettings()` в `src/app/actions.ts`, читающие/пишущие файл по пути на диске. `privacy_content.ts`/`terms_content.ts` можно импортировать как обычные TS-модули, но на практике этого не делает никто.

## Ключевые файлы

| Файл | Что в нём |
|---|---|
| `settings.json` | Живой конфиг: `webhookTest`/`webhookProd` (URL n8n-инстанса), `useTestWebhook`, `models`/`selectedModel` (на момент чтения — `gemini-2.0-flash`), `systemPrompt`, `temperature`, `maxTokens`. |
| `privacy_content.ts` (95 строк) | `PRIVACY_CONTENT` — объект `{ en: "...", ru: "..." }` с полным текстом политики конфиденциальности внутри template-строк. Не импортируется нигде в `src/`. |
| `terms_content.ts` (120 строк) | `TERMS_CONTENT` — аналогичный объект для условий использования. Не импортируется нигде в `src/`. |

## Известные ограничения / технический долг

- `privacy_content.ts` и `terms_content.ts` выглядят как мёртвый код — дублируют (устаревшую версию) контента, который реально отдаётся из `src/content/*.md`. Кандидаты на удаление, но окончательное решение — **требует уточнения у владельца** (не исключено, что это черновик будущей замены текущего `.md`-подхода).
- `settings.json` — конфиг для функциональности, которая в [`../../docs/REVIEW.md`](../../docs/REVIEW.md) (раздел «Можно отложить», заметка про `src/app/actions.ts:23`) отмечена как «похожий на неиспользуемый черновик мультимодельного чата поверх n8n» — стоит уточнить у владельца актуальность всего пути `/chat` целиком.
