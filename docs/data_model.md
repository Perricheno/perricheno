# Модель данных

Источник истины: [`prisma/schema.prisma`](../prisma/schema.prisma). Схема применяется на прод через `npx prisma db push` (см. [`deploy.sh`](../deploy.sh)) — версионированных Prisma-миграций (`prisma/migrations/`) в проекте **нет**, состояние БД всегда "push"-ится напрямую из текущего `schema.prisma`. СУБД — PostgreSQL (`provider = "postgresql"`), ORM — Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`).

Все модели используют имена таблиц по умолчанию Prisma (PascalCase, без `@@map`/`@map` — они нигде в схеме не встречаются), то есть физические таблицы называются `"User"`, `"Citation"`, `"Space"` и т.д. (с точным регистром, в кавычках), а не `users`/`citations`/`spaces`.

> ⚠️ **[ИСПРАВЛЕНО, Фаза 4, 2026-09-04]**: раньше здесь лежали ещё два набора «сырых» SQL-миграций — `/migrations/*.sql` и `/supabase/migrations/*.sql`, описывавшие **другую** схему (таблицы в lowercase, Postgres-триггеры, Supabase Storage RLS-политики на `auth.uid()`), несовместимую с тем, что реально создаёт `schema.prisma`. Проверено по факту перед удалением: ни `deploy.sh`, ни `deploy.yml`, ни `package.json` никогда на них не ссылались (grep + `git log --follow` не нашли ни одного автоматического применения), а сами файлы содержат собственный комментарий «Run in Supabase SQL editor. Idempotent» — то есть предназначались для разового ручного запуска в интерфейсе Supabase на более раннем этапе (SQLite → Supabase → self-hosted Postgres, см. `/scripts/migrate-*`), а не для текущей БД. Удалены целиком как мёртвая, вводящая в заблуждение документация схемы — единственный источник истины теперь `schema.prisma`.

---

## Users & Core

### User
Центральная сущность — пользователь, всегда идентифицируется через Telegram.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | Int, PK, autoincrement | Внутренний ID |
| `telegram_id` | String, **unique** | ID пользователя в Telegram — фактический естественный ключ входа |
| `username`, `first_name`, `photo_url` | String? | Кэш профиля из Telegram |
| `created_at` | DateTime | Дата регистрации |
| `daily_chars_used`, `purchased_chars` | Int | Счётчик и запас символов (лимиты генерации отчётов) — точная формула списания в `docs/business_logic.md` |
| `daily_visuals_used`, `purchased_visuals` | Int | Аналогично для визуализаций/графиков |
| `daily_reports_used`, `purchased_reports` | Int | Аналогично для отчётов |
| `last_reset_date`, `last_week_reset` | String? | Даты последнего сброса daily/weekly счётчиков (хранятся как строки, не Date) |
| `weekly_chars_used`, `monthly_chars_used` | Int | Недельный/месячный расход |
| `plan_tier` | String?, default `"free"` | Тариф пользователя (`free`/`plus`/`pro`/`ultra`), единственное поле — читается `checkAndDeductUsage`/`PDF_STAGING_CAPS`. Ранее сосуществовало с `account_tier`, удалённым в Фазе 4 как неиспользуемый дубль, вызывавший расхождение между отображаемым и реально применяемым тарифом (см. `docs/REVIEW.md`, пункт 10, и `docs/business_logic.md`, §2.10) |
| `is_banned`, `is_deleted` | Boolean | Модерация/soft-delete |
| `is_admin` | Boolean | Доступ к `/api/admin/*` |
| `referred_by` | Int? | ID пригласившего пользователя — **не объявлено как `@relation` к User**, то есть на уровне БД это не настоящий внешний ключ, просто числовое поле (см. `docs/REVIEW.md`) |

**Связи (1 → N от User):** `Task`, `AgentSession`, `Transaction`, `UsageLog`, `SystemNotification`, `LatexError`, `ChatSession`, `VisualAsset`, `Receipt`, `PromoUsage`, `Session`, `AgentUpload`, `Space` (как `SpaceOwner`), `SpaceCollaborator`, `SpaceVersion`, `Citation`, `CitationCollection`, `RSession`. Все — `onDelete: Cascade`, то есть **удаление пользователя каскадно стирает вообще все его данные** без возможности восстановления (важно для GDPR/`api/auth/delete`, см. `docs/business_logic.md`).

### Task
Напоминание/задача пользователя. `status` — свободная строка (default `"pending"`), формального enum в Prisma нет.

### Transaction
История начислений/списаний баланса. `amount_text` — **строка**, а не число (см. `docs/REVIEW.md` — усложняет агрегацию/отчётность). `is_positive` — булев флаг направления операции. Индекс по `user_id` (для истории транзакций пользователя).

### UsageLog
Лог расхода токенов (`tokens: Int`) на пользователя, с таймстампом — используется, судя по названию, для аналитики использования LLM.

### PromoCode / PromoUsage
Промокоды: `type`, `amount`, `uses`/`max_uses`, `is_active`. `PromoUsage` — журнал применений с `@@unique([promo_id, user_id])`, то есть **на уровне БД гарантируется, что один пользователь не может применить один и тот же промокод дважды**. Разбор точной логики начисления — в `docs/business_logic.md`.

### SystemConfig
Key-value хранилище конфигурации приложения в БД (`key` — PK-строка, `value` — строка). Отдельный от `.env` слой конфигурации — см. `docs/config_and_env.md` для того, что реально там хранится (если удалось определить по коду).

### SystemNotification
Внутренние уведомления пользователю (`message`, `is_read`).

### LatexError
Лог ошибок компиляции LaTeX, привязан к пользователю и опционально к `session_id` (строка, **не FK** — просто текстовое поле, без relation).

### AuthRequest
Промежуточная сущность Telegram-логина: `token` (PK), `status` (default `"pending"`), `tg_user_data` (String? — вероятно, сериализованный JSON профиля из Telegram). Используется в flow логина через deep-link/поллинг (`/api/auth/login`, `/api/auth/poll`) — подробности в `docs/business_logic.md`.

### Receipt
Чек об оплате: `type`, `pack_name`, `amount_text` (снова строка), `pdf_base64` (готовый PDF чека, закодированный в base64, хранится прямо в строке БД — см. риск размера строки в `docs/REVIEW.md`). Индекс по `user_id`.

### Session
Активная веб-сессия пользователя (браузер), отдельно от Telegram: `user_agent`, `ip`, `location` (гео по IP, см. `docs/integrations.md` про ip-api.com), `last_active`. Индекс по `user_id`. Это — таблица, в которую пишет `src/lib/session.ts` при логине; JWT-кука лишь хранит `sessionId`, реальная валидность сессии проверяется здесь (отзываемая сессия).

### BotSession
`telegram_id` (PK) + `session_data` (String — вероятно, сериализованный JSON состояния диалога бота). Используется Telegram-ботом для хранения состояния сценария (multi-step wizard) между сообщениями.

### ProcessedPayment
`order_id` (PK) + `created_at`. Явная таблица-дедупликатор: наличие строки с данным `order_id` — единственная защита от повторной обработки одного и того же платёжного вебхука (идемпотентность). Подробности — `docs/business_logic.md` (раздел «Биллинг»).

---

## Agent & AI

### AgentSession
Ядро "агента"-генератора отчётов. Хранит весь жизненный цикл одной генерации:
- `doc_type` (default `"research"`), `settings_json`, `stage_json` (прогресс по стадиям пайплайна, см. `docs/business_logic.md`)
- Результат: `main_tex`, `references_bib`, `visuals_json`
- `status` (default `"done"` — см. потенциальную путаницу в `docs/REVIEW.md`: дефолт «готово» для только что создаваемой записи выглядит подозрительно), `error_msg`, `stream_text` (вероятно, буфер для стриминга ответа LLM в реальном времени)
- `share_id` — **unique**, nullable — включает публичную ссылку `/agent/shared/[shareId]`
- `tg_message_id` — Int?, привязка к сообщению в Telegram (для редактирования сообщения бота по мере прогресса)
Индекс по `user_id`.

### ChatSession / ChatMessage
Обычный чат с ассистентом. `ChatMessage.role` — свободная строка (`user`/`assistant`/... по конвенции, не enum), `metadata_json` — доп. данные сообщения. Каскадное удаление сообщений при удалении сессии. Индексы по `user_id` (ChatSession) и `session_id` (ChatMessage).

### VisualAsset
Сгенерированная визуализация (график/диаграмма): `type`, `url` (путь в MinIO, см. `docs/integrations.md`), `source_code` (код, которым сгенерирован визуал — TikZ/matplotlib/ggplot?), `prompt`. Может быть привязан к `ChatSession` (`onDelete: SetNull` — в отличие от User, при удалении чата актив не удаляется, просто отвязывается).

### AgentUpload
Загруженный пользователем файл (PDF и т.п.) для использования агентом: текст, извлечённый OCR (`ocr_used`), метаданные (`char_count`, `image_count`, `page_count`), опционально путь в объектном хранилище (`storage_path`, `file_size`, `mime_type`). **Обязательное поле `expires_at`** — модель заведомо временная (TTL-очистка), но в `schema.prisma` не видно scheduled job, который бы удалял просроченные записи — см. `docs/REVIEW.md` (в старой SQL-миграции `migrations/2026-04-21-staged-pipeline.sql` есть закомментированный `pg_cron`-джоб на это, который никогда не был включён).

---

## Spaces (совместный LaTeX-редактор)

### Space
Проект/документ: `compiler` (default `"pdflatex"` — свободная строка, не enum, хотя в коде наверняка ограниченный набор компиляторов, см. `docs/business_logic.md`), `main_file`, `auto_compile`, `share_id` (unique, публичная ссылка `/space/pub/[shareId]`), `is_public`.

### SpaceFile
Файл внутри Space: либо текст (`content`), либо бинарь (`content_b64` + `is_binary=true`), `mime_type`, `size_bytes`. `@@unique([space_id, path])` — гарантирует отсутствие двух файлов с одинаковым путём в одном проекте.

### SpaceVersion
Снапшот версии: `label`, `message` (описание версии, как commit message), `snapshot` — **вся версия хранится как одна JSON-строка** (не отдельные строки/файлы), `created_by` — nullable FK на User с `onDelete: SetNull` (версия переживает удаление автора).

### SpaceCollaborator
Права доступа: `role` (default `"editor"`, свободная строка), `invited_at`/`accepted_at` (nullable — приглашение может быть не принято). `@@unique([space_id, user_id])` — пользователь не может быть добавлен дважды.

### SpaceInvite
Инвайт-ссылка по email: `token` (unique, используется в URL), `expires_at`. **Нет `@@unique([space_id, email])`** — теоретически можно наприглашать один email много раз (создаст несколько активных токенов) — см. `docs/REVIEW.md`.

---

## Citations (менеджер библиографии)

### Citation
Одна библиографическая запись: идентификаторы `doi`/`arxiv_id`/`isbn` (все опциональны, не проверяется что хотя бы один задан на уровне схемы), `authors`/`tags` — нативные Postgres-массивы строк (`String[]`), `bibtex` (готовый BibTeX-текст) + `cite_key` (ключ вида `@article{KEY,...}`). Никакого `@@unique` на `(user_id, cite_key)` в Prisma-схеме нет (такой constraint был только в удалённой в Фазе 4 «мёртвой» SQL-версии) — то есть в текущей рабочей схеме два cite_key у одного пользователя технически могут совпасть.

### CitationCollection / CitationCollectionItem
Папки для группировки цитат, классическая M2M через явную join-таблицу `CitationCollectionItem` с `@@unique([collection_id, citation_id])` (нельзя добавить одну цитату в одну коллекцию дважды).

---

## R Studio Sessions

### RSession
Сессия работы с R-скриптами/графиками: `prompt` (запрос пользователя), `results_json`, `status` (default `"generating"` — конечные значения статуса не описаны в схеме, см. `docs/business_logic.md` за тем, что реально выставляет код). Индекс по `user_id`.

---

## Сводная схема связей (ER, упрощённо)

```
User ──1:N── Task
User ──1:N── Transaction
User ──1:N── UsageLog
User ──1:N── SystemNotification
User ──1:N── LatexError
User ──1:N── Receipt
User ──1:N── Session
User ──1:N── PromoUsage ──N:1── PromoCode
User ──1:N── AgentSession
User ──1:N── ChatSession ──1:N── ChatMessage
User ──1:N── VisualAsset ──N:1(opt,SetNull)── ChatSession
User ──1:N── AgentUpload
User ──1:N(owner)── Space ──1:N── SpaceFile
                          ├──1:N── SpaceVersion ──N:1(opt,SetNull)── User
                          ├──1:N── SpaceCollaborator ──N:1── User
                          └──1:N── SpaceInvite
User ──1:N── Citation ──N:M── CitationCollection (через CitationCollectionItem)
User ──1:N── CitationCollection
User ──1:N── RSession
```

Отдельно, без формальных FK-связей в Prisma: `AuthRequest`, `BotSession`, `ProcessedPayment`, `SystemConfig` — все живут сами по себе, ключом является строка (token/telegram_id/order_id/key), а не autoincrement ID.

## Индексы — сводка

Явные `@@index`/`@@unique`, объявленные в `schema.prisma` (кроме implicit PK):

- `User.telegram_id` — unique
- `Transaction.user_id`, `UsageLog` (нет, не индексирован — см. ниже), `Receipt.user_id`, `Session.user_id`, `AgentSession.user_id`, `ChatSession.user_id`, `ChatMessage.session_id`, `AgentUpload.user_id`, `RSession.user_id` — обычные индексы по FK для быстрой выборки "всё для этого пользователя/сессии"
- `PromoUsage(promo_id, user_id)` — unique
- `AgentSession.share_id`, `Space.share_id`, `SpaceInvite.token`, `SpaceFile(space_id, path)`, `SpaceCollaborator(space_id, user_id)` — unique
- **Не индексированы** (потенциально стоит проверить нагрузку): `UsageLog.user_id`, `Task.user_id`, `SystemNotification.user_id`, `LatexError.user_id`, `VisualAsset.user_id`/`session_id`, `Citation.user_id`, `CitationCollection.user_id` — Prisma создаёт индекс на FK только если он явно объявлен через `@@index`; здесь для части моделей с FK на `User` индекса нет. Это заготовка для `docs/REVIEW.md`, не додумываю причину — возможно, объём данных пока мал и не требуется.
