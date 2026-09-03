# src/lib/agent/templates/

## Что тут лежит

Единственный файл — `presets.ts` (181 строка).

## Зачем существует

Даёт пользователю выбор из 5 готовых LaTeX-преамбул (всё, что идёт до `\begin{document}`) вместо ручной настройки `\documentclass`/пакетов. Стадия 4 (`pipeline/stage4_assemble.ts`) берёт preset по `settings.templateId` и вызывает его фабрику преамбулы; если пользователь загрузил свой Overleaf-ZIP с преамбулой (`customTemplatePreamble`), presets игнорируются.

## Как использовать

Импортируется как `import { TEMPLATE_PRESETS } from "../templates/presets"` только из `stage4_assemble.ts`.

## Ключевые файлы

| Файл | Что в нём |
|---|---|
| `presets.ts` | Экспортирует `TEMPLATE_PRESETS` — массив из 5 объектов `TemplatePreset` (`id`, `name`, `description`, `useFancyTitle`, `preamble(settings) => string`): **`plain`**, **`academic`**, **`ieee`**, **`elegant`**, **`minimal`**. Общие хелперы внутри файла: `langPackages()` подбирает пакеты `fontenc`/`babel`/`fontspec` по языку (кириллица, казахский через `fontspec`+`Inter`, латиница), `biblatexLines()` добавляет `biblatex`+`biber`, если включены ссылки. |

## Известные ограничения / технический долг

Отдельных находок по этому файлу в `docs/REVIEW.md` нет — см. общий раздел про технический долг в [`../../../../docs/REVIEW.md`](../../../../docs/REVIEW.md), если потребуется контекст по остальной части agent pipeline.
