library(httpuv)
library(jsonlite)

# ─────────────────────────────────────
# Perricheno R Compiler Microservice
# Internal API — no external access
# ─────────────────────────────────────

MAX_EXEC_TIME <- 30  # seconds

compile_r_code <- function(code) {
  # Create isolated temp directory
  tmp_dir <- tempfile(pattern = "rcompile_")
  dir.create(tmp_dir, recursive = TRUE)
  
  script_path <- file.path(tmp_dir, "script.R")
  output_path <- file.path(tmp_dir, "output.png")
  
  # Wrap code: set working directory, auto-install missing packages, and output to output.png
  wrapped_code <- paste0(
    'setwd("', gsub("\\\\", "/", tmp_dir), '")\n',
    'options(repos = c(CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"))\n',
    'library(Cairo)\n',
    'CairoPNG("output.png", width=800, height=600, dpi=150)\n',
    code, '\n',
    'dev.off()\n'
  )
  
  writeLines(wrapped_code, script_path)
  
  # Execute with timeout using system2
  result <- tryCatch({
    # Use xvfb-run for headless rendering (needed for some 3D plots)
    output <- system2(
      "timeout", 
      args = c(as.character(MAX_EXEC_TIME), "Rscript", script_path),
      stdout = TRUE, 
      stderr = TRUE
    )
    exit_code <- attr(output, "status")
    if (is.null(exit_code)) exit_code <- 0
    
    list(
      success = (exit_code == 0) && file.exists(output_path),
      log = paste(output, collapse = "\n"),
      exit_code = exit_code
    )
  }, error = function(e) {
    list(success = FALSE, log = conditionMessage(e), exit_code = 1)
  })
  
  # Read image if successful
  image_b64 <- NULL
  if (result$success && file.exists(output_path)) {
    raw_img <- readBin(output_path, what = "raw", n = file.info(output_path)$size)
    image_b64 <- base64enc::base64encode(raw_img)
  }
  
  # Cleanup
  unlink(tmp_dir, recursive = TRUE)
  
  list(
    success = result$success,
    image = image_b64,
    log = result$log
  )
}

# Install base64enc if not available
if (!requireNamespace("base64enc", quietly = TRUE)) {
  install.packages("base64enc", repos = "https://cran.r-project.org")
}
library(base64enc)

cat("🚀 R Compiler starting on port 8000...\n")

app <- list(
  call = function(req) {
    # Health check
    if (req$PATH_INFO == "/health") {
      return(list(
        status = 200L,
        headers = list("Content-Type" = "application/json"),
        body = '{"status":"ok"}'
      ))
    }
    
    # Only accept POST /compile
    if (req$REQUEST_METHOD != "POST" || req$PATH_INFO != "/compile") {
      return(list(
        status = 404L,
        headers = list("Content-Type" = "application/json"),
        body = '{"error":"Not found"}'
      ))
    }
    
    # Read body
    body_raw <- req$rook.input$read()
    body_text <- rawToChar(body_raw)
    
    tryCatch({
      payload <- fromJSON(body_text)
      code <- payload$code
      
      if (is.null(code) || nchar(trimws(code)) == 0) {
        return(list(
          status = 400L,
          headers = list("Content-Type" = "application/json"),
          body = '{"error":"No code provided"}'
        ))
      }
      
      cat("📊 Compiling R code (", nchar(code), " chars)...\n")
      result <- compile_r_code(code)
      
      response <- toJSON(result, auto_unbox = TRUE)
      
      list(
        status = 200L,
        headers = list("Content-Type" = "application/json"),
        body = response
      )
    }, error = function(e) {
      list(
        status = 500L,
        headers = list("Content-Type" = "application/json"),
        body = toJSON(list(error = conditionMessage(e)), auto_unbox = TRUE)
      )
    })
  }
)

runServer("0.0.0.0", 8000, app)
