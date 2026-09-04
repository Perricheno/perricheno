FROM golang:1.21-alpine AS builder

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -ldflags="-s -w" -o latex-compiler .

# texlive/texlive ships the full TeX Live scheme (scheme-full) - every
# engine (pdflatex/xelatex/lualatex), biber, and the full package set
# (tikz + extra libraries, biblatex, IEEEtran, babel-russian/ukrainian,
# qrcode, etc). The owner explicitly asked for "full texlive" so custom/
# arbitrary user documents keep working rather than hitting a missing
# package on a minimal install - see docs/config_and_env.md, LaTeX
# compiler section, for exactly which packages various templates need.
FROM texlive/texlive:latest

# fonts-inter: system-level Inter TTF for `\setmainfont{Inter}` under
# xelatex/lualatex (Kazakh-language documents, see src/lib/agent/templates/
# presets.ts). Separate from CTAN's `inter` LaTeX package (already included
# in texlive-full) used for pdflatex's `\usepackage[sfdefault]{inter}`.
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-inter \
    fontconfig \
    ca-certificates \
    wget \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/latex-compiler .

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./latex-compiler"]
