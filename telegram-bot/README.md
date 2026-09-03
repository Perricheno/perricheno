# telegram-bot

Node/TypeScript Telegram-бот на [Telegraf](https://telegraf.js.org/) — основной пользовательский интерфейс продукта (см. корневой [`../README.md`](../README.md)). Бот не хранит бизнес-данные и не считает лимиты/тарифы сам — почти каждый хендлер сразу проксирует запрос на основной Next.js-сайт (`SITE_INTERNAL_URL`, внутренние роуты `/api/internal/bot/*`) и просто рендерит ответ в Telegram-разметку. Подробная бизнес-логика (лимиты, биллинг, генерация отчётов/визуализаций) — [`../docs/business_logic.md`](../docs/business_logic.md), полный список внутренних API — [`../docs/api_reference.md`](../docs/api_reference.md), поведение при недоступности сайта — [`../docs/integrations.md`](../docs/integrations.md).

Хендлеры (бизнес-логика по конкретным командам/сценариям) вынесены в отдельный README: [`src/handlers/README.md`](src/handlers/README.md).

## Как это устроено (по факту чтения `src/bot.ts`)

Один процесс держит **два** режима одновременно:

1. **Telegraf-бот** — команды (`/start`, `/me`, `/history`, `/billing`), inline-кнопки (`bot.action(...)`) и разбор диалоговых сценариев (`bot.on(["text","photo","document"], ...)`) — всё маршрутизируется на функции из `src/handlers/*`.
2. **Встроенный `http.createServer`** на порту `BOT_PORT` (дефолт `3001`, в compose переопределён на `3001`, наружу проброшен как `3033:3001`) с тремя путями:
   - `/api/webhook/telegram` — сюда Telegram шлёт обновления, если у процесса настроен вебхук (проверяется секретный заголовок `x-telegram-bot-api-secret-token` == `WEBHOOK_SECRET`);
   - `/bot-internal/*` — обратный канал: сайт может **пушить** боту команды (`update-visual` — обновить статус генерации в чате, `send-message` — отправить сообщение пользователю, `complete-visual` — прислать готовые визуализации), защищён заголовком `x-bot-secret` == `WEBHOOK_SECRET`;
   - `/health` — простой `200 {"status":"healthy"}`.

При старте (`main()`): если задан `WEBHOOK_DOMAIN` (или `WEBHOOK_URL`) — регистрируется вебхук на Telegram (`bot.telegram.setWebhook`); иначе — обычный long-polling (`bot.launch()`). Без `TELEGRAM_BOT_TOKEN` или `WEBHOOK_SECRET` процесс падает при старте (`process.exit(1)`).

### Сессии — не в памяти процесса, а на сайте

`src/sessionStore.ts` не хранит сессию локально как источник истины — при каждом апдейте (`bot.use` middleware в `bot.ts`) сессия загружается через `GET /api/internal/bot/session?userId=` и сохраняется обратно через `POST` после обработки. Поверх этого есть `localCache` (`Map<number, any>` в памяти процесса) — она нужна для скорости и как fallback: если сайт недоступен, сессия не теряется мгновенно (используется последнее известное значение из кэша), но при перезапуске самого бота кэш обнуляется и сессия учитывается заново с сайта (или как дефолтная, если сайт тоже недоступен). Кэш общий на процесс — при нескольких инстансах бота (сейчас не так, судя по `docker-compose.yml` — сервис один) сессии между инстансами не синхронизировались бы.

## Ключевые файлы

| Файл | Назначение |
|---|---|
| `src/bot.ts` | Точка входа: регистрация команд/кнопок Telegraf, внутренний HTTP-сервер (вебхук + push API + health), запуск вебхука/поллинга. |
| `src/sessionStore.ts` | Слой персистентности сессии диалога — читает/пишет сессию через внутренний API сайта, с in-memory кэшем поверх. |
| `src/telegraf.d.ts` | Расширение типа `Context` из `telegraf` полем `session` (`step`, `isProcessing`, `visual{...}`) — чтобы `ctx.session.*` типизировался без `as any` (хотя по факту в `bot.ts`/хендлерах `ctx` почти везде всё равно типизирован как `any`). |
| `src/keyboards/menu.ts` | Все inline-клавиатуры бота (главное меню, история, биллинг, визуализация, настройки/безопасность) — чистые функции, возвращающие `Markup.inlineKeyboard(...)`. |
| `src/utils/format.ts` | `escapeMarkdown()` — экранирование `_`, `*`, `` ` ``, `[` для легаси Telegram Markdown (не MarkdownV2). |
| `src/handlers/` | Обработчики команд/сценариев — см. [`src/handlers/README.md`](src/handlers/README.md). |

## Сборка и запуск локально

```bash
# из директории telegram-bot/
npm install
cp .env.example .env   # файла .env.example в репозитории нет — переменные завести вручную, см. ниже

npm run dev             # ts-node src/bot.ts, без сборки
# или
npm run build            # tsc → dist/
npm start                 # node dist/bot.js
```

Обязательные переменные окружения для старта (без них процесс падает сразу, `bot.ts:18`):
```env
TELEGRAM_BOT_TOKEN=...
WEBHOOK_SECRET=...
```
Остальные, влияющие на поведение: `SITE_INTERNAL_URL` (дефолт `http://perricheno-site:3000` — при локальном запуске вне Docker его почти всегда нужно переопределить на реальный адрес сайта), `BOT_PORT` (дефолт `3001`), `WEBHOOK_DOMAIN`/`WEBHOOK_URL` (если не заданы — используется long-polling вместо вебхука, что удобнее для локальной разработки без публичного HTTPS). Полный список и у кого ещё эти переменные используются — [`../docs/config_and_env.md`](../docs/config_and_env.md).

Через Docker:
```bash
docker build -t telegram-bot .
docker run --rm -p 3033:3001 \
  -e TELEGRAM_BOT_TOKEN=... -e WEBHOOK_SECRET=... \
  -e SITE_INTERNAL_URL=http://host.docker.internal:3000 \
  telegram-bot
```
`Dockerfile` — один стейдж на `node:20-alpine`, `npm install` → `npm run build` → `CMD ["node", "dist/bot.js"]`; healthcheck — `pgrep -f "node dist/bot.js"` (проверяет только что процесс жив, не что бот реально отвечает).

Реальный запуск (`npm install`/`npm run dev`/`docker build`) в рамках этого аудита не выполнялся — описание по чтению `package.json`, `tsconfig.json`, `Dockerfile`, `src/bot.ts`.

## Известные ограничения

- Почти весь код в хендлерах и `bot.ts` типизирован через `any` (`tsconfig.json`: `"strict": false`, `"noImplicitAny": false`) — типобезопасности Telegraf-контекста фактически нет, несмотря на наличие `telegraf.d.ts`.
- In-memory `localCache` в `sessionStore.ts` — единая точка отказа для сессий при недоступности сайта дольше времени жизни процесса; при рестарте бота все "непереживающие" перезапуск сессии откатываются на дефолт.
- `bot.catch(...)` в `bot.ts` — глобальный "бессмертный" обработчик ошибок: гасит три конкретных класса ошибок Telegram (`message is not modified`, `query is too old`, `message to edit not found`), остальные логирует и пытается ответить пользователю универсальным сообщением — то есть падения отдельных хендлеров не роняют процесс, но и не всегда явно всплывают в мониторинге за пределами `console.error`.
- Нет автотестов (см. корневой [`../README.md`](../README.md), раздел «Тестирование» — во всём репозитории тестов нет).
