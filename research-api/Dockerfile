FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY main.go /app/main.go

RUN go build -o research-api main.go

FROM alpine:latest

WORKDIR /app
COPY --from=builder /app/research-api .

EXPOSE 8080

CMD ["./research-api"]
