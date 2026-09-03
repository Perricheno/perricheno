# Perricheno — бизнес-логика (по коду)

Документ составлен построчным чтением исходников (не по памяти о «типичных SaaS»). Все числа и формулы — цитаты из кода на дату аудита (2026-09-01), с указанием файла. Если логика неочевидна и не подтверждена комментарием/тестом — помечено «требует уточнения у владельца».

---

## 1. Обзор

Perricheno — SaaS для автоматической генерации научных документов (LaTeX) и статистических визуализаций, с Telegram-ботом как основным пользовательским интерфейсом (плюс веб-панель на Next.js 16 / App Router). Бэкенд — Postgres через Prisma.

Что система реально умеет (согласно коду):
- **Генерировать научный документ целиком** (`src/lib/agent/pipeline/*`): план → выжимка из загруженных PDF → верификация понимания → обогащение метаданных по DOI (CrossRef) → генерация статистических графиков по CSV/XLSX (R/Python) → генерация концептуальных диаграмм (TikZ) → черновики секций → сборка `main.tex`/`references.bib` → компиляция в LaTeX-компиляторе с автоматическим ремонтом ошибок (до 2 попыток).
- **Генерировать отдельные статистические визуализации** из загруженных данных (`src/lib/analytics/pipeline/*`) — независимый 3-стадийный конвейер.
- **Совместный LaTeX-редактор "Space"** (`src/lib/space-db.ts`) с версионированием, ролями и шарингом.
- **R-сессии** (`src/lib/r-db.ts`) — отдельная лёгкая история генераций графиков.
- **Менеджер цитат** (`src/lib/citations-db.ts`) — личная библиотека BibTeX-записей с коллекциями.
- **Биллинг**: подписки (Plus/Pro/Ultra) и разовые пакеты символов/визуалов/отчётов, оплата через CryptoCloud (крипта), плюс промокоды и реферальная программа. (Kaspi Pay была подготовлена, но заброшена и удалена 2026-09-03, см. §4.1.)
- **Вход только через Telegram** — either Telegram Login Widget (HMAC-проверка), либо deep-link `/start <token>` из бота.

Пользователь — авторизуется Telegram-аккаунтом (`User.telegram_id` — единственный уникальный идентификатор личности в системе).

---

## 2. Лимиты и тарифы

Источник истины — `src/lib/db.ts`.

### 2.1 Тарифные лимиты по символам (`PLAN_LIMITS`, db.ts:94-99)

| Тариф | `weekly_chars` | `monthly_chars` |
|---|---|---|
| `free`  | 50 000    | 150 000   |
| `plus`  | 150 000   | 450 000   |
| `pro`   | 250 000   | 800 000   |
| `ultra` | 800 000   | 3 000 000 |

Тариф пользователя читается из `user.plan_tier` (по умолчанию `'free'`, если `null`/неизвестен — используется `PLAN_LIMITS['free']`).

### 2.2 Лимит "стейджинга" загруженных PDF (`PDF_STAGING_CAPS`, db.ts:102-107)

Сколько суммарно символов может находиться в активных (не истёкших, см. §2.6) загрузках `AgentUpload` одновременно:

| Тариф | лимит символов |
|---|---|
| `free`  | 200 000 |
| `plus`  | 500 000 |
| `pro`   | 1 000 000 |
| `ultra` | −1 (без ограничения — код просто использует значение `-1`, отдельной проверки "if cap === -1 skip" в `db.ts` нет; проверка происходит в вызывающих роутах, например `src/app/api/agent/ingest-pdf/route.ts`) |

### 2.3 Счётчики расхода на пользователе (`User`, prisma/schema.prisma)

- `daily_chars_used`, `daily_visuals_used`, `daily_reports_used` — сбрасываются раз в сутки.
- `weekly_chars_used` — сбрасывается раз в неделю.
- `monthly_chars_used` — **не имеет автоматического ежемесячного сброса** (см. находку в §10).
- `purchased_chars`, `purchased_visuals`, `purchased_reports` — «купленный» остаток, не связанный с датой, тратится после исчерпания бесплатной квоты.

### 2.4 Формула сброса дневного лимита (`checkAndDeductUsage`, db.ts:116-225)

```
today = new Date().toISOString().split('T')[0]   // "YYYY-MM-DD" по серверному времени (UTC)
if (user.last_reset_date !== today):
    daily_chars_used = 0
    daily_visuals_used = 0
    daily_reports_used = 0
    last_reset_date = today
    // + создаётся Transaction { topic: "Daily quota reset", amount_text: "Reset", is_positive: true }
```

Сброс атомарный (`prisma.$transaction`), выполняется лениво — при первом обращении к `checkAndDeductUsage` в новый день, а не по крону.

### 2.5 Формула сброса недельного лимита (db.ts:109-114, 142-150)

Номер недели вычисляется **нестандартной** (не ISO-8601) функцией:

```js
function getWeekNumber(d) {
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - start.getTime();
    const oneWeek = 604800000; // 7*24*60*60*1000
    return `${d.getFullYear()}-W${Math.ceil((diff / oneWeek) + 1)}`;
}
```

Если `user.last_week_reset !== currentWeek` → `weekly_chars_used = 0`, `last_week_reset = currentWeek`. Эта проверка идёт отдельным `prisma.user.update` (не в одной транзакции с дневным сбросом, но последовательно после него).

Важно: эта неделя **не привязана к дню недели** (не "понедельник—воскресенье"), а к скользящим 7-дневным блокам от 1 января текущего года — на границе года возможны искажения (например, `2026-W53` vs `2027-W1` не всегда предсказуемо совпадают с календарной неделей). Формула не документирована как намеренная — помечаю как "требует уточнения у владельца".

### 2.6 Порядок списания символов (тип `'chars'`, db.ts:176-222)

```
weeklyMax  = PLAN_LIMITS[tier].weekly_chars
monthlyMax = PLAN_LIMITS[tier].monthly_chars
purchased  = user.purchased_chars

remainingWeekly  = max(0, weeklyMax  - weekly_chars_used)
remainingMonthly = max(0, monthlyMax - monthly_chars_used)
freeAvailable    = min(remainingWeekly, remainingMonthly)   // более узкое из двух окон
totalAvailable   = freeAvailable + purchased

if totalAvailable < amount:
    return { success: false, remaining: totalAvailable }    // отказ, НИЧЕГО не списывается

fromFree      = min(freeAvailable, amount)
fromPurchased = amount - fromFree

weekly_chars_used  += fromFree
monthly_chars_used += fromFree
daily_chars_used   += fromFree      // daily НЕ участвует в проверке лимита, только накапливается для UI/статистики
purchased_chars     = max(0, purchased - fromPurchased)
```

Т.е. **дневной лимит символов формально не ограничивает** — `daily_chars_used` нигде не сравнивается с максимумом, это чисто информационный счётчик (для дашборда/бота). Реальные ограничители — недельное и месячное окно (более жёсткое из двух) плюс "докупленный" остаток, который тратится вторым, после бесплатной квоты.

Списание оборачивается в одну `prisma.$transaction` (обновление `User` + создание `UsageLog`, если `amount > 0`).

### 2.7 Списание визуализаций (тип `'visuals'`, db.ts:152-171)

```js
if (type === 'visuals') {
    await prisma.$transaction([
        prisma.user.update({ data: { daily_visuals_used: user.daily_visuals_used + amount } }),
        prisma.transaction.create({ topic: "Visual generation", amount_text: `-${amount} visuals`, is_positive: false }),
        prisma.usageLog.create({ tokens: amount }),
    ]);
    return { success: true, remaining: 999999 };   // ВСЕГДА успех
}
```

**Здесь нет никакой проверки лимита** — ни против `purchased_visuals`, ни против какого-либо `PLAN_LIMITS`-аналога для визуалов (такого лимита в `PLAN_LIMITS` вообще не существует — там только `weekly_chars`/`monthly_chars`). `daily_visuals_used` просто растёт бесконечно, `remaining` всегда `999999`. См. находку в §10 — это делает "precheck" на визуалы (`checkAndDeductUsage(userId, 'visuals', 0)`, используемый в `src/app/api/agent/visualize/route.ts:90`, `src/app/api/agent/data-analytics/route.ts:350`, `src/app/api/agent/analytics/generate/route.ts:105`) фактически мёртвым кодом — `remaining <= 0` никогда не истинно.

### 2.8 Тип `'reports'` (db.ts:224)

Ветки `if (type === 'chars')` и `if (type === 'visuals')` покрывают явно, а для `'reports'` функция **проваливается в финальный `return { success: true, remaining: 999 };`** — не списывает ничего, не проверяет `purchased_reports`, не трогает `daily_reports_used`. `daily_reports_used` инкрементируется **только сбросом в 0** (§2.4) и больше нигде не увеличивается по коду (проверено grep по всему `src/`). Это значит, что счётчик отчётов в день — чисто декоративный: в `src/app/api/internal/bot/billing/route.ts:76` отображается `reports_max: 999` (хардкод, не связан ни с одним тарифом).

**Как в реальности лимитируется генерация отчёта:** в `src/app/api/agent/generate/route.ts:105-108` перед стартом делается `checkAndDeductUsage(userId, 'chars', 0)` (precheck на символы), а расход по завершении конвейера списывается тоже как `'chars'`:

```js
const charEquivalent = result.totalTokens * 3;   // эвристика: 1 токен ≈ 3 символа
await checkAndDeductUsage(userId, 'chars', charEquivalent);
```

Т.е. **генерация целого отчёта тарифицируется исключительно через символьную квоту**, а `purchased_reports`/`daily_reports_used`/пакеты "N отчётов" (`report_single`, `report_bulk`, `combo_lite`, `combo_pro` — см. §4) **никак не расходуются и не проверяются нигде в путях генерации**. Они лишь накапливаются (админ-грант, покупка, промокод) и отображаются в биллинг-дашборде бота (`purchased.reports`). Это несостыковка продукта и кода — см. §10.

### 2.9 Одновременные генерации отчётов

`src/app/api/agent/generate/route.ts:110-115`: не более **3** одновременных `AgentSession` со `status === 'generating'` на пользователя (`getActiveAgentSessionsCount`), иначе HTTP 429.

### 2.10 `account_tier` vs `plan_tier`

В `User` есть **два** похожих поля: `account_tier` (default `'free'`) и `plan_tier` (default `'free'`).
- `upgradeSubscriptionPlan()` (db.ts:244-269, вызывается из вебхуков оплаты) обновляет **оба** поля одинаково.
- `checkAndDeductUsage()` и лимит стейджинга PDF (`PDF_STAGING_CAPS`) читают **только `plan_tier`**.
- Административная ручка `set_tier` в `src/app/api/admin/users/route.ts:140` меняет **только `account_tier`**.
- Бот-роут `src/app/api/internal/bot/billing/route.ts:53` отображает лимиты по **`account_tier`**.

Т.е. если админ через дашборд меняет тариф пользователю вручную (`set_tier`), реальная квота (`plan_tier`-based) не меняется, а в боте пользователь увидит новый тариф с ЛИМИТАМИ, которые фактически не будут применены при генерации (список лимитов в боте посчитан по `account_tier`, а реальное списание — по `plan_tier`). См. §10.

---

## 3. Реферальная программа и промокоды

### 3.1 Реферальная программа

Реализация: `src/app/api/internal/bot/referral/apply/route.ts` (вызывается ботом, вероятно из хендлера `/start ref_<id>`, не входящего в explicitly прочитанный `referral.ts`, — сам файл `referral.ts` в боте только показывает статистику, начисление — в этом internal-роуте).

Правила:
1. Начисление происходит **только если приглашённый — новый пользователь** (`!existingInvitee`, поиск по `telegram_id`).
2. Новому пользователю выставляется `referred_by = referrer.id`.
3. Рефереру начисляется фиксированный бонус **100 000** символов (`const bonus = 100000`, referral/apply/route.ts:34), через прямую запись `purchased_chars: referrer.purchased_chars + bonus` (не `increment`, а чтение-и-запись — потенциальная гонка при параллельных приглашениях, см. §10).
4. Создаётся `Transaction { topic: "Referral Bonus", amount_text: "+100,000 chars", is_positive: true }`.
5. Статистика (`getReferralStats`, db.ts:651-666) считает `invitedCount` как `count(User where referred_by = userId)` и `totalBonus` — суммируя `amount_text` всех транзакций с `topic === 'Referral Bonus'` (парсинг строки регуляркой на `parseInt`).
6. Реферальная ссылка, которую видит пользователь в боте: `https://t.me/perrichenobot?start=ref_${telegram_id}` (`referral/route.ts:24`) — **хардкод имени бота** `perrichenobot`, не через `TELEGRAM_BOT_USERNAME` (в отличие от deep-link авторизации, где имя бота берётся из env, см. §9).
7. Нет проверки на самоприглашение (`referrerId === invitee.id`) — не найдено в прочитанном коде. Требует уточнения у владельца.
8. Нет ограничения на количество рефералов на одного пользователя — бонус начисляется за каждого нового приглашённого без верхнего предела.

### 3.2 Промокоды

Модели: `PromoCode` (code, type, amount, uses, max_uses, is_active) и `PromoUsage` (promo_id, user_id, `@@unique([promo_id, user_id])`).

Активация (`src/app/api/internal/bot/billing/route.ts:201-272`, action `"promo"`):

1. `code.toUpperCase()` — код нечувствителен к регистру при поиске.
2. Отказы (без списания, до транзакции):
   - код не найден → 404 `"Промокод не найден."`
   - `is_active === false` → 410 `"Промокод деактивирован."`
   - `uses >= max_uses` → 410 `"Лимит активаций исчерпан."`
3. Атомарное применение внутри `prisma.$transaction`:
   ```
   a. tx.promoUsage.create({ promo_id, user_id })     // бросает P2002, если пара уже существует
   b. tx.promoCode.updateMany({ where: { id, uses: { lt: max_uses } }, data: { uses: increment(1) } })
      // если updatedPromo.count === 0 → throw new Error('EXHAUSTED')  (гонка: код исчерпан ДРУГИМ юзером между шагом 2 и этим)
   c. addPurchasedTokens(user.id, promo.type, promo.amount, tx)   // прибавляет к purchased_<type>
   ```
4. Обработка исключений: `P2002` → 403 "Вы уже использовали этот промокод."; `'EXHAUSTED'` → 410 "Лимит активаций исчерпан."
5. Тип промокода (`promo.type`) должен быть одним из `'chars' | 'visuals' | 'reports'` — маппится напрямую на поле `purchased_<type>` в `addPurchasedTokens` (db.ts:227-242). Валидация допустимости `type` на уровне схемы/API **не найдена** — если админ создаст промокод с произвольной строкой в `type`, `addPurchasedTokens` попытается обновить несуществующее поле `purchased_<произвольная_строка>` и, скорее всего, упадёт в рантайме Prisma. Требует уточнения у владельца (создание промокода — `createPromoCode` в `src/app/[locale]/dashboard/actions.ts:25-30` — принимает `type: string` без enum-проверки).
6. После успешной активации генерируется чек (`generateAndStoreReceipt`, тип `'promo_code'`) — фоново, не блокирует ответ.
7. Идемпотентность: гарантируется составным уникальным индексом `@@unique([promo_id, user_id])` на `PromoUsage` — повторная активация того же промокода тем же пользователем гарантированно упадёт на `P2002` и явно обрабатывается.

---

## 4. Биллинг

### 4.1 Провайдеры

- **CryptoCloud** (крипта, USD) — единственный активный провайдер. Ключи: `CRYPTOCLOUD_API_KEY`, `CRYPTOCLOUD_SHOP_ID`, `CRYPTOCLOUD_SECRET` (последний — только для проверки подписи вебхука).
- ~~**Kaspi Pay** (KZT)~~ — интеграция была подготовлена (флаг `currency === 'kzt'` при чекауте, отдельный вебхук, каталог цен в KZT), но никогда не была подключена в CI (см. `docs/config_and_env.md`) и **удалена целиком 2026-09-03**, подтверждено владельцем: заброшена, платежи через неё не принимаются и не планируются. Весь код (`kaspi-webhook/route.ts`, `createKaspiPayment()`, `PLANS_KZT` в `checkout/route.ts`) удалён; так как Kaspi и раньше не был сконфигурирован в проде, наблюдаемое поведение чекаута не изменилось — все валюты идут через CryptoCloud.
- Если CryptoCloud не настроен — фолбэк на статичную POS-ссылку терминала (`POS_FALLBACK = 'https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH'`, хардкод в `checkout/route.ts`), пользователю рекомендуют оплатить руками через терминал и написать в поддержку/дождаться промокода.

**Не удалено, отдельный вопрос владельцу**: `src/app/[locale]/billings/page.tsx` и `PricingCard.tsx` всё ещё показывают переключатель валют с `kzt`/«via Kaspi» (и `kzt` — значение по умолчанию), хотя оплата в KZT через Kaspi фактически никогда не проводилась. Это фронтенд/UX-код, не тронут в рамках удаления бэкенда.

### 4.2 Каталог планов и пакетов

Цены в USD (`src/app/api/billing/checkout/route.ts`, PLANS):

| id | USD | Тип |
|---|---|---|
| plus_month | $3.99 | подписка |
| plus_year | $39.00 | подписка |
| pro_month | $7.99 | подписка |
| pro_year | $79.00 | подписка |
| ultra_month | $14.99 | подписка |
| ultra_year | $149.00 | подписка |
| data_scientist | $25.00 | пакет: 2M chars + 50 visuals (веб) |
| researcher | $60.00 | пакет: 5M chars + 150 visuals (веб) |

Внутри бота (`src/app/api/internal/bot/billing/route.ts:19-26`, отдельный каталог `PACKAGES`, **другие цены и состав**, чем в веб-виджете для тех же id `data_scientist`/`researcher` — $5/$12 против $25/$60 в `checkout/route.ts`; расхождение каталогов бот/веб, см. §10):

| id | USD | chars | reports |
|---|---|---|---|
| starter_chars | $1 | 100 000 | 0 |
| writer | $3 | 500 000 | 0 |
| data_scientist | $5 | 2 000 000 | 0 |
| researcher | $12 | 5 000 000 | 0 |
| report_single | $2 | 0 | 3 |
| report_bulk | $8 | 0 | 15 |
| combo_lite | $7 | 1 000 000 | 5 |
| combo_pro | $20 | 10 000 000 | 30 |

(Заметьте: пакеты `reports`-типа фактически не расходуются нигде в конвейере генерации — см. §2.8.)

### 4.3 Идемпотентность (ключевая защита от двойного начисления)

Модель `ProcessedPayment { order_id String @id }` (prisma/schema.prisma:173-176).

Гарантия: `order_id` — **primary key**, поэтому `tx.processedPayment.create({ data: { order_id } })` физически не может выполниться дважды для одного и того же `order_id` — вторая попытка получает ошибку Prisma `P2002` (unique constraint violation). Это единственная защита от повторной обработки одного и того же платежа:

```js
// webhook/route.ts:98-119 (тот же паттерн — в [locale]/callback/route.ts, Фаза 1)
await prisma.$transaction(async (tx) => {
    await tx.processedPayment.create({ data: { order_id: orderId } });   // атомарный "замок"
    if (plan.tier) await upgradeSubscriptionPlan(userId, packId, tx);
    else { /* addPurchasedTokens по chars/visuals/reports */ }
});
// catch (P2002) → просто отвечаем 200 "Already processed", ничего не начисляем повторно
```

Кроме того, ДО входа в транзакцию оба вебхука делают ранний non-atomic check `isPaymentProcessed(orderId)` (db.ts:271-274, обычный `findUnique`) — оптимизация, чтобы не гонять транзакцию зря; но окончательная защита от гонки — именно уникальный ключ `order_id` в самой транзакции (комментарий в коде явно это подтверждает: "ATOMICALLY... If it already exists, it will throw a P2002 error").

### 4.4 Проверка подписи вебхука

**CryptoCloud** (`src/app/api/billing/webhook/route.ts:53-67`):
```
hashString   = `${status}${orderId}${amount_crypto||''}${currency_crypto||''}${CRYPTOCLOUD_SECRET}`
expectedSign = MD5(hashString)
```
Сравнение — простое `!==` (не constant-time сравнение — потенциальная тайминг-атака, теоретическая, т.к. MD5 всё равно легко подделать при компрометации секрета). Если `CRYPTOCLOUD_SECRET` не задан в env — вебхук **полностью отключается** (500, "billing webhook disabled for safety") — явная защита от "тихого" приёма неподписанных вебхуков. Если подпись отсутствует или не совпадает → 403. Тот же паттерн (с Фазы 1) используется в `[locale]/callback/route.ts` — втором вебхуке CryptoCloud, который раньше не проверял подпись.

### 4.5 Обработка успеха/неуспеха

- Вебхук реагирует только на `status === 'success' | 'paid'`. Любой другой статус → ранний `200 OK` без побочных эффектов (провайдер не должен ретраить).
- `order_id` парсится строкой: `UID_{userId}_PACK_{packId}_TS_{timestamp}` — извлечение через `indexOf("PACK_")`/`indexOf("_TS_")`, а не структурированный формат (JSON/подписанный токен). Если `packId` не найден в каталоге `PLANS` — 400 "Bad package data", платёж НЕ считается обработанным (`ProcessedPayment` ещё не создан на этом этапе — создаётся только внутри транзакции ПОСЛЕ валидации `plan`), т.е. деньги провайдер получил, но начисление не произошло и повторный (исправленный) вебхук всё ещё может быть обработан. Требует уточнения у владельца — что происходит, если провайдер один раз прислал вебхук с плохим `order_id`.
- Успех: `upgradeSubscriptionPlan` (для подписок, тариф + сброс `monthly_chars_used=0`) либо `addPurchasedTokens` по каждому не-нулевому полю пакета (`chars`/`visuals`/`reports`), генерация чека (`generateAndStoreReceipt`, см. §4.6) и Telegram-уведомление со ссылкой на PDF-чек — оба фоново (`.catch(console.error)`, не блокируют ответ 200 провайдеру).

### 4.6 Чек (Receipt)

Модель `Receipt { id, user_id, type, pack_name, amount_text, pdf_base64?, created_at }`.

Генерация (`src/lib/receiptGenerator.ts`):
1. Сначала создаётся строка в БД **без** `pdf_base64` (`upsert`) — чтобы `GET /api/billing/receipt/[id]` сразу мог ответить "чек генерируется..." вместо 404.
2. Читается LaTeX-шаблон `src/lib/templates/receipt.tex`, плейсхолдеры `{{...}}` заменяются (сумма в 3 валютах, дата, "хэш" и "подпись").
3. **"Криптографическая" подпись чека — декоративная**: `sha512Hash` считается от строки `${id}:${userId}:${amountText}:${dateISO}:SECRET` — буквально литерал `"SECRET"`, а не секрет из env (`receiptGenerator.ts:71`, комментарий в коде сам называет это "Pseudo RSA signature logic for display"). Она не защищает от подделки — как заявлено в UI чека ("Digital Attestation") и на странице верификации (`.../receipt/[id]/verify`), но фактически не проверяется нигде обратно — `verify/route.ts` просто **рендерит** переданные в query `hash`/`sig` как есть (`url.searchParams.get('hash')`), не пересчитывая и не сверяя их с сохранёнными значениями. Т.е. `verify`-страница не верифицирует ничего криптографически — она просто подтверждает существование записи `Receipt` с данным `id` в БД. Это заявленный "инвариант", который явно **не защищён кодом** — см. §10.
4. ZIP с `main.tex` отправляется в LaTeX-compiler-сервис (`LATEX_COMPILER_URL`), результат (PDF) сохраняется как `pdf_base64` в ту же строку Receipt.
5. Раздача (`src/app/api/billing/receipt/[id]/route.ts`): если `pdf_base64` пуст, но запись существует → HTTP 202 c авто-рефрешем через 5 сек; если записи вовсе нет → 404. Есть защитный код на случай, если компилятор вернул ZIP вместо PDF (magic-байты `PK`) — распаковывает и ищет `.pdf` внутри; если итоговые байты не начинаются с `%PDF` — считается, что это залогированная ошибка LaTeX-компиляции, и она отдаётся пользователю как читаемый текст вместо "битого" PDF.

---

## 5. Конвейер генерации отчёта (Agent pipeline)

Оркестратор: `src/lib/agent/pipeline/index.ts::runPipeline`. Вызывается из `src/app/api/agent/generate/route.ts` в режиме fire-and-forget (ответ клиенту уходит сразу с `sessionId`, фактическая генерация идёт в фоне процесса Node, прогресс пишется в `AgentSession.stage_json`, клиент опрашивает).

LLM: единая обёртка `src/lib/agent/pipeline/llm.ts`, модель **`gpt-5-mini-2025-08-07`** (жёстко задана константой `MODEL`, llm.ts:7), эндпоинт `https://api.openai.com/v1/chat/completions`. Таймаут по умолчанию 90 сек (переопределяется по стадиям). Картинки в промпте тарифицируются вручную плоской ставкой **800 токенов/изображение** (`IMAGE_TOKEN_COST`), добавляется к `usage.prompt_tokens`, возвращаемому OpenAI — то есть биллинг за vision-контент не равен фактическому биллингу OpenAI, а завышен эвристикой продукта. Есть `chatCompletionLong()` — автопродолжение при `finish_reason === 'length'`, максимум 3 итерации (1 начальная + 2 продолжения), даёт модели "хвост" в 1500 символов предыдущего вывода для бесшовной склейки.

### 5.1 Схема стадий (state machine)

```
[created: status='generating']
        │
        ▼
 Stage 1: Plan            (LLM, 1 вызов, JSON mode)
        │  успех → structured outline (title, sections[], visuals[])
        │  ошибка после 2 retry → детерминированный fallback-план (не роняет пайплайн)
        ▼
 Stage 2: Extract          (LLM, N параллельных вызовов, concurrency=4)
        │  пропускается если useReferences=false или нет загрузок
        │  каждый файл независим (Promise.allSettled-семантика через concurrentMap) —
        │  один сбойный PDF не валит остальные, помечается status:'failed'
        ▼
 [если useReferences && есть хотя бы 1 успешный ref] ──┐
        │                                              │
        ▼                                              │ (иначе шаг пропускается)
 Stage 2.7: DOI Enrichment (CrossRef API, без LLM)      │
        │  обогащает bib-метаданные только там, где есть DOI
        ▼                                              │
 Stage 2.5: Verify         (LLM, concurrency=3)         │
        │  "тест на понимание": модель отвечает на 5    │
        │  контрольных вопросов по документу,           │
        │  verified = avgConfidence>=7 && summary>=100 chars && topics>=3
        ◄───────────────────────────────────────────────┘
        ▼
 [если есть dataUploadIds] Stage 2.6: R/Python Data Figures
        │  a. извлечение схемы (колонки/строки) без LLM
        │  b. планирование графиков (LLM, 1 вызов, max 4 фигуры)
        │  c. по каждой фигуре: генерация кода (LLM) → компиляция в R/Python-сервисе
        │     retry до 2 попыток с обратной связью по логу ошибки компиляции
        ▼
 [если plan.visuals.length > 0] Stage 2.3: Visual Generation (TikZ)
        │  LLM генерирует TikZ, concurrency=2, до 3 попыток на визуал
        │  каждая попытка ВАЛИДИРУЕТСЯ реальной компиляцией в LaTeX-compiler
        │  (PDF после проверки синтаксиса отбрасывается — используется только код)
        │  неудача после 3 попыток → GeneratedVisual.failed=true (не блокирует пайплайн)
        ▼
 Stage 3: Draft            (LLM, последовательно по секциям, chatCompletionLong)
        │  каждая секция видит: outline, ref-bundle (полный текст всех релевантных
        │  загрузок без обрезки!), "хвост" предыдущей секции (1500 симв.),
        │  список доступных фигур для ЭТОЙ секции (по названию файла/label)
        ▼
 Stage 4: Assemble         (чистая функция, БЕЗ LLM)
        │  собирает preamble+titlepage+секции+bib, инъекция TikZ вместо
        │  \includegraphics, UTF-8/кириллица нормализация, сшивка \ref{}↔\label{}
        │  (fuzzy-match по longest common substring для "почти совпадающих" меток),
        │  добавление bib-заглушек для нерезолвленных \cite{}
        ▼
 Stage 5: Validate         (LATEX_COMPILER_URL, + LLM-ремонт при ошибке)
        │  compile → если fail: LLM получает лог ошибки + текущий main.tex,
        │  возвращает "исправленный" файл целиком (не diff) → повторная компиляция
        │  до MAX_REPAIR_ATTEMPTS=2 циклов ремонта (итого до 3 попыток компиляции)
        │  сетевой сбой компилятора (не ошибка LaTeX) → сразу break, ремонт не пытается
        ▼
[status = 'done' (если скомпилировалось) | 'needs_attention' (если нет)]
        │
        ▼ (в route.ts после runPipeline)
  billing: totalTokens*3 списывается как 'chars' одним вызовом checkAndDeductUsage
  Telegram: редактируется исходное сообщение "Начало генерации" на финальный статус
```

Ошибка на любой стадии внутри `runBackground()` (`generate/route.ts:79-92`) ловится общим `catch`:
```
AgentSession.status = 'error'
AgentSession.error_msg = err.message (обрезано до 500 символов)
```
и, если было отправлено Telegram-сообщение о старте, оно редактируется на "❌ Ошибка генерации".

Отдельный "лёгкий" путь — `handleLegacyEdit()` (generate/route.ts:190-247): используется, когда пользователь просит точечно поправить уже собранный документ (`body.currentTex`) или исправить ошибку компиляции (`body.errorLog`) — вместо полного 5-стадийного пайплайна делается один LLM-вызов "исправь/примени изменения и верни файлы целиком", статус переключается `generating → done | error` напрямую.

### 5.2 Что теряется/сохраняется между стадиями (`RunPipelineOutput`)

`plan`, `refs` (обогащённые), `verifications`, `generatedVisuals`, `dataFigures`, `sections`, `assembled` (mainTex/bib до валидации), финальные `mainTex`/`referencesBib` (после ремонта), `compiled: boolean`, `repairAttempts: number`, `totalTokens: number`. В БД (`AgentSession`) сохраняются только `main_tex`, `references_bib`, `stage_json` (прогресс), `status`, `error_msg` — промежуточные объекты (`plan`, `refs`, `verifications`) **не персистятся** отдельно, только через `stage_json.logs`/`files` (сокращённая сводка для UI).

---

## 6. Конвейер аналитики/графиков (Analytics pipeline)

Оркестратор: `src/lib/analytics/pipeline/index.ts::runAnalyticsPipeline`. Используется независимо от agent-pipeline (например, из `src/app/api/agent/analytics/generate/route.ts`), это отдельная, более простая 3-стадийная машина без ремонта LaTeX (здесь просто изображения графиков, не LaTeX-документ).

```
Stage 1: Verify Data
    │  ВАЖНО: несмотря на наличие полностью готового system-промпта для
    │  AI-верификации данных (buildSystemPrompt() в stage1_verify_data.ts),
    │  реально вызывается simpleVerify() — эвристика БЕЗ обращения к LLM
    │  (0 токенов, tokensUsed всегда 0): проверяется только расширение файла
    │  (csv/xlsx/xls/json/tsv/txt) и извлекаются колонки/rowCount парсингом
    │  первой строки. Файл с "правильным" расширением ВСЕГДА verified=true,
    │  даже если данные внутри мусорные. LLM-промпт на верификацию данных
    │  — мёртвый код в этой сборке (buildSystemPrompt/buildUserContent/
    │  validateVerification определены, но не вызываются из runStage1).
    │  Если ни один файл не прошёл даже эту слабую проверку → throw
    │  ("No usable data found..."), пайплайн падает целиком на старте.
    ▼
Stage 2: Plan Charts       (LLM, 1 вызов, JSON mode)
    │  на вход — ТОЛЬКО метаданные (имена колонок/rowCount/summary),
    │  сырой text_content НЕ отправляется ("CRITICAL: Don't use text_content")
    │  план: 2–5 графиков, приоритет 1–5, сортировка по приоритету, top-5
    │  если план пуст → throw ("Chart planning failed")
    ▼
Stage 3: Generate Charts   (LLM на каждый график, ПОСЛЕДОВАТЕЛЬНО, без concurrency)
    │  для каждого плана: генерация кода (R или Python) →
    │  эвристическая проверка "не выдумал ли LLM синтетические данные"
    │  (regex на np.random/rnorm/runif/sample/range(N)/seq(N) — только
    │  warning в лог, НЕ блокирует компиляцию и не ретраит) →
    │  POST на компилятор /compile → при ошибке график просто
    │  пропускается (continue), пайплайн НЕ ретраит эту стадию
    │  (в отличие от agent-pipeline'овского Stage 2.6, где 2 попытки есть)
    │  если ни один график не скомпилировался → throw в конце функции
    ▼
[status: 'done' (charts.length===plans.length) |
         'partial' (0 < charts.length < plans.length) |
         'failed' (charts.length===0, но эта ветка на практике не достижима,
         т.к. runStage3 сам бросает исключение при charts.length===0 раньше)]
```

Прогресс пишется в тот же формат `StageProgress` (`stage_json`), что и agent-pipeline (общий `src/lib/agent/stages.ts`), но с `total_stages: 3`.

Биллинг: `checkAndDeductUsage(userId, 'chars', totalTokens*3)` + `checkAndDeductUsage(userId, 'visuals', charts.length)` (`src/app/api/agent/analytics/generate/route.ts:68-69`) — второй вызов, как показано в §2.7, **никогда не может провалиться и ничего реально не лимитирует**.

---

## 7. Space (совместный LaTeX-редактор)

Источник: `src/lib/space-db.ts` + роуты `src/app/api/space/[id]/**`.

### 7.1 Сущности

- `Space` — проект (title, compiler: `pdflatex|xelatex|lualatex`, main_file, auto_compile, share_id/is_public).
- `SpaceFile` — файл проекта, текстовый (`content`) либо бинарный (`content_b64`, `is_binary=true`); уникальность `@@unique([space_id, path])`.
- `SpaceVersion` — снапшот всех файлов проекта на момент создания (JSON-строка `{path: content}}`, бинарные файлы кодируются как `__b64__:<mime>:<base64>`).
- `SpaceCollaborator` — участник, `role ∈ {owner, editor, viewer}`, `@@unique([space_id, user_id])`.
- `SpaceInvite` — одноразовая ссылка-приглашение, `token` (UUID), `expires_at` = дата создания + **7 дней** (жёстко задано в `createSpaceInvite`, space-db.ts:566-567).

### 7.2 Создание

`createSpace()` — создаёт `Space`, засеивает файлы одним из 4 стартовых шаблонов (`blank`, `research`, `thesis`, `beamer` — тексты полностью зашиты в `STARTER_TEMPLATES`), и **сразу добавляет владельца как `SpaceCollaborator` с ролью `owner`** (`accepted_at = now()`). Т.е. права доступа владельца физически хранятся в той же таблице, что и права соавторов, а не выводятся исключительно из `Space.owner_id`.

### 7.3 Матрица прав (по факту проверок в API-роутах)

| Действие | Кто может | Где проверяется |
|---|---|---|
| Просмотр файлов/коллабораторов/версий | owner, editor, viewer (любая роль ≠ null) | `getUserRoleInSpace(...) !== null` |
| Создание/изменение/удаление файла, импорт ZIP, восстановление версии, AI-fix/AI-edit | owner, editor (`role !== 'viewer'`) | `files/route.ts:38`, аналогично в других files/*-роутах |
| Изменение настроек Space (`PATCH /api/space/[id]`) | **только** owner | `route.ts:25` |
| Удаление Space | только `owner_id` (проверка в `deleteSpace`, фильтр `WHERE id AND owner_id=userId`, а не через роль) | `space-db.ts:318-322` |
| Приглашение нового участника | только owner | `invite/route.ts:16` |
| Удаление участника | owner может удалить любого, КРОМЕ себя (сначала нужно передать владение — но эндпоинта "передать владение" в прочитанном коде не найдено, требует уточнения); не-owner может удалить только себя ("выйти") | `collaborators/[uid]/route.ts:20-26` |
| Компиляция (`POST /compile`) | owner, editor, viewer (только `role !== null`, роль **не проверяется на `!== 'viewer'`**) | `compile/route.ts:26-27` — т.е. viewer может компилировать проект, хотя не может редактировать файлы |

### 7.4 Публикация / шаринг

`enableSpaceSharing()` — генерирует `share_id` (12 hex-символов из UUID) и ставит `is_public=true`; доступ по прямой ссылке — `getSpaceByShareId()` ищет **только** записи с `is_public=true` (простая раздача "только на чтение" публике, без входа — используется, вероятно, для read-only предпросмотра, конкретный роут, отдающий его наружу, не входил в explicit-список файлов задания и не проверялся построчно).

Приглашения (`SpaceInvite`) — принимаются через `acceptSpaceInvite(token, userId)`, атомарно: `upsert SpaceCollaborator` (роль из инвайта) + `delete SpaceInvite` в одной `$transaction`. Просроченные (`expires_at < now()`) инвайты не находятся `getSpaceInviteByToken` (WHERE-фильтр `expires_at: {gt: now()}`) — токен де-факто перестаёт существовать после истечения, хотя запись в БД физически остаётся (нет крон-очистки — не найдено).

### 7.5 Компиляция как состояние

В отличие от `AgentSession` (у которого есть персистентный `status`), у `Space`/компиляции **нет персистентного статуса в БД** — `POST /api/space/[id]/compile` синхронный HTTP-запрос: собирает ZIP из текущих файлов → шлёт в LaTeX-compiler → возвращает PDF или лог ошибки напрямую в ответе. "Состояние компиляции" существует только на длительность одного HTTP-запроса (таймаут 110 сек, `maxDuration=120`), в БД ничего не пишется ни о попытке, ни о результате.

---

## 8. R-сессии и цитаты

### 8.1 RSession (`src/lib/r-db.ts`, модель `RSession`)

Состояния (`status: string`, свободная строка, не enum на уровне Prisma):
```
create → status='generating' (createRSession, r-db.ts:38-46)
       → ... (обновления results_json по ходу генерации отдельных графиков —
              логика самого перебора графиков живёт в src/app/api/r/generate/route.ts,
              не входившем в список обязательного построчного чтения; там же
              видны промежуточные статусы отдельных ЭЛЕМЕНТОВ results_json:
              'pending' → 'generating' → 'done' | 'error')
       → status='done' | 'error'   (финальный статус сессии в целом)
```
`results_json` — JSON-массив `RResultItem[]` (`chartType, name, image (base64), code, status, error?`), не отдельные строки в БД — то есть прогресс по отдельным графикам одной R-сессии не имеет собственной модели/индекса, только сериализованный блоб, перезаписываемый целиком на каждое обновление.

`getRSessionsByUser()` считает `chart_count`/`chart_types` на лету, парся `results_json` и фильтруя элементы со `status === 'done'`.

Доступ — только владелец (`user_id` в WHERE каждого запроса, `getRSession`, `deleteRSession`) — нет коллабораторов/шаринга, в отличие от Space.

### 8.2 Citations (`src/lib/citations-db.ts`)

Модели `Citation` (личная запись BibTeX + метаданные: doi/arxiv_id/isbn/title/authors[]/year/venue/abstract/url/bibtex/cite_key/tags[]/notes/starred) и `CitationCollection` (папка с `name/description/color`), связь many-to-many через `CitationCollectionItem`.

Жизненный цикл — плоский CRUD без стадий/статусов:
- `createCitation()` — при создании гарантируется **уникальность `cite_key` в рамках пользователя** через `ensureUniqueCiteKey()`: ищутся все ключи пользователя, начинающиеся с базового; если базовый занят — перебираются `base-2`, `base-3`, ... `base-999`, а если и это не помогло за 1000 попыток — `base-${Date.now()}` (гарантированно уникально по времени). Уникальность не защищена БД-констрейнтом (нет `@@unique([user_id, cite_key])` в схеме) — обеспечивается только этой прикладной логикой (см. §10, потенциальная гонка при параллельном создании двух цитат с одинаковым ключом одним пользователем).
- `updateCitation`/`deleteCitation` — все через `updateMany`/`deleteMany` с `WHERE {id, user_id}` — т.е. попытка изменить чужую цитату молча не находит строк (`count === 0`) и возвращает `null`/`false`, а не 403 — авторизация "по построению запроса", а не явной проверкой прав.
- Коллекции: `addCitationToCollection`/`removeCitationFromCollection` — перед операцией явно проверяется, что и коллекция, и цитата принадлежат вызывающему `userId` (`findFirst` с `user_id`), иначе `throw new Error('Not found')` (add) или тихий `return` (remove).
- `listCitations` поддерживает: полнотекстовый `search` (regex-injection невозможен — используется Prisma `contains`, `%` из пользовательского ввода вручную вырезается перед запросом), фильтр по `tag` (`tags: {has: tag}` — Postgres-массив), `starred`, `collectionId`, лимит по умолчанию **500** записей.

---

## 9. Аутентификация

Единственный способ входа — Telegram. Два потока:

### 9.1 Telegram Login Widget (прямой, для веба)

`src/app/api/auth/login/route.ts` + `src/lib/telegram-auth.ts`:
1. Клиент шлёт данные, подписанные виджетом Telegram (`id, first_name, last_name, username, photo_url, auth_date, hash`).
2. `verifyTelegramAuth()`:
   - строится `data-check-string` — только поля из явного allow-list (`auth_date, first_name, id, last_name, photo_url, username`), отсортированные по ключу, `key=value` через `\n`;
   - `secretKey = SHA256(BOT_TOKEN)`;
   - `hmac = HMAC-SHA256(secretKey, checkString)`, сравнивается с присланным `hash` (`===`, не constant-time);
   - дополнительно проверяется свежесть: `now - auth_date <= 86400` секунд (24 часа), иначе отказ независимо от корректности подписи.
3. При успехе — `upsertUser()` (по `telegram_id`; для существующего пользователя дополнительно снимается `is_deleted=false`, т.е. **вход "воскрешает" мягко удалённый аккаунт**), затем `createSession()`.

### 9.2 Deep-link через бота (для случаев, когда виджет недоступен/для запуска из Telegram-клиента)

Цепочка: `AuthRequest { token PK, status: 'pending'|'completed', tg_user_data? }`.

```
1. Клиент: POST /api/auth/link → создаётся AuthRequest{token: uuid, status:'pending'}
                                → попутно чистит все AuthRequest старше 10 минут (housekeeping)
                                → возвращает deepLink = https://t.me/<BOT_USERNAME>?start=<token>
2. Пользователь открывает deepLink в Telegram → бот получает /start <token>
   → бот-контейнер шлёт POST /api/internal/bot/verify с заголовком X-Bot-Secret
3. verify/route.ts:
     - секрет должен совпасть с process.env.WEBHOOK_SECRET, иначе 403
     - AuthRequest должен существовать и быть НЕ 'completed' (иначе 409 "Token already used")
     - помечает status='completed', tg_user_data=JSON(user)
     - ПОБОЧНЫЙ ЭФФЕКТ: если user.id ∈ хардкод-список SUPER_ADMINS =
       ['1153844209', '5934503762'] (verify/route.ts:43) → upsert User { is_admin: true }
       (эта единственная строка кода во всём src/, которая ЗАПИСЫВАЕТ is_admin=true;
       поле is_admin нигде далее НЕ ЧИТАЕТСЯ для авторизации — см. §10)
4. Клиент поллит GET /api/auth/poll?token=... :
     - status:'expired' если AuthRequest не найден (в т.ч. просрочен/удалён)
     - status:'pending' пока не завершено
     - status:'completed': upsertUser() + createSession() + отправка Telegram-уведомления
       о новом входе (устройство/IP/геолокация по IP через ip-api.com) + УДАЛЕНИЕ
       использованного AuthRequest (одноразовый токен)
```

### 9.3 Сессия (`src/lib/session.ts`)

- Стейтфул: при логине создаётся строка `Session {id: uuid, user_id, user_agent, ip, location}` в БД, ID сессии заворачивается в JWT (HS256, `SESSION_SECRET` из env, обязателен — при его отсутствии **процесс не стартует**: `throw` на этапе импорта модуля) и кладётся в httpOnly-cookie `perricheno_session`.
- Срок жизни — **10 лет** (`SESSION_DURATION = 3650 * 24 * 60 * 60 * 1000`, комментарий в коде: `"(immortal)"`) — и на уровне cookie (`expires`), и на уровне JWT (`setExpirationTime('3650d')`). Разлогин — только явным `deleteSession()` (удаляет и запись `Session` из БД, и cookie) либо `deleteAllOtherSessions()` (используется, видимо, кнопкой "выйти на всех устройствах", не проверялась явно в рамках задания).
- `verifySession()` — проверяет JWT-подпись **и** существование `sessionId` в БД (двойная проверка: истёкший/отозванный по БД токен не пройдёт, даже если JWT формально валиден до 2036 года) — т.е. отзыв сессии через удаление строки в БД работает мгновенно, несмотря на "вечный" JWT.
- Геолокация по IP — сторонний бесплатный `ip-api.com`, без API-ключа, `try/catch` с фолбэком `"Unknown Location"`.

### 9.4 Административный доступ — отдельный, не связанный с `is_admin`

Во всех проверенных админ-роутах (`src/app/api/admin/users/route.ts`, `src/app/[locale]/dashboard/actions.ts`) авторизация — **хардкод одного конкретного `telegram_id === '1153844209'`**, а не проверка поля `User.is_admin` (которое, как отмечено в §9.2, вообще нигде не читается). Список `SUPER_ADMINS` в `bot/verify/route.ts` (2 ID) используется только для простановки `is_admin=true`, но раз это поле не читается — установка эффекта не имеет. Это два независимых, не связанных друг с другом механизма "админства" в коде. См. §10.

---

## 10. Инварианты

Формат: **[защищён]** — в коде есть конкретная проверка/констрейнт, гарантирующая инвариант. **[НЕ защищён]** — инвариант желаем/подразумевается продуктом, но код его не гарантирует (находка для code review).

1. **[защищён]** Один и тот же платёж (`order_id`) не может быть начислен дважды — `ProcessedPayment.order_id` является `@id` (primary key) в Postgres, вторая вставка внутри той же `$transaction` падает с `P2002`, транзакция откатывается целиком (`webhook/route.ts`, `[locale]/callback/route.ts` — оба используют этот паттерн).
2. **[защищён]** Один и тот же промокод не может быть активирован дважды одним пользователем — `PromoUsage.@@unique([promo_id, user_id])`, вставка бросает `P2002`, явно перехватывается и превращается в 403 (`internal/bot/billing/route.ts:216-235`).
3. **[защищён]** Активации промокода не может быть больше `max_uses` — инкремент `uses` выполняется условным `updateMany({ where: { uses: { lt: max_uses } } })`; если `count===0` (кто-то успел исчерпать лимит параллельно) — весь `$transaction` откатывается через `throw`, включая уже вставленный `PromoUsage` (`internal/bot/billing/route.ts:220-228`).
4. **[защищён]** Символьная квота не может быть списана сверх остатка — `checkAndDeductUsage('chars', amount)` явно сравнивает `totalAvailable < amount` **до** любой записи в БД и возвращает `success:false` без побочных эффектов (db.ts:187).
5. **[НЕ защищён]** «Визуалы расходуются из лимита» — фактическая реализация типа `'visuals'` в `checkAndDeductUsage` не сверяется ни с каким лимитом и всегда возвращает `success:true, remaining:999999` (db.ts:152-171). Все вызовы вида `precheck.remaining <= 0` для визуалов (`agent/visualize/route.ts:91`, `agent/data-analytics/route.ts:351`, `agent/analytics/generate/route.ts:106`) — недостижимый код.
6. **[НЕ защищён]** «Купленные/дневные отчёты (`purchased_reports`/`daily_reports_used`) ограничивают генерацию отчётов» — реальная тарификация генерации отчёта идёт исключительно через `'chars'` (см. §2.8); поля `purchased_reports`/`daily_reports_used` пополняются (покупка/промокод/админ) и отображаются, но нигде не читаются как ограничитель и не списываются.
7. **[НЕ защищён]** «`monthly_chars_used` сбрасывается раз в календарный месяц» — в коде нет ни поля `last_month_reset`, ни какой-либо проверки текущего месяца против сохранённого. Единственное место, где `monthly_chars_used` обнуляется — `upgradeSubscriptionPlan()` (то есть только в момент покупки/продления подписки). Пользователь, который не продлевает/не покупает план повторно, копит `monthly_chars_used` бессрочно, и его "месячный" лимит фактически превращается в лимит на весь срок действия тарифа.
8. **[НЕ защищён]** «`account_tier` и `plan_tier` синхронизированы» — синхронно обновляются только через `upgradeSubscriptionPlan()` (платёжный путь). Административная смена тарифа (`set_tier` в `admin/users/route.ts:140`) обновляет только `account_tier`, оставляя `plan_tier` (реально используемый в `checkAndDeductUsage`/`PDF_STAGING_CAPS`) без изменений.
9. **[НЕ защищён]** «Уникальность `cite_key` в рамках пользователя» — обеспечивается только прикладным кодом (`ensureUniqueCiteKey`, чтение-затем-запись), а не БД-констрейнтом (в схеме нет `@@unique([user_id, cite_key])` для `Citation`); при двух параллельных запросах на создание цитаты с одинаковым базовым ключом от одного пользователя возможна гонка и дублирование ключа.
10. **[НЕ защищён]** «Реферальный бонус начисляется ровно один раз на приглашённого» и «начисление атомарно» — начисление рефереру делается как `purchased_chars: referrer.purchased_chars + bonus` (чтение значения в JS, затем запись), а не атомарный `increment`; при двух почти одновременных первых сообщениях от разных приглашённых одному рефереру возможна потеря одного из начислений (последняя запись побеждает). Также нет защиты от самореферала (`referrerId === invitee.id`) в прочитанном коде.
11. **[НЕ защищён]** «Чек (Receipt) криптографически верифицируем по `hash`/`sig`» — заявлено в UI страницы `/api/billing/receipt/[id]/verify`, но `hash`/`sig` берутся напрямую из query-параметров запроса и просто отображаются, не пересчитываются и не сверяются с тем, что было изначально сгенерировано и подписано; сама подпись при генерации использует литеральную строку `"SECRET"` вместо секрета из окружения (`receiptGenerator.ts:71`), т.е. даже пересчитай её кто-то — это не настоящий защищённый HMAC по серверному секрету на этом конкретном шаге.
12. **[защищён]** Доступ к `Space`, его файлам, версиям и настройкам ограничен ролью — каждый релевантный роут вызывает `getUserRoleInSpace()` и явно проверяет `null`/`'viewer'`/`'owner'` перед мутацией (см. таблицу §7.3). Однако **компиляция** — исключение: `role !== null` достаточно, `viewer` тоже может компилировать (не обязательно баг, но отклонение от общего правила "viewer = только чтение").
13. **[защищён]** Приглашение (`SpaceInvite`) не может быть принято после истечения — `getSpaceInviteByToken` фильтрует `expires_at: {gt: now()}` на уровне запроса, просроченный токен для `acceptSpaceInvite` неотличим от несуществующего.
14. **[НЕ защищён]** «Поле `User.is_admin` определяет административный доступ» — поле пишется (`bot/verify/route.ts:49-62`), но не читается ни в одном из проверенных мест авторизации; реальный админ-доступ завязан на хардкод `telegram_id === '1153844209'` в нескольких независимых файлах (`admin/users/route.ts:12`, `dashboard/actions.ts:21`), которые могут разойтись со списком `SUPER_ADMINS` (2 ID) из `bot/verify/route.ts:43`.
15. **[частично защищён]** Вебхуки оплаты отклоняют запросы без валидной подписи (403) и полностью отключаются, если секрет не сконфигурирован (500) — это защищает от подделки, но проверка подписи выполняется НЕ constant-time сравнением строк (`!==`), что теоретически (при прочих равных) может быть подвержено timing-атаке на сравнение хэшей.

---

## 11. Открытые вопросы к владельцу продукта

Список мест, где логика неочевидна, не документирована комментарием и не должна додумываться:

1. `getWeekNumber()` (db.ts:109-114) — вычисляет "неделю" нестандартной формулой (скользящие 7-дневные блоки от 1 января), а не ISO-8601 неделю. Это осознанный выбор или баг? Как ведёт себя на границе года?
2. Тип `PromoCode.type` — принимается как произвольная строка при создании (`dashboard/actions.ts:25`), без проверки на `'chars'|'visuals'|'reports'`. Что должно происходить при опечатке администратора?
3. Несостыковка каталогов пакетов между веб-виджетом (`checkout/route.ts`, `data_scientist`=$25/`researcher`=$60) и ботом (`internal/bot/billing/route.ts`, `data_scientist`=$5/`researcher`=$12, тот же id, другая цена и состав). Это два разных продукта под одинаковым id, или рассинхронизация?
4. Пакеты и счётчики "отчётов" (`purchased_reports`, `daily_reports_used`, пакеты `report_single`/`report_bulk`/`combo_lite`/`combo_pro`) существуют в БД/UI/боте, но не расходуются нигде в путях генерации (везде списывается только `'chars'`). Это незавершённая фича или намеренно устаревшая механика, которую предполагается тратить где-то ещё?
5. `monthly_chars_used` не имеет календарного сброса — ожидаемое ли это поведение ("месячный" лимит держится, пока не купишь/продлишь план), или отсутствует cron-джоба, которая должна была быть?
6. Кто должен использовать эндпоинт "передачи владения" Space — в `collaborators/[uid]/route.ts:22` явно сказано "Owner cannot leave; transfer ownership first", но такого эндпоинта не найдено ни в списке роутов `space/[id]/**`, ни где-либо ещё в рамках прочитанного кода.
7. `getSpaceByShareId()` фильтрует по `is_public=true`, но конкретный публичный роут, отдающий такой Space анонимному посетителю (по аналогии с `/agent/shared/[shareId]` для отчётов), не входил в обязательный список чтения для этого аудита — стоит отдельно проверить, что публичная страница действительно read-only и не даёт возможности compile/save от лица анонима.
8. Хардкоженный секрет обнаружен в `src/app/[locale]/dashboard/actions.ts:169` (API-ключ стороннего сервиса Stirling PDF в диагностической функции `checkServiceHealth`). Значение не приводится в этом документе по соображениям безопасности — требуется вынести в переменную окружения.
9. Реферальная ссылка в `telegram-bot/src/handlers/referral.ts`(через `internal/bot/referral/route.ts:24`) использует хардкод `perrichenobot`, тогда как auth-deep-link (`api/auth/link/route.ts:16`) берёт имя бота из `TELEGRAM_BOT_USERNAME`. Если имя бота когда-либо сменится, реферальные ссылки молча сломаются, пока их источник не приведут к общему знаменателю — намеренно ли это разделение?

---

## Прочитанные файлы (построчно, полностью)

- `src/lib/db.ts` (667 строк)
- `src/lib/agent/pipeline/index.ts`, `llm.ts`, `stage1_plan.ts`, `stage2_extract.ts`, `stage2_3_visuals.ts`, `stage2_5_verify.ts`, `stage2_6_r_figures.ts`, `stage2_7_enrich_doi.ts`, `stage3_draft.ts`, `stage4_assemble.ts`, `stage5_validate.ts`, `types.ts`
- `src/lib/agent/stages.ts`
- `src/lib/analytics/pipeline/index.ts`, `stage1_verify_data.ts`, `stage2_plan_charts.ts`, `stage3_generate.ts`, `types.ts`
- `src/app/api/billing/checkout/route.ts`, `webhook/route.ts`, `receipt/[id]/route.ts`, `receipt/[id]/verify/route.ts`
- `src/lib/receiptGenerator.ts`
- `src/lib/space-db.ts`, `src/lib/r-db.ts`, `src/lib/citations-db.ts`
- `src/lib/telegram-auth.ts`, `src/lib/session.ts`
- `telegram-bot/src/handlers/billing.ts`, `referral.ts`, `tasks.ts`
- `prisma/schema.prisma`
- Дополнительно (для проверки утверждений выше и связывания фактов): `src/app/api/auth/login/route.ts`, `poll/route.ts`, `link/route.ts`, `src/app/api/internal/bot/verify/route.ts`, `billing/route.ts`, `referral/route.ts`, `referral/apply/route.ts`, `tasks/route.ts`, `src/app/api/agent/generate/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/[locale]/dashboard/actions.ts`, `src/app/api/space/[id]/route.ts`, `files/route.ts`, `invite/route.ts`, `collaborators/route.ts`, `collaborators/[uid]/route.ts`, `compile/route.ts`.
