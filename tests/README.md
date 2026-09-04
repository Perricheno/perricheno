# tests/

## Что тут лежит

Vitest-тесты на деньги/авторизацию/необратимые операции — то, что REVIEW.md
(находка о нулевом покрытии тестами) и IMPROVEMENT_PLAN.md называли главной
причиной, по которой баг вроде находки №1 (дублирующий вебхук с отключённой
проверкой подписи) мог остаться незамеченным.

Никаких моков БД — каждый тест бьёт в настоящий Postgres (см. "Как запустить
локально" ниже) точно так же, как проверялся каждый фикс в Фазах 1-2 этого
аудита. `session.test.ts` — единственное исключение: `next/headers`
замоканы (`vi.mock`) простым in-memory хранилищем кук, потому что
`cookies()`/`headers()` физически не работают вне реального Next.js
request-lifecycle — это стандартный способ юнит-тестировать server-only
утилиты App Router, а не отход от принципа "не мокать".

## Файлы

| Файл | Что проверяет |
|---|---|
| `setup.ts` | Vitest setupFile — падает с понятной ошибкой, если `DATABASE_URL` не задан; подставляет тестовые значения для остальных секретов, если они не заданы. |
| `helpers.ts` | `createTestUser()` (уникальный `telegram_id` на каждый вызов, тесты никогда не пересекаются), `createTestSession()`, `uniqueOrderId()`. |
| `billing-webhook.test.ts` | `/api/billing/webhook` (CryptoCloud): подпись отсутствует/неверна → 403; валидный платёж → зачисление один раз; повтор того же вебхука → не зачисляет дважды; неизвестный `status` → без побочных эффектов; неизвестный `packId` → 400; подписка (`upgradeSubscriptionPlan`) начисляется отдельной веткой от разовых пакетов. |
| `callback-webhook.test.ts` | То же самое для `src/app/[locale]/callback/route.ts` — второго вебхука CryptoCloud, который до Фазы 1 (REVIEW.md #1) не проверял подпись и не имел идемпотентности. Отдельный тест на пакет с подчёркиванием в имени (`data_scientist`) — регрессия на баг парсинга `split('_')[3]`. |
| `promo-codes.test.ts` | `internal/bot/billing` (`action=promo`): успешное применение; повторное применение тем же пользователем → 403 без двойного начисления; исчерпание `max_uses` между разными пользователями → 410, `uses` не растёт на неудачной попытке; неизвестный/деактивированный код; запрос без `x-bot-secret`. |
| `quota-limits.test.ts` | `addPurchasedTokens`/`checkAndDeductUsage` напрямую: `amount=0`, обычное списание/начисление, списание сначала из бесплatной квоты потом из купленной, отказ без частичного списания при нехватке обоих. Плюс два теста **[KNOWN GAP]** — см. ниже. |
| `telegram-auth.test.ts` | `verifyTelegramAuth()`: валидная/испорченная/чужим токеном подписанная/просроченная (>24ч)/пустая. |
| `session.test.ts` | `createSession`/`verifySession`/`deleteSession`: нет куки, подпись чужим секретом, отозванная в БД сессия, просроченный JWT, полный цикл создание→проверка→удаление. |
| `tier-consistency.test.ts` | Регрессия на `docs/REVIEW.md` #20 (удаление `account_tier`): админский `set_tier` (`admin/users/route.ts`) реально меняет `plan_tier`, и `internal/bot/billing` (`action=status`) отображает тариф по тому же `plan_tier` — обе точки согласованы с полем, которое реально читает `checkAndDeductUsage`. |

## [KNOWN GAP] — новые находки, обнаруженные при написании тестов

`quota-limits.test.ts` содержит 2 теста, помеченных `[KNOWN GAP]`, которые
**проходят**, потому что документируют реальное текущее поведение, а не
то, каким оно должно быть:

1. `addPurchasedTokens(userId, type, amount)` не проверяет знак `amount` —
   отрицательное значение молча уменьшает баланс, причём без записи в
   таблицу `Transaction` (там гвард `if (amount > 0)` только на запись в
   леджер, не на само изменение баланса).
2. `checkAndDeductUsage(userId, type, amount)` при отрицательном `amount`
   не отклоняет запрос, а **возвращает квоту** (списание с обратным знаком).

На сегодня ни один известный вызывающий код не передаёт отрицательные
значения (везде — константы из захардкоженных каталогов пакетов), поэтому
эксплуатация не подтверждена — но структурной защиты от этого нет. Внесено
как новая находка в `docs/REVIEW.md`, не исправлено в рамках Фазы 3
(задача фазы — тесты, не фиксы), решение остаётся за владельцем.

## Как запустить локально

Нужен реальный (одноразовый) Postgres:

```bash
docker run -d --name perricheno-test-pg -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 5432:5432 postgres:16-alpine

export DATABASE_URL="postgresql://test:test@localhost:5432/test?schema=public"
npx prisma db push
npm test
```

`npm test` = `prisma generate && vitest run` (см. `package.json`).

## CI

`.github/workflows/deploy.yml`, job `test` — поднимает `postgres:16-alpine`
как service-контейнер GitHub Actions, гоняет `npx prisma db push` и
`npm run test`. Джоба `deploy` требует зелёных `typecheck` **и** `test`
(`needs: [typecheck, test]`) — падение тестов теперь блокирует деплой на
прод, это не косметика.
