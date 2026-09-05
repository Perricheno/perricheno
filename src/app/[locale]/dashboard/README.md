# src/app/[locale]/dashboard/

## Что тут лежит

**Не личный кабинет пользователя** — это скрытая суперадмин-панель ("Project Overseer"), выглядящая как отдельное mission control приложение (полноэкранный оверлей `fixed inset-0 z-[100]`, свой топбар с версией "v2.1.0"). Доступна по `/dashboard`, но не рекламируется в навигации и не рассчитана на обычных пользователей.

## Зачем существует

Единая точка операционного управления проектом для владельца: общая статистика (пользователи, сожжённые токены, покупки), список пользователей и точечная выдача/заморозка ресурсов, управление промокодами, системный конфиг (`SystemConfig` в Prisma) и live-диагностика внешних сервисов ("Service Health"). Вкладки (`OverseerClient.tsx`): **Overview**, **Users & Economy**, **Promo & Referrals**, **Telemetry (Logs)**, **System Config**, **Service Health**.

## Ключевые файлы

| Файл | Что делает |
|---|---|
| `page.tsx` | Server-компонент: проверяет сессию и **хардкодом** `user.telegram_id === '1153844209'` — иначе `notFound()`. Тут же одним махом собирает начальные данные для всех вкладок (агрегаты `prisma.usageLog`/`prisma.transaction`, до 100 последних пользователей, все промокоды, весь `SystemConfig`) и передаёт их в клиентский компонент как пропсы. |
| `OverseerClient.tsx` (474 строки) | Весь UI панели: переключение вкладок, таблица пользователей с точечными действиями, управление промокодами, отправка прямых сообщений пользователю в Telegram, кнопки диагностики сервисов. |
| `actions.ts` | Server actions админ-панели: `generateSecurePromoCode`, `createPromoCode`, `setSystemConfig`, `manageUserTokens` (выдача символов/отчётов, заморозка), `sendDirectMessage` (пуш в Telegram-бота через внутренний HTTP), `checkServiceHealth` (пингует OpenAI/LaTeX/Python/R/курсы валют/БД/Stirling PDF и возвращает лог). Каждая функция, кроме `generateSecurePromoCode`/`checkServiceHealth`'s внутренних веток, начинается с `verifyAdmin()` — той же проверки `telegram_id === '1153844209'`. |

## Известные ограничения

- Авторизация всей панели — хардкод одного `telegram_id` в двух независимых местах (`page.tsx`, `actions.ts`), а не проверка поля `User.is_admin` (которое пишется в другом месте кода, но нигде не читается) — уже разобрано в [`docs/business_logic.md`](../../../../docs/business_logic.md), §9.2/§10 и [`docs/api_reference.md`](../../../../docs/api_reference.md) (раздел 10, «Admin»). В этом README не дублируется, только фиксируется как факт для этой конкретной страницы.
- **Новая находка (не была в `docs/REVIEW.md`)**: `actions.ts:169` содержит захардкоженный API-ключ Stirling PDF литералом (`checkServiceHealth`, ветка `'stirling'`) — тот же паттерн, что уже описан в `docs/REVIEW.md`, пункт 3, но для *другого* файла, не входившего в перечисленный там список (`pdf-proxy`, `extract-text`, `history/files`). Владелец уже подтвердил, что такие значения будут перевыпущены — тут просто фиксируется ещё одно место с тем же секретом.
- `page.tsx` создаёт `inferenceLatencies` через `Math.random()` — комментарий в коде прямо говорит "Simulate complex tracking data for missing components". То есть часть отображаемой в Telemetry-вкладке "метрики" — не реальные данные, а заглушка.
- `checkServiceHealth('openai')` дергает `https://api.openai.com/v1/models` — согласуется с реальным провайдером LLM всего проекта (OpenAI, модель `gpt-5.6-terra`, см. [`docs/integrations.md`](../../../../docs/integrations.md), раздел 4), не мёртвая проверка.
- Ни одного теста; сама панель — высокорисковая поверхность (прямая выдача платных ресурсов, заморозка аккаунтов), но без rate-limiting/аудит-лога действий администратора, кроме самих Prisma-записей типа `Transaction`.
