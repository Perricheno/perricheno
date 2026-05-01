# PDF Extractor Service

Собственный микросервис на Go для извлечения текста и изображений из PDF файлов.

## Возможности

- ✅ **Полное извлечение текста** - весь текст из PDF без ограничений
- ✅ **Все изображения** - извлекает ВСЕ изображения без лимита на размер
- ✅ **OCR поддержка** - автоматический OCR для сканированных документов
- ✅ **Многоязычность** - поддержка английского, русского, украинского, казахского
- ✅ **Высокое качество** - изображения извлекаются в PNG (лучше для диаграмм)
- ✅ **Надежность** - нет зависимости от внешних API

## Технологии

- **Go 1.21** - быстрый и эффективный
- **Poppler** - pdftotext, pdfimages, pdfinfo
- **Tesseract OCR** - распознавание текста
- **Gin** - HTTP фреймворк

## API

### POST /extract

Извлекает текст и изображения из PDF.

**Request:**
```bash
curl -X POST http://pdf-extractor:8080/extract \
  -F "file=@document.pdf"
```

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

### GET /health

Проверка здоровья сервиса.

**Response:**
```json
{
  "status": "UP",
  "service": "pdf-extractor"
}
```

## Использование в Next.js

Замените `src/lib/agent/pdfIngest.ts` на вызов нового сервиса:

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
| OCR стабильность | ❌ Падает с 500 | ✅ Стабильно |
| Контроль | ❌ Внешний API | ✅ Полный контроль |
| Скорость | Медленно | Быстро |
| Зависимости | Внешний сервис | Локально |

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

```env
PDF_EXTRACTOR_URL=http://pdf-extractor:8080
```

## Логи

Сервис логирует:
- Запуск сервиса
- Попытки OCR
- Ошибки извлечения

```
[PDF Extractor] Starting on :8080
[OCR] Text too short (234 chars), trying OCR...
[OCR] Success: 5678 chars extracted
```
