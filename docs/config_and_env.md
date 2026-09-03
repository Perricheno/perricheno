# Переменные окружения и конфигурация — Perricheno

## 0. Общие сведения

В проекте **нет** единого загрузчика конфигурации, `.env.example` или центральной схемы валидации переменных окружения (ни zod-схемы, ни `envalid`, ничего подобного не найдено). Каждый файл — будь то `route.ts` в Next.js-приложении, обработчик `telegram-bot`, либо Go-сервис — читает нужную переменную напрямую в месте использования: `process.env.X` (TS/JS) или `os.Getenv("X")` (Go). Обязательность переменной определяется по факту: явная проверка с `throw`/`process.exit(1)` в коде — REQUIRED; иначе — используется fallback-значение (тогда описана его логика) либо переменная просто становится `undefined`/`""` без явной проверки.

Репозиторий не содержит файла `.env` или `.env.example` — секреты живут только на сервере (переданы через GitHub Actions secrets, см. раздел 9) и в `docker-compose.yml`/Dockerfile для несекретных или служебных значений.

Ниже — сгруппировано по сервисам (сервисы соответствуют `docker-compose.yml`): **perricheno-site**, **telegram-bot**, **ws-server**, **r-compiler**, **python-compiler**, **research-api**, **pdf-extractor**. В конце — раздел про сами файлы деплоя (`docker-compose.yml`, `.github/workflows/deploy.yml`, `deploy.sh`, `next.config.ts`) и сводка находок, требующих уточнения у владельца.

---

## 1. `perricheno-site` (основное Next.js-приложение, `src/**`)

### 1.1 Сессии, авторизация, безопасность

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `SESSION_SECRET` | `src/lib/session.ts:5-9` | Ключ подписи JWT пользовательской сессии (cookie `perricheno_session`), HS256. | **REQUIRED** — модуль явно бросает `throw new Error(...)` при импорте, если переменная не задана: "SESSION_SECRET env var is not set - refusing to start with a predictable JWT key". Это делает всё приложение неработоспособным без неё (throw происходит на этапе загрузки модуля, который импортируется почти всеми API-роутами). |
| `WEBHOOK_SECRET` | Десятки файлов: все `src/app/api/internal/bot/**/route.ts` (сравнение с заголовком `x-bot-secret`), `src/app/api/webhook/telegram/route.ts:5`, `src/app/api/r/upload/route.ts:8`, `src/lib/receiptGenerator.ts:75` | Общий межсервисный секрет для проверки, что internal-эндпоинты вызываются легитимно из контейнера `telegram-bot` (заголовок `x-bot-secret`/`X-Bot-Secret`), а также используется как HMAC-ключ для подписи в `receiptGenerator.ts`. | Не выбрасывает исключение при отсутствии — просто ни один секрет не совпадёт с `undefined`, и internal-роуты всегда будут отвечать 401/403. Фактически обязателен для работы бота, но проверяется не централизованно, а поэлементным сравнением в каждом роуте. В `receiptGenerator.ts:75` есть **fallback на строку-плейсхолдер** (не настоящий секрет, а очевидное dev-значение) — используется как HMAC-ключ, если `WEBHOOK_SECRET` не задан. |
| `WS_JWT_SECRET` | `src/app/api/space/[id]/ws-token/route.ts:19` | Ключ подписи JWT-токена для подключения к совместному редактору (`ws-server`, Yjs). | Не обязателен формально: есть **захардкоженный fallback-литерал** (строка-заглушка вида `fallback-secret-key-...`) — **тот же самый литерал**, что и в `ws-server/server.js:8`, поэтому подписанные токены проверяются корректно даже без установки переменной, но с предсказуемым (публично известным из исходников) ключом — слабое место безопасности, если переменная не выставлена в проде. |
| `ALLOWED_WEBHOOK_HOSTS` | `src/app/api/webhook-proxy/route.ts:4` | Allow-list хостов (через запятую) для SSRF-защиты прокси на внешние n8n-вебхуки. | Fallback — пустая строка → после `.split(",").filter(Boolean)` получается пустой массив, то есть **все хосты будут отклонены** (`"Webhook host not allowed"`, 403). Без явной установки функциональность `webhook-proxy` полностью недоступна ни для одного хоста. |

### 1.2 База данных

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `DATABASE_URL` | `src/lib/prisma.ts:5`, `prisma.config.ts:9` | Строка подключения PostgreSQL для Prisma ORM. | Нет explicit-проверки в `prisma.ts` (просто передаётся в `new Pool({connectionString})`/адаптер) — при отсутствии Prisma сама упадёт на первом запросе. В `prisma.config.ts:9` есть fallback на стандартный локальный dev-адрес (`localhost`, порт 5432, дефолтные учётные данные `postgres`/`postgres`) — используется только инструментами Prisma CLI (`prisma migrate`, `prisma db push`), не самим приложением в рантайме. В `docker-compose.yml:14` для контейнера `perricheno-site` эта переменная **захардкожена прямо в `environment:`** (а не читается из `.env`) и содержит логин/пароль, совпадающие с `POSTGRES_USER`/`POSTGRES_PASSWORD` того же файла (строки 157-158) — см. "требует уточнения". |
| `NODE_ENV` | `src/lib/prisma.ts:16,19` (уровень логирования Prisma, инициализация глобального клиента только вне `production`), `src/lib/session.ts:50` (флаг `secure` для cookie сессии), `next.config.ts` косвенно (стандартное поведение Next.js) | Стандартный Node/Next.js признак окружения. | Не обязателен, стандартные умолчания Node. В `docker-compose.yml:15` явно выставлен в `production` для `perricheno-site`. |

### 1.3 LLM и генерация

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `OPENAI_API_KEY` | Повсеместно: `agent/generate`, `agent/chat`, `agent/visualize*`, `agent/analytics/generate`, `agent/data-analytics`, `canvas/generate`, `tikz/generate`, `r/generate`, `space/[id]/ai-edit`, `space/[id]/ai-fix`, `tasks/parse`, `internal/bot/visual/generate`, `src/lib/agent/pipeline/llm.ts:56`, `src/app/[locale]/dashboard/actions.ts:95` | Ключ доступа к OpenAI API — используется для всей генерации текста/кода/визуализаций через модели GPT. | Не проверяется централизованно: **каждый роут отдельно** делает `if (!OPENAI_API_KEY) return 500 "... not configured"` (либо `503 "AI not configured"` в `space/[id]/ai-edit`/`ai-fix`) — единой точки проверки нет, поэтому сообщения об ошибке в разных роутах отличаются текстом (см. `docs/error_codes.md`). |

### 1.4 Внутренние Go-сервисы (компиляция, извлечение, поиск)

| Переменная | Где используется | Назначение | Обязательность / fallback |
|---|---|---|---|
| `R_COMPILER_URL` | `agent/data-analytics`, `agent/visualize`, `agent/r-compile`, `r/generate`, `internal/bot/compile`, `internal/bot/visual/compile`, `internal/bot/visual/generate`, `src/lib/analytics/pipeline/stage3_generate.ts`, `src/lib/agent/pipeline/stage2_6_r_figures.ts`, `src/app/[locale]/dashboard/actions.ts:131` | URL Go-сервиса `r-compiler`. | Fallback `http://r-compiler:8000` — совпадает с именем сервиса в `docker-compose.yml`, поэтому работает "из коробки" в Docker-сети без явной установки. |
| `PYTHON_COMPILER_URL` | Аналогичный набор файлов + `agent/python-compile` | URL Go-сервиса `python-compiler`. | Fallback `http://python-compiler:8000` — так же совпадает с сервисом compose. |
| `RESEARCH_API_URL` | `src/app/api/agent/scholar/search/route.ts:81` | URL Go-сервиса поиска научных статей (`research-api`, arXiv/OpenAlex). | Fallback `http://127.0.0.1:8080` — **не совпадает** с именем сервиса в Docker-сети (`research-api`), поэтому fallback работает только при локальном запуске вне Docker. В проде переменная явно выставлена в `docker-compose.yml:18` (`http://research-api:8080`), так что на практике проблема не проявляется, пока эта строка docker-compose не изменится. |
| `PDF_EXTRACTOR_URL` | `src/lib/agent/pdfIngest.ts:8`, `src/app/api/internal/bot/extract-text/route.ts:4` | URL Go-сервиса `pdf-extractor` (OCR/извлечение текста из PDF). | Fallback `http://pdf-extractor:8080` — совпадает с именем сервиса compose. |
| `LATEX_COMPILER_URL` | `agent/compile-pdf/route.ts:8`, `tikz/generate/route.ts:11` (через `!` non-null assertion — TS считает переменную обязательной, но рантайм-проверки нет), `space/[id]/compile/route.ts:9`, `src/lib/agent/pipeline/stage5_validate.ts:14`, `src/lib/agent/pipeline/stage2_3_visuals.ts:12` (тоже `!`), `src/lib/receiptGenerator.ts:110` (fallback `http://latex-compiler:8000`), `src/app/[locale]/dashboard/actions.ts:107` (тот же fallback), `internal/bot/history/files/route.ts:122` | URL внешнего сервиса компиляции LaTeX→PDF (судя по названиям сообщений об ошибках — "внешний" облачный компилятор, а не контейнер из `docker-compose.yml`, где такого сервиса нет). | Смешанная обязательность: часть файлов использует `!` (TypeScript-only "доверие", без рантайм-проверки — при реальном отсутствии переменной в шаблонную строку попадёт `undefined`), часть — `if (!COMPILER_URL) return 500 "Compiler not configured"/503`, часть — fallback на `http://latex-compiler:8000`. **Важно**: хоста `latex-compiler` нет ни в одном сервисе `docker-compose.yml` — этот fallback нерабочий в текущей топологии (см. "требует уточнения"). |
| `LATEX_COMPILER_KEY` | Парой с `LATEX_COMPILER_URL` во всех перечисленных выше файлах | API-ключ авторизации к внешнему LaTeX-компилятору. | Та же обязательность, что и у `LATEX_COMPILER_URL` (используются всегда вместе). |
| `INTERNAL_EXTRACT_URL` | `src/app/api/r/upload/route.ts:9` | Внутренний URL для извлечения текста из загруженных файлов (используется R Studio модулем). | Fallback `http://localhost:3000/api/internal/bot/extract-text` — self-referential вызов приложения самого себя. |
| `PDF_SERVICE_URL` | `src/app/api/internal/bot/history/files/route.ts:6` | URL стороннего внешнего сервиса генерации/конвертации PDF (не путать с локальным Go-контейнером `pdf-extractor` — это другой, внешний хост). | Fallback `"https://pdf.perricheno.ru/api/v1"`. |
| `PDF_API_KEY` | `src/app/api/internal/bot/history/files/route.ts:7` | API-ключ авторизации к сервису `PDF_SERVICE_URL`. | Fallback — **захардкоженный литерал**, похожий по формату на реальный UUID-ключ (см. раздел 8) — значение не воспроизводится в этом документе. |

### 1.5 Биллинг

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `CRYPTOCLOUD_API_KEY` | `billing/checkout/route.ts:5`, `billing/webhook/route.ts:6`, `internal/bot/billing/route.ts:6`, `src/app/[locale]/callback/route.ts:5` | API-ключ платёжного шлюза CryptoCloud (криптовалютные платежи). | Нет явной REQUIRED-проверки — при отсутствии запросы к CryptoCloud просто будут неавторизованы (500/502 через общий catch). |
| `CRYPTOCLOUD_SHOP_ID` | `billing/checkout/route.ts:6`, `internal/bot/billing/route.ts:7` | ID магазина в CryptoCloud. | Нет явной проверки. |
| `CRYPTOCLOUD_SECRET` | `billing/webhook/route.ts:7`, `src/app/[locale]/callback/route.ts:6` | HMAC-секрет для проверки подписи вебхука CryptoCloud. | **Explicit-проверка** в `billing/webhook/route.ts:54-57`: если не задан — лог `"🚨 CRITICAL..."` и `500 "Server misconfiguration"`, вебхук отключает себя ради безопасности вместо работы без проверки подписи. |
| `WEBHOOK_DOMAIN` | `billing/webhook/route.ts:199`, `billing/checkout/route.ts:11`, `internal/bot/billing/route.ts:263` и др. (везде — для построения публичных ссылок на чеки/отчёты), а также в `receiptGenerator.ts:46` через `.replace()`, и как источник домена для регистрации Telegram-вебхука в `telegram-bot` | Публичный домен сайта для формирования абсолютных ссылок. | Везде fallback `'https://perricheno.ru'` (кроме telegram-bot, где используется без fallback как один из двух кандидатов — см. раздел 2). |

`KASPI_MERCHANT_ID`/`KASPI_API_KEY`/`KASPI_API_BASE_URL`/`KASPI_WEBHOOK_SECRET` **удалены 2026-09-03** вместе со всей Kaspi Pay интеграцией (заброшена, подтверждено владельцем) — код, который их читал, больше не существует.

### 1.6 Интеграция с Telegram

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `src/lib/telegram-auth.ts:3` (проверка подписи Telegram Login Widget), `src/lib/db.ts:328,473,500,521` (пуш-уведомления пользователям через Bot API), `billing/checkout`, `billing/kaspi-webhook`, `billing/webhook`, `telegram/send/route.ts:4`, `webhook/telegram/route.ts:19` | Токен Telegram-бота — используется на стороне сайта параллельно с `telegram-bot`-контейнером (например, для верификации подписи виджета логина и точечных нотификаций из Next.js-кода, минуя очередь бота). | Нет explicit-проверки в большинстве мест на стороне сайта (просто `undefined` при отсутствии → запросы к Telegram API будут падать). |
| `TELEGRAM_BOT_USERNAME` | `src/app/api/auth/link/route.ts:16` | Юзернейм бота для построения deep-link (`https://t.me/<username>?start=...`). | Fallback `"PerrichenoBot"`. |
| `BOT_CONTAINER_URL` | `src/app/api/webhook/telegram/route.ts:3-4` | Внутренний URL контейнера `telegram-bot`, куда сайт форвардит апдейты из Telegram-вебхука. | Fallback: если `NODE_ENV === "development"` → `http://localhost:3001`, иначе → `http://telegram-bot:3001` (имя сервиса в Docker-сети). |
| `SITE_INTERNAL_URL` | `src/lib/receiptGenerator.ts:46` (только для подстановки в URL проверки чека) | Обратный адрес — используется только на стороне сайта в одном месте; основной потребитель этой переменной — `telegram-bot` (см. раздел 2), где сайт выступает получателем запросов, а не источником переменной. | Нет проверки, используется как часть строки. |

### 1.7 Файловое хранилище (MinIO / S3-совместимое)

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `MINIO_ENDPOINT` | `src/lib/storage.ts:8` | Хост MinIO-сервера. | Fallback `'localhost'`. |
| `MINIO_PORT` | `src/lib/storage.ts:9` | Порт MinIO. | Fallback `'9000'` (парсится через `parseInt`). |
| `MINIO_USE_SSL` | `src/lib/storage.ts:10` | Использовать ли SSL для подключения к MinIO. | Сравнение `=== 'true'` — по умолчанию (при отсутствии/любом другом значении) `false`. |
| `MINIO_ACCESS_KEY` | `src/lib/storage.ts:11` | Access key MinIO. | Fallback — литерал, совпадающий с `MINIO_ROOT_USER`, захардкоженным в `docker-compose.yml:175` и `.github/workflows/deploy.yml:86` (см. "требует уточнения" — один и тот же несекретный-по-факту логин повторён в 3 местах). |
| `MINIO_SECRET_KEY` | `src/lib/storage.ts:12` | Secret key MinIO. | Fallback — литерал, совпадающий с `MINIO_ROOT_PASSWORD` из `docker-compose.yml:176`/`minio-init` entrypoint (`docker-compose.yml:201`) и `.github/workflows/deploy.yml:87` — тот же секрет захардкожен в 3+ местах репозитория (не значение секрета, а факт совпадения — см. ниже). |
| `MINIO_BUCKET_NAME` | `src/lib/storage.ts:15` | Имя бакета для хранения крупных загруженных файлов. | Fallback `'perricheno-bucket'`. |

### 1.8 Клиентские (`NEXT_PUBLIC_*`) и сборочные переменные

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `NEXT_PUBLIC_WS_URL` | `src/app/[locale]/space/[spaceId]/hooks/useYjsSpace.ts:43` (клиентский React-хук, `"use client"`) | URL WebSocket-сервера (`ws-server`) для подключения совместного редактора Yjs из браузера. | **[ИСПРАВЛЕНО, Фаза 2, 2026-09-03]**: раньше не передавалась как build-`ARG`, поэтому клиентский бандл всегда содержал fallback `"ws://localhost:3035"` независимо от `.env` — реальный баг, подтверждён реальной сборкой Docker-образа (grep по собранным JS-чанкам до и после фикса). Теперь `Dockerfile` объявляет `ARG NEXT_PUBLIC_WS_URL` + `ENV`, `docker-compose.yml` передаёт её через `build.args` из `.env`. |
| `NEXT_PUBLIC_APP_URL` | `src/app/api/agent/generate/route.ts:70`, `src/app/api/space/[id]/share/route.ts:23`, `src/app/api/space/[id]/invite/route.ts:24` | Публичный базовый URL сайта — используется для построения ссылок на расшаренные отчёты/приглашения. | Fallback `'https://perricheno.ru'`. **Уточнено в Фазе 2**: несмотря на приставку `NEXT_PUBLIC_`, все три места использования — серверный код (`route.ts`, никогда не бандлится в клиент), поэтому переменная читается из `process.env` в рантайме контейнера как обычно и **не требует** build-ARG — старая находка об одинаковой проблеме для обеих переменных была неверной для этой конкретной переменной. |
| `NEXT_SKIP_TYPE_CHECK` | `next.config.ts:12` (`typescript.ignoreBuildErrors`), `Dockerfile:19` (`ENV NEXT_SKIP_TYPE_CHECK=true`) | Отключает проверку типов при `next build` в Docker-образе (расчёт на то, что типы уже проверены в CI — см. `.github/workflows/deploy.yml`, job `typecheck`). | Сравнение `=== "true"`; в самом Dockerfile всегда `true`. |
| `NEXT_SKIP_LINT` | Только `Dockerfile:21` (`ENV NEXT_SKIP_LINT=true`), комментарий "Skip ESLint in Docker build" | По имени должен отключать ESLint при сборке. | **Нигде не читается кодом** (ни в `next.config.ts`, ни где-либо ещё) — переменная выставлена в Dockerfile, но не имеет эффекта; фактическое поведение ESLint при `next build` определяется отдельной опцией Next.js (`eslint.ignoreDuringBuilds`), которая не настроена. См. "требует уточнения". |
| `NEXT_TELEMETRY_DISABLED` | `Dockerfile:17,37` | Стандартная переменная Next.js CLI для отключения телеметрии. | Не читается кастомным кодом — потребляется самим `next`/`create-next-app` CLI. |
| `UV_THREADPOOL_SIZE` | `Dockerfile:24` | Размер пула потоков libuv (влияет на Node.js I/O под капотом). | Не читается кастомным кодом — потребляется Node.js рантаймом. |
| `GENERATE_SOURCEMAP` | `Dockerfile:26` | По комментарию — "Disable source maps in production for faster build". | Эта переменная — конвенция Create React App/webpack; Next.js её не читает (в Next есть отдельная опция `productionBrowserSourceMaps`, которая и так явно выставлена в `false` в `next.config.ts:15`). Похоже на не имеющий эффекта leftover. См. "требует уточнения". |
| `PORT` | `Dockerfile:59` (`ENV PORT=3000`) | Порт, который слушает standalone-сервер Next.js (`server.js` из `.next/standalone`). | Читается самим Next.js рантаймом (framework-level), не кастомным кодом проекта. |
| `HOSTNAME` | `Dockerfile:60` (`ENV HOSTNAME="0.0.0.0"`) | Хост, на который биндится standalone-сервер. | Framework-level, как и `PORT`. |
`WS_SERVER_INTERNAL_URL` **удалена 2026-09-03** — была объявлена в `docker-compose.yml`, но нигде не читалась (клиент подключается к `ws-server` напрямую через `NEXT_PUBLIC_WS_URL`, минуя сервер); подтверждено повторным grep по `src/`, `telegram-bot/`, `ws-server/` перед удалением.

---

## 2. `telegram-bot` (Node/TypeScript, `telegram-bot/src/**`)

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `telegram-bot/src/bot.ts:13` | Токен Telegram-бота (`Telegraf(BOT_TOKEN)`). | **REQUIRED** — `telegram-bot/src/bot.ts:18-21`: `if (!BOT_TOKEN \|\| !WEBHOOK_SECRET) { console.error("FATAL: ..."); process.exit(1); }` — процесс завершается при старте. |
| `WEBHOOK_SECRET` | `telegram-bot/src/bot.ts:15`, `telegram-bot/src/sessionStore.ts:5`, и во всех `telegram-bot/src/handlers/*.ts` (`auth.ts`, `billing.ts`, `visual.ts`, `referral.ts`, `tasks.ts`, `history.ts`) | Тот же межсервисный секрет, что и на стороне сайта — передаётся в заголовке `X-Bot-Secret` при каждом вызове `internal/bot/*` эндпоинтов сайта. | **REQUIRED** (совместно с `TELEGRAM_BOT_TOKEN`, та же проверка `process.exit(1)` в `bot.ts:18-21`). Читается с `\|\| ""` fallback в объявлении, но реально недоступность значения фатальна. |
| `SITE_INTERNAL_URL` | `telegram-bot/src/bot.ts:14`, `telegram-bot/src/sessionStore.ts:4`, и во всех `telegram-bot/src/handlers/*.ts` | Внутренний URL сайта (`perricheno-site`), на который бот шлёт все запросы к `internal/bot/*` API. | Fallback `"http://perricheno-site:3000"` — совпадает с именем сервиса в `docker-compose.yml`. |
| `BOT_PORT` | `telegram-bot/src/bot.ts:16,394` | Порт, на котором бот поднимает свой внутренний HTTP-сервер (принимает вебхуки от Telegram и push-запросы от сайта). | Fallback `3001`; в `docker-compose.yml:142` явно выставлен как `3001`. |
| `WEBHOOK_DOMAIN` | `telegram-bot/src/bot.ts:399`, `telegram-bot/src/keyboards/menu.ts:55` | Публичный домен для регистрации Telegram-вебхука (`setWebhook`) и для формирования ссылок "посмотреть на сайте" в кнопках бота. | В `bot.ts:399` — один из двух кандидатов (`process.env.WEBHOOK_DOMAIN \|\| process.env.WEBHOOK_URL`); если оба не заданы — вебхук не регистрируется вовсе (бот тогда работать не будет в режиме получения сообщений через вебхук). В `menu.ts:55` — fallback `"perricheno.ru"`. |
| `WEBHOOK_URL` | `telegram-bot/src/bot.ts:399` | Альтернативное имя той же переменной домена — используется только как второй вариант, если `WEBHOOK_DOMAIN` не задан. | Не обязателен сам по себе, но один из двух (`WEBHOOK_DOMAIN`/`WEBHOOK_URL`) нужен для регистрации вебхука. |

---

## 3. `ws-server` (Node/JS, `ws-server/server.js`)

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `WS_JWT_SECRET` | `ws-server/server.js:8` | Ключ проверки JWT-токена подключения к комнате совместного редактирования (Yjs). | Fallback — тот же захардкоженный литерал-заглушка, что и в `src/app/api/space/[id]/ws-token/route.ts:19` (см. раздел 1.1) — согласованный, но небезопасный дефолт. |
| `WS_PORT` | `ws-server/server.js:9` | Порт HTTP/WS-сервера. | Fallback `'1234'`; в `docker-compose.yml:120` явно выставлен как `1234`. |

---

## 4. `r-compiler` (Go, `r-compiler/main.go`)

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `PORT` | `r-compiler/main.go:153` (`os.Getenv("PORT")`) | Порт HTTP-сервера компилятора R. | Fallback `"8000"`. В `docker-compose.yml` для сервиса `r-compiler` эта переменная не задаётся вовсе — значит всегда используется дефолт `8000` (что совпадает с портом, который ожидают клиенты вроде `R_COMPILER_URL=http://r-compiler:8000`). |

Единственная переменная окружения сервиса. Все остальные параметры (пакеты R, таймаут выполнения — 30 сек, размер изображения) захардкожены константами в `main.go`.

---

## 5. `python-compiler` (Go, `python-compiler/main.go`)

| Переменная | Где используется | Назначение | Обязательность |
|---|---|---|---|
| `PORT` | `python-compiler/main.go:182` (`os.Getenv("PORT")`) | Порт HTTP-сервера компилятора Python. | Fallback `"8000"`, аналогично `r-compiler`. |

Структура полностью аналогична `r-compiler` — единственная переменная, остальное захардкожено (таймаут 30 сек и т.д.).

---

## 6. `research-api` (Go, `research-api/main.go`)

**Переменных окружения не найдено вовсе** (`os.Getenv`/`os.environ` не встречается ни разу в `research-api/main.go`). Порт сервера захардкожен константой в коде (`:8080`, `main.go:48`), URL внешних API (arXiv, OpenAlex) захардкожены как строковые константы/шаблоны прямо в функциях `fetchArxiv`/`fetchOpenAlex`. Единственный "конфигурационный" параметр — email в `mailto=admin@perricheno.com` (строка 117), захардкожен в URL-запросе к OpenAlex API (требование их этикета вежливого использования API), не является секретом.

---

## 7. `pdf-extractor` (Go + Gin, `pdf-extractor/main.go`)

**Переменных окружения также не найдено** (`os.Getenv`/`os.environ` не встречается). Порт сервера захардкожен (`:8080`, `main.go:72`). Более того, все параметры доступа к внешнему OCR-сервису PaddleOCR тоже захардкожены константами прямо в исходнике, а не вынесены в окружение:

- `pdf-extractor/main.go:44` — `asyncJobURL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"`
- `pdf-extractor/main.go:45` — `asyncModel = "PaddleOCR-VL"`
- `pdf-extractor/main.go:48` — `syncAPIURL = "https://a8gec0nct6gb48gc.aistudio-app.com/layout-parsing"`
- `pdf-extractor/main.go:50` — **`apiToken` — API-токен доступа к PaddleOCR, захардкожен строковым литералом прямо в исходном коде.** Значение не воспроизводится в этом документе; факт — токен закоммичен в открытый код сервиса, а не читается из окружения.

Это резко отличается от остальных трёх Go-сервисов: `r-compiler`/`python-compiler` хотя бы читают `PORT` из окружения, а `pdf-extractor` не параметризован окружением вообще, несмотря на то что хранит там третьесторонний API-ключ.

---

## 8. Захардкоженные значения (найдены буквально в коде/конфиге, не через `process.env`/`os.Getenv`)

Ниже — места, где значение, которое логически должно быть секретом или параметром окружения, вместо этого записано литералом прямо в файле. Согласно заданию, сами значения секретов здесь не воспроизводятся — указаны только файл, строка и факт.

| Файл:строка | Что захардкожено | Комментарий |
|---|---|---|
| `get_bot_name.js:3` | Токен Telegram Bot API вида `<numeric_id>:<35-символьный токен>`, встроен прямо в URL `https://api.telegram.org/bot<TOKEN>/getMe` | Одноразовый скрипт-утилита в корне репозитория (не часть какого-либо `docker-compose`-сервиса, не запускается в проде) — вероятно, dev-инструмент для получения юзернейма бота по токену. Токен в нём захардкожен, а не взят из `process.env.TELEGRAM_BOT_TOKEN`, хотя такая переменная существует и используется везде в проекте. |
| `docker-compose.yml:14` | Полная строка подключения `DATABASE_URL` для сервиса `perricheno-site`, включающая логин и пароль | Значение не читается из `.env`, а прописано прямо в `environment:` этого файла; логин/пароль внутри неё совпадают с `POSTGRES_USER`/`POSTGRES_PASSWORD` того же файла (строки 157-158). |
| `docker-compose.yml:157-158` | `POSTGRES_USER` и `POSTGRES_PASSWORD` для контейнера `postgres` | Захардкожены буквально (не `${VAR}`-подстановка из `.env`), хотя у сервиса `postgres` в этом файле не подключён `env_file: .env` — то есть иначе их и нельзя было бы передать. |
| `docker-compose.yml:175-176` | `MINIO_ROOT_USER` и `MINIO_ROOT_PASSWORD` для контейнера `minio` | Захардкожены буквально; те же значения по факту повторно захардкожены в `minio-init` entrypoint-скрипте (строка 201, команда `mc config host add`) и как fallback-литералы в `src/lib/storage.ts:11-12`, а также ещё раз в `.github/workflows/deploy.yml:86-87` (см. ниже). |
| `.github/workflows/deploy.yml:86-87` | `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`, записываемые в серверный `.env` командой `update_env` | Значения — литералы прямо в workflow-файле (с комментарием "MinIO runs in Docker - values are fixed for this deployment"), а не `${{ secrets.* }}`. Тот же логин/пароль, что и в `docker-compose.yml` и `storage.ts` (см. выше) — итого один и тот же несекретный по факту креденшл продублирован в 4 местах. |
| `src/app/api/internal/bot/history/files/route.ts:7` | Fallback-значение переменной `PDF_API_KEY`, похожее по формату на реальный UUID-ключ стороннего PDF-сервиса (`PDF_SERVICE_URL`) | В коде это `process.env.PDF_API_KEY \|\| "<литерал>"` — то есть если переменная окружения не задана, в проде тихо используется захардкоженный литерал вместо явной ошибки конфигурации. |
| `src/lib/receiptGenerator.ts:75` | Fallback-строка для `WEBHOOK_SECRET` при подписи HMAC | Это очевидный dev-плейсхолдер (не выглядит как реальный секрет), но по факту при отсутствии `WEBHOOK_SECRET` расчёт подписи в этом месте тихо продолжает работать на предсказуемом ключе, а не падает с ошибкой. |
| `pdf-extractor/main.go:50` | API-токен PaddleOCR | См. раздел 7 — единственный из Go-сервисов, где сторонний API-ключ вообще не выведен в переменную окружения. |

---

## 9. Деплой: `docker-compose.yml`, `.github/workflows/deploy.yml`, `deploy.sh`

Эти файлы не читают `process.env`/`os.Getenv` сами (кроме `deploy.sh`, который использует чисто shell-переменные состояния деплоя типа `NEW_SHA`/`PREV_SHA`, не связанные с рантайм-конфигурацией приложений), но именно они определяют, какие переменные вообще попадают в `.env` на сервере и, соответственно, в контейнеры.

- **`.github/workflows/deploy.yml`** прокидывает секреты GitHub Actions (`secrets.*`) в SSH-сессию на сервере и дописывает/обновляет ими файл `.env` через bash-функцию `update_env`. В `env:`/`envs:` блоке шага явно перечислены и форвардятся: `OPENAI_API_KEY`, `LATEX_COMPILER_URL`, `LATEX_COMPILER_KEY`, `CRYPTOCLOUD_API_KEY`, `CRYPTOCLOUD_SHOP_ID`, `CRYPTOCLOUD_SECRET`, `TELEGRAM_BOT_TOKEN`, `WEBHOOK_DOMAIN`, `WEBHOOK_SECRET`, `WS_JWT_SECRET`, `NEXT_PUBLIC_WS_URL`, `SESSION_SECRET`, а с Фазы 1 (2026-09-03) также `STIRLING_PDF_API_KEY`, `PADDLEOCR_API_TOKEN`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`.
- ~~KASPI_* не были объявлены в `envs:`~~ — **неактуально**: вся Kaspi Pay интеграция и её `update_env`-вызовы удалены 2026-09-03 (заброшена, подтверждено владельцем), см. `docs/integrations.md`, раздел 3.
- `SITE_INTERNAL_URL`/`BOT_CONTAINER_URL` записываются в `.env` как захардкоженные в самом workflow-файле литералы (это статические внутренние URL, не секреты — нормально). `MINIO_*` теперь тоже приходят из секретов (см. выше), а не литералами.
- **`docker-compose.yml`** — каждый сервис либо получает переменные через `env_file: .env` (`perricheno-site`, `ws-server`, `telegram-bot`, а с Фазы 1 — `pdf-extractor`), либо через явный список в `environment:`. У `r-compiler`, `python-compiler`, `research-api` вообще нет `env_file`/`environment` секции с переменными (кроме служебных для healthcheck). `postgres` и `minio` с Фазы 1 получают креды через `${VAR:?required}` подстановку из `.env`, а не захардкоженными литералами (см. п.1 ниже — исправлено).
- **`deploy.sh`** не работает с переменными окружения приложений — он работает с git SHA-состоянием (`.last-deployed-sha`) и решает, какие `docker compose build/up` сервисы пересобирать по изменённым путям.

---

## Требует уточнения у владельца

1. ~~`docker-compose.yml:14` vs `:157-158` — `DATABASE_URL` захардкожен, дублируя `POSTGRES_USER`/`POSTGRES_PASSWORD`~~ — **исправлено в Фазе 1** (2026-09-03): теперь `${POSTGRES_USER}`/`${POSTGRES_PASSWORD:?required}`/`${POSTGRES_DB}` подставляются из `.env`/GitHub Secrets в одном месте, `DATABASE_URL` собирается из них же.
2. ~~`LATEX_COMPILER_URL` fallback `http://latex-compiler:8000`~~ — **[ИСПРАВЛЕНО, Фаза 2, 2026-09-03]**: владелец не подтвердил реальную инфраструктуру за этим хостом, поэтому мёртвый фолбэк убран (не гадаю про несуществующий сервис) — оба места (`receiptGenerator.ts`, `dashboard/actions.ts`) теперь явно проверяют конфиг и сообщают об ошибке вместо попытки достучаться до нерезолвящегося хоста.
3. ~~`NEXT_PUBLIC_WS_URL` и `NEXT_PUBLIC_APP_URL` не передаются как build-ARG~~ — **[ИСПРАВЛЕНО частично, Фаза 2, 2026-09-03]**: находка подтвердилась только для `NEXT_PUBLIC_WS_URL` (реальный клиентский код) — `Dockerfile`/`docker-compose.yml` теперь передают её как build-`ARG`, проверено реальной сборкой Docker-образа с уникальным маркерным значением, найденным в собранных JS-чанках. `NEXT_PUBLIC_APP_URL` оказалась ложной тревогой: все три места её использования — серверный код (`route.ts`), который читает `process.env` в рантайме как обычно, build-ARG ей не нужен.
4. ~~`WS_SERVER_INTERNAL_URL` не встречается ни в одном файле `src/`~~ — **[ИСПРАВЛЕНО, Фаза 2, 2026-09-03]**: удалена из `docker-compose.yml`.
5. **`NEXT_SKIP_LINT`** (`Dockerfile:21`) и **`GENERATE_SOURCEMAP`** (`Dockerfile:26`) не читаются нигде в кодовой базе / не являются переменными, которые понимает Next.js — похоже на leftover-конфигурацию без эффекта. Стоит уточнить, не планировалось ли когда-то подключить `eslint.ignoreDuringBuilds` в `next.config.ts` под `NEXT_SKIP_LINT`.
6. ~~`KASPI_MERCHANT_ID`/`KASPI_API_KEY`/`KASPI_WEBHOOK_SECRET` не доезжали через CI~~ — **неактуально**: подтверждено владельцем, Kaspi Pay заброшена и не планируется, весь код и переменные удалены 2026-09-03.
7. ~~Повтор одного и того же несекретного по факту креденшла MinIO в 4 местах~~ — **исправлено в Фазе 1**: `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` теперь единственный источник (GitHub Secrets → `.env`), `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` заполняются из тех же значений в `deploy.yml`, фолбэк-литерал в `storage.ts` убран.
8. ~~`get_bot_name.js` с захардкоженным токеном бота~~ — **исправлено в Фазе 1**: скрипт теперь требует `TELEGRAM_BOT_TOKEN` из окружения, падает с понятной ошибкой если не задан.
9. **`RESEARCH_API_URL` fallback `http://127.0.0.1:8080`** (`src/app/api/agent/scholar/search/route.ts:81`) не соответствует имени сервиса в Docker-сети (`research-api`). Сейчас не критично, потому что `docker-compose.yml:18` всегда явно передаёт правильное значение, но при рефакторинге compose-файла это может незаметно сломаться — стоит унифицировать fallback с остальными (`R_COMPILER_URL`, `PYTHON_COMPILER_URL`, `PDF_EXTRACTOR_URL`), которые все указывают на правильные имена сервисов.
