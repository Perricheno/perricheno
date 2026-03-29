# Use rocker/r-ver which is optimized for fast binary installation via Posit Package Manager
FROM rocker/r-ver:4.4.0

# Install system dependencies required by various R packages
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
    && rm -rf /var/lib/apt/lists/*

# Install R packages using the pre-configured binary repository (extremely fast)
RUN install2.r --error --skipinstalled \
    ggplot2 plotly dplyr tidyr readr tibble stringr \
    plot3D scatterplot3d \
    corrplot pheatmap \
    treemap igraph \
    viridis RColorBrewer scales \
    Cairo svglite \
    jsonlite httpuv \
    ggridges ggrepel patchwork gridExtra \
    reshape2 forcats lubridate

COPY server.R /app/server.R

WORKDIR /app

EXPOSE 8000

CMD ["Rscript", "server.R"]
