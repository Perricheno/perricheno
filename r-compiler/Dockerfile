# Use rocker/r-ver which is optimized for fast binary installation via Posit Package Manager
FROM rocker/r-ver:4.4.0

# Install system dependencies required by various R packages and Go compiler
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2-dev \
    libxt-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libfontconfig1-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    libglu1-mesa-dev \
    xvfb \
    golang \
    && rm -rf /var/lib/apt/lists/*

# Install core dependencies first to ensure they are available
RUN install2.r --error --skipinstalled promises htmlwidgets

# Install visualization and data science packages
RUN install2.r --error --skipinstalled \
    ggplot2 plotly dplyr tidyr readr tibble stringr \
    plot3D scatterplot3d \
    corrplot pheatmap \
    treemap igraph \
    viridis RColorBrewer scales \
    Cairo svglite \
    ggridges ggrepel patchwork gridExtra \
    reshape2 forcats lubridate \
    fmsb waffle waterfalls wordcloud ggExtra ggalt \
    ggthemes showtext ggsci hrbrthemes esquisse

WORKDIR /app

COPY main.go /app/main.go
RUN go build -o r-compiler main.go

EXPOSE 8000

CMD ["./r-compiler"]
