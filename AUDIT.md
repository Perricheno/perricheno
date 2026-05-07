# Аудит проекта perricheno-site

Дата: 2026-05-04 | Stack: Next.js 16 + Prisma 7 + PostgreSQL + MinIO + Docker Compose

---

## 🔴 Критические (SECURITY)

### 1. Хардкод токена Telegram бота
> [!CAUTION]
> Токен бота **захардкожен прямо в исходный код** и закоммичен в Git-историю.
> Файл: `src/lib/telegram-auth.ts:3`

```typescript
const BOT_TOKEN = "8270333686:AAEaQLlEmewJeVQ2FSZXDHrOFx_0eN4JQfI";
```
**Последствия**: Любой, кто имеет доступ к репозиторию, может перехватить управление ботом.
**Исправление**: Перенести в `process.env.TELEGRAM_BOT_TOKEN`. Отозвать токен через @BotFather.

---

### 2. Хардкод учётных данных PostgreSQL и MinIO
> [!CAUTION]
> Пароли БД и S3-хранилища захардкожены в `docker-compose.yml`.

```yaml
POSTGRES_PASSWORD=perricheno_pass
MINIO_ROOT_PASSWORD=perricheno_minio_pass
```
**Исправление**: Вынести в `.env`. Использовать переменные `${VAR_NAME}` в compose.

---

### 3. Fallback-ключ JWT сессии
> [!WARNING]
> Если `SESSION_SECRET` не задан - используется предсказуемый фоллбэк в `src/lib/session.ts`.
**Исправление**: Бросать ошибку при старте, если секрет не задан.

---

### 4. Незащищённые API-маршруты
> [!WARNING]
> Ряд критичных API-эндпоинтов (billing webhook, telegram send, canvas generate) не проверяют авторизацию.
**Исправление**: Добавить middleware или проверку сессии/ключа в каждый обработчик.

---

### 5. MinIO-порты доступны снаружи
> [!WARNING]
> Консоль и API MinIO открыты на портах 9000/9001.
**Исправление**: Убрать проброс портов в `docker-compose.yml`, оставить только внутреннюю сеть.

---

## 🟠 Архитектурные проблемы

### 6. God-файл `db.ts`
623 строки, смешивает CRUD, Telegram API вызовы и фоновый планировщик.
**Исправление**: Разбить на `db/`, `services/` и `jobs/`.

### 7. Планировщик через `setInterval` в модуле БД
Ненадёжно в среде Next.js (Side-effects при импорте).
**Исправление**: Использовать `instrumentation.ts` или внешние воркеры.

---

## 🟡 DevOps & Docker

### 8. `prisma db push --accept-data-loss` в production
> [!CAUTION]
> Опасная команда в `deploy.sh`. Может привести к потере данных.
**Исправление**: Перейти на `prisma migrate deploy`.

### 9. Плохой `.dockerignore`
В образ попадают 17MB SQLite баз данных, PDF и логи.
**Исправление**: Добавить `*.db`, `*.log`, `node_modules` и временные файлы.

---

## 🔵 Мусор в репозитории

### 10. Tracked binary/temp файлы (~20MB)
`perricheno_real.db` (17MB), `r.pdf` (3MB), логи ошибок и временные скрипты закоммичены в git.
**Исправление**: Удалить файлы, добавить расширения в `.gitignore`.

---

## ⚪ Качество кода

- **76 silent catch** блоков (ошибки глотаются без логирования).
- Массовое использование **`any`** в слое БД.
- Гигантские UI компоненты (HomePage - 769 строк).
- `userScalable: false` в layout (проблемы доступности).
