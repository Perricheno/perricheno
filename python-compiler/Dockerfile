FROM golang:1.22-bullseye AS builder
WORKDIR /app
COPY main.go .
RUN go build -o python-compiler main.go

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    dvipng \
    texlive-latex-extra \
    texlive-fonts-recommended \
    cm-super \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=builder /app/python-compiler .

EXPOSE 8000

CMD ["./python-compiler"]
