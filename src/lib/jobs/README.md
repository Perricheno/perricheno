# src/lib/jobs/

## Что тут лежит

Функции-обработчики фоновых задач очереди BullMQ — по одному файлу на поток генерации. Каждая экспортирует одну `async function`, принимающую ровно то, что было в теле BullMQ-задачи (`job.data`).

## Зачем существует

До Фазы 6a эти же функции жили прямо в `route.ts` соответствующего эндпоинта и запускались как необработанный (`fire-and-forget`) промис в процессе `perricheno-site` — рестарт/редеплой веб-контейнера убивал незавершённую генерацию без возможности восстановления. Логика самой генерации не менялась при переносе — только транспорт: раньше прямой вызов из `route.ts`, теперь диспетчеризация из `src/worker/index.ts` по имени задачи (`job.name`). Роуты теперь только валидируют запрос, создают запись сессии (`AgentSession`/`RSession`) и вызывают `getQueue().add(jobName, data)` (`@/lib/queue`).

## Как использовать

Не импортируется напрямую роутами — единственный потребитель — диспетчер `src/worker/index.ts`, который делает `switch (job.name)` и вызывает нужную функцию. Роуты общаются с очередью только через `@/lib/queue`, не зная о содержимом этих файлов.

## Ключевые файлы

| Файл | Задача (`job.name`) | Откуда перенесено |
|---|---|---|
| `reportGenerate.ts` | `report-generate`, `report-edit` | `src/app/api/agent/generate/route.ts` (`runBackground`, `handleLegacyEdit`) |
| `analyticsGenerate.ts` | `analytics-generate` | `src/app/api/agent/analytics/generate/route.ts` (`runBackground`) |
| `rMultiGenerate.ts` | `r-multi-generate` | `src/app/api/r/generate/route.ts` (`runMultiGeneration`) — общие с single-chart режимом хелперы (промпты, `callOpenAI` и т.д.) вынесены отдельно в `../r-generation.ts`, чтобы не дублировать между роутом и этим файлом |
| `botVisualGenerate.ts` | `bot-visual-generate` | `src/app/api/internal/bot/visual/generate/route.ts` (фоновый IIFE) |

## Идемпотентность — важно

BullMQ переотдаёт задачу другому воркеру, если исходный воркер упал посреди обработки (`stalled job recovery`). Каждый обработчик в начале перечитывает статус сессии (`AgentSession.status`/`RSession.status`) — если он уже не `'generating'`, значит предыдущая попытка успела завершиться до краша, и функция сразу возвращается, не повторяя LLM-вызовы/списание квоты. Это не закрывает более узкое окно (краш ровно между списанием и финальной записью статуса) — принятый, а не решённый риск, см. комментарии в каждом файле.

## Известные ограничения / технический долг

- Размер payload'а задачи для `r-multi-generate`/`bot-visual-generate` не ограничен — контекстные файлы/изображения едут через сам job data (Redis), а не через отдельную таблицу-хранилище, в отличие от `report-generate`/`analytics-generate` (которые передают только `sessionId`/`uploadIds` и перечитывают содержимое из БД внутри задачи). Приемлемо при текущих объёмах, см. комментарий в `rMultiGenerate.ts`.
