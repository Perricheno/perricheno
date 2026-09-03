# telegram-bot/src/handlers

Обработчики команд/callback-кнопок/диалоговых шагов бота, подключаются в [`../bot.ts`](../bot.ts). Почти все функции здесь — тонкий слой: сформировать запрос к внутреннему API сайта (`SITE_INTERNAL_URL`, заголовок `X-Bot-Secret`), получить JSON и отрендерить его в текст/клавиатуру Telegraf. Сама бизнес-логика (лимиты, тарифы, пайплайн генерации) живёт на сайте — подробности в [`../../../docs/business_logic.md`](../../../docs/business_logic.md), а список самих внутренних роутов `/api/internal/bot/*` — в [`../../../docs/api_reference.md`](../../../docs/api_reference.md). Ниже — только что каждый хендлер по факту делает, без пересказа этой бизнес-логики.

## `auth.ts`

`handleStart` разбирает deep-link пейлоад `/start <payload>`: `ref_<id>` — заявка на реферальный бонус (`POST /api/internal/bot/referral/apply`), любой другой непустой пейлоад — токен разовой веб-авторизации (`POST /api/internal/bot/verify`); без пейлоада — обычное приветствие с главным меню. `handleMe` запрашивает `POST /api/internal/bot/user-info` и рендерит карточку профиля (ID, имя, username, тариф, дата регистрации, флаг блокировки).

## `billing.ts`

Все функции ходят в один эндпоинт `POST /api/internal/bot/billing` с разным `action` в теле. `handleBilling` (`action: "status"`) — дашборд использования/тарифа с прогресс-баром. `handleBillingShop`/`handleBillingCategory` (`action: "packages"`) — витрина пакетов по категориям (символы/отчёты/бандлы/все). `handleBillingBuy` — карточка подтверждения покупки конкретного пакета. `handleBillingConfirm` (`action: "checkout"`) — создаёт счёт (CryptoCloud) и присылает кнопку оплаты; защищён от повторного клика флагом `ctx.session.isProcessing`. `handleBillingHistory` (`action: "transactions"`) — список транзакций + ссылки на чеки. `handleBillingPromoStart`/`handleBillingPromoApply` (`action: "promo"`) — двухшаговый ввод промокода через `ctx.session.step = 'promo_input'`.

## `history.ts`

`handleHistory` — постраничный список прошлых сессий генерации (`POST /api/internal/bot/history`, `limit: 5`), запоминает текущую страницу в `ctx.session.lastHistoryPage` (чтобы вернуться на неё после удаления). `handleViewSession` — детали одной сессии по `sessionId`. `handleDownloadFile` — скачивает готовый файл (`pdf`/`zip`/`code`) через `POST /api/internal/bot/history/files` и пересылает как документ в чат. `handleViewImages` — тянет сохранённые графики сессии и шлёт их `replyWithMediaGroup` (обрезано до 10 — лимит Telegram на медиагруппу). `handleDeleteSession` — `DELETE /api/internal/bot/history?sessionId=...`, затем перерисовывает список на той же странице.

## `referral.ts`

`handleReferral` — единственный экспорт: запрашивает `POST /api/internal/bot/referral`, показывает статистику (число приглашённых, начисленный бонус) и персональную реферальную ссылку с кнопкой "Поделиться" (диплинк на `t.me/share/url`).

## `tasks.ts`

`handleActiveTasks` — список задач генерации, выполняющихся прямо сейчас (`POST /api/internal/bot/tasks`), с кнопкой сброса на каждую. `handleTaskReset` (`action: "reset"`) — принудительно сбрасывает зависшую/активную задачу по `sessionId` и перерисовывает список.

## `visual.ts`

Самый крупный хендлер — весь сценарий "Аналитика/Визуализация" и отдельно "Компиляция". Диалог собирается по шагам через `ctx.session.step`/`ctx.session.visual`:
- `handleVisualStart` → `handleVisualName` → `handleVisualCollect` (сбор текста/фото/файлов с debounce 1с на альбомы, через `collectionTimers`) → `handleVisualToggleType` (мультивыбор типов графика) → `handleVisualGenerateRequest` → `handleVisualProcess`.
- `handleVisualProcess` — оркестратор: скачивает присланные файлы у Telegram и прогоняет их через `POST /api/internal/bot/extract-text` (тот самый внутренний прокси к `pdf-extractor`, см. [`../../../pdf-extractor/README.md`](../../../pdf-extractor/README.md)), скачивает фото, затем **последовательно** (не параллельно) для каждого выбранного типа графика вызывает `POST /api/internal/bot/visual/generate`, обновляя статусное сообщение в чате на каждом шаге.
- `handleVisualCompletePush` — вызывается не самим ботом напрямую, а через push-канал `/bot-internal/complete-visual` (см. [`../bot.ts`](../bot.ts)), когда сайт заканчивает генерацию асинхронно: подтягивает готовые изображения и код через `/api/internal/bot/history/files` и шлёт их в чат.
- `handleVisualReset` — очищает `ctx.session.visual` и возвращает в главное меню.
- `handleCompileStart`/`handleCompileFile` — режим прямой компиляции: пользователь присылает `.py`/`.r` файл, бот скачивает его у Telegram, передаёт код в `POST /api/internal/bot/compile` (внутренний биллинг-обёрнутый прокси к `r-compiler`/`python-compiler`, см. соответствующие README) и возвращает картинку или лог.
