# API Reference — Perricheno

Полный реестр всех HTTP-эндпоинтов проекта (`src/app/api/**/route.ts`). Документ составлен построчным чтением
всех 90 файлов `route.ts`, найденных в репозитории на дату составления (2026-09-01), плюс `src/middleware.ts`
и модулей авторизации `src/lib/session.ts`, `src/lib/telegram-auth.ts`.

> Ничего не выдумано: если в коде нет проверки авторизации — так и написано ("Auth: нет"). Если поведение
> неочевидно из кода — помечено как "требует уточнения у владельца".

## 0. Общие сведения об авторизации

В проекте используется несколько независимых механизмов авторизации — единого middleware-гейта для `/api/*` **нет**.

### 0.1 `src/middleware.ts` не защищает API

`middleware.ts` оборачивает только `next-intl` (роутинг локалей) и подчистку `Location`-заголовка при редиректах.
`config.matcher` явно исключает `/api`:

```ts
export const config = {
  matcher: [
    "/(ru|en|kz)/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)",
  ],
};
```

Следствие: **каждый route.ts обязан сам проверять авторизацию**. Ни один запрос к `/api/**` не проходит через
middleware вообще (ни для локали, ни для чего-либо ещё).

### 0.2 Пользовательская сессия — `verifySession()` (`src/lib/session.ts`)

- Кука `perricheno_session` — JWT (HS256), подписан ключом `SESSION_SECRET` (env, обязателен — при отсутствии
  процесс падает на старте).
- JWT содержит `{ sessionId, userId }`; `verifySession()` дополнительно проверяет, что `sessionId` существует
  в таблице сессий в БД (отзыв сессий работает через удаление записи в БД, не только через куку).
  Возвращает `number | null` (id пользователя) — без выброса исключений наружу.
- Срок жизни сессии — 10 лет ("immortal"), `httpOnly`, `secure` в проде, `sameSite: lax`.
- Большинство пользовательских эндпоинтов (`agent/*`, `space/*`, `citations/*`, `billing/checkout`, `billing/stats`,
  `r/*`, `tikz/*`, `canvas/*`, `chat/history`, `auth/me`, `auth/delete`, `telegram/send`, `webhook-proxy`,
  `pdf-proxy` частично) вызывают `verifySession()` и возвращают `401` при отсутствии/невалидности сессии.

### 0.3 Telegram Login Widget — `verifyTelegramAuth()` (`src/lib/telegram-auth.ts`)

Используется только в `POST /api/auth/login`. Проверяет HMAC-SHA256 подписи данных, присланных Telegram Login
Widget: секретный ключ — `SHA256(TELEGRAM_BOT_TOKEN)`, строка проверки — отсортированные `key=value` пары
(`auth_date, first_name, id, last_name, photo_url, username`), сравнение с полем `hash`. Дополнительно проверяется
`auth_date` (не старше 24 часов).

### 0.4 Межсервисный секрет для Telegram-бота — заголовок `x-bot-secret` / `X-Bot-Secret`

Все эндпоинты `src/app/api/internal/bot/**` защищены сравнением заголовка запроса с `process.env.WEBHOOK_SECRET`:

```ts
const secret = req.headers.get("x-bot-secret"); // или "X-Bot-Secret" — HTTP-заголовки регистронезависимы
if (secret !== WEBHOOK_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 403 /* или 401 */ });
```

Это единственная защита этих роутов — предполагается, что вызывать их может только контейнер `telegram-bot`
внутри приватной docker-сети. `WEBHOOK_DOMAIN`/публичного доступа к ним быть не должно, но код сам по себе
не ограничивает источник запроса по IP/сети — только по секрету.

Тот же секрет `WEBHOOK_SECRET` используется в `POST /api/webhook/telegram` (там сравнивается с заголовком
`x-telegram-bot-api-secret-token`, который Telegram присылает по настройке `secret_token` вебхука) — это другой
канал сравнения, но тот же env-секрет.

### 0.5 Эндпоинты вообще без какой-либо авторизации

Явно (по коду) не проверяют ни сессию, ни секрет, ни подпись:

- `POST /api/auth/link` — генерация одноразового токена для Telegram deep-link (по дизайну, это pre-auth шаг).
- `POST /api/auth/login` — но проверяет отдельную HMAC-подпись Telegram Login Widget (см. 0.3).
- `GET /api/auth/poll` — принимает произвольный `token` в query и создаёт сессию, если бот подтвердил его (риск
  ограничен только угадыванием UUID-токена).
- `GET /api/billing/receipt/[id]` и `GET /api/billing/receipt/[id]/verify` — публичные страницы чека/протокола
  верификации, отдают частично маскированные PII (`username`/`telegram_id` в замаскированном виде) любому, кто
  знает/угадает `id` чека.
- `POST /api/billing/webhook` — авторизация не сессионная, а через проверку HMAC/MD5-подписи CryptoCloud
  (`CRYPTOCLOUD_SECRET`), см. соответствующий раздел.
- `GET /api/health` — публичный health-check.
- `POST /api/pdf-proxy` — конвертация файлов через внешний Stirling PDF API идёт **без проверки сессии**;
  `verifySession()` вызывается только опционально внутри, чтобы решить, слать ли результат в Telegram.

### 0.6 Находки, требующие уточнения у владельца (безопасность / потенциальные баги)

Ниже — вещи, обнаруженные при построчном чтении кода, которые выглядят как потенциальные проблемы или
несогласованности, но не являются "придумками" — все взяты дословно из исходников:

1. **`src/app/api/tasks/route.ts` и `src/app/api/tasks/parse/route.ts`** используют **отдельный, захардкоженный**
   JWT-секрет вместо `verifySession()` из `src/lib/session.ts`:
   ```ts
   const JWT_SECRET = new TextEncoder().encode("super-secret-key-change-this-in-env-938210");
   ```
   Они читают ту же куку `perricheno_session`, но верифицируют её собственным `jwt.jwtVerify` с этим литералом
   вместо `process.env.SESSION_SECRET`. Если `SESSION_SECRET` в окружении не равен буквально этой строке, подпись
   не совпадёт и `verifyAuth()` будет всегда возвращать `null` (эндпоинты задач окажутся постоянно
   "неавторизованными" для реальных пользовательских сессий). Требует уточнения у владельца — либо это мёртвый
   код, либо `SESSION_SECRET` намеренно был выставлен равным этому значению для обратной совместимости.
2. **Захардкоженный API-ключ Stirling PDF** встречается в открытом виде в трёх файлах:
   `src/app/api/pdf-proxy/route.ts`, `src/app/api/internal/bot/extract-text/route.ts` (как дефолт),
   `src/app/api/internal/bot/history/files/route.ts` (как дефолт `PDF_API_KEY`) — везде значение
   `"0a69f4b4-0210-47c0-a2a9-946e3e894c4c"`. Требует уточнения — ключ явно не секретен в текущем виде (лежит в
   исходниках, попадающих в git).
3. **`src/app/api/space/[id]/ws-token/route.ts`** имеет захардкоженный fallback-секрет для подписи WS JWT:
   `process.env.WS_JWT_SECRET || 'fallback-secret-key-at-least-thirty-two-chars-long'`. Если `WS_JWT_SECRET` не
   задан в окружении, все WS-токены подписываются публично известной строкой.
4. **`POST /api/agent/scholar/search`** проверяет `verifySession()`, но **не проверяет**, что
   `session.user_id === userId` для найденной `AgentSession` — теоретически можно передать чужой `sessionId`
   (UUID) и прочитать/перезаписать чужую сессию литературного поиска. Риск ограничен угадыванием UUID.
5. Многие AI-эндпоинты (`agent/visualize/edit`, `agent/visualize/recommend`, `agent/visualize/generate-code`,
   `space/[id]/ai-edit`, `space/[id]/ai-fix`) проверяют только `verifySession()`, но **не вызывают
   `checkAndDeductUsage`** — то есть не списывают квоту символов/визуалов за вызов OpenAI, в отличие от соседних
   похожих роутов (`agent/visualize` (POST, action=generate), `agent/generate`, `r/generate`), где списание есть.
   Возможно, это осознанный дизайн (эти операции дешёвые/вспомогательные), но стоит уточнить у владельца.

---

## 1. Auth — `/api/auth/*`

### `POST /api/auth/delete`
Файл: `src/app/api/auth/delete/route.ts`

Удаляет аккаунт текущего пользователя и завершает сессию.

- **Auth**: требуется (`verifySession()`).
- **Request**: тело не требуется.
- **Response**:
  - `401 { error: "Unauthorized" }` — нет сессии.
  - `200 { success: true }` — успех (вызывает `deleteUser(userId)` и `deleteSession()`; ошибки `deleteUser` не
    обрабатываются — вызов не `await`-ится).
- **Пример**: `DELETE /api/auth/delete` (с валидной курой) → `{"success":true}`.

### `POST /api/auth/link`
Файл: `src/app/api/auth/link/route.ts`

Генерирует одноразовый токен для входа через Telegram deep-link (`AuthRequest` со статусом `pending`), заодно
чистит записи старше 10 минут.

- **Auth**: нет (публичный, pre-auth эндпоинт).
- **Request**: тело не требуется.
- **Response**:
  - `200 { token: string, deepLink: "https://t.me/<TELEGRAM_BOT_USERNAME>?start=<token>" }`.
  - `500 { error: string }` — ошибка БД.
- **Пример**: `POST /api/auth/link` → `{"token":"5b1e...","deepLink":"https://t.me/PerrichenoBot?start=5b1e..."}`.

### `POST /api/auth/login`
Файл: `src/app/api/auth/login/route.ts`

Логин через Telegram Login Widget: проверяет HMAC-подпись, апсертит пользователя, создаёт сессию (кука).

- **Auth**: нет сессии на входе; вместо этого — проверка `verifyTelegramAuth(data)` (см. §0.3).
- **Request** (JSON body — набор полей Telegram Login Widget): `{ id, first_name, last_name?, username?,
  photo_url?, auth_date, hash }`.
- **Response**:
  - `401 { error: "Invalid signature or expired data" }` — подпись не совпала или `auth_date` протух.
  - `200 { success: true, user }` — успех, кука `perricheno_session` выставлена.
  - `500 { error, details, stack }` — **включает `e.stack` в ответ** (отладочная утечка деталей исключения).
- **Пример**: `POST /api/auth/login {"id":123,"first_name":"Ivan","auth_date":1690000000,"hash":"..."}` →
  `{"success":true,"user":{...}}`.

### `POST /api/auth/logout`
Файл: `src/app/api/auth/logout/route.ts`

- **Auth**: не требуется явной проверки — просто удаляет текущую сессию/куку, если она есть (`deleteSession()`
  сама no-op-ит, если куки нет).
- **Request**: без тела.
- **Response**: `200 { success: true }` всегда.

### `GET /api/auth/me`
Файл: `src/app/api/auth/me/route.ts`

Возвращает профиль текущего пользователя + лимиты плана + использование PDF-стейджинга. Попутно "пингует"
`checkAndDeductUsage(userId, 'chars', 0)` — нулевое списание, нужное только чтобы триггернуть сброс
дневных/недельных счётчиков при смене даты.

- **Auth**: требуется.
- **Request**: query/body не требуются.
- **Response**:
  - `401 { user: null }` — нет сессии.
  - `404 { user: null }` — сессия валидна, но пользователь не найден в БД.
  - `403 { user: null, error: "Account suspended" }` — `user.is_banned === true`.
  - `200 { user: {...user, isAdmin: boolean}, limits: PLAN_LIMITS, stagingUsed: number, stagingCap: number }`.
    `isAdmin` — жёстко: `user.telegram_id === '1153844209'`.

### `GET /api/auth/poll`
Файл: `src/app/api/auth/poll/route.ts`

Клиент опрашивает по токену, завершил ли пользователь вход через бота; при завершении создаёт сессию и шлёт
Telegram-уведомление о новом входе.

- **Auth**: нет (сам создаёт сессию по результату).
- **Request**: query `?token=<uuid>` (обязателен).
- **Response**:
  - `400 { error: "Missing token" }`.
  - `200 { status: "expired" }` — токен не найден в `AuthRequest`.
  - `200 { status: "pending" }` — ещё не подтверждён ботом.
  - `200 { status: "completed", user }` — сессия создана (кука выставлена), запись `AuthRequest` удалена.
  - `500 { error }`.

---

## 2. Agent — `/api/agent/*`

Все роуты этого раздела (кроме внутренних деталей ниже) требуют `verifySession()` → `401 { error: "Auth required" }`
/`{ error: "Authentication required." }`/`{ error: "Unauthorized" }` при отсутствии сессии (текст сообщения
отличается от файла к файлу, но код всегда `401`).

### `POST /api/agent/analytics/generate`
Файл: `src/app/api/agent/analytics/generate/route.ts`

Запускает фоновый (fire-and-forget) пайплайн аналитики данных (`runAnalyticsPipeline`): парсит загруженные файлы,
генерирует графики через R/Python-компиляторы, пишет прогресс в `agent_sessions.stage_json`.

- **Auth**: требуется. Плюс проверка квоты `checkAndDeductUsage(userId, 'visuals', 0)` до старта.
- **Request** (JSON body): `{ prompt: string, runtime?: 'Python'|'R' = 'Python', uploadIds?: string[] = [] }`.
- **Response**:
  - `401 { error: "Auth required" }`.
  - `500 { error: "OpenAI API Key not configured" }` — нет `OPENAI_API_KEY`.
  - `402 { error: "LIMIT_REACHED", details: "Visual tokens limit reached." }` — квота исчерпана.
  - `400 { error: "Prompt is required" }`.
  - `400 { error: "No data files uploaded. Please upload CSV, Excel, or other data files." }`.
  - `404 { error: "Uploads not found" }`.
  - `200 { sessionId: string }` — сессия создана, пайплайн запущен в фоне; итог опрашивается через
    `GET /api/agent/sessions/[id]`.
  - `500 { error: string }` — прочие ошибки при старте.
- **Пример**: `POST { "prompt": "Покажи динамику продаж", "uploadIds": ["u1"] }` → `{"sessionId":"a1b2..."}`.

### `POST /api/agent/attach`
### `DELETE /api/agent/attach`
Файл: `src/app/api/agent/attach/route.ts`

Универсальная загрузка вложения для чата (PDF / изображение / файл данных CSV-Excel-JSON-TSV-TXT) в
`agent_uploads`. Большие файлы данных (>1 МБ) уходят в Supabase Storage вместо БД.

- **Auth**: требуется (`401 { error: "Unauthorized" }`).
- **Request (POST)**: `multipart/form-data` с полями `file` (Blob, обязателен) и опционально `filename`.
  Лимиты: PDF ≤ 40 МБ, изображение (png/jpeg/webp) ≤ 10 МБ, данные (csv/xlsx/json/tsv/txt) ≤ 20 МБ (при
  >1 МБ файл кладётся в Storage).
- **Response (POST)**:
  - `400 { error: "Invalid multipart body" }` / `{ error: "Missing 'file' field" }`.
  - PDF-ветка: `413 { error: "PDF too large (...)" }`; `415 { error: "File does not look like a valid PDF" }`;
    `502 { error: "Failed to parse PDF", details }`; `413 { error: "TOTAL_CHAR_CAP", message, fileChars,
    alreadyUsed, stagingCap, remaining, planTier }` (превышен план-зависимый лимит стейджинга); `422
    { error: "EMPTY_PDF", message }`; успех — `200 { uploadId, kind: "pdf", filename, charCount, imageCount,
    pageCount, ocrUsed }`.
  - Image-ветка: `413 { error: "Image too large (...)" }`; успех — `200 { uploadId, kind: "image", filename,
    charCount: 0, imageCount: 1, pageCount: 0, ocrUsed: false }`.
  - Data-ветка (Storage, >1 МБ): `200 { uploadId, kind: "data_storage", filename, fileSize, storagePath, ... }`
    или `500 { error: "Storage upload failed", details }`.
  - Data-ветка (БД, ≤1 МБ): `500 { error: "Failed to read file", details }` (например, битый xlsx) или
    `200 { uploadId, kind: "data", filename, charCount, imageCount: 0, pageCount: 1, ocrUsed: false }`.
  - Неподдерживаемый тип: `415 { error: "Unsupported file type. Accepted: PDF, PNG, JPEG, WebP, CSV, Excel, JSON,
    TSV, TXT." }`.
- **Request (DELETE)**: query `?id=<uploadId>` (обязателен).
- **Response (DELETE)**: `400 { error: "Missing id" }` или `200 { ok: true }`.

### `POST /api/agent/chat`
Файл: `src/app/api/agent/chat/route.ts`

Стриминговый (SSE, `text/event-stream`) чат с GPT (`gpt-5-mini-2025-08-07`), поддерживает режимы отправки,
повтора и редактирования сообщения, прикрепление PDF/картинок (по `uploadId`), списывает символы посимвольно
по факту использованных токенов × 3.

- **Auth**: требуется.
- **Request** (JSON body): `{ sessionId: string (обязателен), mode?: 'send'|'retry'|'edit' = 'send', editIndex?:
  number, message?: string, uploadIds?: string[] }`. Для `send`/`edit` `message` обязателен (макс. 100 000
  символов); для `edit` обязателен `editIndex >= 0`.
- **Response**:
  - `401 { error: 'Auth required' }`; `500 { error: 'OPENAI_API_KEY not configured' }`.
  - `400 { error: 'sessionId required' }` / `'message required'` / `'editIndex required for edit mode' }`.
  - `413 { error: 'Message is too large (>100k characters).' }`.
  - `402 { error: 'LIMIT_REACHED' }` — предпроверка квоты символов.
  - `404 { error: 'Session not found' }` — сессия чужая или не существует.
  - `400 { error: 'No user message to retry' }` (retry без истории), `{ error: 'editIndex out of range' }`,
    `{ error: 'editIndex must point to a user message' }`.
  - Успех: `200` поток SSE-событий `data: {"delta": "..."}` (по мере генерации) и финальный
    `data: {"done": true, aborted, charsBilled, promptTokens, completionTokens}`. Ошибка апстрима — событие
    `data: {"error": "..."}`.
- **Пример**: `POST {"sessionId":"s1","message":"Привет"}` → SSE-поток дельт, завершение `{"done":true,...}`.

### `POST /api/agent/chat/sessions`
### `GET /api/agent/chat/sessions`
Файл: `src/app/api/agent/chat/sessions/route.ts`

Создание/список чат-сессий (`doc_type: 'chat'`).

- **Auth**: требуется.
- **POST Request**: `{ initialMessage?: string }`. **Response**: `200 { sessionId }` или `500 { error }`.
- **GET Response**: `200 { sessions: AgentSession[] }` (только с `doc_type === 'chat'`).

### `POST /api/agent/compile-pdf`
Файл: `src/app/api/agent/compile-pdf/route.ts`

Проксирует ZIP-архив LaTeX-проекта во внешний компилятор (`LATEX_COMPILER_URL`, заголовок `x-api-key:
LATEX_COMPILER_KEY`) и возвращает готовый PDF.

- **Auth**: требуется.
- **Request**: `multipart/form-data`, поле `file` — ZIP.
- **Response**:
  - `500 { error: "Compiler Config (URL/KEY) missing..." }` — не настроены env-переменные.
  - `400 { error: "No physical ZIP file payload provided." }`.
  - `<compilerStatus> { error: "Compiler Error (<status>): ..." }` — компилятор вернул ошибку.
  - `500 { error: "Compiler returned text/json: ..." }` — компилятор ответил не PDF.
  - `200` — бинарный PDF (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="compiled_document.pdf"`).
  - `500 { error }` — прочее.

### `POST /api/agent/data-analytics`
Файл: `src/app/api/agent/data-analytics/route.ts`

Комбинированный action-эндпоинт: `action: 'suggest'` (AI подсказывает типы графиков) или `action: 'generate'`
(default) — SSE-стрим последовательной генерации до 8 графиков через R/Python-компиляторы.

- **Auth**: требуется + предпроверка `checkAndDeductUsage(userId, 'visuals', 0)` → `402 { error: "LIMIT_REACHED",
  details: "Visual tokens limit reached." }`.
- **Request**: `{ action?: 'suggest'|'generate', prompt: string, contextFiles?: {name,content}[], charts?:
  string[], runtime?: 'Python'|'R' }`.
- **Response (`suggest`)**: `200 { charts: string[], count: number, reasoning: string }` (с фоллбэком
  `["bar","scatter","line"]` при ошибке парсинга ответа модели) либо `500 { error }` (в т.ч. hard-stop при
  "Failed to extract"/"[Failed" в контексте).
- **Response (`generate`)**: `200` SSE-поток событий `status`, `code_chunk`, `chart_done` (`{index, chartType,
  image, code, runtime}`), `chart_error`, `all_done`, `error`.
- Списание квоты (`chars`, `visuals`) происходит внутри цикла генерации, per-chart.

### `POST /api/agent/generate`
Файл: `src/app/api/agent/generate/route.ts`

Главный оркестратор генерации документа (5-стадийный пайплайн `runPipeline`), фоновая генерация с прогрессом
в `stage_json`, Telegram-уведомления о старте/завершении/ошибке. Также поддерживает "legacy"-путь редактирования/
исправления ошибок компиляции существующей сессии одним вызовом LLM.

- **Auth**: требуется. Предпроверка квоты символов (`402 { error: 'LIMIT_REACHED', details: 'Characters limit
  reached.' }`) и лимит одновременных генераций — не более 3 активных сессий на пользователя
  (`429 { error: 'Достигнут лимит одновременных генераций (макс. 3)...' }`).
- **Request** (основной путь, JSON): `{ prompt, type?: DocType = 'research', style?='medium', wordCount?
  (300..30000, default 2000), columns?: 1|2 = 2, useTemplate?=true, templateId?, customTemplatePreamble?,
  useReferences?=false, language?='en', authorName?, courseName?, dateStr?, groupName?, supervisorName?,
  taskDescription?, taskFileText?, referenceLinks?: string[], uploadIds?: string[], visualCount?: 0..10,
  dataUploadIds?: string[], dataRuntime?: 'R'|'Python' }`.
- **Request** (legacy-путь — если тело содержит `currentTex` или `errorLog`): `{ sessionId (обязателен),
  currentTex?, currentBib?, errorLog?, prompt?, language? }`.
- **Response**:
  - `401 { error: 'Authentication required.' }`; `500 { error: 'OpenAI API Key is not configured.' }`.
  - `400 { error: 'Prompt is required.' }` (основной путь) / `{ error: 'Legacy path requires currentTex.' }` /
    `{ error: 'sessionId required for edit' }` (legacy).
  - `200 { sessionId }` — в обоих путях; фактический результат пишется в фоне, клиент опрашивает
    `GET /api/agent/sessions/[id]`.

### `POST /api/agent/ingest-pdf`
### `DELETE /api/agent/ingest-pdf`
Файл: `src/app/api/agent/ingest-pdf/route.ts`

То же, что PDF-ветка `agent/attach`, но отдельным эндпоинтом только для PDF (используется, например, в R Studio).

- **Auth**: требуется.
- **POST Request**: `multipart/form-data { file (обязателен, ≤40 МБ), filename? }`.
- **POST Response**: `400`/`415`/`413`/`502`/`413 TOTAL_CHAR_CAP`/`422 EMPTY_PDF` (аналогично `agent/attach`);
  успех — `200 { uploadId, filename, charCount, imageCount, pageCount, ocrUsed, remaining }`.
- **DELETE**: query `?id=`, `400`/`200 { ok: true }`.

### `POST /api/agent/python-compile`
Файл: `src/app/api/agent/python-compile/route.ts`

Прокси кода Python во внутренний сервис-компилятор.

- **Auth**: требуется.
- **Request**: `{ code (обязателен), files?: any[] }`.
- **Response**: `400 { error: "Python code is required" }`; `500 { error: "Python compiler error" }`; успех —
  `200 <результат компилятора as-is>` (обычно `{ success, image?, log? }`).

### `POST /api/agent/r-compile`
Файл: `src/app/api/agent/r-compile/route.ts`

Симметричный прокси для R-кода (таймаут 35 c).

- **Auth**: требуется. Request/Response — как у `python-compile`, но с `"R code is required"`.

### `POST /api/agent/scholar/search`
Файл: `src/app/api/agent/scholar/search/route.ts`

Ищет научные статьи через внутренний Go-микросервис (`RESEARCH_API_URL`, arXiv/OpenAlex), с автопереводом
не-латинских запросов через MyMemory API.

- **Auth**: требуется (проверяется **после** чтения `sessionId` из тела, но до похода в БД).
  ⚠️ Не проверяется, что `session.user_id === userId` (см. §0.6, п.4).
- **Request**: `{ sessionId (обязателен) }` — сам запрос читается из `AgentSession.stream_text` этой сессии.
- **Response**: `401 { error: "Unauthorized" }`; `404 { error: "Session not found" }`; `400 { error: "Empty
  query" }`; `500 { error }` (в т.ч. при ошибке Go-сервиса); успех — `200 { articles: ScholarArticle[], query,
  originalQuery }`, попутно обновляет `AgentSession.status='completed'` и `visuals_json`.

### `DELETE /api/agent/scholar/sessions/[id]`
Файл: `src/app/api/agent/scholar/sessions/[id]/route.ts`

- **Auth**: требуется. Удаляет `AgentSession` только если `id` и `user_id` совпадают (`deleteMany` с фильтром).
- **Response**: `404 { error: 'Not found' }` (0 удалённых строк) или `200 { ok: true }`.

### `POST /api/agent/scholar/sessions`
Файл: `src/app/api/agent/scholar/sessions/route.ts`

Создаёт `AgentSession` с `doc_type: 'literature_search'`, списывает фиксированные 2500 символов за операцию.

- **Auth**: требуется.
- **Request**: `{ prompt, settings }`.
- **Response**: `402 { error: "Insufficient characters on balance" }`; `500 { error }`; успех —
  `200 { sessionId }`.

### `GET /api/agent/sessions/[id]`
### `PUT /api/agent/sessions/[id]`
### `DELETE /api/agent/sessions/[id]`
Файл: `src/app/api/agent/sessions/[id]/route.ts`

Универсальный CRUD над одной `AgentSession` — базовый способ поллинга прогресса генерации/чата/визуализации.

- **Auth**: требуется во всех трёх методах.
- **GET Response**: `404 { error: "Session not found" }`; `403 { error: "Unauthorized" }` (чужая сессия); успех —
  `200 { session: { id, status, stream_text, stage_json, error_msg, main_tex, references_bib, visuals_json,
  settings_json, doc_type, title, updated_at } }`.
- **PUT Request**: частичное обновление — принимает только `main_tex`, `references_bib`, `settings_json`,
  `title`, `visuals_json` (прочие поля игнорируются). **Response**: `404`/`403` как выше; `400 { error: "No
  valid fields to update" }`; успех — `200 { success: true }`.
- **DELETE Response**: `404 { error: "Session not found or unauthorized" }` или `200 { success: true }`.

### `POST /api/agent/sessions/[id]/share`
Файл: `src/app/api/agent/sessions/[id]/share/route.ts`

Переключает публичную ссылку на сессию (`toggleAgentSessionShare` — генерирует/убирает `share_id`).

- **Auth**: требуется.
- **Response**: `200 { shared: boolean, share_id: string|null, share_url: "/agent/shared/<id>"|null }`.

### `GET /api/agent/sessions`
### `POST /api/agent/sessions`
Файл: `src/app/api/agent/sessions/route.ts`

- **Auth**: требуется.
- **GET Response**: `200 { sessions: AgentSession[] }` (все сессии пользователя, без фильтра по `doc_type`).
- **POST Request**: `{ title (обязателен), doc_type?='research', settings_json?, main_tex?, references_bib?,
  visuals_json? }`. **Response**: `400 { error: "Title is required" }`; успех — `201 { session }`.

### `POST /api/agent/templates/upload`
Файл: `src/app/api/agent/templates/upload/route.ts`

Извлекает LaTeX-преамбулу (`\usepackage`... до `\begin{document}`) из загруженного Overleaf-ZIP — без записи в БД,
клиент передаёт результат обратно в `agent/generate` как `customTemplatePreamble`.

- **Auth**: требуется.
- **Request**: `multipart/form-data { file }`, ограничение по размеру — 10 МБ (проверяется по `Content-Length`
  до чтения тела).
- **Response**: `413 { error: "ZIP file too large (max 10 MB)." }`; `400 { error: "Invalid multipart body." }` /
  `{ error: "No file provided." }`; `422 { error: "Could not read ZIP file..." }` / `{ error: "No .tex file
  found in the ZIP." }` / `{ error: "Could not extract a valid preamble from main.tex." }` (преамбула < 20
  символов); успех — `200 { preamble, mainFile, filesFound: string[], preambleLength }`.

### `GET /api/agent/uploads`
Файл: `src/app/api/agent/uploads/route.ts`

Метаданные загруженных файлов (без `text_content`) по списку id — для отображения TTL/статуса в staging-трее.

- **Auth**: требуется.
- **Request**: query `?ids=id1,id2,...` (обязателен).
- **Response**: `400 { error: 'ids parameter required' }`; `200 { uploads: [] }` при пустом списке; иначе
  `200 { uploads: [{id, user_id, filename, char_count, image_count, page_count, ocr_used, storage_path,
  expires_at, created_at}] }` (только принадлежащие текущему пользователю — фильтр `user_id: userId` в запросе);
  `500 { error }`.

### `POST /api/agent/visualize/edit`
Файл: `src/app/api/agent/visualize/edit/route.ts`

AI-редактирование существующего R/Python кода визуализации по текстовому запросу пользователя (без компиляции).

- **Auth**: требуется. ⚠️ Квота не списывается (см. §0.6, п.5).
- **Request**: `{ currentCode, editPrompt, language?: 'R'|'Python' = 'R' }`.
- **Response**: `500 { error: "Failed" }` (или сообщение исключения) при ошибке AI; успех — `200 { code: string }`.

### `POST /api/agent/visualize/generate-code`
Файл: `src/app/api/agent/visualize/generate-code/route.ts`

Стримит (обычный текстовый поток, не SSE JSON) сырой R/Python-код визуализации по теме без компиляции.

- **Auth**: требуется. ⚠️ Квота не списывается.
- **Request**: `{ topic, chartType, palette?='viridis', language?='en', dataContext?='', engine?: 'r'|'python'
  ='r' }`.
- **Response**: `500 { error: "OpenAI API Key not configured" }`; `500 { error: "AI error: ..." }`; успех —
  `200` поток `Content-Type: text/plain` с сырыми чанками кода.

### `POST /api/agent/visualize/recommend`
Файл: `src/app/api/agent/visualize/recommend/route.ts`

AI подбирает ровно 3 (максимум 4 после `slice`) типа графиков под тему + контекст данных.

- **Auth**: требуется. ⚠️ Квота не списывается.
- **Request**: `{ topic, dataContext, availableTypes: string[] }`.
- **Response**: `500 { error: "Recommendation failed" }` / прочее сообщение исключения; успех —
  `200 { recommended: string[] }` (фоллбэк `["bar","scatter","wordcloud"]` при сбое парсинга).

### `POST /api/agent/visualize`
Файл: `src/app/api/agent/visualize/route.ts`

Комбинированный: `action: "compile"` (компилирует пользовательский код) или `action: "generate"` (AI генерирует +
сразу компилирует, синхронно, без стрима — в отличие от `data-analytics`).

- **Auth**: требуется + предпроверка `checkAndDeductUsage(userId, 'visuals', 0)` →
  `402 { error: "LIMIT_REACHED", details: "Visual tokens limit reached." }`.
- **Request**: `{ topic, chartType, palette?='viridis', language?='en', dataContext?='', action: 'compile'|
  'generate', code? (для compile), previousError?, previousCode? (для retry внутри generate), runtime?: 'R'|
  'Python' = 'R' }`.
- **Response**:
  - `action="compile"`: `500 { error: "<runtime> Compilation server error" }`; `500 { error: log, code }` при
    неуспехе компиляции; успех — `200 { success: true, image, code, chart_type }`.
  - `action="generate"`: `500 { error: "AI Generation failed: ..." }`; `500 { error: log, code: generatedCode }`
    при неуспехе компиляции; успех — `200 { success: true, image, code, chart_type }` (здесь квота **списывается**
    — `chars` и `visuals`).
  - `400 { error: "Invalid action. Use 'generate' or 'compile'." }`.

---

## 3. R Studio — `/api/r/*`

### `POST /api/r/generate`
Файл: `src/app/api/r/generate/route.ts`

Три режима в одном эндпоинте: `suggest` (подбор типов графиков), `multi` (фоновая генерация нескольких графиков,
план зависит от тарифа пользователя, с автоповтором при ошибке компиляции), одиночная синхронная генерация
(по умолчанию, без `action`).

- **Auth**: требуется + предпроверка `checkAndDeductUsage(userId, "visuals", 0)` →
  `402 { error: "LIMIT_REACHED", details: "Visual limit reached." }`. Также `500 { error: "OpenAI API key not
  configured." }`.
- **Request**: `{ action?: 'suggest'|'multi'|(generate по умолчанию), prompt, chartType?='', chartTypes?:
  string[], contextFiles?: {name,content,rFileName?,fileData?,images?}[], previousCode?, previousError? }`.
- **Response**:
  - `400 { error: "Invalid JSON" }` / `{ error: "Prompt is required." }`.
  - `suggest`: `500 { error: "Suggestion failed." }` или `200 { charts: string[], reasoning }` (фоллбэк на
    ошибке парсинга).
  - `multi`: план графиков ограничен тарифом (`free:1, plus:3, pro:10, ultra:15`); ответ сразу
    `200 { sessionId, chartsPlanned: string[] }` — реальная генерация идёт в фоне, прогресс — через
    `GET /api/r/sessions/[id]`.
  - default (одиночный, синхронный): `500 { error: <текст ошибки AI/компилятора> }`; `422 { error: log, code }`
    — R упал на выполнении; успех — `200 { image, code, chartType, sessionId }`.

### `GET /api/r/sessions/[id]`
### `DELETE /api/r/sessions/[id]`
Файл: `src/app/api/r/sessions/[id]/route.ts`

- **Auth**: требуется (`401 { error: 'Authentication required.' }`).
- **GET**: `404 { error: 'Not found.' }` (чужая или несуществующая); успех —
  `200 { session: { id, title, prompt, status, results: RResultItem[], created_at, updated_at } }`.
- **DELETE**: `404 { error: 'Not found.' }` или `200 { success: true }`.

### `GET /api/r/sessions`
Файл: `src/app/api/r/sessions/route.ts`

- **Auth**: требуется. **Response**: `200 { sessions: RSession[] }` (только сессии текущего пользователя).

### `POST /api/r/upload`
Файл: `src/app/api/r/upload/route.ts`

Прокси извлечения текста/изображений из файла (PDF/Office/CSV/TXT) через внутренний
`/api/internal/bot/extract-text` (тот же процесс, вызов по HTTP на `INTERNAL_EXTRACT_URL`, по умолчанию
`http://localhost:3000/api/internal/bot/extract-text`), с подстановкой `x-bot-secret: WEBHOOK_SECRET`.

- **Auth**: требуется (`401`). Плюс `500 { error: "Extract service not configured." }`, если `WEBHOOK_SECRET`
  не задан на этом сервисе.
- **Request**: `multipart/form-data { file }`, лимит 20 МБ.
- **Response**: `400 { error: "No file provided." }` / `{ error: "File too large (max 20 MB)." }`;
  `500 { error: "Extraction failed: ..." }`; успех — `200 { name, content, images, chars, pages }`.

---

## 4. TikZ — `/api/tikz/*`

### `POST /api/tikz/generate`
Файл: `src/app/api/tikz/generate/route.ts`

Генерация TikZ-диаграммы по одному из ~28 заготовленных "blueprint"-типов (`mind_map`, `flowchart`, `er_diagram`,
`swot`, `gantt` и т.д.), с автоповтором до 3 попыток компиляции (ошибки LaTeX скармливаются обратно модели).

- **Auth**: требуется. Предпроверка `checkAndDeductUsage(userId, "visuals", 0)` →
  `402 { error: "LIMIT_REACHED", details: "Visual limit reached." }`.
- **Request**: `{ prompt (обязателен), visualType?='concept_map', language?='en' }`.
- **Response**: `400 { error: "Invalid JSON" }` / `{ error: "Prompt is required." }`; успех —
  `200 { tikzCode, pdfBase64, type }` (квота списывается по факту потраченных токенов); при исчерпании 3
  попыток — `422 { error: "TikZ compilation failed after 3 attempts.", log, tikzCode }`.

---

## 5. Canvas — `/api/canvas/*`

### `POST /api/canvas/generate`
Файл: `src/app/api/canvas/generate/route.ts`

Генерирует mind-map/pipeline в формате JSON Canvas 1.0 (строго 4 группы × 9 текстовых узлов по фиксированному
скелету).

- **Auth**: требуется (`401 { error: "Unauthorized" }`). ⚠️ Квота не списывается.
- **Request**: `{ prompt (обязателен) }`.
- **Response**: `500 { error: "OpenAI API Key is not configured." }`; `400 { error: "Prompt is required." }`;
  `500 { error: "Failed to generate canvas. External API error." }`; `500 { error: "AI generated invalid JSON
  Canvas format." }`; `500 { error: "An unexpected parsing error occurred.", details }` (например, JSON.parse
  упал); успех — `200 { canvas: { nodes, edges } }`.

---

## 6. Chat (общий текстовый чат-виджет) — `/api/chat/*`

### `GET /api/chat/history`
### `POST /api/chat/history`
### `DELETE /api/chat/history`
Файл: `src/app/api/chat/history/route.ts`

CRUD над `ChatSession`/`ChatMessage` (отдельная от `agent/chat` модель — здесь своя таблица истории чата).

- **Auth**: требуется во всех методах (`401 { error: "Auth required" }`).
- **GET Request**: query `?sessionId=` (опционально). Без него — список сессий пользователя: `200 { sessions:
  [{id,title,created_at,createdAt}] }`. С ним — сообщения сессии: `200 { messages: [{id,role,text,timestamp}] }`.
  `500 { error: String(err) }`.
- **POST Request**: `{ action: 'create_session'|'save_message', sessionId, title?, message?: {id,role,text,
  metadata?} }`. `create_session` → `200 { success: true }`. `save_message` → создаёт сессию, если её ещё нет,
  затем транзакционно пишет сообщение и обновляет `updated_at` → `200 { success: true }`. Неизвестный `action`
  → `400 { error: "Invalid action" }`.
- **DELETE Request**: query `?sessionId=` (обязателен). `400 { error: "Missing sessionId" }`; удаляет только
  сессии текущего пользователя (`deleteMany` с фильтром `user_id`); `200 { success: true }` независимо от того,
  была ли реально удалена строка.

---

## 7. Citations (менеджер библиографии) — `/api/citations/*`

Все роуты требуют `verifySession()` → `401 { error: 'Unauthorized' }` при отсутствии.

### `GET /api/citations/[id]`
### `PATCH /api/citations/[id]`
### `DELETE /api/citations/[id]`
Файл: `src/app/api/citations/[id]/route.ts`

- **GET**: `404 { error: 'Not found' }` или `200 { citation }`.
- **PATCH Request**: JSON, разрешённые к обновлению поля — белый список: `title, authors, year, venue, abstract,
  url, bibtex, cite_key, tags, notes, starred, doi, arxiv_id, isbn` (прочие поля тела молча игнорируются).
  **Response**: `404 { error: 'Not found' }` или `200 { citation }`.
- **DELETE**: `404 { error: 'Not found' }` или `200 { ok: true }`.

### `GET /api/citations/collections`
### `POST /api/citations/collections`
Файл: `src/app/api/citations/collections/route.ts`

- **GET**: `200 { collections }`.
- **POST Request**: `{ name (обязателен, string), color? }`. **Response**: `400 { error: 'name is required' }`
  или `200 { collection }`.

### `DELETE /api/citations/collections/[id]`
### `POST /api/citations/collections/[id]`
Файл: `src/app/api/citations/collections/[id]/route.ts`

- **DELETE**: удаляет коллекцию. `404 { error: 'Not found' }` или `200 { ok: true }`.
- **POST**: добавляет/убирает цитату из коллекции. **Request**: `{ citationId (обязателен), remove?: boolean }`
  — `remove: true` убирает, иначе добавляет. **Response**: `400 { error: 'citationId required' }`;
  `400 { error: <message> }` при ошибке `addCitationToCollection`/`removeCitationFromCollection`; успех —
  `200 { ok: true }`.

### `GET /api/citations`
### `POST /api/citations`
Файл: `src/app/api/citations/route.ts`

- **GET Request**: query `search?`, `tag?`, `starred? ('1')`, `collection?`. **Response**: `200 { citations }`.
- **POST Request**: `{ title, bibtex, cite_key (все три обязательны), doi?, arxiv_id?, isbn?, authors?: string[],
  year?: number, venue?, abstract?, url?, tags?: string[], notes?, starred?: boolean }`. **Response**:
  `400 { error: 'Invalid JSON' }` / `{ error: 'title, bibtex, cite_key are required' }`;
  `500 { error: <message> }`; успех — `200 { citation }`.

### `GET /api/citations/search`
Файл: `src/app/api/citations/search/route.ts`

Поиск во внешних академических индексах: CrossRef (DOI/полнотекстовый поиск) и arXiv, с авто-конвертацией в
BibTeX и генерацией `cite_key`.

- **Auth**: требуется.
- **Request**: query `?q=<строка> (обязателен)`, `&source=auto|crossref|arxiv|doi` (default `auto`).
  При `auto` — если `q` похож на DOI (`10.xxxx/...`) → резолвится напрямую; если похож на arXiv ID
  (`\d{4}\.\d{4,5}`) → берётся одна статья; иначе — параллельный поиск в CrossRef (до 8) и arXiv (до 5).
- **Response**: `400 { error: 'Query parameter "q" is required' }`; `500 { error: <message> }`; успех —
  `200 { results: [{source, doi, arxiv_id, title, authors, year, venue, abstract, url, bibtex, cite_key}] }`.

---

## 8. Space (LaTeX-редактор проектов) — `/api/space/*`

Единый паттерн авторизации: `verifySession()` → `401`, затем `getUserRoleInSpace(id, userId)` возвращает
`'owner'|'editor'|'viewer'|null`. `null` → как правило `404 { error: 'Not found' }` (чтобы не раскрывать
существование чужого приватного проекта); `viewer` не может изменять содержимое (`403 { error: 'Forbidden' }`
на write-эндпоинтах); только `owner` может менять настройки/удалять/приглашать/убирать участников
(`403 { error: '...' }`).

### `GET /api/space`
### `POST /api/space`
Файл: `src/app/api/space/route.ts`

- **GET**: `401`; успех — `200 { spaces: Space[] }` (все пространства пользователя).
- **POST Request**: `{ title?='Untitled Project' (обрезается до 120 симв.), template?='blank', compiler?:
  'pdflatex'|'xelatex'|'lualatex' = 'pdflatex' }`. **Response**: `201 { space }`.

### `GET /api/space/[id]`
### `PATCH /api/space/[id]`
### `DELETE /api/space/[id]`
Файл: `src/app/api/space/[id]/route.ts`

- **GET**: `404 { error: 'Not found' }` или `200 { space }`.
- **PATCH**: только `owner` (`404` если роли нет, `403 { error: 'Only owner can edit settings' }` иначе).
  **Request**: `{ title?, description?, compiler?, main_file?, auto_compile?, is_public? }`. **Response**:
  `400 { error: 'Invalid JSON' }` или `200 { ok: true }`.
- **DELETE**: `401`; `200 { ok: true }` (удаление ограничено внутри `deleteSpace(id, userId)`).

### `GET /api/space/invite/[token]`
### `POST /api/space/invite/[token]`
Файл: `src/app/api/space/invite/[token]/route.ts`

- **GET** (превью инвайта, без авторизации): `404 { error: 'Invite not found or expired' }` или
  `200 { invite: { space_id, role } }` (email не раскрывается).
- **POST** (принять инвайт): требуется сессия. `404 { error: 'Invite not found or expired' }` или
  `200 { ok: true, spaceId }`.

### `POST /api/space/[id]/invite`
Файл: `src/app/api/space/[id]/invite/route.ts`

Только `owner`. **Request**: `{ role?: 'editor'|'viewer' = 'editor' }`. **Response**:
`403 { error: 'Only owner can invite' }`; успех — `201 { ok: true, inviteUrl, token }`.

### `POST /api/space/[id]/share`
Файл: `src/app/api/space/[id]/share/route.ts`

Включает/выключает публичную read-only ссылку на проект. ⚠️ Здесь роль **не проверяется явно** в самом
роуте — доступ ограничен только внутри `enableSpaceSharing/disableSpaceSharing(id, userId)` (не прочитан
отдельно, поведение для не-owner — требует уточнения у владельца/см. `src/lib/space-db.ts`).

- **Request**: `{ enabled?: false }` — при `false` выключает; иначе включает. **Response**:
  `200 { ok: true, enabled: false }` или `200 { ok: true, enabled: true, shareId, url }`.

### `GET /api/space/[id]/collaborators`
Файл: `src/app/api/space/[id]/collaborators/route.ts`

Любая роль (включая `viewer`) может смотреть список. `404 { error: 'Not found' }` без роли; успех —
`200 { collaborators }`.

### `DELETE /api/space/[id]/collaborators/[uid]`
Файл: `src/app/api/space/[id]/collaborators/[uid]/route.ts`

- **Response**: `404 { error: 'Not found' }` (нет роли); `403 { error: 'Owner cannot leave; transfer ownership
  first' }` (owner пытается удалить сам себя); `403 { error: 'Forbidden' }` (не-owner пытается удалить кого-то
  кроме себя); успех — `200 { ok: true }`.

### `POST /api/space/[id]/compile`
Файл: `src/app/api/space/[id]/compile/route.ts`

Собирает все файлы пространства в ZIP и шлёт на внешний LaTeX-компилятор (`LATEX_COMPILER_URL` +
`x-api-key: LATEX_COMPILER_KEY`), передавая движок (`pdflatex`/`xelatex`/`lualatex` через заголовок
`X-Compiler`) и точку входа (`X-Main-File`).

- **Response**: `404 { error: 'Not found' }`; `503 { error: 'Compiler not configured' }`; `400 { error: 'No
  files to compile' }`; успех при компиляции — `200` бинарный PDF (`Content-Disposition: inline`); при ошибке
  компиляции — **тоже HTTP `200`**, но JSON `{ ok: false, log: string (обрезан до 12000 симв.) }` — статус-код
  не отражает неуспех компиляции, различать нужно по `Content-Type`/телу.

### `POST /api/space/[id]/duplicate`
Файл: `src/app/api/space/[id]/duplicate/route.ts`

`404 { error: 'Not found' }` или `201 { space }`.

### `GET /api/space/[id]/export`
Файл: `src/app/api/space/[id]/export/route.ts`

Экспорт всех файлов проекта одним ZIP. Доступно любой роли (owner/editor/viewer).

- **Response**: `403 { error: 'Forbidden' }` (нет роли); `404 { error: 'Not found' }`; успех — `200` бинарный
  ZIP (`Content-Disposition: attachment; filename="<slug>.zip"`).

### `POST /api/space/[id]/ai-edit`
Файл: `src/app/api/space/[id]/ai-edit/route.ts`

AI-редактирование выделенного куска LaTeX по одному из пресетов действий (`fix`, `rewrite`, `translate`,
`explain`, `shorten`, `expand`) либо по произвольному `customPrompt`.

- **Auth**: требуется + роль в пространстве (`404` без роли; редактор/владелец могут — `viewer` тоже технически
  проходит проверку `if (!role)`, т.е. **viewer может вызывать AI-правки текста**, хотя не может сохранить их
  файлом — стоит уточнить, ожидаемое ли это поведение). ⚠️ Квота не списывается.
- **Request**: `{ action?: keyof ACTIONS, text (обязателен), customPrompt? }`. **Response**:
  `503 { error: 'AI not configured' }`; `400 { error: 'text required' }` / `{ error: 'action or customPrompt
  required' }`; `502 { error: 'AI request failed' }`; успех — `200 { result: string }`.

### `POST /api/space[id]/ai-fix` <!-- фактический путь: /api/space/[id]/ai-fix -->
Файл: `src/app/api/space/[id]/ai-fix/route.ts`

AI диагностирует ошибку компиляции LaTeX по логу + исходнику, возвращает объяснение и патч.

- **Auth**: как у `ai-edit`. ⚠️ Квота не списывается.
- **Request**: `{ log (обязателен), code?, filename? }`. **Response**: `503`/`400 { error: 'log required' }`/
  `502 { error: 'AI request failed' }`; успех — `200 { explanation?, fix? }` (модель должна вернуть JSON;
  при сбое парсинга — `{ explanation: <сырой ответ>, fix: '' }`).

### `GET /api/space/[id]/ws-token`
Файл: `src/app/api/space/[id]/ws-token/route.ts`

Выдаёт короткоживущий (2 часа) JWT для подключения к WebSocket-серверу совместного редактирования.

- **Response**: `404 { error: 'Not found' }` (нет роли); успех — `200 { token }` (payload `{spaceId, userId,
  role}`, подписан `WS_JWT_SECRET`, см. предупреждение о fallback-секрете в §0.6, п.3).

### `GET /api/space/[id]/files`
### `POST /api/space/[id]/files`
Файл: `src/app/api/space/[id]/files/route.ts`

- **GET**: список файлов без содержимого (`{id, path, mime_type, size_bytes, updated_at, is_binary}`).
  `404` без роли; успех — `200 { files }`.
- **POST**: создаёт новый текстовый файл. Роль `viewer` запрещена (`403`). **Request**: `{ path (обязателен),
  content?='' }`. **Response**: `400 { error: 'path required' }`; успех — `201 { ok: true }`.

### `GET /api/space/[id]/files/[...path]`
### `PUT /api/space/[id]/files/[...path]`
### `DELETE /api/space/[id]/files/[...path]`
Файл: `src/app/api/space/[id]/files/[...path]/route.ts`

Работа с содержимым одного файла по произвольному вложенному пути (`[...path]` — каталоги через `/`).

- **GET**: `404 { error: 'Not found' }` (нет роли) / `404 { error: 'File not found' }`; успех — `200 { file }`.
- **PUT**: `400 { error: 'Invalid path' }` (path пуст, начинается с `/`, содержит `../` или NUL-байт — защита от
  path traversal); `403 { error: 'Forbidden' }` (viewer); `413 { error: 'File too large (max 2 MB)' }`; успех —
  `200 { ok: true }`.
- **DELETE**: `403` для viewer; `200 { ok: true }`.

### `POST /api/space/[id]/files/import-zip`
Файл: `src/app/api/space/[id]/files/import-zip/route.ts`

Импортирует содержимое ZIP-архива как файлы проекта (текстовые по whitelist-расширениям идут как текст, прочие —
как base64/бинарные), с авто-детектом общей корневой папки (Overleaf-style экспорт).

- **Request**: `multipart/form-data { file }` (ZIP, ≤20 МБ; отдельные файлы внутри ≤5 МБ — превышающие
  пропускаются и попадают в `skipped`). **Response**: `403` для viewer; `413 { error: 'ZIP too large (max
  20 MB)' }`; `400 { error: 'Invalid ZIP file' }`; успех — `200 { ok: true, imported: string[], skipped:
  string[] }`.

### `POST /api/space/[id]/files/rename`
Файл: `src/app/api/space/[id]/files/rename/route.ts`

**Request**: `{ from (обязателен), to (обязателен) }`. **Response**: `403` для viewer; `400 { error: 'from and
to required' }`; `200 { ok: true }` (если `from === to` — no-op, тоже `200 { ok: true }`).

### `POST /api/space/[id]/files/upload`
Файл: `src/app/api/space/[id]/files/upload/route.ts`

Загрузка одного бинарного файла (изображение и т.п.), лимит 5 МБ, путь по умолчанию `images/<filename>`.

**Request**: `multipart/form-data { file, path? }`. **Response**: `403` для viewer; `413 { error: 'File too
large (max 5 MB)' }`; успех — `201 { ok: true, path }`.

### `GET /api/space/[id]/versions`
### `POST /api/space/[id]/versions`
Файл: `src/app/api/space/[id]/versions/route.ts`

- **GET**: `200 { versions }`.
- **POST** (ручное сохранение снапшота): `403` для viewer. **Request**: `{ label?='Manual save' (до 100
  симв.), message?  (до 500 симв.) }`. **Response**: `201 { version }`.

### `GET /api/space/[id]/versions/[vid]`
Файл: `src/app/api/space/[id]/versions/[vid]/route.ts`

`404 { error: 'Not found' }` (нет роли, либо версия не найдена, либо `version.space_id !== id`); успех —
`200 { version }`.

### `POST /api/space/[id]/versions/[vid]/restore`
Файл: `src/app/api/space/[id]/versions/[vid]/restore/route.ts`

`403` для viewer; успех — `200 { ok: true }`.

---

## 9. Billing — `/api/billing/*`

### `POST /api/billing/checkout`
Файл: `src/app/api/billing/checkout/route.ts`

Создаёт платёжную ссылку через CryptoCloud (USD), с фоллбэком на статичный POS-терминал.
Шлёт пользователю Telegram-уведомление со ссылкой на оплату (если есть `TELEGRAM_BOT_TOKEN` и известен
`telegram_id`).

> ⚠️ До 2026-09-03 этот роут также поддерживал Kaspi Pay (KZT) через `currency: 'kzt'`. Интеграция была
> заброшена (подтверждено владельцем, никогда не была подключена в CI) и код удалён — см.
> [`docs/integrations.md`](integrations.md), раздел 3. Поле `currency` в запросе больше ни на что не влияет.

- **Auth**: требуется (`401 { error: 'Auth required' }`).
- **Request**: `{ planId|packId (id пакета из PLANS) }`.
- **Response**:
  - `400 { error: 'Invalid package selected' }`.
  - Нет ключей CryptoCloud → `200 { fallback_url: POS_FALLBACK }` (статичная ссылка на терминал).
  - `502 { error: 'Gateway error', fallback_url }` — CryptoCloud вернул невалидный JSON.
  - `500 { error: <message>, fallback_url }` — CryptoCloud вернул ошибку/не дал ссылку.
  - Успех: `200 { url: <ссылка на оплату> }`.

### ~~`POST /api/billing/kaspi-webhook`~~ — удалён 2026-09-03
Файл `src/app/api/billing/kaspi-webhook/route.ts` больше не существует (Kaspi Pay заброшена, подтверждено
владельцем). Запрос на этот путь теперь возвращает `404`. Сохранено здесь только для истории: раньше принимал
`{ txn_id, order_id, status, amount, currency, sign }` с HMAC-SHA256-подписью и отвечал в специфичном для
Kaspi формате `{ result: 0 | 1 }`.

### `GET /api/billing/receipt/[id]`
Файл: `src/app/api/billing/receipt/[id]/route.ts`

Отдаёт готовый PDF-чек (хранится как base64 в `Receipt.pdf_base64`).

- **Auth**: нет.
- **Response**: `400` (невалидный id); `202` HTML-заглушка "чек генерируется..." (авто-refresh через 5 c), если
  запись есть, но `pdf_base64` ещё пуст; `404` — записи нет вообще; `500` текстовый лог ошибки LaTeX, если
  вместо PDF внутри лежит текст компиляции (магический байт-чек `%PDF` не совпал); успех — `200` бинарный PDF
  (`Content-Disposition: inline`). Умеет распаковывать ZIP, если хранившийся blob оказался ZIP-архивом с PDF
  внутри.

### `GET /api/billing/receipt/[id]/verify`
Файл: `src/app/api/billing/receipt/[id]/verify/route.ts`

Публичная HTML-страница "верификации" чека (стилизованная под фискальный протокол), маскирует `username`/
`telegram_id` пользователя частично (например, `@iv***`).

- **Auth**: нет.
- **Request**: query `?hash=`, `?sig=` (опциональны — используются только для отображения, не проверяются).
- **Response**: `400` (невалидный id); `404` HTML "Чек не найден"; успех — `200` HTML-страница.

### `GET /api/billing/stats`
Файл: `src/app/api/billing/stats/route.ts`

Последние 20 транзакций + все чеки текущего пользователя (для страницы биллинга).

- **Auth**: требуется. **Response**: `500 { error }`; успех — `200 { transactions, receipts, hourlyData: [] }`
  (`hourlyData` захардкожен пустым).

### `POST /api/billing/webhook`
Файл: `src/app/api/billing/webhook/route.ts`

Основной вебхук CryptoCloud. **Auth**: не сессионная — MD5-подпись
(`sign = MD5(status + order_id + amount_crypto + currency_crypto + CRYPTOCLOUD_SECRET)`), плюс идемпотентность
через `ProcessedPayment`. Принимает тело как `application/x-www-form-urlencoded` либо JSON (автоопределение по
первому символу).

- **Response**: `200 'OK'` для неуспешных/уже обработанных статусов; `500 'Server misconfiguration'` без
  `CRYPTOCLOUD_SECRET`; `403 'Missing signature'`/`'Invalid signature'`; `400 'Invalid order ID'`/`'Bad package
  data'`; `200 'Already processed'`; успех — `200 'OK'` (начисление ресурсов/подписки в транзакции, генерация
  чека с live-курсом USD→KZT/RUB через `open.er-api.com`, Telegram-уведомление).

---

## 10. Admin — `/api/admin/*`

Единая проверка во всех трёх файлах — функция `verifyAdmin()`: требует валидную сессию **и**
`user.telegram_id === '1153844209'` (единственный захардкоженный супер-админ ID). Несоответствие →
`403 { error: "Forbidden" }` (не `401`, даже если сессии вообще нет).

### `GET /api/admin/promos`
### `PUT /api/admin/promos`
Файл: `src/app/api/admin/promos/route.ts`

- **GET**: список до 100 промокодов. `200 { promos }`.
- **PUT Request**: `{ promoId (обязателен), action: 'toggle_active'|'delete', is_active? }`. **Response**:
  `400 { error: "Missing promoId" }` / `{ error: "Invalid action" }`; успех — `200 { success: true }`
  (`delete` сначала чистит `PromoUsage`, затем `PromoCode`).

### `GET /api/admin/stats`
Файл: `src/app/api/admin/stats/route.ts`

Глобальная статистика: число пользователей, суммарные токены использования, число покупок, график за 7 дней.

- **Response**: `200 { stats: { totalUsers, totalUsage, totalTransactions }, weekData: [{label, value}] }`.

### `GET /api/admin/users`
### `PUT /api/admin/users`
Файл: `src/app/api/admin/users/route.ts`

- **GET**: query `?search=` (по `telegram_id`/`username`/`first_name`, `insensitive`); до 50 записей.
  `200 { users }`.
- **PUT Request**: `{ targetUserId, action: 'grant_chars'|'grant_reports'|'grant_subscription'|'set_tier'|
  'toggle_ban', amount?, tier? }`. **Response**: `404 { error: "User not found" }`; `400 { error: "Invalid
  action" }`; `toggle_ban` → `200 { success: true, newBanStatus }`; прочие действия → `200 { success: true }`
  (гранты символов/отчётов/подписки дополнительно создают `Transaction` и фоново генерируют чек через
  `generateAndStoreReceipt`).

---

## 11. Internal / Bot — `/api/internal/bot/*`

Служебные эндпоинты для контейнера `telegram-bot`. **Все** защищены только сравнением заголовка
`x-bot-secret`/`X-Bot-Secret` с `process.env.WEBHOOK_SECRET` (см. §0.4) — при несовпадении `401` или `403`
`{ error: "Unauthorized" }` (код варьируется по файлу — см. ниже).

### `POST /api/internal/bot/billing`
Файл: `src/app/api/internal/bot/billing/route.ts`

Мульти-action эндпоинт для биллинга из бота: `status`, `packages`, `checkout`, `transactions`, `promo`,
`receipt`.

- **Auth**: `x-bot-secret` → `403` при несовпадении.
- **Request**: `{ action, telegram_id (обязателен кроме action="packages"), ...специфичные поля }`.
- **Response** (по `action`):
  - `status`/без action: `404 { error: "User not found" }` или `200 { billing: {...} }`.
  - `packages`: `200 { packages: [...] }` (опционально фильтр `category: 'chars'|'reports'|'combo'|'all'`).
  - `checkout`: `404`/`400 { error: "Invalid package" }`; успех — `200 { success: true, pay_url, order_id?,
    pack, fallback? }`.
  - `transactions`: `200 { transactions, receipts }` (`limit` по умолчанию 10).
  - `promo`: `400 { error: "Missing code" }`; `404 { error: "Промокод не найден." }`; `410 { error: "Промокод
    деактивирован." }` / `"Лимит активаций исчерпан." }`; `403 { error: "Вы уже использовали этот промокод." }`
    (уникальный `PromoUsage`); успех — `200 { success, type, amount, receipt_url, message }`.
  - `receipt`: `404 { error: "Transaction not found" }`; успех — `200 { receipt: {...} }`.
  - Неизвестный `action`: `400 { error: "Unknown action" }`. Прочие ошибки — `500 { error }`.

### `POST /api/internal/bot/compile`
Файл: `src/app/api/internal/bot/compile/route.ts`

Компилирует R/Python-код от имени пользователя бота, списывая символы по длине кода **до** компиляции.

- **Request**: `{ code (обязателен), type?: 'python'|'r' = 'python', telegramId (обязателен), files?: any[] }`.
- **Response**: `403` (секрет); `400 { error: "Code and Telegram ID are required" }`; `404 { error: "User not
  found" }`; `402 { error: "Insufficient balance. Need <N> symbols, but you have <M>." }`; `500 { error:
  "Compiler error: ..." }`; успех — `200 <результат компилятора>`.

### `POST /api/internal/bot/extract-text`
Файл: `src/app/api/internal/bot/extract-text/route.ts`

Универсальный экстрактор текста/изображений: PDF → внутренний `pdf-extractor` сервис (`PDF_EXTRACTOR_URL`);
Office-форматы (`xlsx/xls/docx/doc/pptx/ppt`) сначала конвертируются в PDF через внешний Stirling API
(`PDF_API_BASE` + захардкоженный `PDF_API_KEY`, см. §0.6, п.2); текстовые форматы (`txt/csv/tsv/json/md/xml`)
парсятся локально (для CSV — выдержка схемы: заголовок + первые 10 строк, лимит чтения 5 МБ).

- **Request**: тело — сырые байты файла (не multipart!), заголовки `x-file-name` (имя файла), `x-bot-secret`.
- **Response**: `403` (секрет); `200 { text: "", error: "Unsupported file type" }` для неизвестных расширений
  (обратите внимание — `200`, не `4xx`); успех — `200 { text, images, fileName, chars, pages }`;
  `500 { error, text: "", images: [] }` при внутренней ошибке.

### `POST /api/internal/bot/history/files`
Файл: `src/app/api/internal/bot/history/files/route.ts`

Отдаёт содержимое сессии агента в разных форматах для скачивания из бота: `zip` (исходники + изображения),
`pdf` (LaTeX → компилятор, либо markdown → PDF фоллбэк через Stirling), `images` (список графиков), `code`
(исходный код визуализации/LaTeX).

- **Request**: `{ sessionId (обязателен), type: 'zip'|'pdf'|'images'|'code' }`.
- **Response**: `403` (секрет); `404 { error: "Session not found" }`; `type='zip'` → `200` бинарный ZIP;
  `type='pdf'` → `200` бинарный PDF или `404 { error: "Нет содержимого для генерации PDF." }` / `500 { error:
  "Не удалось скомпилировать PDF. Используйте ZIP." }`; `type='images'` → `200 { visuals: [...] }`;
  `type='code'` → `200` текстовый файл или ZIP из нескольких, либо `404 { error: "Код для этой сессии
  отсутствует." }`; `400 { error: "Invalid type" }` для прочих значений.

### `POST /api/internal/bot/history`
### `DELETE /api/internal/bot/history`
Файл: `src/app/api/internal/bot/history/route.ts`

- **POST**: три режима по составу тела — просмотр одной сессии (`{sessionId}`), обновление `visuals_json`
  сессии (`{sessionId, updateVisuals}`), пагинированный список сессий пользователя (`{telegram_id, page?=1,
  limit?=5}`). **Response**: `400 { error: "Missing telegram_id" }`; `404 { error: "User not found" }`; успех —
  `200 { session }` / `200 { success: true }` / `200 { sessions, total, totalPages, currentPage }`.
- **DELETE**: query `?sessionId=`. `400 { error: "Missing sessionId" }`; успех — `200 { success: true }`
  (⚠️ удаление `AgentSession` по `id` без проверки, что она принадлежит переданному `telegram_id` — но
  эндпоинт защищён только общим `WEBHOOK_SECRET`, доверенный вызывающий — сам бот).

### `POST /api/internal/bot/referral/apply`
Файл: `src/app/api/internal/bot/referral/apply/route.ts`

Начисляет 100 000 символов рефереру за нового приглашённого пользователя (только если приглашённый ещё не
существовал в БД).

- **Auth**: заголовок `X-Bot-Secret` → `401` (не `403`, в отличие от большинства других bot-роутов) при
  несовпадении.
- **Request**: `{ invitee: {id, username?, first_name?}, referrerId }`. **Response**: `404 { error: "Referrer
  not found" }`; `200 { success: true, awarded: true }` (новый юзер, бонус начислен) или
  `200 { success: true, awarded: false, message: "User already registered" }`.

### `POST /api/internal/bot/referral`
Файл: `src/app/api/internal/bot/referral/route.ts`

Возвращает реферальную статистику и ссылку.

- **Auth**: `X-Bot-Secret` → `401`.
- **Request**: `{ telegram_id }`. **Response**: `404 { error: "User not found" }`; успех —
  `200 { success: true, stats, referralLink: "https://t.me/perrichenobot?start=ref_<telegram_id>" }`.

### `GET /api/internal/bot/session`
### `POST /api/internal/bot/session`
Файл: `src/app/api/internal/bot/session/route.ts`

Хранилище "сессии диалога" бота (мастер текущего шага сценария) + управление активными веб-сессиями
пользователя.

- **Auth**: `x-bot-secret` → `403`.
- **GET Request**: query `?telegramId=` (список веб-сессий пользователя через `getSessionsByUserId`) либо
  `?userId=` (одна bot-сессия через `getBotSession`). `400 { error: "Missing userId" }`, если ни один параметр
  не подошёл под первую ветку и `userId` не передан.
- **POST Request**: `{ action: 'terminate_others', telegramId }` — убивает все веб-сессии пользователя кроме
  текущей; либо `{ userId, session }` — апдейт bot-сессии. **Response**: `400 { error: "Missing data" }`;
  успех — `200 { success: true }`.

### `POST /api/internal/bot/tasks`
Файл: `src/app/api/internal/bot/tasks/route.ts`

Просмотр/сброс активных задач генерации (`AgentSession` со статусом `generating|processing|extracting`)
пользователя бота.

- **Auth**: `X-Bot-Secret` → `401`.
- **Request**: `{ telegram_id, action?: 'reset', sessionId? }`. **Response**: `404 { error: "User not found" }`;
  `action='reset'` → `200 { success: true, message: "Task reset complete." }` (помечает сессию `failed`); иначе
  → `200 { success: true, tasks: [{...,timeAgo (минут)}] }`.

### `POST /api/internal/bot/user-info`
Файл: `src/app/api/internal/bot/user-info/route.ts`

- **Auth**: `x-bot-secret` → `403`.
- **Request**: `{ telegram_id (обязателен) }`. **Response**: `400 { error: "Missing telegram_id" }`;
  `404 { error: "User not found" }`; успех — `200 { user }` (полная запись `User`, без фильтрации полей).

### `POST /api/internal/bot/verify`
Файл: `src/app/api/internal/bot/verify/route.ts`

Вызывается ботом, когда пользователь ввёл `/start <token>` — подтверждает `AuthRequest`, привязывая Telegram-
данные пользователя; автопромоутит в админы, если `user.id` входит в захардкоженный список
`SUPER_ADMINS = ['1153844209', '5934503762']`.

- **Auth**: `x-bot-secret` → `403`.
- **Request**: `{ token (обязателен), user: {id (обязателен), username?, first_name?, ...} }`.
- **Response**: `400 { error: "Missing token or user data" }`; `404 { error: "Token not found or expired" }`;
  `409 { error: "Token already used" }`; успех — `200 { success: true }`; `500 { error }`.

### `POST /api/internal/bot/visual/compile`
Файл: `src/app/api/internal/bot/visual/compile/route.ts`

Простой прокси компиляции R/Python-кода без биллинга/сессий (в отличие от `internal/bot/compile`).

- **Auth**: `x-bot-secret` → `403`.
- **Request**: `{ code (обязателен), language?: 'python'|<other, трактуется как R> = 'python' }`.
- **Response**: `400 { error: "No code provided" }`; `502 { error: "Compiler Error: ..." }`; успех —
  `200 <результат компилятора>`.

### `POST /api/internal/bot/visual/generate`
Файл: `src/app/api/internal/bot/visual/generate/route.ts`

Самый сложный bot-эндпоинт: принимает извлечённый текст/изображения документа из бота, генерирует и
компилирует визуализацию (с автоисправлением ошибки — 1 повтор), пишет прогресс через колбэки на сам бот
(`BOT_INTERNAL_URL = "http://telegram-bot:3001/bot-internal"`, эндпоинты `/update-visual`,
`/complete-visual`, тоже защищённые тем же `X-Bot-Secret`). Есть кэш по заголовку сессии с тем же `title`.

- **Auth**: `x-bot-secret` → `403`. `500 { error: "OpenAI API Key not configured" }`.
- **Request**: `{ context: { text_data? }, language?: 'python'|'r', telegramId, title?, chartType?='auto',
  chatId?, messageId?, images?: string[], instruction?, attachedFiles?: any[] }`.
- **Response**: `400 { error: "No context provided" }`; `422 { error: "⚠️ В документе недостаточно данных для
  анализа..." }` (текст < 400 символов и нет изображений — защита от галлюцинаций); `403 { error: "Ваш аккаунт
  заморожен администрацией." }` (`user.is_banned`); `402 { error: "Insufficient balance..." }`; успех —
  `200 { success: true, sessionId, cached?: true }` — фактическая генерация асинхронна, статус/результат
  доступны через `internal/bot/history` (`sessionId`) или push-колбэки в бот.

---

## 12. Tasks (напоминания) — `/api/tasks/*`

⚠️ Оба файла используют **собственную**, не связанную с `src/lib/session.ts` проверку авторизации (см. критичную
находку в §0.6, п.1) — тот же cookie `perricheno_session`, но верифицируемый захардкоженным JWT-секретом
`"super-secret-key-change-this-in-env-938210"` вместо `process.env.SESSION_SECRET`.

### `POST /api/tasks/parse`
Файл: `src/app/api/tasks/parse/route.ts`

Парсит естественно-языковой текст ("напомни мне в 18:00 позвонить маме") в задачу с точной датой через
OpenAI (`gpt-4.1-nano-2025-04-14`), сразу сохраняет как `Task`.

- **Auth**: своя `verifyAuth()` (см. выше) → `401 { error: 'Unauthorized' }`.
- **Request**: `{ text (обязателен), timezoneOffset, currentTime }`.
- **Response**: `500 { error: 'OpenAI API key is missing' }`; `400 { error: 'Text input is required' }`;
  `500 { error: 'Failed to parse task from OpenAI' }` / `{ error: 'Failed to parse model response' }` /
  `{ error: 'Model returned incomplete data' }`; успех — `200 { success: true, task }`.

### `GET /api/tasks`
### `POST /api/tasks`
### `PUT /api/tasks`
### `DELETE /api/tasks`
Файл: `src/app/api/tasks/route.ts`

Обычный CRUD над задачами напоминаний.

- **Auth**: та же `verifyAuth()` (дублирует код из `tasks/parse`).
- **GET**: `200 <Task[]>` (массив напрямую, без обёртки в объект).
- **POST Request**: `{ text (обязателен), remindAt (обязателен) }`. **Response**: `400 { error: 'Text and
  remindAt are required' }`; `500 { error: 'Failed to create task' }`; успех — `200 <Task>`.
- **PUT Request**: `{ taskId (обязателен), status?, text?, remindAt? }` — если передан `text`/`remindAt`, идёт
  прямой `prisma.task.update` (без проверки владения задачей текущим пользователем ⚠️); иначе —
  `updateTaskStatus(taskId, status)`. **Response**: `400 { error: 'taskId is required' }`; `500 { error: 'Failed
  to update task' }`; успех — `200 { success: true }`.
- **DELETE Request**: query `?id=` (обязателен). **Response**: `400 { error: 'id parameter is required' }`;
  `500 { error: 'Failed to delete task' }`; успех — `200 { success: true }` (⚠️ `deleteTask(Number(taskId))`
  тоже без явной проверки, что задача принадлежит текущему пользователю).

---

## 13. Telegram (прямые действия с ботом) — `/api/telegram/*`

### `POST /api/telegram/send`
Файл: `src/app/api/telegram/send/route.ts`

Отправляет документ пользователю в Telegram через Bot API (`sendDocument`), используется как внутренний шаг
после конвертации файлов (`pdf-proxy`).

- **Auth**: требуется (`verifySession()`, `401 { error: "Unauthorized" }`).
- **Request**: `multipart/form-data { document (файл), chat_id }`.
- **Response**: `500 { error: "Server configuration error" }` (нет `TELEGRAM_BOT_TOKEN`); `400 { error: "Missing
  file or chat_id" }`; `<telegramStatus> { error: "Telegram send failed", details }`; успех —
  `200 { success: true }`.

---

## 14. Прочее: health / pdf-proxy / webhook-proxy / webhook-telegram

### `GET /api/health`
Файл: `src/app/api/health/route.ts`

Публичный health-check с проверкой соединения с БД (`SELECT 1`).

- **Auth**: нет.
- **Response**: `200 { status: 'UP', timestamp, database: 'CONNECTED' }` или `503 { status: 'DOWN', timestamp,
  database: 'DISCONNECTED', error }`.

### `POST /api/pdf-proxy`
Файл: `src/app/api/pdf-proxy/route.ts`

Единая точка входа для ~90 операций Stirling PDF (конвертации, merge/split, безопасность, OCR, метаданные и
т.д. — полный список эндпоинтов зашит в объект `ENDPOINTS`). Ключ Stirling API захардкожен в файле (см. §0.6,
п.2). После успешной конвертации, если у вызывающего есть валидная сессия и известен его `telegram_id`,
результат дополнительно фоново отправляется в Telegram через `/api/telegram/send`.

- **Auth**: **нет** для самой конвертации — любой может вызвать эндпоинт без сессии, авторизация проверяется
  только опционально внутри, чтобы решить, слать ли файл в Telegram.
- **Request**: query `?type=<ключ из ENDPOINTS>` (по умолчанию `file-to-pdf`), `multipart/form-data` с
  `fileInput` или `urlInput` (плюс служебное поле `originalName`, удаляется перед проксированием) и прочими
  полями, специфичными для конкретной Stirling-операции.
- **Response**: `400 { error: "Invalid conversion type" }`; `400 { error: "No input provided" }`;
  `<upstreamStatus> { error: "API Error: <status>", details }`; успех — `200` бинарный файл с оригинальными
  `Content-Type`/`Content-Disposition` от Stirling; `500 { error: String(e) }`.

### `POST /api/webhook-proxy`
Файл: `src/app/api/webhook-proxy/route.ts`

Серверный прокси для вызова внешних webhook'ов (n8n) в обход CORS, с базовой SSRF-защитой (только `https:`,
опциональный allowlist хостов через `ALLOWED_WEBHOOK_HOSTS`).

- **Auth**: требуется (`verifySession()`, `401 { error: "Unauthorized" }`).
- **Request**: `multipart/form-data` с полем `webhookUrl` (обязателен, будет удалён из формы перед
  проксированием) + произвольные прочие поля, пересылаемые как есть.
- **Response**: `400 { error: "Missing webhookUrl" }` / `{ error: "Invalid webhookUrl" }`; `400 { error: "Only
  HTTPS webhooks allowed" }`; `403 { error: "Webhook host not allowed" }` (если задан allowlist); `504 { error:
  "Webhook timed out (120s)" }`; `502 { error: <message> }`; успех — `200` (JSON или text, проксируется от
  n8n как есть).

### `POST /api/webhook/telegram`
Файл: `src/app/api/webhook/telegram/route.ts`

Публичная точка приёма вебхуков Telegram Bot API — проксирует апдейты во внутренний контейнер бота
(`BOT_CONTAINER_URL`, по умолчанию `http://telegram-bot:3001`).

- **Auth**: Telegram-специфичный секретный токен вебхука — заголовок `x-telegram-bot-api-secret-token`
  сравнивается с `process.env.WEBHOOK_SECRET` (тот же env-секрет, что и `x-bot-secret` в internal/bot-роутах,
  но другой канал/заголовок — настраивается при регистрации вебхука через Telegram Bot API
  `setWebhook(secret_token=...)`).
- **Request**: сырое тело от Telegram (JSON Update-объект) — пробрасывается как текст без парсинга.
- **Response**: `403 { error: "Forbidden" }` при несовпадении секрета; иначе — статус ответа от контейнера бота
  пробрасывается 1:1 (тело не передаётся обратно, только код); `502 { error: "Proxy failed" }` при сетевой
  ошибке до бота.

---

## 15. Сводная таблица всех эндпоинтов

| Путь | Метод | Auth | Назначение |
|---|---|---|---|
| `/api/admin/promos` | GET | Session + admin (`telegram_id=1153844209`) | Список промокодов |
| `/api/admin/promos` | PUT | Session + admin | Toggle/удалить промокод |
| `/api/admin/stats` | GET | Session + admin | Глобальная статистика (юзеры/использование/график 7д) |
| `/api/admin/users` | GET | Session + admin | Поиск/список пользователей |
| `/api/admin/users` | PUT | Session + admin | Гранты символов/отчётов/подписки, бан, тир |
| `/api/agent/analytics/generate` | POST | Session | Фоновый пайплайн аналитики данных (графики) |
| `/api/agent/attach` | POST | Session | Универсальная загрузка вложения (PDF/img/data) |
| `/api/agent/attach` | DELETE | Session | Удалить вложение |
| `/api/agent/chat` | POST | Session | SSE-чат с GPT (с attach-контекстом) |
| `/api/agent/chat/sessions` | POST | Session | Создать чат-сессию |
| `/api/agent/chat/sessions` | GET | Session | Список чат-сессий |
| `/api/agent/compile-pdf` | POST | Session | Прокси ZIP → внешний LaTeX-компилятор → PDF |
| `/api/agent/data-analytics` | POST | Session | suggest/generate графиков (SSE) |
| `/api/agent/generate` | POST | Session | Оркестратор 5-стадийной генерации документа + legacy edit/fix |
| `/api/agent/ingest-pdf` | POST | Session | Загрузка и парсинг PDF |
| `/api/agent/ingest-pdf` | DELETE | Session | Удалить upload |
| `/api/agent/python-compile` | POST | Session | Прокси Python-кода в компилятор |
| `/api/agent/r-compile` | POST | Session | Прокси R-кода в компилятор |
| `/api/agent/scholar/search` | POST | Session (без проверки владения сессией) | Поиск статей arXiv/OpenAlex/CrossRef |
| `/api/agent/scholar/sessions/[id]` | DELETE | Session | Удалить сессию лит. поиска |
| `/api/agent/scholar/sessions` | POST | Session | Создать сессию лит. поиска (спишет 2500 симв.) |
| `/api/agent/sessions/[id]` | GET | Session (owner) | Получить сессию агента |
| `/api/agent/sessions/[id]` | PUT | Session (owner) | Частично обновить сессию |
| `/api/agent/sessions/[id]` | DELETE | Session (owner) | Удалить сессию |
| `/api/agent/sessions/[id]/share` | POST | Session | Вкл/выкл публичную ссылку на сессию |
| `/api/agent/sessions` | GET | Session | Список всех сессий пользователя |
| `/api/agent/sessions` | POST | Session | Создать произвольную сессию |
| `/api/agent/templates/upload` | POST | Session | Извлечь LaTeX-преамбулу из ZIP-шаблона |
| `/api/agent/uploads` | GET | Session | Метаданные вложений по id |
| `/api/agent/visualize/edit` | POST | Session (без списания квоты) | AI-правка кода визуализации |
| `/api/agent/visualize/generate-code` | POST | Session (без списания квоты) | Стрим сырого кода визуализации |
| `/api/agent/visualize/recommend` | POST | Session (без списания квоты) | AI подбирает 3 типа графика |
| `/api/agent/visualize` | POST | Session | compile/generate одного графика (синхронно) |
| `/api/auth/delete` | DELETE | Session | Удалить аккаунт |
| `/api/auth/link` | POST | Нет | Сгенерировать deep-link токен для Telegram-логина |
| `/api/auth/login` | POST | Подпись Telegram Login Widget | Логин через Telegram, создать сессию |
| `/api/auth/logout` | POST | Нет (no-op без сессии) | Выйти |
| `/api/auth/me` | GET | Session | Профиль + лимиты плана |
| `/api/auth/poll` | GET | Нет (по одноразовому token) | Опрос статуса Telegram-логина |
| `/api/billing/checkout` | POST | Session | Создать ссылку оплаты (CryptoCloud) |
| ~~`/api/billing/kaspi-webhook`~~ | — | — | Удалён 2026-09-03, теперь 404 (Kaspi Pay заброшена) |
| `/api/billing/receipt/[id]` | GET | Нет | Скачать PDF-чек |
| `/api/billing/receipt/[id]/verify` | GET | Нет | HTML-страница верификации чека |
| `/api/billing/stats` | GET | Session | Транзакции и чеки пользователя |
| `/api/billing/webhook` | POST | MD5-подпись CryptoCloud | Вебхук подтверждения оплаты CryptoCloud |
| `/api/canvas/generate` | POST | Session (без списания квоты) | Генерация mind-map в формате JSON Canvas |
| `/api/chat/history` | GET | Session | Список чат-сессий / сообщения сессии |
| `/api/chat/history` | POST | Session | Создать сессию / сохранить сообщение |
| `/api/chat/history` | DELETE | Session | Удалить чат-сессию |
| `/api/citations/[id]` | GET | Session | Получить цитату |
| `/api/citations/[id]` | PATCH | Session | Частично обновить цитату |
| `/api/citations/[id]` | DELETE | Session | Удалить цитату |
| `/api/citations/collections` | GET | Session | Список коллекций |
| `/api/citations/collections` | POST | Session | Создать коллекцию |
| `/api/citations/collections/[id]` | DELETE | Session | Удалить коллекцию |
| `/api/citations/collections/[id]` | POST | Session | Добавить/убрать цитату из коллекции |
| `/api/citations` | GET | Session | Список/поиск цитат пользователя |
| `/api/citations` | POST | Session | Создать цитату |
| `/api/citations/search` | GET | Session | Поиск в CrossRef/arXiv/DOI |
| `/api/health` | GET | Нет | Health-check БД |
| `/api/internal/bot/billing` | POST | `x-bot-secret` | Биллинг-операции для бота (status/packages/checkout/promo/...) |
| `/api/internal/bot/compile` | POST | `x-bot-secret` | Компиляция кода от имени юзера бота + списание квоты |
| `/api/internal/bot/extract-text` | POST | `x-bot-secret` | Извлечение текста/изображений из файла |
| `/api/internal/bot/history/files` | POST | `x-bot-secret` | Скачивание ZIP/PDF/images/code сессии из бота |
| `/api/internal/bot/history` | POST | `x-bot-secret` | Просмотр/список сессий, апдейт visuals_json |
| `/api/internal/bot/history` | DELETE | `x-bot-secret` | Удалить сессию |
| `/api/internal/bot/referral/apply` | POST | `X-Bot-Secret` | Начислить реферальный бонус |
| `/api/internal/bot/referral` | POST | `X-Bot-Secret` | Реферальная статистика/ссылка |
| `/api/internal/bot/session` | GET | `x-bot-secret` | Список веб-сессий / bot-сессия пользователя |
| `/api/internal/bot/session` | POST | `x-bot-secret` | Апдейт bot-сессии / терминировать другие веб-сессии |
| `/api/internal/bot/tasks` | POST | `X-Bot-Secret` | Активные задачи генерации / сброс задачи |
| `/api/internal/bot/user-info` | POST | `x-bot-secret` | Получить полную запись User по telegram_id |
| `/api/internal/bot/verify` | POST | `x-bot-secret` | Подтвердить `/start <token>`, создать/промоутнуть юзера |
| `/api/internal/bot/visual/compile` | POST | `x-bot-secret` | Прямая компиляция кода без биллинга |
| `/api/internal/bot/visual/generate` | POST | `x-bot-secret` | Генерация+компиляция визуализации из бота |
| `/api/pdf-proxy` | POST | Нет (опционально сессия для Telegram-доставки) | Прокси ~90 Stirling PDF операций |
| `/api/r/generate` | POST | Session | suggest/multi/single генерация R-графиков |
| `/api/r/sessions/[id]` | GET | Session (owner) | Получить R-сессию с результатами |
| `/api/r/sessions/[id]` | DELETE | Session (owner) | Удалить R-сессию |
| `/api/r/sessions` | GET | Session | Список R-сессий пользователя |
| `/api/r/upload` | POST | Session | Извлечение текста/картинок из файла (прокси bot/extract-text) |
| `/api/space` | GET | Session | Список пространств пользователя |
| `/api/space` | POST | Session | Создать пространство |
| `/api/space/[id]` | GET | Session + роль | Получить пространство |
| `/api/space/[id]` | PATCH | Session + owner | Обновить настройки пространства |
| `/api/space/[id]` | DELETE | Session | Удалить пространство |
| `/api/space/invite/[token]` | GET | Нет | Превью инвайта |
| `/api/space/invite/[token]` | POST | Session | Принять инвайт |
| `/api/space/[id]/invite` | POST | Session + owner | Создать инвайт-ссылку |
| `/api/space/[id]/share` | POST | Session (роль не проверена в роуте) | Вкл/выкл публичный доступ к проекту |
| `/api/space/[id]/collaborators` | GET | Session + роль | Список участников |
| `/api/space/[id]/collaborators/[uid]` | DELETE | Session + роль | Удалить участника / выйти самому |
| `/api/space/[id]/compile` | POST | Session + роль | Собрать проект в ZIP и скомпилировать LaTeX |
| `/api/space/[id]/duplicate` | POST | Session | Дублировать пространство |
| `/api/space/[id]/export` | GET | Session + роль | Экспорт всех файлов как ZIP |
| `/api/space/[id]/ai-edit` | POST | Session + роль (без списания квоты) | AI-правка выделенного LaTeX |
| `/api/space/[id]/ai-fix` | POST | Session + роль (без списания квоты) | AI-диагностика ошибки компиляции |
| `/api/space/[id]/ws-token` | GET | Session + роль | JWT для WebSocket совместного редактирования |
| `/api/space/[id]/files` | GET | Session + роль | Список файлов проекта (без содержимого) |
| `/api/space/[id]/files` | POST | Session + роль (не viewer) | Создать текстовый файл |
| `/api/space/[id]/files/[...path]` | GET | Session + роль | Содержимое файла |
| `/api/space/[id]/files/[...path]` | PUT | Session + роль (не viewer) | Создать/обновить содержимое файла |
| `/api/space/[id]/files/[...path]` | DELETE | Session + роль (не viewer) | Удалить файл |
| `/api/space/[id]/files/import-zip` | POST | Session + роль (не viewer) | Импорт файлов из ZIP |
| `/api/space/[id]/files/rename` | POST | Session + роль (не viewer) | Переименовать файл |
| `/api/space/[id]/files/upload` | POST | Session + роль (не viewer) | Загрузить бинарный файл |
| `/api/space/[id]/versions` | GET | Session + роль | Список версий |
| `/api/space/[id]/versions` | POST | Session + роль (не viewer) | Создать снапшот версии |
| `/api/space/[id]/versions/[vid]` | GET | Session + роль | Получить версию |
| `/api/space/[id]/versions/[vid]/restore` | POST | Session + роль (не viewer) | Восстановить версию |
| `/api/tasks/parse` | POST | Кастомный JWT (хардкод-секрет, см. §0.6.1) | Распарсить NL-текст в задачу-напоминание |
| `/api/tasks` | GET | Кастомный JWT (хардкод-секрет) | Список задач пользователя |
| `/api/tasks` | POST | Кастомный JWT (хардкод-секрет) | Создать задачу |
| `/api/tasks` | PUT | Кастомный JWT (хардкод-секрет) | Обновить задачу (без проверки владения) |
| `/api/tasks` | DELETE | Кастомный JWT (хардкод-секрет) | Удалить задачу (без проверки владения) |
| `/api/telegram/send` | POST | Session | Отправить документ пользователю в Telegram |
| `/api/tikz/generate` | POST | Session | Генерация+компиляция TikZ-диаграммы (retry x3) |
| `/api/webhook-proxy` | POST | Session | Серверный прокси произвольного https-вебхука (n8n) с SSRF-фильтром |
| `/api/webhook/telegram` | POST | `x-telegram-bot-api-secret-token` | Публичный приём вебхуков Telegram → прокси в bot-контейнер |

**Итого**: 90 файлов `route.ts`, 119 экспортированных HTTP-методов (эндпоинтов).
