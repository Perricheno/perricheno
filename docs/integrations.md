# Внешние интеграции Perricheno

Документ составлен вычиткой реального кода (grep + чтение файлов) по состоянию репозитория на момент написания. Каждый раздел указывает файл:строку, где искать доказательство.

Обозначения: **REST** — обычный HTTP JSON/form запрос, **Webhook** — сторонний сервис сам стучится к нам, **Внутренний RPC** — вызов между собственными контейнерами по Docker-сети.

---

## 1. Telegram Bot API

Два независимых пути:

### 1.1 Бот → Telegram (исходящие сообщения)
Нет единого клиента — `fetch` к `https://api.telegram.org/bot<TOKEN>/...` разбросан по коду в обоих сервисах:

- `telegram-bot/src/bot.ts` — использует библиотеку `Telegraf` (`bot.telegram.sendMessage/editMessageText/setWebhook`, строки 353–407).
- `telegram-bot/src/handlers/*.ts` — тоже через Telegraf.
- Основной сайт (Next.js) бьёт напрямую в Telegram Bot API HTTP-эндпоинт, минуя бот-контейнер, в нескольких местах:
  - `src/lib/db.ts:337,477,503,524` — `sendMessage`, `editMessageText`, `deleteMessage` (уведомления пользователю).
  - `src/app/api/billing/webhook/route.ts:201` — уведомление об оплате CryptoCloud.
  - `src/app/api/billing/checkout/route.ts` — уведомления о созданном счёте.
  - `src/app/api/telegram/send/route.ts:29` — `sendDocument` (отправка файла из PDF-инструментов сайта).

Аутентификация: `TELEGRAM_BOT_TOKEN` подставляется в URL (`.../bot<TOKEN>/...`). Токен читается из `process.env.TELEGRAM_BOT_TOKEN` почти везде, но в `get_bot_name.js:3` — отдельный служебный скрипт для получения username бота — **токен захардкожен литералом прямо в файле**, не читается из env. Файл не используется приложением в рантайме (это разовый dev-скрипт), но токен в git-истории уже скомпрометирован.

Сбой/недоступность Telegram API: везде — `fetch(...).catch(console.error)` или `.catch(() => {})` (fire-and-forget). Ошибка Telegram никогда не блокирует основной ответ пользователю (например, оплата пройдёт и ресурсы начислятся, даже если Telegram-уведомление не отправилось). Ретраев нет.

### 1.2 Telegram → Бот (входящие обновления)
Режим определяется в `telegram-bot/src/bot.ts:398-408`: если задан `WEBHOOK_DOMAIN` (или `WEBHOOK_URL`) — вызывается `bot.telegram.setWebhook(...)` (вебхук-режим); если нет — `bot.launch()` (long polling). В докер-компоузе `WEBHOOK_DOMAIN` пробрасывается через deploy.yml, то есть в проде используется **вебхук**.

Путь вебхука: Telegram → публичный сайт `POST /api/webhook/telegram` (`src/app/api/webhook/telegram/route.ts`) → сайт проверяет заголовок `X-Telegram-Bot-Api-Secret-Token` против `WEBHOOK_SECRET` (route.ts:11-15) → проксирует тело запроса на `BOT_CONTAINER_URL` (по умолчанию `http://telegram-bot:3001`) на путь `/api/webhook/telegram` → бот повторно проверяет тот же секрет в `telegram-bot/src/bot.ts:297-302` и передаёт апдейт в `Telegraf`.

Если секрет не совпал — на обоих уровнях 403 (`Forbidden` / `Unauthorized`). Если бот-контейнер недоступен — сайтовый прокси ловит исключение и отвечает Telegram `502 {"error":"Proxy failed"}` (`src/app/api/webhook/telegram/route.ts:32-35`); Telegram сам ретраит доставку вебхука по своей логике.

### 1.3 Вход через Telegram Login Widget
`src/lib/telegram-auth.ts` — проверка HMAC-подписи данных виджета: `secretKey = SHA256(BOT_TOKEN)`, `hmac = HMAC-SHA256(secretKey, data_check_string)`, сверяется с полем `hash` (строки 34-44); также проверяется `auth_date` на протухание (>24ч, строка 56). При отсутствии `TELEGRAM_BOT_TOKEN` модуль **бросает исключение при импорте** (`telegram-auth.ts:3-6`) — де-факто обязательная переменная для роута логина.

### 1.4 Deep-link авторизация из бота
`src/app/api/auth/link/route.ts` генерирует токен и ссылку `https://t.me/<TELEGRAM_BOT_USERNAME>?start=<token>`; пользователь открывает бота, бот шлёт данные на `POST /api/internal/bot/verify` (защищено `X-Bot-Secret` == `WEBHOOK_SECRET`), фронтенд поллит `GET /api/auth/poll?token=...` до появления статуса `completed`.

---

## 2. CryptoCloud (платежи, USD/RUB)

Формирование инвойса — `src/app/api/billing/checkout/route.ts:147-150`:
```
POST https://api.cryptocloud.plus/v2/invoice/create
Authorization: Token <CRYPTOCLOUD_API_KEY>
body: { shop_id: CRYPTOCLOUD_SHOP_ID, amount, order_id: "UID_<userId>_PACK_<packId>_TS_<ts>", currency: "USD" }
```
Тот же вызов продублирован для оплат из бота в `src/app/api/internal/bot/billing/route.ts:120`.

Если `CRYPTOCLOUD_API_KEY`/`CRYPTOCLOUD_SHOP_ID` не заданы — вместо ошибки пользователю показывается fallback-ссылка на статический POS-терминал CryptoCloud, захардкоженный в коде: `POS_FALLBACK = 'https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH'` (`checkout/route.ts:10`). Если CryptoCloud вернул невалидный JSON или non-success — тоже отдаётся `fallback_url` вместе с ошибкой (`checkout/route.ts:159,183`).

Приём результата — вебхук `POST /api/billing/webhook` (`src/app/api/billing/webhook/route.ts`):
- Подпись: `MD5(status_invoice + order_id + amount_crypto + currency_crypto + CRYPTOCLOUD_SECRET)`, сверяется с полем `sign` (строки 62-66). Порядок специально «подпись раньше проверки заказа», чтобы не давать timing-oracle по order_id (комментарий в коде, строка 53).
- Если `CRYPTOCLOUD_SECRET` не задан — вебхук **полностью отключается** и всегда отвечает 500 (строки 54-57) — то есть отсутствие секрета не открывает дыру, а глушит приём платежей.
- Идемпотентность: запись `processedPayment` создаётся в транзакции; повторный вебхук с тем же `order_id` либо отбивается явной проверкой, либо перехватывается по коду ошибки Prisma `P2002` (unique constraint) — строки 70-73, 113-118.
- После зачисления генерируется PDF-чек через **внешний LaTeX-компилятор** (`LATEX_COMPILER_URL`, см. раздел 8) и подтягивается live-курс USD→KZT/RUB с `https://open.er-api.com/v6/latest/USD` (строка 134) с захардкоженным фолбэком курса (KZT=480, RUB=95), если сервис недоступен.

**Найден "мёртвый"/дублирующий обработчик**: `src/app/[locale]/callback/route.ts` — второй, почти идентичный вебхук-хендлер CryptoCloud. В нём проверка подписи **не блокирует запрос при несовпадении** — в коде есть закомментированная строка `// Uncomment in prod if needed: return new NextResponse('Invalid signature', { status: 403 });` (строка 47) — то есть этот путь при рассинхроне подписи просто логирует предупреждение и продолжает начислять ресурсы. Требует уточнения у владельца, используется ли этот путь реально (зарегистрирован ли он как webhook URL в кабинете CryptoCloud) или это забытый черновик.

---

## 3. Kaspi Pay — ЗАБРОШЕНО, код удалён (2026-09-03)

Подтверждено владельцем: интеграция Kaspi Pay заброшена, платежи через неё не принимаются и не планируются. `deploy.yml` никогда не доставлял `KASPI_MERCHANT_ID`/`KASPI_API_KEY`/`KASPI_WEBHOOK_SECRET` на сервер (см. `docs/REVIEW.md` #11 и историю этого документа) — на практике эта ветка всегда падала обратно в CryptoCloud.

Что было и что убрано:
- `src/app/api/billing/kaspi-webhook/route.ts` — отдельный вебхук-хендлер, **удалён целиком** (был полностью изолирован, ничего кроме общих утилит `addPurchasedTokens`/`isPaymentProcessed` не переиспользовал).
- `src/app/api/billing/checkout/route.ts` — Kaspi-специфичная часть (`createKaspiPayment()`, `PLANS_KZT`, ветка `currency === 'kzt'`, чтение `KASPI_*`) **удалена**; сейчас все валюты идут через CryptoCloud без изменения наблюдаемого поведения (Kaspi и раньше никогда фактически не проводил платёж).
- `.github/workflows/deploy.yml` — убраны 3 строки `update_env "KASPI_*"`, ссылавшиеся на этот код.

**Не удалено**: `src/app/[locale]/billings/page.tsx` и `PricingCard.tsx` всё ещё показывают валюту `kzt`/«via Kaspi» в переключателе (и `kzt` — значение по умолчанию) — это фронтенд/UX-решение, требует отдельного решения владельца, не тронуто в рамках этой правки.

---

## 4. LLM-провайдер (OpenAI)

Единого клиента-обёртки в проекте два, и они ведут себя по-разному:

### 4.1 `src/lib/agent/pipeline/llm.ts` — используется LaTeX-агентом (стадии генерации отчёта)
- Модель: `gpt-5-mini-2025-08-07` (константа `MODEL`, строка 7).
- Эндпоинт: `https://api.openai.com/v1/chat/completions`, заголовок `Authorization: Bearer <OPENAI_API_KEY>`.
- Таймаут: 90с по умолчанию (`DEFAULT_TIMEOUT_MS`), через `AbortController`.
- **Ретраев нет** — один запрос, при ошибке бросается `LlmError(status, body)`.
- Если ответ — HTML (типичная страница ошибки Cloudflare/gateway), тело подменяется на «Infrastructure Error (Gateway/Cloudflare). OpenAI might be temporarily overloaded.» (строки 36-38) — единственное место, где Cloudflare упоминается в контексте реального сетевого поведения (не как исходящий вызов, а как эвристика распознавания чужой HTML-страницы ошибки).
- Есть механизм «продолжения» при обрезке по `max_tokens` (`chatCompletionLong`, строки 128-168): до 2 доп. запросов с хвостом предыдущего ответа как контекстом.
- Биллинг изображений: +800 «токенов» за каждую картинку в сообщении, независимо от факта из ответа OpenAI (строки 8, 90-92).

### 4.2 Прямые вызовы `fetch("https://api.openai.com/v1/chat/completions", ...)` в 15+ роутах
Обёртка `llm.ts` используется не везде — отдельные, независимые вызовы с той же моделью `gpt-5-mini-2025-08-07` разбросаны по:
`src/app/api/tasks/parse/route.ts:61` (модель `gpt-4.1-nano-2025-04-14` — исключение), `src/app/api/r/generate/route.ts:14`, `src/app/api/agent/visualize/route.ts:172`, `src/app/api/space/[id]/ai-edit/route.ts:42`, `src/app/api/space/[id]/ai-fix/route.ts:31`, `src/app/api/agent/visualize/recommend/route.ts:31`, `src/app/api/agent/visualize/generate-code/route.ts:77`, `src/app/api/agent/chat/route.ts:185,324`, `src/app/api/agent/visualize/edit/route.ts:49`, `src/app/api/internal/bot/visual/generate/route.ts:380,536`, `src/app/api/agent/data-analytics/route.ts:138,232`, `src/app/api/tikz/generate/route.ts:13`. (`src/app/api/canvas/generate/route.ts` — **[УДАЛЕНО, 2026-09-04]**, фича Canvas удалена целиком.)

Из них только **`src/app/api/r/generate/route.ts:151-199`** (функция `callOpenAI`) реализует ретраи: до 4 попыток с экспоненциальным backoff (`2^attempt * 1500ms`, максимум 16с), повтор на статусах 429/500/502/503/524, на сетевых ошибках и на HTML-ответах. Все остальные вызовы — однократные, без backoff.

Что видит пользователь при отказе LLM: единого поведения нет —
- Часть роутов возвращает `500 {"error": "OpenAI API Key not configured"}`, если ключ не задан (например `src/app/api/agent/chat/route.ts:35`, `src/app/api/tasks/parse/route.ts:25`).
- Часть — `503 {"error": "AI not configured"}` за то же самое условие (`src/app/api/space/[id]/ai-edit/route.ts:23`, `ai-fix/route.ts:14`) — то есть код условия один, а HTTP-статус разный в зависимости от роута.
- Часть роутов после провала компиляции LaTeX/TikZ повторяет генерацию до 3 раз целиком (LLM + компиляция) внутри одного запроса (`src/app/api/tikz/generate/route.ts`, цикл до строки 428) и только затем отдаёт `422` с логом последней ошибки.

Список моделей `["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "claude-3.5-sonnet", "claude-3-haiku", "gemini-2.0-flash"]` в `src/app/actions.ts:23` — это настройки старой/тестовой страницы чата (`ChatPage.tsx` / `[locale]/chat`), которая **не ходит в OpenAI напрямую**, а шлёт данные во внешний n8n-вебхук (см. раздел 9); реального вызова Claude или Gemini в коде нет — это декоративный список моделей для UI, не подключённый к реальному провайдеру.

---

## 5. MinIO / S3-совместимое хранилище

`src/lib/storage.ts:7-15` — клиент `minio` (SDK), подключение по `MINIO_ENDPOINT`/`MINIO_PORT`/`MINIO_USE_SSL`, аутентификация `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`, бакет `MINIO_BUCKET_NAME`. У всех этих переменных есть захардкоженные дефолты **в самом коде** (не только в docker-compose), совпадающие со значениями из docker-compose.yml — то есть если переменные не заданы явно, клиент всё равно соединится с дефолтными dev-креденшелами.

Операции: `putObject`, `presignedGetObject` (публичная ссылка на 24ч при загрузке, `storage.ts:42`; настраиваемый TTL в `getSignedUrl`), `removeObject`, `getObject`, `statObject`.

Обработка недоступности хранилища непоследовательна:
- `deleteFromStorage` — глотает ошибку, только логирует (`storage.ts:50-55`).
- `getSignedUrl` — при ошибке возвращает пустую строку `''` (строка 63) — вызывающий код должен сам это учитывать.
- `downloadFromStorage` — перебрасывает ошибку дальше как `Error("Download failed: ...")` (строка 81).
- `fileExistsInStorage`/`getFileMetadata` — при ошибке молча возвращают `false`/`null`.

Т.е. единой стратегии деградации нет: где-то тихий провал, где-то исключение — poведение зависит от вызывающего кода в каждом конкретном роуте.

`minio-init` в docker-compose (строки 179-206) при старте кластера создаёт бакет и делает его публично читаемым (`mc anonymous set download`), используя те же захардкоженные креды.

---

## 6. Научные API для цитирований (Scholar/Citations)

Два независимых пути к одним и тем же внешним индексам:

### 6.1 Прямые вызовы из Next.js — `src/app/api/citations/search/route.ts`
- **CrossRef**: `GET https://api.crossref.org/works?query=...` (строка 51) и `GET https://api.crossref.org/works/{doi}` для точного DOI (строка 89). `User-Agent: Perricheno/1.0 (mailto:support@perricheno.ru)`, таймаут 10с.
- **arXiv**: `GET https://export.arxiv.org/api/query?search_query=...` (строка 123), парсинг Atom-фида регулярками, таймаут 10с.
- При автоопределении источника (`source=auto`) CrossRef и arXiv запрашиваются параллельно через `Promise.allSettled` — частичный отказ одного источника не валит запрос целиком (строки 223-229), просто в выдаче будет меньше результатов.
- Полный отказ (оба упали, либо явно выбранный источник упал) — `500 {"error": e.message}` (строка 242).

### 6.2 Через Go-микросервис `research-api` — `src/app/api/agent/scholar/search/route.ts`
Сайт сначала переводит нелатинские запросы на английский через **бесплатный MyMemory Translation API** (`https://api.mymemory.translated.net/get`, `translateToEnglish`, строки 23-50) — анонимная квота, e-mail `admin@perricheno.com` передаётся в параметре `de` для увеличения лимита (согласно комментарию в коде — до 50000 слов/день). Таймаут 4с через `AbortController`; при любой ошибке или подозрительном ответе (`PLEASE SELECT...`, `MYMEMORY WARNING`) функция просто возвращает исходный текст без перевода (строки 43-49) — деградация тихая.

Затем результат идёт в `research-api` (`RESEARCH_API_URL`, по умолчанию `http://127.0.0.1:8080`) на `POST /search`, который сам обращается к:
- **arXiv** (`research-api/main.go:253-282`) — таймаут 30с, при HTTP 503 делает **один повторный запрос через 1с** (единственный найденный в проекте пример ретрая на уровне Go-сервиса, строки 270-278).
- **OpenAlex** (`research-api/main.go:112-147`) — `https://api.openalex.org/works?...&mailto=admin@perricheno.com`, таймаут 30с, без ретраев.

Ошибка любого из источников внутри `research-api` превращается в `500 Internal Server Error` от самого микросервиса (main.go:97-100), которую Next.js-роут заворачивает в собственное сообщение `Research API error: <status> - <текст>` и тоже отвечает 500 (`scholar/search/route.ts:89-92`).

---

## 7. ip-api.com (геолокация по IP)

`src/lib/session.ts:12-22`, функция `getIpLocation`, вызывается при каждом создании сессии (логин). Запрос **по обычному HTTP** (не HTTPS): `http://ip-api.com/json/{ip}?fields=status,country,city` — без ключа, бесплатный тариф. При `ip === '127.0.0.1'/'::1'` запрос не делается вообще (возвращается `"Localhost"`). При сетевой ошибке, таймауте или `data.status !== 'success'` — возвращается строка `"Unknown Location"`, ошибка нигде не логируется и не пробрасывается наружу — логин пользователя никогда не блокируется геолокацией.

---

## 8. Внутренние вычислительные сервисы (Docker-сеть)

Все — «внутренние интеграции» без публичных портов (кроме health-check), общаются по имени контейнера внутри сети `cloudflare` (см. docker-compose.yml).

| Сервис | Переменная URL | Дефолт | Где вызывается с сайта |
|---|---|---|---|
| R-компилятор (Go) | `R_COMPILER_URL` | `http://r-compiler:8000` | `src/app/api/agent/r-compile/route.ts:17` (`POST /compile`, таймаут 35с) |
| Python-компилятор (Go) | `PYTHON_COMPILER_URL` | `http://python-compiler:8000` | `src/app/api/agent/python-compile/route.ts:17` (`POST /compile`, таймаут 35с) |
| Research API (Go, arXiv/OpenAlex) | `RESEARCH_API_URL` | `http://127.0.0.1:8080` | `src/app/api/agent/scholar/search/route.ts:82` (`POST /search`) |
| PDF-экстрактор (Go) | `PDF_EXTRACTOR_URL` | `http://pdf-extractor:8080` | `src/app/api/internal/bot/extract-text/route.ts:52` (`POST /extract`, таймаут **300с**, т.к. асинхронное OCR-задание может идти долго) |
| WS-сервер (Yjs realtime, Node) | `WS_SERVER_INTERNAL_URL` (задана в docker-compose) | `ws://ws-server:1234` | **Не найдено ни одного использования `process.env.WS_SERVER_INTERNAL_URL` в коде приложения** — переменная объявлена, но, судя по всему, мертва. Клиент подключается к WS напрямую по `NEXT_PUBLIC_WS_URL` (браузер → `ws-server`, минуя сайт), см. `src/app/[locale]/space/[spaceId]/hooks/useYjsSpace.ts:43`. Требует уточнения у владельца: планировалось ли использование `WS_SERVER_INTERNAL_URL` (например, для presence через сайт) или переменная — рудимент. |

Во всех трёх R/Python/scholar-прокси при сбое (таймаут, не-2xx, сеть) — **ретраев нет**, ошибка сразу оборачивается в `500` с текстом вида `"R compiler error"`/`"Python compiler error"`/проброс текста ошибки — пользователь получает одну попытку на запрос.

`pdf-extractor` сам по себе (Go, `pdf-extractor/main.go`) — не просто локальный сервис, а прокси-цепочка к внешним облачным OCR-API (см. раздел 10) с фолбэком на локальный `pdftotext`, если оба внешних недоступны.

---

## 9. LaTeX-компилятор — [ИЗМЕНЕНО, Фаза 6a-latex, 2026-09-04] теперь свой сервис (`latex-compiler/`)

**Раньше** этот раздел документировал `LATEX_COMPILER_URL`/`LATEX_COMPILER_KEY` как указывающие на внешнюю, нигде в репозитории не описанную инфраструктуру (владелец подтвердил: сам писал этот компилятор — Go + Docker + полный TeX Live — но его код не хранился ни в одном репозитории и терялся при каждой пересборке). Теперь это собственный сервис **`latex-compiler/`** в этом репозитории (Go + Gin, образ `texlive/texlive:latest` — полная схема TeX Live, все движки + `biber` + весь пакетный набор), запущенный в `docker-compose.yml` под именем `latex-compiler`, порт 8080. Подробности реализации — [`../latex-compiler/README.md`](../latex-compiler/README.md).

Используется в **8 разных местах** кода — контракт **не менялся**, новый сервис воспроизводит его по фактическому использованию:
`src/lib/receiptGenerator.ts:110-118`, `src/lib/agent/pipeline/stage2_3_visuals.ts:12-13,901,910`, `src/lib/agent/pipeline/stage5_validate.ts:14-15,55`, `src/app/[locale]/dashboard/actions.ts:107`, `src/app/api/agent/compile-pdf/route.ts:8-12`, `src/app/api/tikz/generate/route.ts:11-12,319,330`, `src/app/api/space/[id]/compile/route.ts:9-10`, `src/app/api/internal/bot/history/files/route.ts:122-123`.

Протокол везде одинаковый: `POST <LATEX_COMPILER_URL>` с ZIP-архивом проекта в `multipart/form-data` (`file=project.zip`), заголовок `x-api-key: <LATEX_COMPILER_KEY>`, опционально `X-Compiler`/`X-Main-File` для выбора движка/входного файла (`space/[id]/compile/route.ts:53-59`). Таймауты варьируются (60с в receiptGenerator, 110с в space-компиляторе); сам сервис укладывается в собственный лимит 100с на пайплайн `latex → biber → latex → latex`.

`LATEX_COMPILER_URL` теперь фиксированное значение `http://latex-compiler:8080` в `docker-compose.yml` (не секрет, убрано из `deploy.yml`); `LATEX_COMPILER_KEY` остаётся секретом (значение сгенерировано заново — старое, для внешнего компилятора, больше не действует).

Поведение при недоступности/незаданности переменных — тоже противоречиво:
- `space/[id]/compile/route.ts:32-34` → `503 {"error": "Compiler not configured"}`.
- `agent/compile-pdf/route.ts:9-12` → `500` с текстом, прямо называющим нужные секреты.
- `tikz/generate/route.ts:319` → тихий `{ ok: false, log: "Compiler not configured." }` без HTTP-ошибки.
- `receiptGenerator.ts` → просто `return false` (чек не генерируется, но платёж уже засчитан пользователю — см. раздел 2).
- `stage2_3_visuals.ts:901` → шаг молча пропускается (`{ ok: true }`), считается необязательным.

Ретраев нет нигде; ошибки компиляции (не-2xx или JSON/текстовый ответ вместо PDF) прокидываются пользователю как лог ошибки LaTeX (например `space/[id]/compile/route.ts:83-91` возвращает `200 {"ok": false, "log": "..."}` — то есть сама HTTP-транзакция считается успешной, а неуспех кодируется в теле).

---

## 10. Внешние OCR/конвертация документов

Отдельная группа интеграций, не упомянутая явно в постановке задачи, но обнаруженная при вычитке `pdf-extractor` и `internal/bot/extract-text`:

### 10.1 PaddleOCR-VL / Baidu AI Studio (`pdf-extractor/main.go`)
Основной путь распознавания PDF в Go-сервисе `pdf-extractor` — не локальный, а облачный:
- Асинхронный job-API (основной): `POST https://paddleocr.aistudio-app.com/api/v2/ocr/jobs` (`pdf-extractor/main.go:44,242-254`), затем поллинг `GET .../jobs/{jobId}` каждые 5с до 10 минут (строки 274-291), затем скачивание результата `GET <jsonlURL>` (строка 327).
- Синхронный API (фолбэк №1): `https://a8gec0nct6gb48gc.aistudio-app.com/layout-parsing` (константа `syncAPIURL`, строка 48).
- Локальный `pdftotext` (фолбэк №2, последний рубеж) — строка 186.
- Аутентификация: заголовок `Authorization: bearer <apiToken>` — **токен захардкожен константой в коде** (`pdf-extractor/main.go:50`), не читается ни из какой переменной окружения. Это реальный секрет, закоммиченный в git.

### 10.2 Stirling PDF (конвертация Office → PDF), `pdf.perricheno.ru`
`src/app/api/internal/bot/extract-text/route.ts:5-6,31-36` — конвертация `xlsx/docx/pptx` и т.п. в PDF перед OCR: `POST https://pdf.perricheno.ru/api/v1/convert/file/pdf`, заголовок `X-API-KEY`. И `PDF_API_BASE`, и `PDF_API_KEY` **захардкожены прямо в этом файле** (не читаются из env). В соседнем `src/app/api/internal/bot/history/files/route.ts:6-7` тот же ключ и похожий хост (`PDF_SERVICE_URL`) уже читаются из `process.env`, но с точно таким же значением в качестве дефолта — то есть переменные окружения существуют, но текущий деплой явно держится на захардкоженном фолбэке. Таймаут конвертации — 45с; при ошибке — извлечение просто продолжает работать с исходным файлом как есть (частичная деградация, не жёсткий отказ).

Оба этих хардкода — реальные секреты в исходниках; в `docs/config_and_env.md` они отмечены без значений.

---

## 11. n8n (генерический вебхук чата)

Отдельная, независимая от агент-пайплайна фича — старая/тестовая страница чата (`src/components/ChatPage.tsx`, `src/app/[locale]/chat/page.tsx`, настройки в `src/app/actions.ts` и `src/data/settings.json`). URL вебхука (тестовый/боевой) хранится не в env, а в JSON-настройках:
```
https://n8n.perricheno.ru/webhook-test/519031b9-...
https://n8n.perricheno.ru/webhook/519031b9-...
```
Запрос идёт не напрямую из браузера, а через собственный серверный прокси `POST /api/webhook-proxy` (`src/app/api/webhook-proxy/route.ts`), который:
- требует активную сессию (401 без неё);
- разрешает только `https:` URL (400 иначе);
- если задана `ALLOWED_WEBHOOK_HOSTS` (список хостов через запятую) — пропускает только эти хосты (403 иначе); если переменная не задана — **ограничения нет вообще**, разрешён любой https-хост (SSRF-риск в дефолтной конфигурации, смягчённый только требованием авторизации и `https:`);
- таймаут 120с, при истечении — `504 {"error": "Webhook timed out (120s)"}`.

---

## 12. Cloudflare

Проверено: реального исходящего вызова к Cloudflare API (DNS/Zones/Workers) в коде **не найдено**. Все найденные упоминания — либо (а) имя внешней Docker-сети `cloudflare` в `docker-compose.yml` (просто транспортный слой/edge-proxy перед контейнерами), либо (б) эвристика в `src/lib/agent/pipeline/llm.ts:36-38` и `src/app/api/r/generate/route.ts:185-190`, распознающая HTML-страницу ошибки (503/524 gateway) как «похоже на Cloudflare» по признаку `<!DOCTYPE`/`<html`, чтобы вернуть пользователю более понятное сообщение. Прямого использования Cloudflare API-ключей/токенов в репозитории нет.

---

## 13. Валютный курс (open.er-api.com)

Бесплатный, без ключа: `https://open.er-api.com/v6/latest/USD`. Используется в трёх местах: `src/app/api/billing/webhook/route.ts:134` (курс для отображения в чеке CryptoCloud), `src/app/[locale]/dashboard/actions.ts:144` и клиентский `src/app/[locale]/billings/page.tsx:128` (отображение цен в KZT/RUB на странице тарифов). Везде — при недоступности используется захардкоженный запасной курс (в `billing/webhook/route.ts` — KZT=480, RUB=95, строки 129-130), ошибка только логируется.

---

## Сводная таблица

| # | Интеграция | Тип | Аутентификация | Ретраи | Файл(ы)-точка входа |
|---|---|---|---|---|---|
| 1 | Telegram Bot API | REST + Webhook | Bot Token в URL / `X-Telegram-Bot-Api-Secret-Token` | Нет | `telegram-bot/src/bot.ts`, `src/lib/db.ts`, `src/app/api/webhook/telegram/route.ts` |
| 2 | CryptoCloud | REST + Webhook | `Token <API_KEY>` / MD5-подпись | Нет | `src/app/api/billing/checkout,webhook/route.ts` |
| 3 | ~~Kaspi Pay~~ | — | — | — | **Заброшено, код удалён 2026-09-03** (см. раздел 3) |
| 4 | OpenAI | REST | `Bearer <OPENAI_API_KEY>` | Только в `r/generate` (4 попытки) | `src/lib/agent/pipeline/llm.ts` + 15 роутов напрямую |
| 5 | MinIO/S3 | SDK (S3 API) | Access/Secret Key | Нет | `src/lib/storage.ts` |
| 6 | CrossRef / arXiv / OpenAlex | REST | Без ключа (только `mailto=`/User-Agent) | Только arXiv в `research-api` (1 повтор на 503) | `src/app/api/citations/search`, `research-api/main.go` |
| 6a | MyMemory Translation | REST | Без ключа | Нет | `src/app/api/agent/scholar/search/route.ts` |
| 7 | ip-api.com | REST | Без ключа | Нет | `src/lib/session.ts` |
| 8 | R/Python/Research/PDF-extractor (внутренние) | Внутренний REST | Нет (закрыты сетью Docker) | Нет | `src/app/api/agent/{r,python}-compile`, `scholar/search`, `internal/bot/extract-text` |
| 9 | LaTeX-компилятор (`latex-compiler`, **[Фаза 6a-latex] теперь внутренний**) | Внутренний REST | `x-api-key` | Нет | 8 файлов, см. раздел 9 |
| 10 | PaddleOCR-VL / Stirling PDF | REST | Bearer / `X-API-KEY` (читаются из `PADDLEOCR_API_TOKEN`/`STIRLING_PDF_API_KEY`, централизовано в Фазе 1 REVIEW.md #3) | Нет (но есть цепочка фолбэков) | `pdf-extractor/main.go`, `src/lib/config.ts` |
| 11 | n8n webhook | REST (через свой прокси) | Нет (URL сам по себе — секрет) | Нет | `src/app/api/webhook-proxy/route.ts` |
| 12 | Cloudflare | Только сетевой слой | — | — | `docker-compose.yml` (сеть), эвристики в error-хендлинге |
| 13 | open.er-api.com | REST | Без ключа | Нет | `billing/webhook`, `dashboard/actions.ts`, `billings/page.tsx` |

## Требует уточнения у владельца

1. Что такое `latex-compiler` инфраструктурно (раздел 9) — сервис не описан в `docker-compose.yml` этого репозитория, но используется в 8 местах кода. (Открыто — Фаза 2.)
2. ~~Дублирующий вебхук `src/app/[locale]/callback/route.ts`~~ — **закрыто**: подтверждено владельцем, что вебхук боевой и «сырой» (не мёртвый код); в Фазе 1 (REVIEW.md #1) добавлена проверка подписи и идемпотентность по образцу `/api/billing/webhook`.
3. ~~`WS_SERVER_INTERNAL_URL`~~ — **закрыто**: подтверждено, что нигде не читается, удалена из `docker-compose.yml` (Фаза 2, 2026-09-03).
4. Актуальность списка моделей `claude-3.5-sonnet`/`gemini-2.0-flash` в `src/app/actions.ts:23` — похоже на неиспользуемый черновик мультимодельного чата поверх n8n. (Не в фокусе текущих фаз — не трогать без отдельного запроса.)
5. ~~Kaspi Pay~~ — **закрыто**: подтверждено владельцем, интеграция заброшена, код удалён (см. раздел 3).
