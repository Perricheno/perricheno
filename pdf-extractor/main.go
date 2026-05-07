package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ExtractResponse struct {
	Filename   string  `json:"filename"`
	Text       string  `json:"text"`
	Images     []Image `json:"images"`
	PageCount  int     `json:"pageCount"`
	CharCount  int     `json:"charCount"`
	ImageCount int     `json:"imageCount"`
	OCRUsed    bool    `json:"ocrUsed"`
	Error      string  `json:"error,omitempty"`
}

type Image struct {
	DataURL     string `json:"dataUrl"`
	ContentType string `json:"contentType"`
	Bytes       int    `json:"bytes"`
}

const (
	maxFileSize = 100 * 1024 * 1024
	tempDir     = "/tmp/pdf-extractor"

	// PaddleOCR-VL async job API (primary - better model, handles large PDFs)
	asyncJobURL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
	asyncModel  = "PaddleOCR-VL"

	// Layout Parsing sync API (fallback)
	syncAPIURL = "https://a8gec0nct6gb48gc.aistudio-app.com/layout-parsing"

	apiToken = "5e94e2479a04df782a2e7ab489412c9b99bb9885"

	pollInterval = 5 * time.Second
	pollTimeout  = 10 * time.Minute
)

func main() {
	os.MkdirAll(tempDir, 0755)

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	healthHandler := func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "UP", "service": "pdf-extractor"})
	}
	r.GET("/health", healthHandler)
	r.HEAD("/health", healthHandler)

	r.POST("/extract", handleExtract)
	r.POST("/to-png", handleToPng)

	log.Println("[PDF Extractor] Starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}

func handleExtract(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "Missing file"})
		return
	}
	defer file.Close()

	if header.Size > maxFileSize {
		c.JSON(413, gin.H{"error": fmt.Sprintf("File too large (max %d MB)", maxFileSize/1024/1024)})
		return
	}

	tempID := uuid.New().String()
	tempPath := filepath.Join(tempDir, tempID+".pdf")
	defer os.Remove(tempPath)

	out, err := os.Create(tempPath)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create temp file"})
		return
	}
	_, err = io.Copy(out, file)
	out.Close()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to save file"})
		return
	}

	response := extractPDF(tempPath, header.Filename)
	if response.Error != "" {
		c.JSON(500, response)
	} else {
		c.JSON(200, response)
	}
}

// handleToPng converts the first page of a PDF to PNG (base64).
// Accepts raw PDF bytes in request body (Content-Type: application/pdf).
// Returns { "image": "<base64 PNG>" }.
func handleToPng(c *gin.Context) {
	pdfBytes, err := io.ReadAll(io.LimitReader(c.Request.Body, maxFileSize))
	if err != nil || len(pdfBytes) == 0 {
		c.JSON(400, gin.H{"error": "empty or unreadable body"})
		return
	}

	tempID := uuid.New().String()
	pdfPath := filepath.Join(tempDir, tempID+".pdf")
	outBase := filepath.Join(tempDir, tempID)
	defer os.Remove(pdfPath)
	defer os.Remove(outBase + ".png")

	if err := os.WriteFile(pdfPath, pdfBytes, 0644); err != nil {
		c.JSON(500, gin.H{"error": "failed to save pdf"})
		return
	}

	// pdftoppm: -r 200 resolution, -png, -singlefile = only first page, no page-number suffix
	cmd := exec.Command("pdftoppm", "-r", "200", "-png", "-singlefile", pdfPath, outBase)
	if out, err := cmd.CombinedOutput(); err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("pdftoppm: %s", strings.TrimSpace(string(out)))})
		return
	}

	pngBytes, err := os.ReadFile(outBase + ".png")
	if err != nil {
		c.JSON(500, gin.H{"error": "png file not found after conversion"})
		return
	}

	c.JSON(200, gin.H{"image": base64.StdEncoding.EncodeToString(pngBytes)})
}

func extractPDF(pdfPath, filename string) ExtractResponse {
	resp := ExtractResponse{Filename: filename, Images: []Image{}}

	pageCount, _ := getPageCount(pdfPath)
	resp.PageCount = pageCount

	// ── 1. Async PaddleOCR-VL (primary) ──────────────────────────────────────
	text, err := callAsyncAPI(pdfPath)
	if err == nil && len(text) > 0 {
		log.Printf("[Async API] Success: %d chars", len(text))
		resp.Text = text
		resp.CharCount = len(text)
		resp.OCRUsed = true
		images, _ := extractImages(pdfPath)
		resp.Images = images
		resp.ImageCount = len(images)
		return resp
	}
	log.Printf("[Async API] Failed: %v - trying sync API", err)

	// ── 2. Sync Layout Parsing API (fallback) ─────────────────────────────────
	text, err = callSyncAPI(pdfPath)
	if err == nil && len(text) > 0 {
		log.Printf("[Sync API] Success: %d chars", len(text))
		resp.Text = text
		resp.CharCount = len(text)
		resp.OCRUsed = true
		images, _ := extractImages(pdfPath)
		resp.Images = images
		resp.ImageCount = len(images)
		return resp
	}
	log.Printf("[Sync API] Failed: %v - falling back to pdftotext", err)

	// ── 3. pdftotext (last resort) ────────────────────────────────────────────
	text, err = extractText(pdfPath)
	if err != nil {
		resp.Error = fmt.Sprintf("All extraction methods failed: %v", err)
		return resp
	}
	resp.Text = text
	resp.CharCount = len(text)

	images, _ := extractImages(pdfPath)
	resp.Images = images
	resp.ImageCount = len(images)
	return resp
}

// ── Async API (PaddleOCR-VL) ─────────────────────────────────────────────────

func callAsyncAPI(pdfPath string) (string, error) {
	jobID, err := submitAsyncJob(pdfPath)
	if err != nil {
		return "", fmt.Errorf("submit job: %w", err)
	}
	log.Printf("[Async API] Job submitted: %s", jobID)

	jsonlURL, err := pollJob(jobID)
	if err != nil {
		return "", fmt.Errorf("poll job: %w", err)
	}

	return downloadJSONLResult(jsonlURL)
}

func submitAsyncJob(pdfPath string) (string, error) {
	f, err := os.Open(pdfPath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	w.WriteField("model", asyncModel)
	optJSON, _ := json.Marshal(map[string]bool{
		"useDocOrientationClassify": false,
		"useDocUnwarping":           false,
		"useChartRecognition":       false,
	})
	w.WriteField("optionalPayload", string(optJSON))
	part, err := w.CreateFormFile("file", filepath.Base(pdfPath))
	if err != nil {
		return "", err
	}
	if _, err = io.Copy(part, f); err != nil {
		return "", err
	}
	w.Close()

	req, err := http.NewRequest("POST", asyncJobURL, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "bearer "+apiToken)
	req.Header.Set("Content-Type", w.FormDataContentType())

	client := &http.Client{Timeout: 60 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode != 200 {
		return "", fmt.Errorf("status %d", res.StatusCode)
	}

	var resp struct {
		Data struct {
			JobID string `json:"jobId"`
		} `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return "", err
	}
	if resp.Data.JobID == "" {
		return "", fmt.Errorf("empty jobId")
	}
	return resp.Data.JobID, nil
}

func pollJob(jobID string) (string, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	deadline := time.Now().Add(pollTimeout)

	for time.Now().Before(deadline) {
		time.Sleep(pollInterval)

		req, err := http.NewRequest("GET", asyncJobURL+"/"+jobID, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "bearer "+apiToken)

		res, err := client.Do(req)
		if err != nil {
			log.Printf("[Async API] Poll error: %v", err)
			continue
		}

		var payload struct {
			Data struct {
				State string `json:"state"`
				ExtractProgress struct {
					TotalPages     int    `json:"totalPages"`
					ExtractedPages int    `json:"extractedPages"`
				} `json:"extractProgress"`
				ResultURL struct {
					JSONUrl string `json:"jsonUrl"`
				} `json:"resultUrl"`
				ErrorMsg string `json:"errorMsg"`
			} `json:"data"`
		}
		json.NewDecoder(res.Body).Decode(&payload)
		res.Body.Close()

		switch payload.Data.State {
		case "done":
			log.Printf("[Async API] Done: %d pages extracted", payload.Data.ExtractProgress.ExtractedPages)
			return payload.Data.ResultURL.JSONUrl, nil
		case "failed":
			return "", fmt.Errorf("job failed: %s", payload.Data.ErrorMsg)
		case "running":
			log.Printf("[Async API] Running: %d/%d pages",
				payload.Data.ExtractProgress.ExtractedPages,
				payload.Data.ExtractProgress.TotalPages)
		default:
			log.Printf("[Async API] State: %s", payload.Data.State)
		}
	}
	return "", fmt.Errorf("timed out after %v", pollTimeout)
}

func downloadJSONLResult(jsonlURL string) (string, error) {
	res, err := http.Get(jsonlURL)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	for _, line := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var entry struct {
			Result struct {
				LayoutParsingResults []struct {
					Markdown struct {
						Text string `json:"text"`
					} `json:"markdown"`
				} `json:"layoutParsingResults"`
			} `json:"result"`
		}
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue
		}
		for _, r := range entry.Result.LayoutParsingResults {
			if r.Markdown.Text != "" {
				sb.WriteString(r.Markdown.Text)
				sb.WriteString("\n\n")
			}
		}
	}
	return strings.TrimSpace(sb.String()), nil
}

// ── Sync Layout Parsing API ───────────────────────────────────────────────────

func callSyncAPI(pdfPath string) (string, error) {
	data, err := os.ReadFile(pdfPath)
	if err != nil {
		return "", err
	}

	payload := map[string]any{
		"file":                      base64.StdEncoding.EncodeToString(data),
		"fileType":                  0,
		"useDocOrientationClassify": false,
		"useDocUnwarping":           false,
		"useChartRecognition":       false,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", syncAPIURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "token "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 180 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode != 200 {
		return "", fmt.Errorf("status %d", res.StatusCode)
	}

	var apiResp struct {
		Result struct {
			LayoutParsingResults []struct {
				Markdown struct {
					Text string `json:"text"`
				} `json:"markdown"`
			} `json:"layoutParsingResults"`
		} `json:"result"`
	}
	if err := json.NewDecoder(res.Body).Decode(&apiResp); err != nil {
		return "", err
	}

	var sb strings.Builder
	for _, r := range apiResp.Result.LayoutParsingResults {
		if r.Markdown.Text != "" {
			sb.WriteString(r.Markdown.Text)
			sb.WriteString("\n\n")
		}
	}
	return strings.TrimSpace(sb.String()), nil
}

// ── Utilities ─────────────────────────────────────────────────────────────────

func extractText(pdfPath string) (string, error) {
	cmd := exec.Command("pdftotext", "-enc", "UTF-8", "-nopgbrk", pdfPath, "-")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(strings.ReplaceAll(string(output), "\f", "\n")), nil
}

func getPageCount(pdfPath string) (int, error) {
	output, err := exec.Command("pdfinfo", pdfPath).Output()
	if err != nil {
		return 0, err
	}
	for _, line := range strings.Split(string(output), "\n") {
		if strings.HasPrefix(line, "Pages:") {
			var count int
			fmt.Sscanf(line, "Pages: %d", &count)
			return count, nil
		}
	}
	return 0, nil
}

func extractImages(pdfPath string) ([]Image, error) {
	imgDir := filepath.Join(tempDir, uuid.New().String())
	os.MkdirAll(imgDir, 0755)
	defer os.RemoveAll(imgDir)

	imgPrefix := filepath.Join(imgDir, "img")
	if err := exec.Command("pdfimages", "-png", pdfPath, imgPrefix).Run(); err != nil {
		return nil, err
	}

	files, err := os.ReadDir(imgDir)
	if err != nil {
		return nil, err
	}

	var images []Image
	for _, f := range files {
		if f.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(imgDir, f.Name()))
		if err != nil || len(data) < 2048 {
			continue
		}
		contentType := "image/png"
		if strings.HasSuffix(f.Name(), ".jpg") || strings.HasSuffix(f.Name(), ".jpeg") {
			contentType = "image/jpeg"
		}
		images = append(images, Image{
			DataURL:     fmt.Sprintf("data:%s;base64,%s", contentType, base64.StdEncoding.EncodeToString(data)),
			ContentType: contentType,
			Bytes:       len(data),
		})
	}
	return images, nil
}
