# Реестр кодов и типов ошибок — Perricheno

> Сопоставлять с разделами `docs/api_reference.md` (нумерация разделов ниже совпадает с ним).

## 0. Общие сведения

**Формального реестра кодов ошибок в проекте нет.** Нет ни enum'а, ни файла констант, ни общей обёртки для ошибок API. Каждый `route.ts` в `src/app/api/**` формирует ответ об ошибке индивидуально, обычно так:

```ts
return NextResponse.json({ error: "какая-то строка" }, { status: N });
```

Поиск по репозиторию (`enum.*Error`, `ErrorCode`, `error_code`, `ERROR_CODES`) не находит ни одного общего типа/константы ошибок в `src/`. Единственная переиспользуемая структура — это **условность** (не enum, а просто повторяющаяся строка), которую разработчики соблюдают вручную в нескольких эндпоинтах квот: `{ error: "LIMIT_REACHED", details: "..." }` со статусом `402`. Также несколько эндпоинтов используют собственные строковые "псевдокоды" в поле `error` вместо человекочитаемого текста: `"LIMIT_REACHED"`, `"TOTAL_CHAR_CAP"`, `"EMPTY_PDF"` — фронтенд, судя по всему, матчит именно эти строки, а не HTTP-статус.

Ниже — **сводная таблица по факту встречающихся в коде ошибок**, собранная построчным просмотром всех 90 файлов `src/app/api/**/route.ts` и четырёх Go-микросервисов. Формат: `HTTP-статус | сообщение/поле error (как в коде) | файл:строка | что означает`.

### 0.1 Сквозные паттерны (встречаются в десятках файлов, не дублируются построчно ниже без надобности)

| Статус | Сообщение | Где | Что означает |
|---|---|---|---|
| 401 | `"Auth required"` / `"Authentication required."` / `"Unauthorized"` | начало почти каждого хендлера, после `verifySession()` из `src/lib/session.ts` | Нет валидной cookie-сессии `perricheno_session` (JWT подписан `SESSION_SECRET`) или сессии нет в БД. Три разные строки используются как синонимы одного и того же случая — единообразия нет. |
| 403 | `"Unauthorized"` | все `src/app/api/internal/bot/**/route.ts` | Заголовок `x-bot-secret` не совпадает с `process.env.WEBHOOK_SECRET` — это межсервисная защита эндпоинтов, вызываемых только из `telegram-bot`. Обратите внимание: семантически это 401 (неверные креды), но код возвращает 403 — так сделано во всех internal/bot роутах, кроме `internal/bot/tasks/route.ts`, где та же проверка возвращает 401 (см. раздел 11 и "требует уточнения"). |
| 403 | `"Forbidden"` / `"Only owner can ..."` | `src/app/api/space/**` | Сессия валидна, но роль пользователя в space (`viewer`/`editor`/`owner`) не даёт прав на операцию. |
| 404 | `"Not found"` | `src/app/api/space/**`, `src/app/api/citations/**` | Либо сущность не существует, либо (в space) роль пользователя для неё не найдена — эти два случая часто неразличимы в ответе. |
| 402 | `{ error: "LIMIT_REACHED", details: "..." }` | `agent/generate`, `agent/visualize`, `agent/data-analytics`, `agent/analytics/generate`, `agent/scholar/sessions`, `r/generate`, `tikz/generate`, `internal/bot/compile`, `internal/bot/visual/generate` | Исчерпан лимит тарифа (символы/визуалы/отчёты) — используется как псевдокод, который фронтенд/бот, вероятно, матчит по строке `"LIMIT_REACHED"`, а не по статусу. |
| 400 | `"Invalid JSON"` / `"Invalid JSON body"` | во многих POST-роутах, `catch` вокруг `req.json()` | Тело запроса не парсится как JSON. |
| 413 | `"... too large ..."` | все upload-роуты (`agent/attach`, `agent/ingest-pdf`, `agent/templates/upload`, `space/[id]/files/*`, `r/upload`) | Превышен размер файла — лимиты у каждого роута свои и захардкожены в константах файла (см. `api_reference.md`). |
| 500 | `err.message` / `String(err)` / фиксированная строка | практически все хендлеры, catch-all в конце функции | Необработанное исключение. В части файлов message пробрасывается пользователю как есть — потенциальная утечка внутренних деталей (см. раздел "требует уточнения"). |

Далее — построчная таблица по каждому файлу, сгруппированная по разделам `api_reference.md`. Успешные ответы (без `error`) не перечисляются, кроме случаев, когда статус нестандартный (201, 202, 200 с полем "ошибочного" содержимого).

---

## 1. Auth — `/api/auth/*`

| Статус | Сообщение (`error`) | Файл:строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | `src/app/api/auth/delete/route.ts:8` | Нет сессии. |
| 500 | `err.message \|\| "Failed to generate link"` | `src/app/api/auth/link/route.ts:22-25` | Ошибка при создании токена/deep-link в БД (`prisma.authRequest.create`). |
| 401 | `"Invalid signature or expired data"` | `src/app/api/auth/login/route.ts:16` | Не прошла проверка подписи Telegram Login Widget (`verifyTelegramAuth`). |
| 500 | `e.message \|\| "Internal Server Error"`, плюс `details: e.toString()`, `stack: e.stack` | `src/app/api/auth/login/route.ts:39-43` | Catch-all внутри логина. **Важно**: в ответ клиенту уходит полный `e.stack` — утечка внутренностей сервера (см. "требует уточнения"). |
| — | нет ошибок | `src/app/api/auth/logout/route.ts` | Всегда `{ success: true }`. |
| 401 | `{ user: null }` | `src/app/api/auth/me/route.ts:8` | Нет сессии. |
| 404 | `{ user: null }` | `src/app/api/auth/me/route.ts:16` | `userId` из сессии есть, но пользователь не найден в БД (запись удалена). |
| 403 | `{ user: null, error: "Account suspended" }` | `src/app/api/auth/me/route.ts:20` | `user.is_banned === true`. |
| 400 | `"Missing token"` | `src/app/api/auth/poll/route.ts:11` | Query-параметр `token` не передан при поллинге Telegram-логина. |
| 500 | `err.message \|\| "Poll failed"` | `src/app/api/auth/poll/route.ts:57-60` | Catch-all. |

---

## 2. Agent — `/api/agent/*`

### `agent/analytics/generate` — `src/app/api/agent/analytics/generate/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 97 | Нет сессии. |
| 500 | `"OpenAI API Key not configured"` | 101 | `process.env.OPENAI_API_KEY` пуст. |
| 402 | `{error:"LIMIT_REACHED", details:"Visual tokens limit reached."}` | 107-110 | Квота визуалов исчерпана. |
| 400 | `"Prompt is required"` | 118 | Пустой `prompt`. |
| 400 | `"No data files uploaded. Please upload CSV, Excel, or other data files."` | 122-124 | `uploadIds` пуст. |
| 404 | `"Uploads not found"` | 130 | Загрузки по `uploadIds` не найдены/не принадлежат юзеру. |
| 500 | `err?.message \|\| "Failed to start analytics pipeline"` | 172-174 | Catch-all при старте фонового пайплайна. |

### `agent/attach` (POST + DELETE) — `src/app/api/agent/attach/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | 50, 253 | Нет сессии (POST и DELETE). |
| 400 | `"Invalid multipart body"` | 54 | `req.formData()` бросил исключение. |
| 400 | `"Missing 'file' field"` | 58 | В форме нет поля `file`. |
| 413 | `` `PDF too large (> ${MAX_PDF_BYTES} bytes)` `` | 65 | Превышен лимит размера PDF. |
| 415 | `"File does not look like a valid PDF"` | 69 | Проверка сигнатуры файла (magic bytes) не прошла. |
| 502 | `{error:"Failed to parse PDF", details}` | 75 | Вызов `pdf-extractor` (или парсера) упал. |
| 413 | `{error:"TOTAL_CHAR_CAP", message:"Staging limit reached for your plan.", fileChars, alreadyUsed, stagingCap, remaining, planTier}` | 84-92 | Суммарный лимит символов "в стейджинге" (ещё не отправленных в агент) для тарифа исчерпан. |
| 422 | `{error:"EMPTY_PDF", message:"Could not extract any text or images from this PDF."}` | 96 | Из PDF не извлекли ни текста, ни изображений. |
| 413 | `` `Image too large (> ${MAX_IMAGE_BYTES} bytes)` `` | 122 | Лимит размера изображения. |
| 413 | `` `Data file too large (> ${MAX_DATA_BYTES} bytes)` `` | 150 | Лимит размера файла данных (CSV/Excel/JSON). |
| 500 | `{error:"Storage upload failed", details}` | 185-188 | Не удалось загрузить крупный файл в Supabase Storage. |
| 500 | `{error:"Failed to read file", details}` | 215-218 | Ошибка при чтении/конвертации XLSX→CSV или текстового файла. |
| 415 | `{error:"Unsupported file type. Accepted: PDF, PNG, JPEG, WebP, CSV, Excel, JSON, TSV, TXT."}` | 246-248 | Тип файла не подошёл ни под одну из веток (PDF/image/data). |
| 400 | `"Missing id"` | 257 | DELETE без `id`. |

### `agent/chat` — `src/app/api/agent/chat/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Auth required'` | 33 | Нет сессии. |
| 500 | `'OPENAI_API_KEY not configured'` | 35 | Ключ не задан. |
| 400 | `'sessionId required'` | 45 | Не передан `sessionId`. |
| 400 | `'message required'` | 47 | `message` не строка. |
| 413 | `'Message is too large (>100k characters).'` | 48 | Превышен лимит длины сообщения. |
| 400 | `'editIndex required for edit mode'` | 51 | Режим редактирования без индекса. |
| 402 | `'LIMIT_REACHED'` | 55 | Квота символов исчерпана (`precheck.remaining <= 0`); в отличие от других агентных роутов, здесь **нет** поля `details`. |
| 404 | `'Session not found'` | 59 | Сессия чата не найдена. |
| 400 | `'No user message to retry'` | 78 | Retry без предыдущего сообщения пользователя. |
| 400 | `'editIndex out of range'` | 86 | Индекс за пределами истории. |
| 400 | `'editIndex must point to a user message'` | 87 | Индекс указывает не на сообщение пользователя. |

### `agent/chat/sessions` — `src/app/api/agent/chat/sessions/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 9, 39 | Нет сессии (POST/GET). |
| 500 | `err.message \|\| "Failed to create session"` | 33 | Ошибка создания записи чат-сессии. |

### `agent/compile-pdf` — `src/app/api/agent/compile-pdf/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 6 | Нет сессии. |
| 500 | `"Compiler Config (URL/KEY) missing. Set LATEX_COMPILER_URL and LATEX_COMPILER_KEY secrets."` | 12 | Не заданы `LATEX_COMPILER_URL`/`LATEX_COMPILER_KEY`. |
| 400 | `"No physical ZIP file payload provided."` | 20 | Нет ZIP в запросе. |
| `compilerRes.status` (проброс) | `` `Compiler Error (${compilerRes.status}): ` + errText `` | 40 | Прокси ретранслирует реальный статус внешнего LaTeX-компилятора. |
| 500 | `` `Compiler returned text/json: ` + msg `` | 52 | Компилятор вернул не PDF, а текст/JSON — трактуется как ошибка. |
| 500 | `err.message \|\| "Failed proxy to compilation server"` | 66 | Catch-all прокси. |

### `agent/data-analytics` — `src/app/api/agent/data-analytics/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 348 | Нет сессии. |
| 402 | `{error:"LIMIT_REACHED", details:"Visual tokens limit reached."}` | 352 | Квота визуалов. |
| 500 | `err.message \|\| "Failed to start analytics stream."` | 365 | Catch-all запуска SSE-потока. |

### `agent/generate` — `src/app/api/agent/generate/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Authentication required.'` | 99 | Нет сессии. |
| 500 | `'OpenAI API Key is not configured.'` | 102 | `OPENAI_API_KEY` пуст. |
| 402 | `{error:'LIMIT_REACHED', details:'Characters limit reached.'}` | 107 | Квота символов. |
| 400 | `'Invalid JSON body'` | 119 | `req.json()` упал. |
| 400 | `'Prompt is required.'` | 159 | Пустой `prompt`. |
| 400 | `'Legacy path requires currentTex.'` | 203 | Устаревший режим правки без текущего `.tex`. |
| 400 | `'sessionId required for edit'` | 207 | Режим правки без `sessionId`. |

### `agent/ingest-pdf` (POST + DELETE) — `src/app/api/agent/ingest-pdf/route.ts`
Полностью повторяет PDF-ветку `agent/attach` (тот же контракт `TOTAL_CHAR_CAP`/`EMPTY_PDF`) — вероятно, дублирующий/более ранний эндпоинт.
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | 14, 108 | Нет сессии. |
| 400 | `"Invalid multipart body"` | 20 | `formData()` упал. |
| 400 | `"Missing 'file' field"` | 25 | Нет файла. |
| 415 | `"Only PDF files are accepted"` | 32 | Расширение/MIME не PDF. |
| 413 | `` `File too large (> ${MAX_FILE_BYTES} bytes)` `` | 36 | Лимит размера. |
| 415 | `"File does not look like a valid PDF"` | 44 | Сигнатура файла не PDF. |
| 502 | `{error:"Failed to parse PDF", details}` | 53 | Парсер PDF упал. |
| 413 | `{error:"TOTAL_CHAR_CAP", message:"Staging limit reached for your plan.", ...}` | 65-73 | Тот же стейджинг-лимит, что в `agent/attach`. |
| 422 | `{error:"EMPTY_PDF", message:"Could not extract any text or images from this PDF."}` | 78-81 | Пустой результат извлечения. |
| 400 | `"Missing id"` | 112 | DELETE без `id`. |

### `agent/python-compile` — `src/app/api/agent/python-compile/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 9 | Нет сессии. |
| 400 | `"Python code is required"` | 14 | Пустой код. |
| 500 | `"Python compiler error"` | 25 | `python-compiler` (Go-сервис) ответил не-OK. |
| 500 | `err.message \|\| "Compilation failed"` | 33 | Catch-all. |

### `agent/r-compile` — `src/app/api/agent/r-compile/route.ts`
Зеркально `python-compile`, но для `r-compiler`.
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 9 | Нет сессии. |
| 400 | `"R code is required"` | 14 | Пустой код. |
| 500 | `"R compiler error"` | 25 | `r-compiler` ответил не-OK. |
| 500 | `err.message \|\| "Compilation failed"` | 33 | Catch-all. |

### `agent/scholar/search` — `src/app/api/agent/scholar/search/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | 57 | Нет сессии. |
| 404 | `"Session not found"` | 60 | Scholar-сессия не найдена. |
| 400 | `"Empty query"` | 63 | Пустой запрос после нормализации. |
| 500 | `e.message` | 107 | Catch-all (в т.ч. ошибка вызова `research-api`). |

### `agent/scholar/sessions` — `src/app/api/agent/scholar/sessions/route.ts` (POST) и `[id]/route.ts` (DELETE)
| Статус | Сообщение | Файл:строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | `sessions/route.ts:11` | Нет сессии. |
| 402 | `"Insufficient characters on balance"` | `sessions/route.ts:16` | Квота символов исчерпана. |
| 500 | `e.message` | `sessions/route.ts:36` | Catch-all. |
| 401 | `'Unauthorized'` | `sessions/[id]/route.ts:9` | Нет сессии (DELETE). |
| 404 | `'Not found'` | `sessions/[id]/route.ts:17` | `result.count === 0` — сессия не найдена/не принадлежит юзеру. |
| 500 | `error.message` | `sessions/[id]/route.ts:19` | Catch-all. |

### `agent/sessions` — `src/app/api/agent/sessions/route.ts` и `[id]/route.ts`, `[id]/share/route.ts`
| Статус | Сообщение | Файл:строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | `sessions/route.ts:9,18`; `[id]/route.ts:9,43,83`; `[id]/share/route.ts:13` | Нет сессии — во всех методах. |
| 400 | `"Title is required"` | `sessions/route.ts:23` | Пустой заголовок при создании. |
| 404 | `"Session not found"` | `[id]/route.ts:15,48` | Сессия не найдена (GET/PUT). |
| 403 | `"Unauthorized"` | `[id]/route.ts:19,49` | Сессия найдена, но `session.user_id !== userId` — это скорее 403 (owner-check), а не 401, хотя текст сообщения такой же, как у 401-кейсов в других роутах. |
| 400 | `"No valid fields to update"` | `[id]/route.ts:69` | PUT без полей для обновления. |
| 500 | `e.message \|\| "Update failed"` | `[id]/route.ts:76` | Catch-all PUT. |
| 404 | `"Session not found or unauthorized"` | `[id]/route.ts:88` | DELETE: сознательно не различает "не найдено" и "чужая сессия" (не палит существование чужих сессий). |

### `agent/templates/upload` — `src/app/api/agent/templates/upload/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Authentication required."` | 20 | Нет сессии. |
| 413 | `"ZIP file too large (max 10 MB)."` | 24 | Лимит размера. |
| 400 | `"Invalid multipart body."` | 31 | `formData()` упал. |
| 400 | `"No file provided."` | 36 | Нет файла. |
| 422 | `"Could not read ZIP file. Make sure it is a valid Overleaf project export."` | 45 | ZIP повреждён/не читается. |
| 422 | `"No .tex file found in the ZIP."` | 56 | В архиве нет `.tex`. |
| 422 | `"Could not extract a valid preamble from main.tex."` | 63 | Не удалось вытащить преамбулу из главного файла. |

### `agent/uploads` — `src/app/api/agent/uploads/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 13 | Нет сессии. |
| 400 | `'ids parameter required'` | 16 | Query `ids` не передан. |
| 500 | `error.message` | 33 | Catch-all. |

### `agent/visualize` — `src/app/api/agent/visualize/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 88 | Нет сессии. |
| 402 | `{error:"LIMIT_REACHED", details:"Visual tokens limit reached."}` | 92 | Квота визуалов. |
| 500 | `{error: compileResult.log \|\| \`${runtime} Execution failed\`, code}` | 150 | Компиляция кода (R/Python) в режиме "compile" провалилась. |
| 500 | `{error: compileResult.log \|\| \`${runtime} Execution failed\`, code: generatedCode}` | 213-216 | Компиляция провалилась в режиме "generate" (после AI-генерации кода). |
| 400 | `"Invalid action. Use 'generate' or 'compile'."` | 232 | Неизвестное значение `action`. |
| 500 | `err.message \|\| "Visualization failed"` | 236 | Catch-all. |

### `agent/visualize/edit` — `src/app/api/agent/visualize/edit/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 8 | Нет сессии. |
| 500 | `err.message \|\| "Failed"` | 69 | Catch-all. |

### `agent/visualize/generate-code` — `src/app/api/agent/visualize/generate-code/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 55 | Нет сессии. |
| 500 | `"OpenAI API Key not configured"` | 58 | Ключ не задан. |
| 400 | `"topic and chartType required"` | 65 | Не переданы обязательные поля. |
| 500 | `` `AI error: ${err}` `` | 88 | Ошибка вызова OpenAI. |
| 500 | `err.message \|\| "Failed"` | 133 | Catch-all. |

### `agent/visualize/recommend` — `src/app/api/agent/visualize/recommend/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 8 | Нет сессии. |
| 500 | `err.message \|\| "Recommendation failed"` | 60 | Catch-all (строка 56 — не ошибка, а fallback-успех `["bar","scatter","wordcloud"]`). |

---

## 3. R Studio — `/api/r/*`

### `r/generate` — `src/app/api/r/generate/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Authentication required."` | 387 | Нет сессии. |
| 402 | `{error:"LIMIT_REACHED", details:"Visual limit reached."}` | 391 | Квота визуалов. |
| 500 | `"OpenAI API key not configured."` | 394 | Ключ не задан. |
| 400 | `"Invalid JSON"` | 397 | `req.json()` упал. |
| 400 | `"Prompt is required."` | 430, 459, 515 | Пустой `prompt` — проверяется отдельно в трёх режимах (`suggest`/`multi`/одиночная генерация). |
| 500 | `"Suggestion failed."` | 440 | Вызов OpenAI для подсказки типов графиков не удался. |
| 500 | `{error: aiResult.error}` | 550 | Ошибка генерации кода через OpenAI. |
| 500 | `"AI returned empty code."` | 561 | Модель вернула пустой код. |
| 500 | `{error:"R compiler error.", code}` | 577 | `r-compiler` вернул не-OK ответ. |
| 422 | `{error: result.log \|\| "R execution failed.", code}` | 584 | Скрипт скомпилировался, но выполнение R-кода завершилось с ошибкой (в компилятор пришёл валидный запрос, но сам код упал). |

### `r/sessions/[id]` — `src/app/api/r/sessions/[id]/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Authentication required.'` | 10, 39 | Нет сессии (GET/DELETE). |
| 404 | `'Not found.'` | 14, 43 | Сессия не найдена. |

### `r/sessions` — `src/app/api/r/sessions/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Authentication required.'` | 7 | Нет сессии. |

### `r/upload` — `src/app/api/r/upload/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Authentication required."` | 13 | Нет сессии. |
| 500 | `"Extract service not configured."` | 15 | `WEBHOOK_SECRET` не задан (используется как ключ для вызова внутреннего извлечения текста — название сообщения вводит в заблуждение, речь не про "Extract service", а про отсутствие секрета). |
| 400 | `"No file provided."` | 20 | Нет файла. |
| 400 | `"File too large (max 20 MB)."` | 24 | Лимит размера. |
| 500 | `"Extraction failed: " + errText.slice(0, 200)` | 44 | Внутренний вызов извлечения текста вернул ошибку. |
| 500 | `err.message \|\| "Upload failed."` | 57 | Catch-all. |

---

## 4. TikZ — `/api/tikz/*`

### `tikz/generate` — `src/app/api/tikz/generate/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Authentication required."` | 357 | Нет сессии. |
| 402 | `{error:"LIMIT_REACHED", details:"Visual limit reached."}` | 361 | Квота визуалов. |
| 400 | `"Invalid JSON"` | 365 | `req.json()` упал. |
| 400 | `"Prompt is required."` | 368 | Пустой `prompt`. |
| 422 | `{error:"TikZ compilation failed after 3 attempts.", log, tikzCode}` | 431-434 | После 3 попыток AI-генерации TikZ-код так и не скомпилировался. |

---

## 5. Canvas — `/api/canvas/*`

### `canvas/generate` — `src/app/api/canvas/generate/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | 8 | Нет сессии. |
| 500 | `"OpenAI API Key is not configured."` | 11 | Ключ не задан. |
| 400 | `"Prompt is required."` | 18 | Пустой `prompt`. |
| 500 | `"Failed to generate canvas. External API error."` | 81 | OpenAI вернул не-OK. |
| 500 | `"AI generated invalid JSON Canvas format."` | 100 | Ответ модели не парсится как JSON Canvas. |
| 500 | `{error:"An unexpected parsing error occurred.", details: err.message}` | 107 | Catch-all. |

---

## 6. Chat (общий текстовый чат-виджет) — `/api/chat/*`

### `chat/history` — `src/app/api/chat/history/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 7, 45, 97 | Нет сессии (GET/POST/DELETE). |
| 500 | `String(err)` | 39, 91, 108 | Catch-all во всех трёх методах. |
| 400 | `"Invalid action"` | 88 | Неизвестное значение `action` в POST. |
| 400 | `"Missing sessionId"` | 100 | DELETE без `sessionId`. |

---

## 7. Citations (менеджер библиографии) — `/api/citations/*`

### `citations` — `src/app/api/citations/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 9, 23 | Нет сессии (GET/POST). |
| 400 | `'Invalid JSON'` | 27 | `req.json()` упал. |
| 400 | `'title, bibtex, cite_key are required'` | 30 | Не хватает обязательных полей. |
| 500 | `e.message \|\| 'Failed to save citation'` | 54 | Catch-all. |

### `citations/search` — `src/app/api/citations/search/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 199 | Нет сессии. |
| 400 | `'Query parameter "q" is required'` | 206 | Нет query-параметра `q`. |
| 500 | `e.message` | 242 | Catch-all. |

### `citations/[id]` — `src/app/api/citations/[id]/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11, 21, 38 | Нет сессии (GET/PATCH/DELETE). |
| 404 | `'Not found'` | 15, 32, 42 | Цитата не найдена/не принадлежит юзеру. |

### `citations/collections` — `src/app/api/citations/collections/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 9, 16 | Нет сессии (GET/POST). |
| 400 | `'name is required'` | 19 | Пустое имя коллекции. |

### `citations/collections/[id]` — `src/app/api/citations/collections/[id]/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11, 23 | Нет сессии (DELETE/POST). |
| 404 | `'Not found'` | 14 | Коллекция не найдена. |
| 400 | `'citationId required'` | 26 | Нет `citationId` при добавлении в коллекцию. |
| 400 | `e.message ?? 'Failed'` | 32 | Ошибка добавления (например, дубликат) — единственное место, где сообщение из исключения возвращается как 400, а не 500. |

---

## 8. Space (LaTeX-редактор проектов) — `/api/space/*`

### `space` — `src/app/api/space/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 10, 18 | Нет сессии (GET/POST). |
| 400 | `'Invalid JSON'` | 21 | `req.json()` упал. |

### `space/[id]` — `src/app/api/space/[id]/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11, 20, 43 | Нет сессии (GET/PATCH/DELETE). |
| 404 | `'Not found'` | 14, 24 | Space не найден / роль не определена. |
| 403 | `'Only owner can edit settings'` | 25 | Роль не `owner`. |
| 400 | `'Invalid JSON'` | 28 | `req.json()` упал. |

### `space/invite/[token]` — `src/app/api/space/invite/[token]/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 404 | `'Invite not found or expired'` | 13, 24 | Токен приглашения не найден или истёк (GET/POST). |
| 401 | `'Unauthorized'` | 20 | Нет сессии при принятии приглашения. |

### `space/[id]/invite` — `src/app/api/space/[id]/invite/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 12 | Нет сессии. |
| 403 | `'Only owner can invite'` | 16 | Роль не `owner`. |
| 400 | `'Invalid JSON'` | 19 | `req.json()` упал. |

### `space/[id]/share` — `src/app/api/space/[id]/share/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11 | Нет сессии. |

### `space/[id]/collaborators` — `src/app/api/space/[id]/collaborators/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11 | Нет сессии. |
| 404 | `'Not found'` | 15 | Роль не определена (нет доступа к space). |

### `space/[id]/collaborators/[uid]` — `src/app/api/space/[id]/collaborators/[uid]/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11 | Нет сессии. |
| 404 | `'Not found'` | 15 | Роль не определена. |
| 403 | `'Owner cannot leave; transfer ownership first'` | 22 | Владелец пытается удалить себя из соавторов. |
| 403 | `'Forbidden'` | 25 | Нет прав удалить указанного участника. |

### `space/[id]/compile` — `src/app/api/space/[id]/compile/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 23 | Нет сессии. |
| 404 | `'Not found'` | 27, 30 | Роль не определена / space не найден. |
| 503 | `'Compiler not configured'` | 33 | Не настроен URL LaTeX-компилятора. |
| 400 | `'No files to compile'` | 37 | В проекте нет файлов. |
| 200 (не HTTP-ошибка) | `{ ok: false, log: "..." }` | 91 | **Важно**: неудачная компиляция LaTeX — это не HTTP-ошибка, а `200 OK` с `ok:false` и логом компилятора (обрезанным до 12000 символов). Единственный такой паттерн в проекте — компиляция трактуется как бизнес-результат, а не как сбой запроса. |

### `space/[id]/duplicate` — `src/app/api/space/[id]/duplicate/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11 | Нет сессии. |
| 404 | `'Not found'` | 14 | Исходный space не найден. |

### `space/[id]/export` — `src/app/api/space/[id]/export/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 12 | Нет сессии. |
| 403 | `'Forbidden'` | 18 | Роль не определена (нет доступа). |
| 404 | `'Not found'` | 21 | Space не найден. |

### `space/[id]/files/[...path]` — `src/app/api/space/[id]/files/[...path]/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 20, 35, 59 | Нет сессии (GET/PUT/DELETE). |
| 404 | `'Not found'` | 24 | Роль не определена. |
| 404 | `'File not found'` | 27 | Файл по пути не найден. |
| 400 | `'Invalid path'` | 39 | Путь не прошёл валидацию (`isValidPath`) — защита от path traversal. |
| 403 | `'Forbidden'` | 42, 63 | Роль `viewer` (или её нет) — нет прав на запись/удаление. |
| 400 | `'Invalid JSON'` | 45 | `req.json()` упал. |
| 413 | `'File too large (max 2 MB)'` | 49 | Лимит размера при сохранении содержимого файла. |

### `space/[id]/files` — `src/app/api/space/[id]/files/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 12, 34 | Нет сессии (GET/POST). |
| 404 | `'Not found'` | 16 | Роль не определена. |
| 403 | `'Forbidden'` | 38 | Роль `viewer`. |
| 400 | `'Invalid JSON'` | 41 | `req.json()` упал. |
| 400 | `'path required'` | 44 | Не передан путь нового файла/папки. |

### `space/[id]/files/import-zip` — `src/app/api/space/[id]/files/import-zip/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 34 | Нет сессии. |
| 403 | `'Forbidden'` | 38 | Роль `viewer`. |
| 400 | `'Invalid form data'` | 41 | `req.formData()` упал. |
| 400 | `'file required'` | 44 | Нет файла. |
| 413 | `'ZIP too large (max 20 MB)'` | 45 | Лимит размера ZIP. |
| 400 | `'Invalid ZIP file'` | 50 | Архив повреждён/не читается. |

### `space/[id]/files/rename` — `src/app/api/space/[id]/files/rename/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11 | Нет сессии. |
| 403 | `'Forbidden'` | 15 | Роль `viewer`. |
| 400 | `'Invalid JSON'` | 18 | `req.json()` упал. |
| 400 | `'from and to required'` | 22 | Не переданы старый/новый путь. |

### `space/[id]/files/upload` — `src/app/api/space/[id]/files/upload/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 13 | Нет сессии. |
| 403 | `'Forbidden'` | 17 | Роль `viewer`. |
| 400 | `'Invalid form data'` | 20 | `req.formData()` упал. |
| 400 | `'file required'` | 24 | Нет файла. |
| 413 | `'File too large (max 5 MB)'` | 25 | Лимит размера. |

### `space/[id]/versions` — `src/app/api/space/[id]/versions/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11, 23 | Нет сессии (GET/POST). |
| 404 | `'Not found'` | 15 | Роль не определена. |
| 403 | `'Forbidden'` | 27 | Роль отсутствует или `viewer`. |

### `space/[id]/versions/[vid]` — `src/app/api/space/[id]/versions/[vid]/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11 | Нет сессии. |
| 404 | `'Not found'` | 15, 18 | Роль не определена / версия не найдена либо принадлежит другому space. |

### `space/[id]/versions/[vid]/restore` — `src/app/api/space/[id]/versions/[vid]/restore/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 11 | Нет сессии. |
| 403 | `'Forbidden'` | 15 | Роль отсутствует или `viewer`. |

### `space/[id]/ws-token` — `src/app/api/space/[id]/ws-token/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 12 | Нет сессии. |
| 404 | `'Not found'` | 16 | Роль не определена (нет доступа к space → нельзя выдать WS-токен). |

### `space/[id]/ai-edit` — `src/app/api/space/[id]/ai-edit/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 22 | Нет сессии. |
| 503 | `'AI not configured'` | 23 | `OPENAI_API_KEY` не задан. |
| 404 | `'Not found'` | 27 | Роль не определена. |
| 400 | `'text required'` | 30 | Не передан текст для правки. |
| 400 | `'action or customPrompt required'` | 33 | Не передано ни готовое действие, ни свой промпт. |
| 502 | `'AI request failed'` | 47 | OpenAI вернул не-OK. |

### `space/[id]/ai-fix` — `src/app/api/space/[id]/ai-fix/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 13 | Нет сессии. |
| 503 | `'AI not configured'` | 14 | `OPENAI_API_KEY` не задан. |
| 404 | `'Not found'` | 18 | Роль не определена. |
| 400 | `'log required'` | 21 | Не передан лог компиляции для анализа. |
| 502 | `'AI request failed'` | 36 | OpenAI вернул не-OK. |

---

## 9. Billing — `/api/billing/*`

### `billing/checkout` — `src/app/api/billing/checkout/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Auth required'` | 84 | Нет сессии. |
| 400 | `'Plan not available for KZT payment'` | 94 | Выбранный план недоступен для оплаты в KZT (через Kaspi). |
| 400 | `'Invalid package selected'` | 123 | Пакет не найден в списке доступных. |
| 502 | `{error:'Gateway error', fallback_url: POS_FALLBACK}` | 159 | Платёжный шлюз (CryptoCloud) вернул ошибку; клиенту дополнительно отдаётся резервная ссылка на POS-терминал. |
| 500 | `{error: data.message \|\| 'Failed to generate invoice', fallback_url: POS_FALLBACK}` | 183 | Не удалось создать инвойс в шлюзе. |
| 500 | `{error: message, fallback_url: POS_FALLBACK}` | 188 | Catch-all. |

### `billing/kaspi-webhook` — `src/app/api/billing/kaspi-webhook/route.ts`
**Особый контракт**: это вебхук, который дергает Kaspi, а не фронтенд, поэтому формат ответа — `{ result: 0 | 1, message?: string }` (0 = обработано успешно, 1 = ошибка), а не `{ error }`. HTTP-статус при этом тоже выставляется, но именно поле `result` — это то, что проверяет Kaspi.
| Статус | `result` | `message` | Строка | Значение |
|---|---|---|---|---|
| 200 | 0 | — | 42, 68, 99, 157 | Успешная обработка (в т.ч. идемпотентный повтор уже обработанного платежа на строке 99). |
| 500 | 1 | `'Server misconfiguration'` | 48 | Не настроен секрет для проверки подписи. |
| 403 | 1 | `'Missing signature'` | 51 | Нет подписи в запросе. |
| 403 | 1 | `'Invalid signature'` | 59 | Подпись не совпала. |
| 400 | 1 | `'Invalid order ID'` | 63 | Некорректный `order_id`. |
| 400 | 1 | `'Bad package data'` | 79 | Пакет из `order_id` не распознан. |
| 500 | 1 | `'Internal error'` | 160 | Catch-all. |

### `billing/receipt/[id]` — `src/app/api/billing/receipt/[id]/route.ts`
**Особенность**: ответы — это `new NextResponse("текст"/"html", { status })`, а не JSON (`{ error }`), т.к. эндпоинт отдаёт либо PDF, либо HTML-страницу.
| Статус | Тело | Строка | Значение |
|---|---|---|---|
| 400 | `"Invalid receipt ID"` (текст) | 8 | `id` не строка/не передан. |
| 202 | HTML `"Чек генерируется..."` | 18-21 | Чек ещё не сгенерирован (PDF в процессе), это не ошибка, а промежуточное состояние — страница сама перезагрузится через 5с (`setTimeout` в `<script>`). |
| 404 | `"Receipt not found. It may be processing or does not exist."` (текст) | 24 | Записи о чеке вообще нет в БД. |
| 500 | `"Internal Server Error"` (текст) | 79 | Catch-all. |

### `billing/receipt/[id]/verify` — `src/app/api/billing/receipt/[id]/verify/route.ts`
| Статус | Тело | Строка | Значение |
|---|---|---|---|
| 400 | `"Invalid receipt ID"` (текст) | 8 | `id` не строка/не передан. |
| 404 | HTML `"Ошибка: Чек не найден"` | 30-33 | Чек не найден в БД. |
| 500 | `"Internal Server Error"` (текст) | 242 | Catch-all. |

### `billing/stats` — `src/app/api/billing/stats/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Auth required"` | 8 | Нет сессии. |
| 500 | `err.message` | 48 | Catch-all. |

### `billing/webhook` — `src/app/api/billing/webhook/route.ts` (вебхук CryptoCloud)
**Особый контракт**, как и у Kaspi-вебхука: ответы — plain text (`new NextResponse('текст', { status })`), не JSON.
| Статус | Тело | Строка | Значение |
|---|---|---|---|
| 200 | `'OK'` | 50 | Платёж не в финальном статусе (`status !== 'success' \|\| 'paid'`) — подтверждение получения без обработки. |
| 500 | `'Server misconfiguration'` | 56 | `CRYPTOCLOUD_SECRET` не задан — вебхук намеренно отключает себя ради безопасности. |
| 403 | `'Missing signature'` | 60 | В теле нет поля `sign`. |
| 403 | `'Invalid signature'` | 66 | MD5-подпись (`status+orderId+amount+currency+SECRET`) не совпала. |
| 200 | `'Already processed'` | 72 | Идемпотентность — платёж с этим `order_id` уже обработан. |
| 400 | `'Invalid order ID'` | 76 | `order_id` не начинается с `"UID_"`. |
| 200 | `'OK'` | 222 | Успешная обработка. |
| 500 | `'Internal error'` | 225 | Catch-all. |

(Строки 93, 116, 159/160 из первичного грепа относятся к телу этого же файла — `'Bad package data'` (400) и повторное `'Already processed'` (200) на другой ветке разбора пакета.)

---

## 10. Admin — `/api/admin/*`

### `admin/promos` — `src/app/api/admin/promos/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Forbidden"` | 19, 38 | Пользователь не админ (GET/PUT). |
| 500 | `err.message` | 31, 62 | Catch-all. |
| 400 | `"Missing promoId"` | 45 | Не передан ID промокода. |
| 400 | `"Invalid action"` | 60 | Неизвестное значение `action`. |

### `admin/stats` — `src/app/api/admin/stats/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Forbidden"` | 19 | Пользователь не админ. |
| 500 | `err.message` | 71 | Catch-all. |

### `admin/users` — `src/app/api/admin/users/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Forbidden"` | 19, 55 | Пользователь не админ (GET/PUT). |
| 500 | `err.message` | 48, 151 | Catch-all. |
| 404 | `"User not found"` | 63 | Целевой пользователь не найден. |
| 400 | `"Invalid action"` | 146 | Неизвестное значение `action` (например, не `toggle_ban`). |

Все три admin-роута проверяют права одним и тем же паттерном "Forbidden = не админ" — общей вспомогательной функции с явным типом ошибки нет, проверка инлайн в каждом файле.

---

## 11. Internal / Bot — `/api/internal/bot/*`

Все эндпоинты этого раздела защищены сравнением заголовка `x-bot-secret` с `process.env.WEBHOOK_SECRET` и вызываются только из контейнера `telegram-bot`. **Кроме `internal/bot/tasks`, все возвращают 403** при несовпадении секрета; `internal/bot/tasks` — единственный, возвращающий 401 в этом же случае (см. "требует уточнения").

### `internal/bot/billing` — `src/app/api/internal/bot/billing/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 32 | Неверный `x-bot-secret`. |
| 400 | `"Missing telegram_id"` | 40 | Не передан `telegram_id`. |
| 404 | `"User not found"` | 51, 108, 160, 202, 278 | Пользователь Telegram не найден в БД (в разных действиях: баланс, покупка, промокод, чек). |
| 400 | `"Invalid package"` | 113 | Пакет не найден в каталоге. |
| 404 | `"Промокод не найден."` | 208 | Промокод не существует. |
| 410 | `"Промокод деактивирован."` | 209 | `promo.is_active === false`. |
| 410 | `"Лимит активаций исчерпан."` | 210, 238 | Промокод исчерпал лимит использований (проверяется дважды — до и после гонки условий). |
| 403 | `"Вы уже использовали этот промокод."` | 235 | Пользователь уже активировал этот промокод ранее. |
| 400 | `"Missing code"` | 205 | Не передан код промокода. |
| 404 | `"Transaction not found"` | 284 | Транзакция для генерации чека не найдена. |
| 400 | `"Unknown action"` | 301 | Неизвестное значение `action`. |
| 500 | `err.message` | 304 | Catch-all. |

### `internal/bot/compile` — `src/app/api/internal/bot/compile/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 11 | Неверный `x-bot-secret`. |
| 400 | `"Code and Telegram ID are required"` | 18 | Не переданы обязательные поля. |
| 404 | `"User not found"` | 27 | Пользователь не найден. |
| 402 | `` `Insufficient balance. Need ${charCount} symbols, but you have ${Math.floor(deduction.remaining)}.` `` | 34-36 | Квота символов исчерпана — сообщение динамически подставляет остаток. |
| 500 | `err instanceof Error ? err.message : "Internal compilation failed"` | 57 | Catch-all. |

### `internal/bot/extract-text` — `src/app/api/internal/bot/extract-text/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 11 | Неверный `x-bot-secret`. |
| 200 (не ошибка HTTP, но с `error`) | `{ text: "", error: "Unsupported file type" }` | 96 | **Нестандартно**: тип файла не поддерживается, но статус всё равно `200` (не 400/415, как в аналогичных проверках других роутов). |
| 500 | `{error: err.message, text: "", images: []}` | 111 | Catch-all. |

### `internal/bot/referral` — `src/app/api/internal/bot/referral/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | 9 | Неверный `x-bot-secret` (единственный `referral`-роут с 401 вместо 403 — см. `referral/apply` ниже, там тоже 401). |
| 404 | `"User not found"` | 17 | Пользователь не найден. |
| 500 | `err.message` | 27 | Catch-all. |

### `internal/bot/referral/apply` — `src/app/api/internal/bot/referral/apply/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | 10 | Неверный `x-bot-secret`. |
| 404 | `"Referrer not found"` | 19 | Пригласивший пользователь не найден. |
| 500 | `err.message` | 45 | Catch-all. |

(Не ошибка, но важно для понимания контракта: строка 43 — `{success: true, awarded: false, message: "User already registered"}` со статусом 200, т.е. повторное применение реферального кода не считается ошибкой.)

### `internal/bot/history` — `src/app/api/internal/bot/history/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 9, 62 | Неверный `x-bot-secret` (GET/DELETE). |
| 400 | `"Missing telegram_id"` | 30 | Не передан `telegram_id`. |
| 404 | `"User not found"` | 33 | Пользователь не найден. |
| 500 | `err.message` | 55, 77 | Catch-all. |
| 400 | `"Missing sessionId"` | 70 | DELETE без `sessionId`. |

### `internal/bot/history/files` — `src/app/api/internal/bot/history/files/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 47 | Неверный `x-bot-secret`. |
| 404 | `"Session not found"` | 55 | Сессия не найдена. |
| 404 | `"Нет содержимого для генерации PDF."` | 116 | Нет текста/визуалов для сборки PDF-отчёта. |
| 500 | `"Не удалось скомпилировать PDF. Используйте ZIP."` | 202 | Компиляция LaTeX→PDF провалилась, предлагается fallback на ZIP. |
| 404 | `"Код для этой сессии отсутствует."` | 295 | Запрошен код (R/Python/TeX) сессии, но он не сохранён. |
| 400 | `"Invalid type"` | 298 | Неизвестный запрошенный тип файла. |
| 500 | `err.message` | 300 | Catch-all. |

### `internal/bot/session` — `src/app/api/internal/bot/session/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 9, 35 | Неверный `x-bot-secret` (GET/POST). |
| 400 | `"Missing userId"` | 25 | Не передан `userId` в query. |
| 400 | `"Missing data"` | 54 | Не передано тело для сохранения сессии. |
| 500 | `err.message` | 60 | Catch-all. |

### `internal/bot/tasks` — `src/app/api/internal/bot/tasks/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | 10 | Неверный `x-bot-secret` — **единственный internal/bot-роут с 401** вместо 403 (см. "требует уточнения"). |
| 404 | `"User not found"` | 18 | Пользователь не найден. |
| 500 | `err.message` | 48 | Catch-all. |

### `internal/bot/user-info` — `src/app/api/internal/bot/user-info/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 10 | Неверный `x-bot-secret`. |
| 400 | `"Missing telegram_id"` | 17 | Не передан `telegram_id`. |
| 404 | `"User not found"` | 23 | Пользователь не найден. |
| 500 | `err.message` | 29 | Catch-all. |

### `internal/bot/verify` — `src/app/api/internal/bot/verify/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 12 | Неверный `x-bot-secret`. |
| 400 | `"Missing token or user data"` | 19-22 | Не переданы `token`/`user.id`. |
| 404 | `"Token not found or expired"` | 29-32 | Токен deep-link не найден. |
| 409 | `"Token already used"` | 36-39 | Токен уже был использован (`status === "completed"`) — единственное место в проекте с кодом 409. |
| 500 | `err.message \|\| "Verification failed"` | 72-75 | Catch-all. |

### `internal/bot/visual/compile` — `src/app/api/internal/bot/visual/compile/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 29 | Неверный `x-bot-secret`. |
| 400 | `"No code provided"` | 36 | Пустой код. |
| 502 | `` `Compiler Error: ${err}` `` | 52 | Внутренний компилятор (R/Python) вернул ошибку. |
| 500 | `err.message` | 58 | Catch-all. |

### `internal/bot/visual/generate` — `src/app/api/internal/bot/visual/generate/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Unauthorized"` | 195 | Неверный `x-bot-secret`. |
| 500 | `"OpenAI API Key not configured"` | 199 | Ключ не задан. |
| 400 | `"No context provided"` | 219 | Нет ни текста, ни изображений для анализа. |
| 422 | `"⚠️ В документе недостаточно данных для анализа. Пожалуйста, убедитесь, что в файле есть количественные показатели или прикрепите детальное описание."` | 229-231 | Защита от галлюцинаций: текста < 400 символов и нет изображений. |
| 403 | `"Ваш аккаунт заморожен администрацией."` | 245 | `user.is_banned === true`. |
| 402 | `` `Insufficient balance to analyze data. Need ${inputChars} symbols, but you only have ${Math.floor(deduction.remaining)}.` `` | 272-274 | Квота символов исчерпана. |
| 500 | `err instanceof Error ? err.message : "Compilation failed"` | 589 | Catch-all. |

---

## 12. Tasks (напоминания) — `/api/tasks/*`

### `tasks/parse` — `src/app/api/tasks/parse/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 21 | Нет сессии (используется `verifyAuth`, см. ниже). |
| 500 | `'OpenAI API key is missing'` | 25 | Ключ не задан. |
| 400 | `'Text input is required'` | 32 | Пустой текст для парсинга. |
| 500 | `'Failed to parse task from OpenAI'` | 73 | OpenAI вернул не-OK. |
| 500 | `'Failed to parse model response'` | 86 | Ответ модели не парсится как JSON. |
| 500 | `'Model returned incomplete data'` | 94 | В распарсенном JSON не хватает полей. |
| 500 | `'Internal Server Error'` | 99 | Catch-all. |

### `tasks` — `src/app/api/tasks/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `'Unauthorized'` | 23, 31, 50, 79 | Нет валидной cookie (GET/POST/PUT/DELETE). |
| 400 | `'Text and remindAt are required'` | 38 | Не хватает полей при создании. |
| 500 | `'Failed to create task'` | 44 | Ошибка записи в БД. |
| 400 | `'taskId is required'` | 57 | Нет `taskId` в PUT. |
| 500 | `'Failed to update task'` | 73 | Ошибка обновления. |
| 400 | `'id parameter is required'` | 86 | Нет `id` в query для DELETE. |
| 500 | `'Failed to delete task'` | 92 | Ошибка удаления. |

**Важно**: `tasks/route.ts` и `tasks/parse/route.ts` авторизуются **не через** `verifySession()` из `src/lib/session.ts`, а через собственную функцию `verifyAuth()`, объявленную прямо в `src/app/api/tasks/route.ts:9-19`, которая проверяет ту же cookie `perricheno_session`, но подписанную **захардкоженным** ключом `"super-secret-key-change-this-in-env-938210"` (`src/app/api/tasks/route.ts:7`), а не `process.env.SESSION_SECRET`. Раз ключи разные, JWT, подписанный основной сессией (`SESSION_SECRET`), в этом роуте, скорее всего, не пройдёт проверку `jwtVerify` с другим ключом — то есть `/api/tasks/*` **может не работать вместе с обычным логином**, либо это заведомо иной, отдельный секрет. Это требует уточнения у владельца (см. финальный раздел) — совпадение результата 401 маскирует потенциально более серьёзную проблему консистентности авторизации.

---

## 13. Telegram (прямые действия с ботом) — `/api/telegram/*`

### `telegram/send` — `src/app/api/telegram/send/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | 8 | Нет сессии. |
| 500 | `"Server configuration error"` | 13 | Не настроен токен Telegram-бота. |
| 400 | `"Missing file or chat_id"` | 21 | Не переданы обязательные поля. |
| `res.status` (проброс) | `{error:"Telegram send failed", details: err}` | 37 | Telegram Bot API вернул ошибку — статус ретранслируется как есть. |
| 500 | `String(e)` | 43 | Catch-all. |

---

## 14. Прочее: health / pdf-proxy / webhook-proxy / webhook-telegram

### `health` — `src/app/api/health/route.ts`
| Статус | Тело | Строка | Значение |
|---|---|---|---|
| 200 | `{status:'UP', timestamp, database:'CONNECTED'}` | 11-15 | БД доступна (`SELECT 1`). |
| 503 | `{status:'DOWN', timestamp, database:'DISCONNECTED', error: error.message}` | 18-23 | Запрос к БД упал — единственное место в проекте, использующее 503 для healthcheck (в остальных 503 означает "фича не настроена", см. `space/[id]/ai-edit`, `space/[id]/ai-fix`, `space/[id]/compile`). |

### `pdf-proxy` — `src/app/api/pdf-proxy/route.ts` (прокси к внешнему Stirling PDF API)
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 400 | `"Invalid conversion type"` | 132 | Неизвестный `type` в query. |
| 400 | `"No input provided"` | 147 | Нет ни `fileInput`, ни `urlInput` в форме. |
| `response.status` (проброс) | `{error: \`API Error: ${response.status}\`, details: errText.substring(0,500)}` | 162-165 | Внешний Stirling API вернул ошибку — статус и часть текста ретранслируются как есть. |
| 500 | `String(e)` | 217 | Catch-all. |

### `webhook-proxy` — `src/app/api/webhook-proxy/route.ts` (прокси к n8n-вебхукам, с защитой от SSRF)
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 401 | `"Unauthorized"` | 12 | Нет сессии. |
| 400 | `"Missing webhookUrl"` | 19 | Не передан URL вебхука. |
| 400 | `"Invalid webhookUrl"` | 27 | URL не парсится (`new URL()` упал). |
| 400 | `"Only HTTPS webhooks allowed"` | 30 | Протокол не `https:`. |
| 403 | `"Webhook host not allowed"` | 33 | Хост не входит в allow-list (защита от SSRF). |
| 504 | `"Webhook timed out (120s)"` | 67 | Таймаут запроса к n8n. |
| 502 | `message` (текст исключения) | 70 | Прочая ошибка вызова вебхука. |

### `webhook/telegram` — `src/app/api/webhook/telegram/route.ts`
| Статус | Сообщение | Строка | Значение |
|---|---|---|---|
| 403 | `"Forbidden"` | 14 | Проверка секрета Telegram-вебхука не прошла. |
| 502 | `"Proxy failed"` | 34 | Не удалось передать апдейт в контейнер `telegram-bot`. |

---

## 15. Go-микросервисы

У всех четырёх сервисов **тоже нет** общего реестра кодов ошибок — каждый обработчик формирует JSON вручную (`http.Error`/`json.NewEncoder` в стандартной `net/http`-реализации, `c.JSON` в `pdf-extractor`, который использует Gin).

### `r-compiler` — `r-compiler/main.go` (эндпоинты `/health`, `/compile`)
| Статус | Тело | Строка | Значение |
|---|---|---|---|
| 405 | `"Method not allowed"` (обычный текст, не JSON — `http.Error`) | 45 | Запрос не POST. |
| 400 | `{"error": "Invalid JSON"}` | 51 | Тело не парсится. |
| 400 | `{"error": "No code provided"}` | 56 | Пустое поле `code`. |
| 500 | `{"error": "Failed to create temp directory"}` | 62 | `ioutil.TempDir` упал. |
| 500 | `{"error": "Failed to write script"}` | 93 | Не удалось записать `script.R`. |
| 200 | `CompileResponse{Success:false, Log:"...", ExitCode:124}` | 132-133 | Таймаут выполнения R-скрипта (30 сек) — **не HTTP-ошибка**, всегда 200 с `success:false` в теле; так же и для любого ненулевого exit code скрипта (строка 135). |

### `python-compiler` — `python-compiler/main.go` (эндпоинты `/health`, `/compile`)
Структура идентична `r-compiler` (та же логика, тот же 30-секундный таймаут, тот же паттерн "выполнение упало → 200 + `success:false`", а не HTTP-ошибка).
| Статус | Тело | Строка | Значение |
|---|---|---|---|
| 405 | `"Method not allowed"` | 44 | Не POST. |
| 400 | `{"error": "Invalid JSON"}` | 50 | Тело не парсится. |
| 400 | `{"error": "No code provided"}` | 55 | Пустой `code`. |
| 500 | `{"error": "Failed to create temp directory"}` | 61 | Ошибка ФС. |
| 500 | `{"error": "Failed to write script"}` | 122 | Не удалось записать `script.py`. |

### `research-api` — `research-api/main.go` (эндпоинты `/health`, `/search`, вызывается из `agent/scholar/search`)
| Статус | Тело | Строка | Значение |
|---|---|---|---|
| 405 | `"Method not allowed"` (текст через `http.Error`) | 55 | Не POST. |
| 400 | `err.Error()` (текст исключения как есть, без обёртки в JSON) | 61 | Тело запроса не парсится в `SearchRequest`. |
| 500 | `err.Error()` | 99 | Ошибка вызова `fetchArxiv`/`fetchOpenAlex` (в т.ч. если внешний API — arXiv или OpenAlex — вернул не-200: см. `fmt.Errorf("OpenAlex returned status %d", ...)` на строке 146 и `fmt.Errorf("arxiv returned status %d", ...)` на строке 281 — обе эти ошибки всплывают сюда как 500). |

**Замечание**: `research-api` возвращает ошибки как `text/plain` (через `http.Error`, без JSON-обёртки `{error: ...}`), в отличие от `r-compiler`/`python-compiler`, которые явно формируют `{"error": "..."}`. Три Go-сервиса, написанные, судя по всему, в разное время, используют разные конвенции тела ошибки.

### `pdf-extractor` — `pdf-extractor/main.go` (Gin; эндпоинты `/health`, `/extract`, `/to-png`)
| Статус | Тело | Строка | Значение |
|---|---|---|---|
| 400 | `{"error": "Missing file"}` | 80 | Нет поля `file` в форме (`/extract`). |
| 413 | `{"error": "File too large (max 100 MB)"}` | 86 | Превышен `maxFileSize`. |
| 500 | `{"error": "Failed to create temp file"}` | 96 | Ошибка ФС. |
| 500 | `{"error": "Failed to save file"}` | 102 | Ошибка копирования загруженного файла. |
| 500 | `response` (тело `ExtractResponse` с непустым `Error`) | 108 | Сам процесс извлечения (OCR/layout parsing через внешний PaddleOCR API) вернул ошибку — прокидывается как есть с 500. |
| 400 | `{"error": "empty or unreadable body"}` | 120 | `/to-png`: тело запроса пустое или не читается. |
| 500 | `{"error": "failed to save pdf"}` | 131 | Ошибка сохранения временного PDF. |
| 500 | `{"error": "pdftoppm: <stderr>"}` | 138 | Утилита `pdftoppm` (Poppler) завершилась с ошибкой — текст её stderr пробрасывается как есть. |
| 500 | `{"error": "png file not found after conversion"}` | 144 | `pdftoppm` отработал, но PNG не появился. |

---

## Итоговая сводка по статусам (сквозной подсчёт по всему проекту, включая Go-сервисы)

| Статус | Типовое значение |
|---|---|
| 200 | Успех; также используется для "мягких" ошибок бизнес-логики (`ok:false` при неудачной компиляции в `space/[id]/compile`, `success:false` при таймауте/падении скрипта в `r-compiler`/`python-compiler`, `{text:"", error:"..."}` в `internal/bot/extract-text`, `{result:0}` в Kaspi-вебхуке, `'OK'` в CryptoCloud-вебхуке). |
| 201 | Создание сущности (`agent/sessions` POST, `space` POST, `space/[id]/duplicate`, `space/[id]/invite`, `space/[id]/versions` POST, `space/[id]/files` POST, `space/[id]/files/upload`). |
| 202 | Асинхронная генерация ещё не завершена (`billing/receipt/[id]` — чек генерируется). |
| 400 | Некорректный запрос: невалидный JSON, отсутствуют обязательные поля, невалидный путь/URL/тип конвертации. Самый частый код после 401. |
| 401 | Нет валидной пользовательской сессии (`verifySession()`), либо (нестандартно) неверный `x-bot-secret` в паре internal/bot-роутов, либо провалена подпись Telegram Login Widget. |
| 402 | Исчерпана тарифная квота (символы/визуалы/отчёты) — часто с псевдокодом `"LIMIT_REACHED"` в `error`. |
| 403 | Неверный межсервисный секрет (`x-bot-secret`) в большинстве internal/bot-роутов; недостаточно прав на ресурс (роль в space, не-админ); провалена подпись вебхука. |
| 404 | Сущность не найдена (сессия, space, версия, файл, пользователь, промокод, чек, транзакция, приглашение); в `space/*` также используется, когда не определена роль пользователя. |
| 409 | Только один случай — повторное использование auth-токена (`internal/bot/verify`). |
| 410 | Промокод деактивирован/исчерпан (`internal/bot/billing`). |
| 413 | Превышен лимит размера файла/сообщения (у каждого эндпоинта свой захардкоженный лимит) либо лимит "стейджинга" символов (`TOTAL_CHAR_CAP`). |
| 415 | Неподдерживаемый тип/формат файла. |
| 422 | Бизнес-валидация не прошла уже после структурной проверки: пустой результат извлечения PDF (`EMPTY_PDF`), недостаточно данных для анализа, TikZ/R не скомпилировались после нескольких попыток. |
| 500 | Необработанное исключение / внешний сервис (OpenAI, компилятор, платёжный шлюз, PaddleOCR) вернул ошибку. Иногда статус проксируется от внешнего сервиса как есть. |
| 502 | Явный сбой вызова внешнего/внутреннего сервиса (AI, webhook, компилятор) — используется как осознанный "Bad Gateway", а не общий 500. |
| 503 | "Функция не настроена" (`AI not configured`, `Compiler not configured`) — используется как отдельный код от 500, кроме `health`, где 503 означает недоступность БД. |
| 504 | Таймаут вызова внешнего webhook (`webhook-proxy`, 120 сек). |

---

## Требует уточнения у владельца

1. **`src/app/api/tasks/route.ts:7`** — JWT для `/api/tasks/*` подписывается захардкоженным литералом `"super-secret-key-change-this-in-env-938210"` через собственную функцию `verifyAuth()`, а не общим `verifySession()`/`SESSION_SECRET` из `src/lib/session.ts`. Непонятно, баг это (роут случайно не признаёт основную сессию пользователя) или осознанное решение с отдельным механизмом.
2. **Несогласованность 401 vs 403 для `x-bot-secret`**: почти все `internal/bot/*` роуты возвращают 403 при неверном секрете, но `internal/bot/referral/route.ts:9`, `internal/bot/referral/apply/route.ts:10` и `internal/bot/tasks/route.ts:10` возвращают 401 в той же ситуации. Неясно, это случайная непоследовательность или у 401-роутов иная семантика.
3. **`src/app/api/auth/login/route.ts:39-43`** — в ответ клиенту при 500 уходят `details: e.toString()` и `stack: e.stack` (полный стектрейс). Нужно подтвердить, что это осознанный debug-режим, а не забытый код для продакшена.
4. **`src/app/api/internal/bot/extract-text/route.ts:96`** — неподдерживаемый тип файла возвращается со статусом 200 (`{text:"", error:"Unsupported file type"}`), тогда как аналогичные проверки в других роутах (`agent/attach`, `agent/ingest-pdf`) используют 415. Уточнить, намеренно ли здесь другая семантика (чтобы бот не считал это фатальной ошибкой HTTP).
5. **`src/app/api/r/upload/route.ts:15`** — сообщение `"Extract service not configured."` появляется при отсутствии `WEBHOOK_SECRET`, что вводит в заблуждение (звучит как проблема самого сервиса извлечения, а не отсутствующего секрета для его вызова). Не баг, но неточная формулировка — стоит уточнить у автора, не является ли это переиспользованием не по назначению общего `WEBHOOK_SECRET`.
6. **Смешанные форматы ошибок между Go-сервисами**: `r-compiler`/`python-compiler` отдают `{"error": "..."}`, `research-api` — голый текст (`http.Error` без JSON), `pdf-extractor` (Gin) — `{"error": "..."}` через `c.JSON`. Неясно, ожидается ли когда-нибудь их унификация, раз они уже вызываются из общего Next.js-приложения.
7. **`space/[id]/compile` и `r-compiler`/`python-compiler`** намеренно возвращают ошибки компиляции/выполнения как `200 OK` с `ok:false`/`success:false` в теле, а не как HTTP-ошибку — стоит подтвердить, что все клиенты (в т.ч. телеграм-бот) действительно всегда проверяют это поле, а не полагаются на HTTP-статус.

