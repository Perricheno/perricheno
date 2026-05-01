FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    g++ \
    musl-dev \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-rus

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o pdf-extractor .

# Final stage
FROM alpine:latest

    # Install runtime dependencies
    RUN apk add --no-cache \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-data-eng \
        tesseract-ocr-data-rus \
        ca-certificates \
        wget

    # Download additional language data (not available in Alpine repos)
    # Popular languages for scientific publications
    RUN wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/kaz.traineddata \
        -O /usr/share/tessdata/kaz.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/chi_sim.traineddata \
        -O /usr/share/tessdata/chi_sim.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/jpn.traineddata \
        -O /usr/share/tessdata/jpn.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/kor.traineddata \
        -O /usr/share/tessdata/kor.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/ara.traineddata \
        -O /usr/share/tessdata/ara.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/deu.traineddata \
        -O /usr/share/tessdata/deu.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/fra.traineddata \
        -O /usr/share/tessdata/fra.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/spa.traineddata \
        -O /usr/share/tessdata/spa.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/ita.traineddata \
        -O /usr/share/tessdata/ita.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/por.traineddata \
        -O /usr/share/tessdata/por.traineddata && \
        wget -q https://github.com/tesseract-ocr/tessdata_fast/raw/main/ukr.traineddata \
        -O /usr/share/tessdata/ukr.traineddata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/pdf-extractor .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run
CMD ["./pdf-extractor"]
