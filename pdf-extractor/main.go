package main

import (
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ExtractResponse struct {
	Filename   string   `json:"filename"`
	Text       string   `json:"text"`
	Images     []Image  `json:"images"`
	PageCount  int      `json:"pageCount"`
	CharCount  int      `json:"charCount"`
	ImageCount int      `json:"imageCount"`
	OCRUsed    bool     `json:"ocrUsed"`
	Error      string   `json:"error,omitempty"`
}

type Image struct {
	DataURL     string `json:"dataUrl"`
	ContentType string `json:"contentType"`
	Bytes       int    `json:"bytes"`
}

const (
	maxFileSize        = 100 * 1024 * 1024 // 100 MB
	ocrTextThreshold   = 500                // If text < 500 chars, try OCR
	tempDir            = "/tmp/pdf-extractor"
)

func main() {
	// Create temp directory
	os.MkdirAll(tempDir, 0755)

	// Setup Gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// Health check (support both GET and HEAD for Docker healthcheck)
	healthHandler := func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "UP", "service": "pdf-extractor"})
	}
	r.GET("/health", healthHandler)
	r.HEAD("/health", healthHandler)

	// Extract endpoint
	r.POST("/extract", handleExtract)

	log.Println("[PDF Extractor] Starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}

func handleExtract(c *gin.Context) {
	// Parse multipart form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "Missing file"})
		return
	}
	defer file.Close()

	// Check file size
	if header.Size > maxFileSize {
		c.JSON(413, gin.H{"error": fmt.Sprintf("File too large (max %d MB)", maxFileSize/1024/1024)})
		return
	}

	// Create temp file
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

	// Extract data
	response := extractPDF(tempPath, header.Filename)
	
	if response.Error != "" {
		c.JSON(500, response)
	} else {
		c.JSON(200, response)
	}
}

func extractPDF(pdfPath, filename string) ExtractResponse {
	resp := ExtractResponse{
		Filename: filename,
		Images:   []Image{},
	}

	// 1. Extract text using pdftotext
	text, err := extractText(pdfPath)
	if err != nil {
		resp.Error = fmt.Sprintf("Text extraction failed: %v", err)
		return resp
	}
	resp.Text = text
	resp.CharCount = len(text)

	// 2. Get page count
	pageCount, _ := getPageCount(pdfPath)
	resp.PageCount = pageCount

	// 3. Extract images using pdfimages
	images, err := extractImages(pdfPath)
	if err != nil {
		log.Printf("[WARN] Image extraction failed: %v", err)
		// Continue without images
	} else {
		resp.Images = images
		resp.ImageCount = len(images)
	}

	// 4. OCR fallback if text is too short
	if len(text) < ocrTextThreshold {
		log.Printf("[OCR] Text too short (%d chars), trying OCR...", len(text))
		ocrText, err := performOCR(pdfPath)
		if err != nil {
			log.Printf("[OCR] Failed: %v", err)
		} else if len(ocrText) > len(text) {
			resp.Text = ocrText
			resp.CharCount = len(ocrText)
			resp.OCRUsed = true
			log.Printf("[OCR] Success: %d chars extracted", len(ocrText))
		}
	}

	return resp
}

func extractText(pdfPath string) (string, error) {
	cmd := exec.Command("pdftotext", "-enc", "UTF-8", "-nopgbrk", pdfPath, "-")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	
	// Clean up text
	text := string(output)
	text = strings.ReplaceAll(text, "\f", "\n")
	text = strings.TrimSpace(text)
	
	return text, nil
}

func getPageCount(pdfPath string) (int, error) {
	cmd := exec.Command("pdfinfo", pdfPath)
	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "Pages:") {
			var count int
			fmt.Sscanf(line, "Pages: %d", &count)
			return count, nil
		}
	}
	return 0, nil
}

func extractImages(pdfPath string) ([]Image, error) {
	// Create temp dir for images
	imgDir := filepath.Join(tempDir, uuid.New().String())
	os.MkdirAll(imgDir, 0755)
	defer os.RemoveAll(imgDir)

	// Extract images as PNG (better quality than JPEG for diagrams)
	imgPrefix := filepath.Join(imgDir, "img")
	cmd := exec.Command("pdfimages", "-png", pdfPath, imgPrefix)
	if err := cmd.Run(); err != nil {
		return nil, err
	}

	// Read all extracted images
	files, err := os.ReadDir(imgDir)
	if err != nil {
		return nil, err
	}

	images := []Image{}
	for _, f := range files {
		if f.IsDir() {
			continue
		}

		imgPath := filepath.Join(imgDir, f.Name())
		data, err := os.ReadFile(imgPath)
		if err != nil {
			continue
		}

		// Skip tiny images (likely decorative)
		if len(data) < 2048 {
			continue
		}

		// Determine content type
		contentType := "image/png"
		if strings.HasSuffix(f.Name(), ".jpg") || strings.HasSuffix(f.Name(), ".jpeg") {
			contentType = "image/jpeg"
		}

		// Convert to base64 data URL
		b64 := base64.StdEncoding.EncodeToString(data)
		dataURL := fmt.Sprintf("data:%s;base64,%s", contentType, b64)

		images = append(images, Image{
			DataURL:     dataURL,
			ContentType: contentType,
			Bytes:       len(data),
		})
	}

	return images, nil
}

func performOCR(pdfPath string) (string, error) {
	// Convert PDF to images first, then OCR each page
	imgDir := filepath.Join(tempDir, uuid.New().String())
	os.MkdirAll(imgDir, 0755)
	defer os.RemoveAll(imgDir)

	// Convert PDF to images (one per page)
	imgPrefix := filepath.Join(imgDir, "page")
	cmd := exec.Command("pdftoppm", "-png", "-r", "300", pdfPath, imgPrefix)
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("pdftoppm failed: %v", err)
	}

	// Get all page images
	files, err := os.ReadDir(imgDir)
	if err != nil {
		return "", err
	}

	var allText strings.Builder

	// OCR each page
	for _, f := range files {
		if f.IsDir() || !strings.HasSuffix(f.Name(), ".png") {
			continue
		}

		imgPath := filepath.Join(imgDir, f.Name())
		
		// Run tesseract with multiple languages
		// eng+rus+kaz+chi_sim+jpn+kor+ara+deu+fra+spa+ita+por+ukr
		cmd := exec.Command("tesseract", imgPath, "stdout", "-l", "eng+rus+kaz+chi_sim+jpn+kor+ara+deu+fra+spa+ita+por+ukr")
		output, err := cmd.Output()
		if err != nil {
			log.Printf("[OCR] Page %s failed: %v", f.Name(), err)
			continue
		}

		allText.WriteString(string(output))
		allText.WriteString("\n\n")
	}

	return strings.TrimSpace(allText.String()), nil
}
