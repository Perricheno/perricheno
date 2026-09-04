package main

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// apiKey authenticates the compile endpoint. Read from the environment
// rather than hardcoded - matches the convention already established for
// the other Go services in this repo (see pdf-extractor/main.go).
var apiKey = mustEnv("LATEX_COMPILER_KEY")

const (
	maxUploadBytes = 100 * 1024 * 1024 // 100MB - generous for a LaTeX project + figures, no contract-mandated limit
	tempRoot       = "/tmp/latex-compiler"
	compileTimeout = 100 * time.Second // callers' own timeouts range 60-120s; stay comfortably inside that
	jobName        = "output"          // fixed jobname so the resulting PDF path is always predictable
)

var allowedEngines = map[string]bool{
	"pdflatex": true,
	"xelatex":  true,
	"lualatex": true,
}

// concurrency limiter - a handful of simultaneous pdflatex/xelatex processes
// is already CPU/memory-heavy; block (up to the request's own deadline)
// rather than immediately reject when the server is busy.
var compileSlots = make(chan struct{}, 3)

func mustEnv(name string) string {
	v := os.Getenv(name)
	if v == "" {
		log.Fatalf("%s env var is not set - refusing to start", name)
	}
	return v
}

func main() {
	os.MkdirAll(tempRoot, 0755)

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	healthHandler := func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "UP", "service": "latex-compiler"})
	}
	r.GET("/health", healthHandler)
	r.HEAD("/health", healthHandler)

	// Compile endpoint lives at the base path - every caller in the app
	// POSTs directly to LATEX_COMPILER_URL with no path suffix.
	r.POST("/", handleCompile)

	log.Println("[latex-compiler] Starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}

func handleCompile(c *gin.Context) {
	if c.GetHeader("x-api-key") != apiKey {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or missing x-api-key"})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes)
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		respondError(c, http.StatusBadRequest, "missing 'file' field: "+err.Error())
		return
	}
	defer file.Close()

	zipBytes, err := io.ReadAll(file)
	if err != nil {
		respondError(c, http.StatusBadRequest, "failed to read upload: "+err.Error())
		return
	}

	workDir := filepath.Join(tempRoot, uuid.New().String())
	if err := os.MkdirAll(workDir, 0755); err != nil {
		respondError(c, http.StatusInternalServerError, "failed to create work directory: "+err.Error())
		return
	}
	defer os.RemoveAll(workDir)

	if err := extractZip(zipBytes, workDir); err != nil {
		respondError(c, http.StatusBadRequest, "invalid zip: "+err.Error())
		return
	}

	mainFile := c.GetHeader("X-Main-File")
	if mainFile == "" {
		mainFile = "main.tex"
	}
	if strings.Contains(mainFile, "..") {
		respondError(c, http.StatusBadRequest, "invalid X-Main-File")
		return
	}
	if _, err := os.Stat(filepath.Join(workDir, mainFile)); err != nil {
		respondError(c, http.StatusBadRequest, fmt.Sprintf("main file %q not found in upload", mainFile))
		return
	}

	engine := c.GetHeader("X-Compiler")
	if engine == "" {
		engine = "pdflatex"
	}
	if !allowedEngines[engine] {
		respondError(c, http.StatusBadRequest, fmt.Sprintf("unsupported X-Compiler %q", engine))
		return
	}

	select {
	case compileSlots <- struct{}{}:
		defer func() { <-compileSlots }()
	case <-c.Request.Context().Done():
		respondError(c, http.StatusServiceUnavailable, "server busy, request cancelled while waiting")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), compileTimeout)
	defer cancel()

	pdfBytes, buildLog, err := compile(ctx, workDir, mainFile, engine)
	if err != nil {
		respondError(c, http.StatusUnprocessableEntity, err.Error()+"\n\n"+buildLog)
		return
	}

	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// respondError sends the same message under error/detail/log - different
// callers in the app fall back through different field names, so all three
// carry identical content to satisfy whichever one a given caller reads.
func respondError(c *gin.Context, status int, message string) {
	if len(message) > 12000 {
		message = message[:12000]
	}
	c.JSON(status, gin.H{"error": message, "detail": message, "log": message})
}

func extractZip(data []byte, destDir string) error {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}

	for _, f := range r.File {
		// Zip-slip protection: reject any entry that would resolve outside destDir.
		cleanName := filepath.Clean(f.Name)
		targetPath := filepath.Join(destDir, cleanName)
		if !strings.HasPrefix(targetPath, filepath.Clean(destDir)+string(os.PathSeparator)) {
			return fmt.Errorf("zip entry escapes target directory: %s", f.Name)
		}

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0755); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
		if err != nil {
			rc.Close()
			return err
		}
		_, copyErr := io.Copy(out, rc)
		rc.Close()
		out.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	return nil
}

// compile runs the standard latex -> [biber] -> latex -> latex sequence and
// returns the resulting PDF bytes plus the combined log of everything run.
func compile(ctx context.Context, workDir, mainFile, engine string) ([]byte, string, error) {
	var fullLog strings.Builder

	runPass := func(label string) error {
		out, err := runEngine(ctx, workDir, engine, mainFile)
		fullLog.WriteString(fmt.Sprintf("=== %s (%s) ===\n%s\n", label, engine, out))
		return err
	}

	// Pass 1: a hard failure here (syntax error etc.) means there's no point continuing.
	if err := runPass("pass 1"); err != nil {
		return nil, fullLog.String(), fmt.Errorf("compilation failed on first pass")
	}

	bcfPath := filepath.Join(workDir, jobName+".bcf")
	if _, statErr := os.Stat(bcfPath); statErr == nil {
		out, _ := runBiber(ctx, workDir)
		fullLog.WriteString("=== biber ===\n" + out + "\n")
		// Don't hard-fail on biber errors - a document with a broken bibliography
		// entry can still produce a usable PDF; the log carries the detail either way.
	}

	// Passes 2 and 3 resolve citations/cross-references/table of contents.
	// Non-fatal warnings here are normal (LaTeX's own "rerun to get references
	// right" convention) - only the final PDF's existence decides success.
	runPass("pass 2")
	runPass("pass 3")

	pdfPath := filepath.Join(workDir, jobName+".pdf")
	pdfBytes, err := os.ReadFile(pdfPath)
	if err != nil || len(pdfBytes) < 4 || !bytes.HasPrefix(pdfBytes, []byte("%PDF")) {
		return nil, fullLog.String(), fmt.Errorf("no valid PDF produced")
	}

	return pdfBytes, fullLog.String(), nil
}

func runEngine(ctx context.Context, workDir, engine, mainFile string) (string, error) {
	args := []string{
		"-interaction=nonstopmode",
		"-halt-on-error",
		"-file-line-error",
		"-jobname=" + jobName,
		"-output-directory=" + workDir,
		mainFile,
	}
	cmd := exec.CommandContext(ctx, engine, args...)
	cmd.Dir = workDir
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return out.String(), err
}

func runBiber(ctx context.Context, workDir string) (string, error) {
	cmd := exec.CommandContext(ctx, "biber", jobName)
	cmd.Dir = workDir
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return out.String(), err
}
