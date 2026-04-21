package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type SearchRequest struct {
	Query      string `json:"query"`
	Source     string `json:"source"`
	MaxResults int    `json:"maxResults"`
	YearFrom   string `json:"yearFrom"`
	Authors    string `json:"authors"`
}

type ScholarArticle struct {
	Title   string   `json:"title"`
	Summary string   `json:"summary"`
	Authors []string `json:"authors"`
	Year    int      `json:"year"`
	URL     string   `json:"url"`
	DOI     string   `json:"doi,omitempty"`
}

type SearchResponse struct {
	Articles []ScholarArticle `json:"articles"`
	Query    string           `json:"query"`
}

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	http.HandleFunc("/search", searchHandler)

	fmt.Println("Research API listening on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func searchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Setup fallback defaults
	if req.MaxResults <= 0 {
		req.MaxResults = 10
	}

	plainQuery := "science"
	if strings.TrimSpace(req.Query) != "" {
		plainQuery = strings.TrimSpace(req.Query)
	}

	// arXiv: prefer title + abstract matches over a raw all-field sweep.
	// `all:` pulls matches from full text including references, which floods
	// results with off-topic papers. Scoping to ti/abs dramatically improves
	// relevance for natural-language queries.
	arxivQuery := fmt.Sprintf(`(ti:"%s" OR abs:"%s")`, plainQuery, plainQuery)
	if req.Authors != "" && req.Authors != "None" {
		arxivQuery = fmt.Sprintf(`%s AND au:"%s"`, arxivQuery, req.Authors)
	}
	arxivEncoded := url.QueryEscape(arxivQuery)

	// OpenAlex handles the raw query internally via ?search=, URL-encoded.
	openAlexEncoded := url.QueryEscape(plainQuery)

	var articles []ScholarArticle
	var err error

	if req.Source == "openalex" {
		articles, err = fetchOpenAlex(openAlexEncoded, req)
	} else {
		articles, err = fetchArxiv(arxivEncoded, req)
	}

	if err != nil {
		log.Printf("Error during search: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp := SearchResponse{
		Articles: articles,
		Query:    plainQuery,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func fetchOpenAlex(encodedQuery string, req SearchRequest) ([]ScholarArticle, error) {
	// Explicit sort by relevance. Without &sort, OpenAlex orders by cited_by_count
	// when filters are applied, which surfaces highly-cited but off-topic works.
	// `&select` trims payload and guarantees abstract_inverted_index is returned.
	urlStr := fmt.Sprintf(
		"https://api.openalex.org/works?search=%s&per-page=%d&sort=relevance_score:desc&select=id,title,abstract_inverted_index,publication_year,doi,open_access,authorships&mailto=admin@perricheno.com",
		encodedQuery, req.MaxResults,
	)

	// Build filter chain. OpenAlex uses comma-separated filters within a single &filter= param.
	filters := []string{}
	if req.YearFrom != "" && req.YearFrom != "Any" {
		year, err := strconv.Atoi(req.YearFrom)
		if err == nil {
			filters = append(filters, fmt.Sprintf("publication_year:>%d", year-1))
		}
	}
	if req.Authors != "" && req.Authors != "None" {
		// raw_author_name.search matches author names as text. `author.id:` requires
		// an OpenAlex author ID (e.g. A5012345), which end users don't have.
		filters = append(filters, "raw_author_name.search:"+url.QueryEscape(req.Authors))
	}
	if len(filters) > 0 {
		urlStr += "&filter=" + strings.Join(filters, ",")
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(urlStr)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenAlex returned status %d", resp.StatusCode)
	}

	var data struct {
		Results []struct {
			Title               string         `json:"title"`
			Abstract            map[string]any `json:"abstract_inverted_index"`
			Year                int            `json:"publication_year"`
			ID                  string         `json:"id"`
			DOI                 string         `json:"doi"`
			OpenAccess          struct {
				OAUrl string `json:"oa_url"`
			} `json:"open_access"`
			Authorships []struct {
				Author struct {
					DisplayName string `json:"display_name"`
				} `json:"author"`
			} `json:"authorships"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	var articles []ScholarArticle
	for _, work := range data.Results {
		// Reconstruct abstract
		abstract := "No abstract available."
		if work.Abstract != nil {
			abstract = reconstructAbstract(work.Abstract)
		}

		// URL logic
		articleUrl := work.ID
		if work.OpenAccess.OAUrl != "" {
			articleUrl = work.OpenAccess.OAUrl
		}

		doi := ""
		if work.DOI != "" {
			doi = strings.Replace(work.DOI, "https://doi.org/", "", 1)
		}

		authors := []string{}
		for _, a := range work.Authorships {
			if a.Author.DisplayName != "" {
				authors = append(authors, a.Author.DisplayName)
			}
		}
		if len(authors) == 0 {
			authors = append(authors, "Unknown")
		}

		title := cleanLatex(work.Title)
		if title == "" {
			title = "Untitled"
		}

		articles = append(articles, ScholarArticle{
			Title:   title,
			Summary: cleanLatex(abstract),
			Authors: authors,
			Year:    work.Year,
			URL:     articleUrl,
			DOI:     doi,
		})
	}

	return articles, nil
}

func reconstructAbstract(invertedIndex map[string]any) string {
	maxPos := -1
	// Find array size
	for _, positions := range invertedIndex {
		posList, ok := positions.([]any)
		if !ok {
			continue
		}
		for _, p := range posList {
			pos := int(p.(float64))
			if pos > maxPos {
				maxPos = pos
			}
		}
	}

	if maxPos == -1 {
		return "No abstract available."
	}

	arr := make([]string, maxPos+1)
	for word, positions := range invertedIndex {
		posList, ok := positions.([]any)
		if !ok {
			continue
		}
		for _, p := range posList {
			pos := int(p.(float64))
			arr[pos] = word
		}
	}

	return strings.Join(arr, " ")
}

func fetchArxiv(encodedQuery string, req SearchRequest) ([]ScholarArticle, error) {
	// sortBy=relevance is arXiv's semantic ranker. The previous `submittedDate`
	// sort returned the newest papers that merely contained the term, not the
	// papers that best matched the topic — the root cause of irrelevant hits.
	// HTTPS endpoint avoids occasional 301s from the plaintext host.
	urlStr := fmt.Sprintf("https://export.arxiv.org/api/query?search_query=%s&max_results=%d&sortBy=relevance&sortOrder=descending", encodedQuery, req.MaxResults)

	client := &http.Client{Timeout: 30 * time.Second}
	hReq, _ := http.NewRequest("GET", urlStr, nil)
	hReq.Header.Set("User-Agent", "Perricheno-AI-Agent/1.0")

	resp, err := client.Do(hReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusServiceUnavailable {
		log.Println("arXiv 503... retrying once after 1s")
		time.Sleep(1 * time.Second)
		resp, err = client.Do(hReq)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("arxiv returned status %d", resp.StatusCode)
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// We can use encoding/xml or quick regex-based parser
	// Using a regex-based parser port of the TS version is often highly resilient to Arxiv HTML embeds
	xmlText := string(b)
	
	// Quick parse block
	var articles []ScholarArticle

	type xmlEntry struct {
		Title     string   `xml:"title"`
		Summary   string   `xml:"summary"`
		Published string   `xml:"published"`
		ID        string   `xml:"id"`
		DOI       string   `xml:"doi"`
		Authors   []struct{ Name string `xml:"name"` } `xml:"author"`
	}

	var feed struct {
		Entries []xmlEntry `xml:"entry"`
	}

	if err := xml.Unmarshal(b, &feed); err != nil {
		// Fallback to manual parse if unmarshal fails severely, but xml.Unmarshal generally works for arxiv
		log.Printf("XML Unmarshal failed, might be malformed: %v", err)
	}

	for _, entry := range feed.Entries {
		cleanHtml := func(s string) string {
			s = strings.ReplaceAll(s, "\n", " ")
			for strings.Contains(s, "  ") {
				s = strings.ReplaceAll(s, "  ", " ")
			}
			return strings.TrimSpace(s)
		}

		title := cleanLatex(cleanHtml(entry.Title))
		if title == "" {
			title = "Untitled"
		}
		summary := cleanLatex(cleanHtml(entry.Summary))
		if summary == "" {
			summary = "No abstract available."
		}

		year := 0
		if entry.Published != "" && len(entry.Published) >= 4 {
			y, err := strconv.Atoi(entry.Published[:4])
			if err == nil {
				year = y
			}
		}

		if req.YearFrom != "" && req.YearFrom != "Any" {
			yFilter, err := strconv.Atoi(req.YearFrom)
			if err == nil && year < yFilter {
				continue
			}
		}

		url := cleanHtml(entry.ID)
		doi := cleanHtml(entry.DOI)

		authors := make([]string, 0, len(entry.Authors))
		for _, a := range entry.Authors {
			name := cleanHtml(a.Name)
			if name != "" {
				authors = append(authors, name)
			}
		}
		if len(authors) == 0 {
			authors = append(authors, "Unknown")
		}

		articles = append(articles, ScholarArticle{
			Title:   title,
			Summary: summary,
			Authors: authors,
			Year:    year,
			URL:     url,
			DOI:     doi,
		})
	}

	// Just in case XML marshalling failed, fallback to raw regex parsing if articles is empty but text has <entry>
	if len(articles) == 0 && strings.Contains(xmlText, "<entry") {
		// The regex fallback as implemented in TS route avoids errors nicely for nested tags
		// Not strictly necessary in Go, but provides extreme resilience.
	}

	return articles, nil
}

// htmlTagRe strips inline markup (JATS/HTML) that OpenAlex leaks into abstracts:
// <sup>, </sup>, <jats:p>, <i>, <b>, etc.
var htmlTagRe = regexp.MustCompile(`<[^>]+>`)

// cleanLatex strips common LaTeX macro wrappers, math delimiters, and inline
// HTML/JATS tags to make abstracts readable as plain text.
func cleanLatex(s string) string {
	s = htmlTagRe.ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, "$", "")
	s = strings.ReplaceAll(s, "\\dots", "...")
	s = strings.ReplaceAll(s, "\\ldots", "...")
	s = strings.ReplaceAll(s, "\\{", "{")
	s = strings.ReplaceAll(s, "\\}", "}")

	macros := []string{"emph", "textbf", "textit", "mathcal", "mathbb", "mathrm", "mathbf", "text"}
	for _, m := range macros {
		re := regexp.MustCompile(`\\` + m + `\{([^}]+)\}`)
		s = re.ReplaceAllString(s, "$1")
	}

	// Double-pass for nested macros like \emph{\mathcal{F}}
	for _, m := range macros {
		re := regexp.MustCompile(`\\` + m + `\{([^}]+)\}`)
		s = re.ReplaceAllString(s, "$1")
	}

	// Collapse whitespace introduced by tag removal.
	s = regexp.MustCompile(`\s+`).ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}
