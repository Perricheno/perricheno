# R Studio - Visualization Guide & Coding Standards

## Aesthetic Philosophy
The R Studio page uses a **black-and-white / grayscale** design system. Default all generated visuals to match:
- `theme_minimal(base_size = 13)` or `theme_classic(base_size = 13)`
- `scale_fill_grey(start = 0.15, end = 0.85)` for categorical fills
- `scale_color_grey(start = 0.1, end = 0.7)` for color aesthetics
- Plot background: white or near-white
- Grid lines: `#e8e8e8` only (or none)
- Title: bold, black, font size 14-16
- Axis labels: black, 11-12pt

When the topic/prompt implies color (e.g. "red vs blue teams"), use a minimal 2-shade grey instead.

## ggplot2 Recipes by Chart Type

### bar
```r
library(ggplot2); library(dplyr)
p <- ggplot(df, aes(x = reorder(category, -value), y = value)) +
  geom_bar(stat = "identity", fill = "#1a1a1a", width = 0.65) +
  geom_text(aes(label = value), vjust = -0.4, size = 3.2, color = "#555") +
  theme_minimal(base_size = 13) +
  theme(panel.grid.major.x = element_blank(), panel.grid.minor = element_blank(),
        axis.text.x = element_text(angle = 35, hjust = 1)) +
  labs(title = "...", x = NULL, y = "...")
```

### histogram
```r
p <- ggplot(df, aes(x = value)) +
  geom_histogram(bins = 30, fill = "#333", color = "white", linewidth = 0.3) +
  theme_minimal(base_size = 13) +
  theme(panel.grid.minor = element_blank())
```

### boxplot
```r
p <- ggplot(df, aes(x = group, y = value)) +
  geom_boxplot(fill = "#f0f0f0", color = "#1a1a1a", outlier.color = "#888", outlier.size = 1.5) +
  theme_minimal(base_size = 13) + theme(panel.grid.major.x = element_blank())
```

### violin
```r
library(ggplot2)
p <- ggplot(df, aes(x = group, y = value)) +
  geom_violin(fill = "#ddd", color = "#1a1a1a", trim = FALSE) +
  geom_boxplot(width = 0.08, fill = "white", color = "#1a1a1a") +
  theme_minimal(base_size = 13)
```

### heatmap (corrplot / ggplot2 tile)
```r
library(reshape2)
mat_melt <- melt(cor_matrix)
p <- ggplot(mat_melt, aes(Var1, Var2, fill = value)) +
  geom_tile(color = "white") +
  scale_fill_gradient2(low = "#fff", mid = "#999", high = "#1a1a1a", midpoint = 0) +
  theme_minimal(base_size = 11) +
  theme(axis.text.x = element_text(angle = 45, hjust = 1)) +
  coord_fixed()
```

### lollipop
```r
p <- ggplot(df, aes(x = reorder(label, value), y = value)) +
  geom_segment(aes(xend = label, y = 0, yend = value), color = "#ccc", linewidth = 0.8) +
  geom_point(size = 4, color = "#1a1a1a") +
  coord_flip() + theme_minimal(base_size = 13) +
  theme(panel.grid.major.y = element_blank())
```

### density2d
```r
p <- ggplot(df, aes(x = x, y = y)) +
  geom_density_2d_filled(alpha = 0.85) +
  scale_fill_grey(start = 0.95, end = 0.1) +
  theme_minimal(base_size = 13)
```

### bubble
```r
p <- ggplot(df, aes(x = x, y = y, size = z, fill = group)) +
  geom_point(alpha = 0.75, shape = 21, color = "#1a1a1a", stroke = 0.5) +
  scale_fill_grey(start = 0.3, end = 0.85) +
  scale_size_continuous(range = c(3, 18)) +
  theme_minimal(base_size = 13) + guides(size = guide_legend(title = "Size"))
```

### dumbbell
```r
library(ggplot2)
p <- ggplot(df) +
  geom_segment(aes(x = before, xend = after, y = label, yend = label), color = "#ccc", linewidth = 1.2) +
  geom_point(aes(x = before, y = label), color = "#888", size = 3.5) +
  geom_point(aes(x = after, y = label), color = "#1a1a1a", size = 3.5) +
  theme_minimal(base_size = 13) + theme(panel.grid.major.y = element_blank())
```

### radar (fmsb)
```r
library(fmsb)
# fmsb radar requires specific data format: first 2 rows = max/min
data_r <- rbind(rep(10,5), rep(0,5), c(7,8,5,6,9))
colnames(data_r) <- c("A","B","C","D","E")
radarchart(data.frame(data_r), axistype = 1, pcol = "#1a1a1a", pfcol = rgb(0,0,0,0.15),
           plwd = 2, cglcol = "#ddd", cglty = 1, axislabcol = "#888",
           vlcex = 0.9, title = "Radar Chart")
```

### sankey
```r
library(ggplot2); library(ggalluvial)
p <- ggplot(df, aes(axis1 = from, axis2 = to, y = value)) +
  geom_alluvium(fill = "#888", alpha = 0.7) +
  geom_stratum(fill = "#1a1a1a", color = "white") +
  geom_text(stat = "stratum", aes(label = after_stat(stratum)), color = "white", size = 3.5) +
  theme_minimal(base_size = 13) + theme(axis.text.y = element_blank(), panel.grid = element_blank())
```

### chord (circlize)
```r
library(circlize)
chordDiagram(mat, col = grey.colors(nrow(mat), start = 0.2, end = 0.8),
             transparency = 0.4, annotationTrack = "grid",
             preAllocateTracks = list(track.height = 0.1))
```

### wordcloud
```r
library(wordcloud); library(RColorBrewer)
wordcloud(words = df$word, freq = df$freq, min.freq = 2, max.words = 80,
          random.order = FALSE, rot.per = 0.3,
          colors = grey.colors(8, start = 0.1, end = 0.7))
```

### waffle
```r
library(waffle)
vals <- c(A = 40, B = 30, C = 20, D = 10)
waffle(vals, rows = 5, colors = grey.colors(4, start = 0.1, end = 0.85),
       title = "Waffle Chart", xlab = "1 sq = 1 unit")
```

### dendrogram
```r
hc <- hclust(dist(scale(df_numeric)))
plot(hc, main = "Dendrogram", sub = "", xlab = "", cex = 0.75,
     col = "#1a1a1a", lwd = 1.2)
```

### parallel (GGally / ggparcoord)
```r
library(GGally)
p <- ggparcoord(df, columns = 2:ncol(df), groupColumn = 1, alpha = 0.4,
                scale = "uniminmax") +
  scale_color_grey(start = 0.2, end = 0.7) +
  theme_minimal(base_size = 13) + xlab("") + ylab("Normalized value")
```

### marginal (ggExtra)
```r
library(ggplot2); library(ggExtra)
p <- ggplot(df, aes(x = x, y = y)) +
  geom_point(alpha = 0.6, color = "#1a1a1a", size = 1.8) +
  theme_minimal(base_size = 13)
p <- ggMarginal(p, type = "histogram", fill = "#888", color = "white")
```

### circlepack
```r
library(packcircles); library(ggplot2)
packing <- circleProgressiveLayout(df$value, sizetype = "area")
df2 <- cbind(df, packing)
df_gg <- circleLayoutVertices(packing, npoints = 50)
p <- ggplot() +
  geom_polygon(data = df_gg, aes(x, y, group = id, fill = as.factor(id)), alpha = 0.75, color = "white") +
  scale_fill_grey(start = 0.2, end = 0.9) +
  geom_text(data = df2, aes(x, y, label = label), size = 3) +
  theme_void() + theme(legend.position = "none")
```

### 3d_scatter (scatterplot3d)
```r
library(scatterplot3d)
s3d <- scatterplot3d(df$x, df$y, df$z, pch = 19, color = "#1a1a1a",
                     main = "3D Scatter", xlab = "X", ylab = "Y", zlab = "Z",
                     grid = TRUE, box = FALSE, angle = 35)
```

### 3d_surface (plot3D)
```r
library(plot3D)
persp3D(x = xseq, y = yseq, z = z_matrix, theta = 40, phi = 25,
        col = grey.colors(100, start = 0.05, end = 0.95),
        border = NA, shade = 0.4, main = "3D Surface")
```

## Critical Rules
1. ALWAYS end the script with the plot object `p` or equivalent (for ggplot2).
   For base-R plots (radarchart, wordcloud, dendrogram, chord, 3D), the plot is produced by the function call itself - no assignment needed.
2. NEVER use `png()`, `pdf()`, `cairo_pdf()`, `dev.off()` - the compiler handles output capture.
3. NEVER use external files - generate all data inline.
4. Use `set.seed(42)` before any `rnorm()` / `sample()` for reproducibility.
5. Text overlap: always add `ggrepel::geom_text_repel()` when labeling many points.
6. Keep code under 80 lines - concise, production-quality.
