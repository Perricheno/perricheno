# python-compiler

Go-сервис-«песочница», по структуре и назначению — почти точная копия [`../r-compiler/`](../r-compiler/), только исполняет Python вместо R: принимает код, запускает его во внешнем процессе `python3`, возвращает получившийся PNG-график (matplotlib/plotly) плюс лог выполнения. Никакого FastAPI/uvicorn (несмотря на то, что они есть в `requirements.txt`) сервис не поднимает — HTTP слушает Go, Python вызывается только как одноразовый подпроцесс на один запрос.

Кто вызывает и что происходит при недоступности — [`../docs/integrations.md`](../docs/integrations.md) (вызывается из `src/app/api/agent/python-compile/route.ts`, таймаут на стороне сайта 35с, ретраев нет).

## Как это устроено (по факту чтения `main.go`)

### `GET /health`
`{"status": "ok"}`, без реальной проверки Python-окружения.

### `POST /compile`
Request — идентичен r-compiler:
```json
{
  "code": "import matplotlib.pyplot as plt\nplt.plot([1,2,3])",
  "files": [ { "name": "data.csv", "content_b64": "<base64>" } ]
}
```

Механизм (подтверждено чтением кода, `os/exec` на `python3` — да, именно так):
1. Временная директория, декодирование `files` в неё (имя очищается `filepath.Base`).
2. Пользовательский `code` подставляется в служебный Python-скрипт-обёртку:
   - `matplotlib.use('Agg')` в `try/except` (не падает, если matplotlib не импортирован);
   - `os.chdir(tmpDir)`;
   - сам код пользователя;
   - автосохранение картинки: если в globals есть переменная `fig` и это `plotly.graph_objects.Figure` — `fig.write_image("output.png")` (требует `kaleido`, есть в `requirements.txt`); иначе — `fig.savefig(...)` (если `fig` — matplotlib figure) либо `plt.savefig("output.png", dpi=120, bbox_inches="tight")` как общий fallback.
3. Запуск `exec.CommandContext(ctx, "python3", scriptPath)` с таймаутом **30 секунд** (`maxExecTime`, идентично r-compiler). При превышении — `exit_code: 124`.
4. Если `output.png` существует и exit code 0 — читает и кодирует в base64.

Response — та же схема `{success, image, log, exit_code}`.

Как и у r-compiler, аутентификации на HTTP-уровне нет.

## Сборка и запуск локально

`Dockerfile` — двухстадийная сборка:
1. `golang:1.22-bullseye` — компилирует `main.go` в бинарь `python-compiler`.
2. `python:3.11-slim` — финальный образ: ставит `dvipng`, `texlive-latex-extra`, `texlive-fonts-recommended`, `cm-super` (нужны для рендеринга LaTeX-подписей в matplotlib, `usetex=True` и т.п.), затем `pip install -r requirements.txt`, копирует собранный Go-бинарь.

```bash
# из директории python-compiler/
docker build -t python-compiler .
docker run --rm -p 8000:8000 python-compiler

curl http://localhost:8000/health
curl -X POST http://localhost:8000/compile \
  -H "Content-Type: application/json" \
  -d '{"code": "import matplotlib.pyplot as plt\nplt.plot([1,2,3])"}'
```

В `docker-compose.yml`, как и r-compiler, поднимается без проброса портов наружу — доступен только другим контейнерам сети `cloudflare` по имени `python-compiler:8000`. Порт настраивается через `PORT` (fallback `8000`), в compose не переопределяется.

Реальная сборка образа не выполнялась в рамках аудита (описание — по чтению `Dockerfile`/`main.go`/`requirements.txt`).

## Ключевые файлы

- `main.go` — весь HTTP-сервер и логика обёртки/запуска Python.
- `requirements.txt` — Python-зависимости, устанавливаемые в образ: `fastapi`, `uvicorn` (не используются самим сервисом — вероятно, наследие от более раннего варианта на чистом Python, до переписывания на Go-обёртку; см. «Известные ограничения»), `pandas`, `numpy`, `matplotlib`, `seaborn`, `scipy`, `scikit-learn`, `statsmodels`, `plotly`, `squarify`, `Kaleido` (нужен для экспорта Plotly-графиков в PNG), `CairoSVG`, `SciencePlots`.
- `Dockerfile` — двухстадийная сборка Go + Python 3.11-slim, системные TeX-пакеты для LaTeX-рендеринга подписей.

## Известные ограничения

- **`fastapi`/`uvicorn` в `requirements.txt`, но не используются** — HTTP полностью на Go; похоже на остаток от более раннего прототипа. Требует уточнения у владельца, можно ли их убрать из зависимостей (уменьшит время сборки образа).
- **Нет аутентификации** на HTTP-уровне — как и у r-compiler, митигируется только отсутствием проброса порта наружу.
- **Нет ограничения ресурсов** для запускаемого `python3`-процесса — только таймаут 30с на весь запуск.
- Автосохранение графика — эвристика (`fig` в globals → plotly, иначе matplotlib `savefig`) — нестандартный код пользователя/ИИ-агента, не создающий `fig` или не рисующий через `plt`, не получит `output.png`, и сервис вернёт `success: false` с пояснением в `log`.
- Реальный `docker build`/`docker run` не выполнялся в рамках этого аудита.
