# R Visualization Knowledge Base (Compact)

## CRITICAL: Output Constraints
The compiler captures the graphics device as PNG. Only use libraries that write to R's graphics device.

**BANNED — produce HTML/interactive output, NOT PNG:**
- `plotly`, `ggplotly()`, `htmlwidgets`, `networkD3`, `leaflet`, `dygraphs`, `rbokeh`
- `sankeyNetwork()`, `chordNetwork()`, `forceNetwork()`

**ALLOWED ggplot2/base-R libraries:**
- `ggplot2`, `dplyr`, `tidyr`, `ggrepel`, `ggforce`, `ggraph`, `igraph`
- `circlize`, `treemap`, `wordcloud`, `corrplot`
- `scatterplot3d` (3D scatter), `lattice` (3D surface with `wireframe`)
- `ggalluvial` (Sankey/alluvial flows)
- `waffle`, `ggridges`, `vioplot`, `beeswarm`

## Chart Type Patterns

### Distribution
```r
# Histogram
ggplot(df, aes(x=value)) + geom_histogram(bins=30, fill="grey40") + theme_minimal()

# Density
ggplot(df, aes(x=value)) + geom_density(fill="grey60", alpha=0.7) + theme_minimal()

# Boxplot
ggplot(df, aes(x=group, y=value)) + geom_boxplot(fill="grey70") + theme_minimal()

# Violin
ggplot(df, aes(x=group, y=value)) + geom_violin(fill="grey60") + geom_boxplot(width=0.07, fill="white") + theme_minimal()

# Ridgeline
library(ggridges)
ggplot(df, aes(x=value, y=group, fill=group)) + geom_density_ridges() + scale_fill_grey() + theme_minimal()

# Beeswarm
library(beeswarm)
beeswarm(value ~ group, data=df, col=c("grey30","grey60"), pch=16, method="swarm")
```

### Correlation
```r
# Scatter
ggplot(df, aes(x=x, y=y)) + geom_point(color="grey30", size=2, alpha=0.6) + theme_minimal()

# Heatmap (use reshape2 or pivot_longer to get long format first)
library(reshape2)
mat <- cor(df[sapply(df, is.numeric)])
melted <- melt(mat)
ggplot(melted, aes(x=Var1, y=Var2, fill=value)) +
  geom_tile() + scale_fill_gradient2(low="grey90", mid="white", high="grey10", midpoint=0) +
  theme_minimal() + theme(axis.text.x=element_text(angle=45, hjust=1))

# Correlogram
library(corrplot)
mat <- cor(df[sapply(df, is.numeric)])
corrplot(mat, method="circle", col=grey.colors(200, start=0.1, end=0.9))

# Bubble
ggplot(df, aes(x=x, y=y, size=z)) + geom_point(color="grey40", alpha=0.5) + theme_minimal()
```

### Ranking
```r
# Barplot
ggplot(df, aes(x=reorder(category, value), y=value)) +
  geom_bar(stat="identity", fill="grey40") + coord_flip() + theme_minimal()

# Lollipop
ggplot(df, aes(x=reorder(category, value), y=value)) +
  geom_segment(aes(xend=category, yend=0), color="grey60") +
  geom_point(size=4, color="grey20") + coord_flip() + theme_minimal()

# Dumbbell
library(ggalt)
ggplot(df, aes(x=val1, xend=val2, y=reorder(category, val1))) +
  geom_dumbbell(color="grey70", size=1.2) + theme_minimal()
```

### Evolution
```r
# Line
ggplot(df, aes(x=time, y=value)) + geom_line(color="grey20", size=1) + theme_minimal()

# Area
ggplot(df, aes(x=time, y=value)) + geom_area(fill="grey60", alpha=0.7) + theme_minimal()

# Stacked Area
ggplot(df, aes(x=time, y=value, fill=group)) +
  geom_area() + scale_fill_grey() + theme_minimal()
```

### Part-to-Whole
```r
# Pie
ggplot(df, aes(x="", y=value, fill=category)) +
  geom_bar(stat="identity", width=1) + coord_polar("y") +
  scale_fill_grey() + theme_void()

# Treemap
library(treemap)
treemap(df, index="category", vSize="value", palette=grey.colors(10, start=0.2, end=0.9))

# Stacked Bar
ggplot(df, aes(x=x, y=value, fill=group)) +
  geom_bar(stat="identity") + scale_fill_grey() + theme_minimal()

# Waffle
library(waffle)
waffle(setNames(df$value, df$category), rows=8, colors=grey.colors(nrow(df)))

# Circular Barplot
ggplot(df, aes(x=factor(category), y=value)) +
  geom_bar(stat="identity", fill="grey40") +
  coord_polar() + theme_minimal()
```

### Networks & Flow
```r
# Network (igraph + ggraph — ggplot2 based, produces PNG)
library(igraph); library(ggraph)
g <- graph_from_data_frame(edges, vertices=nodes, directed=FALSE)
ggraph(g, layout="fr") +
  geom_edge_link(color="grey70", alpha=0.7) +
  geom_node_point(size=5, color="grey30") +
  geom_node_text(aes(label=name), repel=TRUE, size=3) +
  theme_void()

# Sankey / Alluvial — use ggalluvial (NOT networkD3)
library(ggalluvial)
ggplot(df, aes(axis1=from, axis2=to, y=value)) +
  geom_alluvium(fill="grey50", alpha=0.7) +
  geom_stratum() +
  geom_text(stat="stratum", aes(label=after_stat(stratum)), size=3) +
  theme_void()

# Chord diagram — circlize writes to graphics device
library(circlize)
mat <- as.matrix(df_wide)  # adjacency matrix
chordDiagram(mat, col=grey.colors(nrow(mat), start=0.2, end=0.8), transparency=0.4)
```

### Maps
```r
# Choropleth
library(maps)
world <- map_data("world")
ggplot(df, aes(map_id=region)) +
  geom_map(aes(fill=value), map=world) +
  expand_limits(x=world$long, y=world$lat) +
  scale_fill_gradient(low="grey90", high="grey10") + theme_void()

# Bubble Map
ggplot(df, aes(x=long, y=lat, size=value)) +
  borders("world", colour="grey80", fill="grey95") +
  geom_point(color="grey30", alpha=0.5) + theme_void()
```

### 3D Charts (base-R — NOT plotly)
```r
# 3D Scatter — use scatterplot3d (NOT plotly)
library(scatterplot3d)
scatterplot3d(df$x, df$y, df$z, pch=16, color="grey40",
              xlab="X", ylab="Y", zlab="Z", main="3D Scatter")

# 3D Surface — use lattice wireframe (NOT plotly)
library(lattice)
wireframe(z ~ x + y, data=df, shade=TRUE, col.regions=grey.colors(100))
```

### Word Cloud
```r
library(wordcloud)
wordcloud(words=df$word, freq=df$freq, min.freq=1,
          colors=grey.colors(8, start=0.1, end=0.8), scale=c(4, 0.5))
```

## Essential Patterns

### Data Preparation
```r
library(dplyr)
df <- df %>%
  filter(!is.na(value)) %>%
  mutate(new_col = value * 2) %>%
  group_by(category) %>%
  summarise(mean_val = mean(value, na.rm=TRUE))
```

### Axis Formatting
```r
scale_y_continuous(labels=scales::comma)
scale_x_date(date_labels="%b %Y")
```

### Overlapping Labels
```r
library(ggrepel)
geom_text_repel(aes(label=name), size=3, max.overlaps=20)
```

### Fill Scale Rules (CRITICAL — wrong scale = immediate crash)
```r
# DISCRETE fill (bar, boxplot, violin, grouped charts, pie, stacked area, ridgeline)
# aes(fill = <categorical/factor column>) → use scale_fill_grey()
ggplot(df, aes(x=group, y=value, fill=group)) +
  geom_boxplot() + scale_fill_grey(start=0.15, end=0.85) + theme_minimal()

# CONTINUOUS fill (heatmap, geom_tile, density2d, raster, choropleth map)
# aes(fill = <numeric column>) → use scale_fill_gradient() or scale_fill_gradient2()
ggplot(melted, aes(x=Var1, y=Var2, fill=value)) +
  geom_tile() + scale_fill_gradient2(low="grey90", mid="white", high="grey10", midpoint=0) +
  theme_minimal()

# RULE: if fill= maps to numbers → gradient; if fill= maps to categories → grey
# NEVER use scale_fill_grey() when aes(fill=<numeric>) — crashes with:
#   "Continuous values supplied to discrete scale"
```

### Arc / Network Diagrams (safe pattern)
```r
# Arc diagram — use igraph + ggraph with geom_edge_arc (NOT custom left_join)
library(igraph); library(ggraph)
edges <- data.frame(from=c("A","B","C"), to=c("B","C","A"), weight=c(1,2,3))
g <- graph_from_data_frame(edges, directed=FALSE)
ggraph(g, layout="linear") +
  geom_edge_arc(aes(width=weight), color="grey50", alpha=0.7) +
  geom_node_point(size=5, color="grey30") +
  geom_node_text(aes(label=name), vjust=-1, size=3) +
  theme_void()
```

## Non-negotiable Rules
1. End script with `p` (ggplot object) or the bare function call for base-R
2. NEVER call `png()`, `pdf()`, `ggsave()`, `dev.off()`
3. NEVER use `plotly`, `ggplotly()`, `networkD3`, `htmlwidgets` — they produce HTML, not PNG
4. NEVER hardcode data when a file is provided — use `read.csv("filename")`
5. `set.seed(42)` before any random generation
6. `filter(!is.na(col))` before plotting to avoid NA crashes
7. Keep code under 90 lines
8. FILL SCALES: `scale_fill_grey()` for categorical fill, `scale_fill_gradient()`/`scale_fill_gradient2()` for numeric fill — mixing them crashes immediately
