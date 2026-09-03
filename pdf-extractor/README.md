# PDF Extractor Service

Микросервис на Go (Gin) для извлечения текста и изображений из PDF-файлов. Проверено по факту чтения `main.go` 2026-09-02: **этот README ранее описывал сервис как независимый от внешних API с локальным OCR через Tesseract — это не соответствует коду и исправлено ниже.** Реальный пайплайн извлечения текста трёхступенчатый, и первые два (основных) шага уходят на сторонний внешний сервис.

## Возможности (уточнено по коду)

- ✅ **Извлечение текста** — через каскад из трёх методов, см. «Как работает извлечение текста» ниже.
- ✅ **Извлечение изображений** — `pdfimages -png` (Poppler), без лимита на размер; изображения меньше 2048 байт отбрасываются как вероятный шум.
- ⚠️ **OCR — НЕ локальный.** Никакого Tesseract в образе нет (в `Dockerfile` он не устанавливается, в `main.go` не вызывается). Реально используется сторонний облачный сервис **PaddleOCR-VL** (aistudio-app.com) — см. ниже.
- ✅ **PNG-конвертация первой страницы** — отдельный эндпоинт `/to-png` (не был описан в предыдущей версии этого README).
- ❌ **Не независим от внешних API** — зависит от двух внешних HTTP API третьей стороны (см. ниже) как от основного и запасного метода; собственный `pdftotext` — лишь третий, резервный уровень.

## Технологии

- **Go 1.21 + Gin** (`go.mod`: `gin-gonic/gin`, `google/uuid`) — HTTP-сервер.
- **Poppler** (`pdftotext`, `pdfimages`, `pdfinfo`, `pdftoppm`) — локальные утилиты, единственная системная зависимость в `Dockerfile` (`apt-get install poppler-utils`).
- **PaddleOCR-VL** и **Layout Parsing API** — сторонние облачные API (aistudio-app.com), см. «Известные ограничения».

## Как работает извлечение текста (`extractPDF`, `main.go`)

Каскад из трёх методов, без параллельности — каждый следующий пробуется только если предыдущий вернул ошибку или пустой текст:

1. **Async PaddleOCR-VL** (`callAsyncAPI`) — основной метод. Файл POST'ится на `https://paddleocr.aistudio-app.com/api/v2/ocr/jobs`, дальше сервис поллит статус джоба (`pollInterval` 5с, `pollTimeout` 10 минут) и скачивает JSONL-результат по готовности.
2. **Sync Layout Parsing API** (`callSyncAPI`) — запасной метод при ошибке первого; синхронный POST (PDF в base64 в теле JSON) на `https://a8gec0nct6gb48gc.aistudio-app.com/layout-parsing`, таймаут запроса 180с.
3. **`pdftotext`** (Poppler, локально) — последний резерв, если оба облачных метода недоступны/вернули ошибку.

`ocrUsed: true` в ответе означает, что сработал один из двух облачных методов (1 или 2), а не то, что был запущен локальный OCR-движок.

## API

### POST /extract

Извлекает текст и изображения из PDF.

**Request:**
```bash
curl -X POST http://pdf-extractor:8080/extract \
  -F "file=@document.pdf"
```
Лимит размера файла — 100 МБ (`maxFileSize`, `main.go`), при превышении — `413`.

**Response:**
```json
{
  "filename": "document.pdf",
  "text": "Полный текст документа...",
  "images": [
    {
      "dataUrl": "data:image/png;base64,...",
      "contentType": "image/png",
      "bytes": 45678
    }
  ],
  "pageCount": 10,
  "charCount": 15000,
  "imageCount": 5,
  "ocrUsed": false
}
```

### POST /to-png

Не описан в предыдущей версии README, но есть в коде (`handleToPng`, `main.go`). Конвертирует первую страницу PDF в PNG через `pdftoppm -r 200 -png -singlefile`.

**Request:** сырые байты PDF в теле, `Content-Type: application/pdf`.

**Response:**
```json
{ "image": "<base64 PNG>" }
```

### GET /health (и HEAD /health)

Проверка живости процесса (без проверки доступности внешних OCR-API).

**Response:**
```json
{
  "status": "UP",
  "service": "pdf-extractor"
}
```

## Использование в Next.js

Так сервис вызывается из сайта (уже реализовано в `src/lib/agent/pdfIngest.ts`, вызов `/extract`; отдельно `src/app/api/internal/bot/extract-text/route.ts` вызывает тот же `/extract` для файлов из Telegram-бота с таймаутом 300с — см. [`../docs/integrations.md`](../docs/integrations.md)):

```typescript
const PDF_EXTRACTOR_URL = process.env.PDF_EXTRACTOR_URL || "http://pdf-extractor:8080";

export async function ingestPdf(pdfBuffer: Buffer, filename: string): Promise<IngestedPdf> {
    const form = new FormData();
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    form.append("file", blob, filename);

    const res = await fetch(`${PDF_EXTRACTOR_URL}/extract`, {
        method: "POST",
        body: form,
    });

    if (!res.ok) {
        throw new Error(`PDF extraction failed: ${res.status}`);
    }

    const data = await res.json();
    
    return {
        filename: data.filename,
        text: data.text,
        images: data.images,
        pageCount: data.pageCount,
        charCount: data.charCount,
        imageCount: data.imageCount,
        ocrUsed: data.ocrUsed,
    };
}
```

## Преимущества перед Stirling-PDF

| Функция | Stirling-PDF | PDF Extractor |
|---------|--------------|---------------|
| Лимит изображений | 2 MB | Без лимита |
| Контроль над HTTP-слоем и извлечением изображений | ❌ Внешний сервис | ✅ Свой код, Poppler локально |
| Извлечение текста | — | Каскад: облачный PaddleOCR-VL → облачный Layout Parsing → локальный `pdftotext` |

Уточнение к таблице (её не было в предыдущей версии этого README): оба основных метода извлечения текста всё равно уходят на внешние облачные API — сервис не «локальный» в смысле независимости от сети, преимущество перед Stirling-PDF именно в контроле над HTTP-контрактом, лимитами изображений и наличии локального резервного пути (`pdftotext`), а не в отсутствии внешних зависимостей.

## Ключевые файлы

- `main.go` — весь сервис: Gin-роутинг, каскад извлечения текста, работа с Poppler, вызовы внешних OCR-API.
- `go.mod` / `go.sum` — зависимости (`gin-gonic/gin`, `google/uuid`).
- `Dockerfile` — двухстадийная сборка (`golang:1.21-alpine` → `debian:12-slim` с `poppler-utils`), встроенный `HEALTHCHECK`.

## Сборка и запуск

```bash
# Сборка
docker build -t pdf-extractor .

# Запуск
docker run -p 8080:8080 pdf-extractor

# Или через docker-compose
docker-compose up pdf-extractor
```

## Переменные окружения

**Уточнение:** сам сервис (`main.go`) не читает ни одной переменной окружения (`os.Getenv`/`os.Environ` в коде не встречается) — порт (`:8080`), URL-ы обоих внешних OCR-API и API-токен зашиты в код константами. `PDF_EXTRACTOR_URL` ниже — это переменная **для вызывающей стороны** (Next.js-сайта и бота), а не для самого pdf-extractor:

```env
# Читается сайтом/ботом, не самим pdf-extractor:
PDF_EXTRACTOR_URL=http://pdf-extractor:8080
```

Подробный разбор — [`../docs/config_and_env.md`](../docs/config_and_env.md) (раздел 7).

## Известные ограничения

- **Захардкоженный API-токен стороннего сервиса.** `main.go:50` — `apiToken` для PaddleOCR-VL прописан строковым литералом прямо в исходнике, закоммиченном в открытый репозиторий. Это единственный из внутренних Go-сервисов проекта, где сторонний секрет вообще не вынесен в окружение (даже частично, как `PORT` у r-compiler/python-compiler) — подробности и контекст (владелец планирует ключ перевыпустить) см. [`../docs/config_and_env.md`](../docs/config_and_env.md) и [`../docs/REVIEW.md`](../docs/REVIEW.md).
- **Зависимость от двух внешних облачных API** (`paddleocr.aistudio-app.com`, `a8gec0nct6gb48gc.aistudio-app.com`) для основного пути извлечения текста — при их недоступности сервис автоматически падает на локальный `pdftotext`, но это заметно более простой текстовый экстрактор без OCR сканов.
- **Нет ретраев** между тремя методами, кроме встроенной последовательности каскада — если оба облачных API вернули ошибку, локальный `pdftotext` не сможет распознать текст с отсканированных (не текстовых) страниц.
- Таймаут поллинга асинхронного джоба PaddleOCR-VL — до 10 минут (`pollTimeout`) — при этом вызывающая сторона (`extract-text/route.ts`) ждёт не дольше 300с, так что на практике первый метод может не успеть завершиться в рамках запроса пользователя (см. `../docs/integrations.md`).
- **Нет аутентификации** входящих запросов к `/extract`/`/to-png` — как и у остальных внутренних Go-сервисов, полагается на то, что порт не выставлен наружу докер-сети.
- Реальный `docker build`/`docker run` в рамках этого аудита не выполнялся — описание по чтению кода.

## Логи

Сервис логирует (реальные префиксы из `main.go`, не совпадают с более ранней версией этого README):
- `[PDF Extractor] Starting on :8080` — запуск.
- `[Async API] Job submitted: <id>`, `[Async API] Running: N/M pages`, `[Async API] Done: N pages extracted`, `[Async API] Failed: <err> - trying sync API` — ход основного (асинхронного) метода извлечения.
- `[Sync API] Success: N chars` / `[Sync API] Failed: <err> - falling back to pdftotext` — ход запасного метода.
