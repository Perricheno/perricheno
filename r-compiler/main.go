package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type FileModel struct {
	Name       string `json:"name"`
	ContentB64 string `json:"content_b64"`
}

type CompileRequest struct {
	Code  string      `json:"code"`
	Files []FileModel `json:"files"`
}

type CompileResponse struct {
	Success  bool   `json:"success"`
	Image    string `json:"image"`
	Log      string `json:"log"`
	ExitCode int    `json:"exit_code"`
}

const maxExecTime = 30 * time.Second

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status": "ok"}`))
}

func compileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CompileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if req.Code == "" {
		http.Error(w, `{"error": "No code provided"}`, http.StatusBadRequest)
		return
	}

	tmpDir, err := ioutil.TempDir("", "rcompile_")
	if err != nil {
		http.Error(w, `{"error": "Failed to create temp directory"}`, http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tmpDir)

	for _, fInfo := range req.Files {
		cleanName := filepath.Base(fInfo.Name)
		fPath := filepath.Join(tmpDir, cleanName)
		decBytes, err := base64.StdEncoding.DecodeString(fInfo.ContentB64)
		if err == nil {
			ioutil.WriteFile(fPath, decBytes, 0644)
		} else {
			log.Printf("Error decoding file %s: %v", fInfo.Name, err)
		}
	}

	rTmpDir := strings.ReplaceAll(tmpDir, "\\", "/")

	wrapperCode := fmt.Sprintf(`setwd("%s")
options(repos = c(CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"))
library(Cairo)
CairoPNG("output.png", width=1400, height=1000, res=120)
%s
dev.off()
`, rTmpDir, req.Code)

	scriptPath := filepath.Join(tmpDir, "script.R")
	outputPath := filepath.Join(tmpDir, "output.png")

	err = ioutil.WriteFile(scriptPath, []byte(wrapperCode), 0644)
	if err != nil {
		http.Error(w, `{"error": "Failed to write script"}`, http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), maxExecTime)
	defer cancel()

	cmd := exec.CommandContext(ctx, "Rscript", scriptPath)
	var outBytes, errBytes bytes.Buffer
	cmd.Stdout = &outBytes
	cmd.Stderr = &errBytes

	err = cmd.Run()

	exitCode := 0
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
		} else if ctx.Err() == context.DeadlineExceeded {
			exitCode = 124
		} else {
			exitCode = 1
		}
	}

	logOutput := outBytes.String() + "\n" + errBytes.String()
	success := false
	var imageB64 string

	if exitCode == 0 {
		if _, statErr := os.Stat(outputPath); statErr == nil {
			success = true
			imgBytes, readErr := ioutil.ReadFile(outputPath)
			if readErr == nil {
				imageB64 = base64.StdEncoding.EncodeToString(imgBytes)
			}
		} else {
			logOutput += "\n[Error] R script finished with exit_code 0 but NO output.png was found."
		}
	} else if exitCode == 124 {
		logOutput = "Execution timed out after 30 seconds."
	} else {
		logOutput += fmt.Sprintf("\n[Error] R script exited with code %d.", exitCode)
	}

	resp := CompileResponse{
		Success:  success,
		Image:    imageB64,
		Log:      logOutput,
		ExitCode: exitCode,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func main() {
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/compile", compileHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	log.Printf("🚀 R Go Compiler starting on port %s...", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
