# R Visualization Knowledge Base (Compact)

## Core Libraries
- **ggplot2** - primary visualization (use for 90% of charts)
- **dplyr** - data manipulation
- **tidyr** - data reshaping
- **plotly** - interactive charts (ggplotly wrapper)
- **viridis/RColorBrewer** - color palettes

## Chart Type Patterns

### Distribution
```r
# Histogram
ggplot(data, aes(x=value)) + geom_histogram(bins=30, fill="#69b3a2") + theme_minimal()

# Density
ggplot(data, aes(x=value)) + geom_density(fill="#69b3a2", alpha=0.6) + theme_minimal()

# Boxplot
ggplot(data, aes(x=group, y=value)) + geom_boxplot(fill="#69b3a2") + theme_minimal()

# Violin
ggplot(data, aes(x=group, y=value)) + geom_violin(fill="#69b3a2") + theme_minimal()
```

### Correlation
```r
# Scatter
ggplot(data, aes(x=x, y=y)) + geom_point(color="#69b3a2", size=3, alpha=0.6) + theme_minimal()

# Heatmap
ggplot(data, aes(x=x, y=y, fill=value)) + geom_tile() + scale_fill_viridis() + theme_minimal()

# Bubble
ggplot(data, aes(x=x, y=y, size=z)) + geom_point(alpha=0.5, color="#69b3a2") + theme_minimal()
```

### Ranking
```r
# Barplot
ggplot(data, aes(x=reorder(category, value), y=value)) + 
  geom_bar(stat="identity", fill="#69b3a2") + coord_flip() + theme_minimal()

# Lollipop
ggplot(data, aes(x=reorder(category, value), y=value)) + 
  geom_segment(aes(xend=category, yend=0)) + geom_point(size=4, color="#69b3a2") + 
  coord_flip() + theme_minimal()
```

### Evolution
```r
# Line
ggplot(data, aes(x=time, y=value)) + geom_line(color="#69b3a2", size=1.2) + theme_minimal()

# Area
ggplot(data, aes(x=time, y=value)) + geom_area(fill="#69b3a2", alpha=0.6) + theme_minimal()

# Stacked Area
ggplot(data, aes(x=time, y=value, fill=group)) + geom_area() + 
  scale_fill_viridis(discrete=TRUE) + theme_minimal()
```

### Part-to-Whole
```r
# Pie (use coord_polar)
ggplot(data, aes(x="", y=value, fill=category)) + 
  geom_bar(stat="identity", width=1) + coord_polar("y") + theme_void()

# Treemap (treemap package)
library(treemap)
treemap(data, index="category", vSize="value", vColor="value", 
        type="value", palette="RdYlGn")

# Stacked Bar
ggplot(data, aes(x=x, y=value, fill=group)) + 
  geom_bar(stat="identity") + scale_fill_viridis(discrete=TRUE) + theme_minimal()
```

### Networks & Flow
```r
# Network (igraph + ggraph)
library(igraph); library(ggraph)
g <- graph_from_data_frame(edges, vertices=nodes)
ggraph(g, layout="fr") + geom_edge_link() + geom_node_point(size=5) + theme_void()

# Sankey (networkD3)
library(networkD3)
sankeyNetwork(Links=links, Nodes=nodes, Source="source", Target="target", 
              Value="value", NodeID="name")

# Chord (circlize)
library(circlize)
chordDiagram(matrix, transparency=0.5)
```

### Maps
```r
# Choropleth (ggplot2 + maps)
library(maps)
map_data <- map_data("world")
ggplot(data, aes(map_id=region)) + geom_map(aes(fill=value), map=map_data) + 
  expand_limits(x=map_data$long, y=map_data$lat) + scale_fill_viridis() + theme_void()

# Bubble Map
ggplot(data, aes(x=long, y=lat, size=value)) + 
  borders("world", colour="gray85", fill="gray80") + 
  geom_point(alpha=0.5, color="#69b3a2") + theme_void()
```

### 3D & Advanced
```r
# 3D Scatter (plotly)
library(plotly)
plot_ly(data, x=~x, y=~y, z=~z, type="scatter3d", mode="markers")

# 3D Surface
plot_ly(z=~volcano, type="surface")
```

## Essential Patterns

### Data Preparation
```r
library(dplyr)
data <- data %>%
  filter(!is.na(value)) %>%
  mutate(new_col = value * 2) %>%
  group_by(category) %>%
  summarise(mean_val = mean(value))
```

### Theme Customization
```r
theme_minimal(base_size=13) +
  theme(
    plot.title = element_text(size=16, face="bold"),
    axis.text = element_text(size=11),
    legend.position = "bottom"
  )
```

### Color Scales
```r
# Grayscale (for B&W requirement)
scale_fill_grey(start=0.15, end=0.85)
scale_color_grey(start=0.1, end=0.7)

# Viridis (colorful)
scale_fill_viridis(discrete=TRUE, option="D")
scale_color_viridis()
```

### Interactive Conversion
```r
library(plotly)
p <- ggplot(...) + ...
ggplotly(p)
```

## Common Fixes

### Overlapping Labels
```r
library(ggrepel)
geom_text_repel(aes(label=name), size=3)
```

### Large Datasets
```r
# Sample data
data_sample <- data[sample(nrow(data), 5000), ]

# Use alpha for overplotting
geom_point(alpha=0.3)
```

### Axis Formatting
```r
scale_y_continuous(labels=scales::comma)  # 1,000,000
scale_x_date(date_labels="%b %Y")         # Jan 2024
```

## Quick Reference

**Always include:**
- `library(ggplot2)` or `library(tidyverse)`
- `theme_minimal()` or `theme_classic()` for clean look
- Proper axis labels: `xlab()`, `ylab()`, `ggtitle()`

**Never use:**
- `png()`, `pdf()`, `dev.off()` - compiler handles output
- Base R `plot()` unless specifically requested
- Hardcoded data when file is provided

**Best practices:**
- Use `set.seed(42)` for reproducibility
- Check for NA values: `filter(!is.na(col))`
- Reorder factors for better viz: `reorder(category, value)`
- Use meaningful variable names
- Add comments for complex transformations
