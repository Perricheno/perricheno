# R Graph Gallery - Все примеры кода

Всего примеров: 466

---

## 1. 1-one-title-for-2-graphs

**Файл:** `1-one-title-for-2-graphs_1.R`

```r
#Dummy data 
Ixos <- rnorm(4000,100,30)
Primadur <- Ixos+rnorm(4000 , 0 , 30)
 
#Divide the screen in 1 line and 2 columns
par(
  mfrow=c(1,2), 
  oma = c(0, 0, 2, 0)
) 
 
#Make the margin around each graph a bit smaller
par(mar=c(4,2,2,2))
 
# Histogram and Scatterplot
hist(Ixos,  main="" , breaks=30 , col=rgb(0.3,0.5,1,0.4) , xlab="height" , ylab="nbr of plants")
plot(Ixos , Primadur,  main="" , pch=20 , cex=0.4 , col=rgb(0.3,0.5,1,0.4)  , xlab="primadur" , ylab="Ixos" )
 
#And I add only ONE title :
mtext("Primadur : Distribution and correlation with Ixos", outer = TRUE, cex = 1.5, font=4, col=rgb(0.1,0.3,0.5,0.5) )
```

---

## 2. 1-one-title-for-2-graphs

**Файл:** `1-one-title-for-2-graphs_2.R`

```r
# Create data
data = data.frame(
  x=seq(1:100) + 0.1*seq(1:100)*sample(c(1:10) , 100 , replace=T),
  y=seq(1:100) + 0.2*seq(1:100)*sample(c(1:10) , 100 , replace=T)
)

# Basic scatterplot
plot(data$x, data$y,
     xlim=c(0,250) , ylim=c(0,250), 
     pch=18, 
     cex=2, 
     col="#69b3a2",
     xlab="value of X", ylab="value of Y",
     main="A simple scatterplot"
     )
```

---

## 3. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_1.R`

```r
# Load the library
library(qqman)

# Make the Manhattan plot on the gwasResults dataset
manhattan(gwasResults, chr="CHR", bp="BP", snp="SNP", p="P" )
```

---

## 4. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_2.R`

```r
##  Circular Manhattan plotting P.
##  Plots are stored in: /Users/josephbarbier/Desktop/R-graph-gallery
```

---

## 5. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_3.R`

```r
data(pig60K)
CMplot(pig60K, plot.type="c", chr.labels=paste("Chr",c(1:18,"X","Y"),sep=""), r=0.4, 
      outward=FALSE, cir.chr.h=1.3 ,chr.den.col="black", file="jpg", dpi=300)
```

---

## 6. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_4.R`

```r
##  Circular Manhattan plotting trait1.
##  Circular Manhattan plotting trait2.
##  Circular Manhattan plotting trait3.
##  Plots are stored in: /Users/josephbarbier/Desktop/R-graph-gallery
```

---

## 7. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_5.R`

```r
# Let's highlight them, with a bit of customization on the plot
snpsOfInterest
```

---

## 8. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_6.R`

```r
manhattan(gwasResults, highlight = snpsOfInterest)
```

---

## 9. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_7.R`

```r
manhattan(gwasResults, annotatePval = 0.01)
```

---

## 10. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_8.R`

```r
don <- gwasResults %>% 
  
  # Compute chromosome size
  group_by(CHR) %>% 
  summarise(chr_len=max(BP)) %>% 
  
  # Calculate cumulative position of each chromosome
  mutate(tot=cumsum(chr_len)-chr_len) %>%
  select(-chr_len) %>%
  
  # Add this info to the initial dataset
  left_join(gwasResults, ., by=c("CHR"="CHR")) %>%
  
  # Add a cumulative position of each SNP
  arrange(CHR, BP) %>%
  mutate( BPcum=BP+tot)

axisdf = don %>%
  group_by(CHR) %>%
  summarize(center=( max(BPcum) + min(BPcum) ) / 2 )
```

---

## 11. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_9.R`

```r
ggplot(don, aes(x=BPcum, y=-log10(P))) +
    
    # Show all points
    geom_point( aes(color=as.factor(CHR)), alpha=0.8, size=1.3) +
    scale_color_manual(values = rep(c("grey", "skyblue"), 22 )) +
    
    # custom X axis:
    scale_x_continuous( label = axisdf$CHR, breaks= axisdf$center ) +
    scale_y_continuous(expand = c(0, 0) ) +     # remove space between plot area and x axis
  
    # Custom the theme:
    theme_bw() +
    theme( 
      legend.position="none",
      panel.border = element_blank(),
      panel.grid.major.x = element_blank(),
      panel.grid.minor.x = element_blank()
    )
```

---

## 12. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_10.R`

```r
# List of SNPs to highlight are in the snpsOfInterest object
# We will use ggrepel for the annotation
library(ggrepel)

# Prepare the dataset
don <- gwasResults %>% 
  
  # Compute chromosome size
  group_by(CHR) %>% 
  summarise(chr_len=max(BP)) %>% 
  
  # Calculate cumulative position of each chromosome
  mutate(tot=cumsum(chr_len)-chr_len) %>%
  select(-chr_len) %>%
  
  # Add this info to the initial dataset
  left_join(gwasResults, ., by=c("CHR"="CHR")) %>%
  
  # Add a cumulative position of each SNP
  arrange(CHR, BP) %>%
  mutate( BPcum=BP+tot) %>%

  # Add highlight and annotation information
  mutate( is_highlight=ifelse(SNP %in% snpsOfInterest, "yes", "no")) %>%
  mutate( is_annotate=ifelse(-log10(P)>4, "yes", "no")) 

# Prepare X axis
axisdf <- don %>% group_by(CHR) %>% summarize(center=( max(BPcum) + min(BPcum) ) / 2 )

# Make the plot
ggplot(don, aes(x=BPcum, y=-log10(P))) +
    
    # Show all points
    geom_point( aes(color=as.factor(CHR)), alpha=0.8, size=1.3) +
    scale_color_manual(values = rep(c("grey", "skyblue"), 22 )) +
    
    # custom X axis:
    scale_x_continuous( label = axisdf$CHR, breaks= axisdf$center ) +
    scale_y_continuous(expand = c(0, 0) ) +     # remove space between plot area and x axis

    # Add highlighted points
    geom_point(data=subset(don, is_highlight=="yes"), color="orange", size=2) +
  
    # Add label using ggrepel to avoid overlapping
    geom_label_repel( data=subset(don, is_annotate=="yes"), aes(label=SNP), size=2) +

    # Custom the theme:
    theme_bw() +
    theme( 
      legend.position="none",
      panel.border = element_blank(),
      panel.grid.major.x = element_blank(),
      panel.grid.minor.x = element_blank()
    )
```

---

## 13. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_11.R`

```r
library(plotly)

# Prepare the dataset
don <- gwasResults %>% 
  
  # Compute chromosome size
  group_by(CHR) %>% 
  summarise(chr_len=max(BP)) %>% 
  
  # Calculate cumulative position of each chromosome
  mutate(tot=cumsum(chr_len)-chr_len) %>%
  select(-chr_len) %>%
  
  # Add this info to the initial dataset
  left_join(gwasResults, ., by=c("CHR"="CHR")) %>%
  
  # Add a cumulative position of each SNP
  arrange(CHR, BP) %>%
  mutate( BPcum=BP+tot) %>%

  # Add highlight and annotation information
  mutate( is_highlight=ifelse(SNP %in% snpsOfInterest, "yes", "no")) %>%

  # Filter SNP to make the plot lighter
  filter(-log10(P)>0.5)
  
# Prepare X axis
axisdf <- don %>% group_by(CHR) %>% summarize(center=( max(BPcum) + min(BPcum) ) / 2 )

# Prepare text description for each SNP:
don$text <- paste("SNP: ", don$SNP, "\nPosition: ", don$BP, "\nChromosome: ", don$CHR, "\nLOD score:", -log10(don$P) %>% round(2), "\nWhat else do you wanna know", sep="")

# Make the plot
p <- ggplot(don, aes(x=BPcum, y=-log10(P), text=text)) +
    
    # Show all points
    geom_point( aes(color=as.factor(CHR)), alpha=0.8, size=1.3) +
    scale_color_manual(values = rep(c("grey", "skyblue"), 22 )) +
    
    # custom X axis:
    scale_x_continuous( label = axisdf$CHR, breaks= axisdf$center ) +
    scale_y_continuous(expand = c(0, 0) ) +     # remove space between plot area and x axis
    ylim(0,9) +

    # Add highlighted points
    geom_point(data=subset(don, is_highlight=="yes"), color="orange", size=2) +
  
    # Custom the theme:
    theme_bw() +
    theme( 
      legend.position="none",
      panel.border = element_blank(),
      panel.grid.major.x = element_blank(),
      panel.grid.minor.x = element_blank()
    )
p = ggplotly(p, tooltip="text")

# save the widget
library(htmlwidgets)
saveWidget(p, file="HtmlWidget/interactiveManhattanPlot.html")
```

---

## 14. 101_Manhattan_plot

**Файл:** `101_Manhattan_plot_12.R`

```r
library("CMplot")
CMplot(gwasResults, plot.type="c", r=1.6,
        outward=TRUE, cir.chr.h=.1 ,chr.den.col="orange", file="jpg",
        dpi=300, chr.labels=seq(1,22))
```

---

## 15. 102-text-mining-and-wordcloud

**Файл:** `102-text-mining-and-wordcloud_1.R`

```r
# Packages
library(reshape)
library(tm)
library(wordcloud)
 
# --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 
# -- STEP 1 : GET THE DATA
# A dataset with 5485 lines, each line has several words.
dataset=read.delim("https://raw.githubusercontent.com/TATABOX42/text-mining-in-r/master/dataset.txt", header=FALSE)
 
# The labels of each line of the dataset file
dataset_labels <- read.delim("https://raw.githubusercontent.com/TATABOX42/text-mining-in-r/master/labels.txt",header=FALSE)
dataset_labels <- dataset_labels[,1]
dataset_labels_p <- paste("class",dataset_labels,sep="_")
unique_labels <- unique(dataset_labels_p)
 
# merge documents that match certain class into a list object
dataset_s <- sapply(unique_labels,function(label) list( dataset[dataset_labels_p %in% label,1] ) )
 
 
# --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 
 
# -- STEP2 : COMPUTE DOCUMENT CORPUS TO MAKE TEXT MINING
# convert each list content into a corpus object
dataset_corpus <- lapply(dataset_s, function(x) VCorpus(VectorSource( toString(x) )))
 
# merge all documents into one single corpus
dataset_corpus_all <- dataset_corpus[[1]]
for (i in 2:length(unique_labels)) { dataset_corpus_all <- c(dataset_corpus_all,dataset_corpus[[i]]) }
 
# remove punctuation, numbers and stopwords
dataset_corpus_all <- tm_map(dataset_corpus_all, removePunctuation)
dataset_corpus_all <- tm_map(dataset_corpus_all, removeNumbers)
dataset_corpus_all <- tm_map(dataset_corpus_all, function(x) removeWords(x,stopwords("english")))
 
#remove some unintersting words
words_to_remove <- c("said","from","what","told","over","more","other","have","last","with","this","that","such","when","been","says","will","also","where","why","would","today")
dataset_corpus_all <- tm_map(dataset_corpus_all, removeWords, words_to_remove)
 
# compute term matrix & convert to matrix class --> you get a table summarizing the occurence of each word in each class.
document_tm <- TermDocumentMatrix(dataset_corpus_all)
document_tm_mat <- as.matrix(document_tm)
colnames(document_tm_mat) <- unique_labels
document_tm_clean <- removeSparseTerms(document_tm, 0.8)
document_tm_clean_mat <- as.matrix(document_tm_clean)
colnames(document_tm_clean_mat) <- unique_labels
 
# remove words in term matrix with length < 4
index <- as.logical(sapply(rownames(document_tm_clean_mat), function(x) (nchar(x)>3) ))
document_tm_clean_mat_s <- document_tm_clean_mat[index,]
 
# Have a look to the matrix you are going to use for wordcloud !
head(document_tm_clean_mat_s)
 
 
# --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 
# -- STEP 3 : make the graphics !
 
# Graph 1 : first top 500 discriminant words
png("#102_1_comparison_cloud_top_500_words.png", width = 480, height = 480)
comparison.cloud(document_tm_clean_mat_s, max.words=500, random.order=FALSE,c(4,0.4), title.size=1.4)
dev.off()
 
# Graph 2 : first top 2000 discriminant words
png("#102_1_comparison_cloud_top_2000_words.png", width = 480, height = 480)
comparison.cloud(document_tm_clean_mat_s,max.words=2000,random.order=FALSE,c(4,0.4), title.size=1.4)
dev.off()
 
# Graph 3: commonality word cloud : first top 2000 common words across classes
png("#103_commonality_wordcloud.png", width = 480, height = 480)
commonality.cloud(document_tm_clean_mat_s, max.words=2000, random.order=FALSE)
dev.off()
```

---

## 16. 104-plot-lines-with-error-envelopes-ggplot2

**Файл:** `104-plot-lines-with-error-envelopes-ggplot2_1.R`

```r
library(ggplot2)
 
# Get the data from the web !
CC <- read.table("http://www.sr.bham.ac.uk/~ajrs/papers/sanderson06/mean_Tprofile-CC.txt" ,  header=TRUE)
nCC <- read.table("http://www.sr.bham.ac.uk/~ajrs/papers/sanderson06/mean_Tprofile-nCC.txt" , header=TRUE)
CC$type <- "Cool core"
nCC$type <- "Non-cool core"
A <- rbind(CC, nCC)
 
 
# Make the plot
ggplot(data=A, aes(x=r.r500, y=sckT, ymin=sckT.lo, ymax=sckT.up, fill=type, linetype=type)) + 
 geom_line() + 
 geom_ribbon(alpha=0.5) + 
 scale_x_log10() + 
 scale_y_log10() + 
 xlab(as.expression(expression( paste("Radius (", R[500], ")") ))) + 
 ylab("Scaled Temperature")
```

---

## 17. 115-study-correlations-with-a-correlogram

**Файл:** `115-study-correlations-with-a-correlogram_1.R`

```r
# Corrgram library
library(corrgram)

# mtcars dataset is natively available in R
# head(mtcars)

# First
corrgram(mtcars, order=TRUE, lower.panel=panel.shade, upper.panel=panel.pie, text.panel=panel.txt, main="Car Milage Data in PC2/PC1 Order") 

# Second
corrgram(mtcars, order=TRUE, lower.panel=panel.ellipse, upper.panel=panel.pts, text.panel=panel.txt, diag.panel=panel.minmax, main="Car Milage Data in PC2/PC1 Order") 

# Third
corrgram(mtcars, order=NULL, lower.panel=panel.shade, upper.panel=NULL, text.panel=panel.txt, main="Car Milage Data (unsorted)")
```

---

## 18. 115-study-correlations-with-a-correlogram

**Файл:** `115-study-correlations-with-a-correlogram_2.R`

```r
# Quick display of two cabapilities of GGally, to assess the distribution and correlation of variables
library(GGally)

# Create data
data <- data.frame( var1 = 1:100 + rnorm(100,sd=20), v2 = 1:100 + rnorm(100,sd=27), v3 = rep(1, 100) + rnorm(100, sd = 1))
data$v4 = data$var1 ** 2
data$v5 = -(data$var1 ** 2)

# Check correlation between variables
#cor(data)

# Nice visualization of correlations
ggcorr(data, method = c("everything", "pearson"))
```

---

## 19. 115-study-correlations-with-a-correlogram

**Файл:** `115-study-correlations-with-a-correlogram_3.R`

```r
# Quick display of two cabapilities of GGally, to assess the distribution and correlation of variables
library(GGally)

# From the help page:
data(flea)
ggpairs(flea, columns = 2:4, ggplot2::aes(colour=species))
```

---

## 20. 115-study-correlations-with-a-correlogram

**Файл:** `115-study-correlations-with-a-correlogram_4.R`

```r
# Quick display of two cabapilities of GGally, to assess the distribution and correlation of variables
library(GGally)

# From the help page:
data(tips, package = "reshape")
ggpairs(
  tips[, c(1, 3, 4, 2)],
  upper = list(continuous = "density", combo = "box_no_facet"),
  lower = list(continuous = "points", combo = "dot_no_facet")
)
```

---

## 21. 119-add-a-legend-to-a-plot

**Файл:** `119-add-a-legend-to-a-plot_1.R`

```r
# Create data:
a=c(1:5)
b=c(5,3,4,5,5)
c=c(4,5,4,3,1)
 
# Make a basic graph
plot( b~a , type="b" , bty="l" , xlab="value of a" , ylab="value of b" , col=rgb(0.2,0.4,0.1,0.7) , lwd=3 , pch=17 , ylim=c(1,5) )
lines(c ~a , col=rgb(0.8,0.4,0.1,0.7) , lwd=3 , pch=19 , type="b" )
 
# Add a legend
legend("bottomleft", 
  legend = c("Group 1", "Group 2"), 
  col = c(rgb(0.2,0.4,0.1,0.7), 
  rgb(0.8,0.4,0.1,0.7)), 
  pch = c(17,19), 
  bty = "n", 
  pt.cex = 2, 
  cex = 1.2, 
  text.col = "black", 
  horiz = F , 
  inset = c(0.1, 0.1))
```

---

## 22. 120-plot-with-an-image-as-background

**Файл:** `120-plot-with-an-image-as-background_1.R`

```r
# If you want to show an image coming from the web, first download it with R:
download.file("https://github.com/holtzy/R-graph-gallery/blob/master/img/logo/R_full_medium.png?raw=true" , destfile="tmp.png")
#Else, just place the image in the current directory
 
# Charge the image as an R object with the "JPEG" package
library(jpeg)
library(png)
my_image <- readPNG("tmp.png")
 
# Set up a plot area with no plot
plot(1:2, type='n', main="", xlab="x", ylab="y")
 
# Get the plot information so the image will fill the plot box, and draw it
lim <- par()
rasterImage(my_image, 
            xleft=1, xright=2, 
            ybottom=1.3, ytop=1.7)
grid()
 
#Add your plot !
lines(
  x=c(1, 1.2, 1.4, 1.6, 1.8, 2.0), 
  y=c(1, 1.3, 1.7, 1.6, 1.7, 1.0), 
  type="b", lwd=5, col="black")
```

---

## 23. 122-a-circular-plot-with-the-circlize-package

**Файл:** `122-a-circular-plot-with-the-circlize-package_1.R`

```r
### You need several libraries
library(circlize)
library(migest)
library(dplyr)
 
### Make data
m <- data.frame(order = 1:6,
            country = c("Ausralia", "India", "China", "Japan", "Thailand", "Malaysia"),
            V3 = c(1, 150000, 90000, 180000, 15000, 10000),
            V4 = c(35000, 1, 10000, 12000, 25000, 8000),
            V5 = c(10000, 7000, 1, 40000, 5000, 4000),
            V6 = c(7000, 8000, 175000, 1, 11000, 18000),
            V7 = c(70000, 30000, 22000, 120000, 1, 40000),
            V8 = c(60000, 90000, 110000, 14000, 30000, 1),
            r = c(255,255,255,153,51,51),
            g = c(51, 153, 255, 255, 255, 255),
            b = c(51, 51, 51, 51, 51, 153),
            stringsAsFactors = FALSE)
df1 <- m[, c(1,2, 9:11)]
m <- m[,-(1:2)]/1e04
m <- as.matrix(m[,c(1:6)])
dimnames(m) <- list(orig = df1$country, dest = df1$country)
#Sort order of data.frame and matrix for plotting in circos
df1 <- arrange(df1, order)
df1$country <- factor(df1$country, levels = df1$country)
m <- m[levels(df1$country),levels(df1$country)]
 
 
### Define ranges of circos sectors and their colors (both of the sectors and the links)
df1$xmin <- 0
df1$xmax <- rowSums(m) + colSums(m)
n <- nrow(df1)
df1$rcol<-rgb(df1$r, df1$g, df1$b, max = 255)
df1$lcol<-rgb(df1$r, df1$g, df1$b, alpha=200, max = 255)
 
### Plot sectors (outer part)
par(mar=rep(0,4))
circos.clear()
 
### Basic circos graphic parameters
circos.par(cell.padding=c(0,0,0,0), track.margin=c(0,0.15), start.degree = 90, gap.degree =4)
 
### Sector details
circos.initialize(factors = df1$country, xlim = cbind(df1$xmin, df1$xmax))
 
### Plot sectors
circos.trackPlotRegion(ylim = c(0, 1), factors = df1$country, track.height=0.1,
                      #panel.fun for each sector
                      panel.fun = function(x, y) {
                      #select details of current sector
                      name = get.cell.meta.data("sector.index")
                      i = get.cell.meta.data("sector.numeric.index")
                      xlim = get.cell.meta.data("xlim")
                      ylim = get.cell.meta.data("ylim")
 
                      #text direction (dd) and adjusmtents (aa)
                      theta = circlize(mean(xlim), 1.3)[1, 1] %% 360
                      dd <- ifelse(theta < 90 || theta > 270, "clockwise", "reverse.clockwise")
                      aa = c(1, 0.5)
                      if(theta < 90 || theta > 270)  aa = c(0, 0.5)
 
                      #plot country labels
                      circos.text(x=mean(xlim), y=1.7, labels=name, facing = dd, cex=0.6,  adj = aa)
 
                      #plot main sector
                      circos.rect(xleft=xlim[1], ybottom=ylim[1], xright=xlim[2], ytop=ylim[2], 
                                  col = df1$rcol[i], border=df1$rcol[i])
 
                      #blank in part of main sector
                      circos.rect(xleft=xlim[1], ybottom=ylim[1], xright=xlim[2]-rowSums(m)[i], ytop=ylim[1]+0.3, 
                                  col = "white", border = "white")
 
                      #white line all the way around
                      circos.rect(xleft=xlim[1], ybottom=0.3, xright=xlim[2], ytop=0.32, col = "white", border = "white")
 
                      #plot axis
                      circos.axis(labels.cex=0.6, direction = "outside", major.at=seq(from=0,to=floor(df1$xmax)[i],by=5), 
                                  minor.ticks=1, labels.away.percentage = 0.15)
                    })
 
### Plot links (inner part)
### Add sum values to df1, marking the x-position of the first links
### out (sum1) and in (sum2). Updated for further links in loop below.
df1$sum1 <- colSums(m)
df1$sum2 <- numeric(n)
 
### Create a data.frame of the flow matrix sorted by flow size, to allow largest flow plotted first
df2 <- cbind(as.data.frame(m),orig=rownames(m),  stringsAsFactors=FALSE)
df2 <- reshape(df2, idvar="orig", varying=list(1:n), direction="long",
           timevar="dest", time=rownames(m),  v.names = "m")
df2 <- arrange(df2,desc(m))
 
### Keep only the largest flows to avoid clutter
df2 <- subset(df2, m > quantile(m,0.6))
 
### Plot links
for(k in 1:nrow(df2)){
    #i,j reference of flow matrix
    i<-match(df2$orig[k],df1$country)
    j<-match(df2$dest[k],df1$country)
 
#plot link
circos.link(sector.index1=df1$country[i], point1=c(df1$sum1[i], df1$sum1[i] + abs(m[i, j])),
            sector.index2=df1$country[j], point2=c(df1$sum2[j], df1$sum2[j] + abs(m[i, j])),
            col = df1$lcol[i])
 
#update sum1 and sum2 for use when plotting the next link
df1$sum1[i] = df1$sum1[i] + abs(m[i, j])
df1$sum2[j] = df1$sum2[j] + abs(m[i, j])
}
```

---

## 24. 123-circular-plot-circlize-package-2

**Файл:** `123-circular-plot-circlize-package-2_1.R`

```r
# Create an adjacency matrix: 
# a list of connections between 20 origin nodes, and 5 destination nodes:
numbers <- sample(c(1:1000), 100, replace = T)
data <- matrix( numbers, ncol=5)
rownames(data) <- paste0("orig-", seq(1,20))
colnames(data) <- paste0("dest-", seq(1,5))

# Load the circlize library
library(circlize)
 
# Make the circular plot
chordDiagram(data, transparency = 0.5)
```

---

## 25. 123-circular-plot-circlize-package-2

**Файл:** `123-circular-plot-circlize-package-2_2.R`

```r
# Create an edge list: a list of connections between 10 origin nodes, and 10 destination nodes:
origin <- paste0("orig ", sample(c(1:10), 20, replace = T))
destination <- paste0("dest ", sample(c(1:10), 20, replace = T))
data <- data.frame(origin, destination)

# Transform input data in a adjacency matrix
adjacencyData <- with(data, table(origin, destination))
 
# Charge the circlize library
library(circlize)
 
# Make the circular plot
chordDiagram(adjacencyData, transparency = 0.5)
```

---

## 26. 128-ring-or-donut-plot

**Файл:** `128-ring-or-donut-plot_1.R`

```r
# load library
library(ggplot2)
 
# Create test data.
data <- data.frame(
  category=c("A", "B", "C"),
  count=c(10, 60, 30)
)
 
# Compute percentages
data$fraction = data$count / sum(data$count)

# Compute the cumulative percentages (top of each rectangle)
data$ymax = cumsum(data$fraction)

# Compute the bottom of each rectangle
data$ymin = c(0, head(data$ymax, n=-1))
 
# Make the plot
ggplot(data, aes(ymax=ymax, ymin=ymin, xmax=4, xmin=3, fill=category)) +
     geom_rect() +
     coord_polar(theta="y") + # Try to remove that to understand how the chart is built initially
     xlim(c(2, 4)) # Try to remove that to see how to make a pie chart
```

---

## 27. 128-ring-or-donut-plot

**Файл:** `128-ring-or-donut-plot_2.R`

```r
# load library
library(ggplot2)

# Create test data.
data <- data.frame(
  category=c("A", "B", "C"),
  count=c(10, 60, 30)
)
 
# Compute percentages
data$fraction <- data$count / sum(data$count)

# Compute the cumulative percentages (top of each rectangle)
data$ymax <- cumsum(data$fraction)

# Compute the bottom of each rectangle
data$ymin <- c(0, head(data$ymax, n=-1))

# Compute label position
data$labelPosition <- (data$ymax + data$ymin) / 2

# Compute a good label
data$label <- paste0(data$category, "\n value: ", data$count)

# Make the plot
ggplot(data, aes(ymax=ymax, ymin=ymin, xmax=4, xmin=3, fill=category)) +
  geom_rect() +
  geom_label( x=3.5, aes(y=labelPosition, label=label), size=6) +
  scale_fill_brewer(palette=4) +
  coord_polar(theta="y") +
  xlim(c(2, 4)) +
  theme_void() +
  theme(legend.position = "none")
```

---

## 28. 128-ring-or-donut-plot

**Файл:** `128-ring-or-donut-plot_3.R`

```r
# load library
library(ggplot2)

# Create test data.
data <- data.frame(
  category=c("A", "B", "C"),
  count=c(10, 60, 30)
)
 
# Compute percentages
data$fraction <- data$count / sum(data$count)

# Compute the cumulative percentages (top of each rectangle)
data$ymax <- cumsum(data$fraction)

# Compute the bottom of each rectangle
data$ymin <- c(0, head(data$ymax, n=-1))

# Compute label position
data$labelPosition <- (data$ymax + data$ymin) / 2

# Compute a good label
data$label <- paste0(data$category, "\n value: ", data$count)

# Make the plot
ggplot(data, aes(ymax=ymax, ymin=ymin, xmax=4, xmin=3, fill=category)) +
  geom_rect() +
  geom_text( x=2, aes(y=labelPosition, label=label, color=category), size=6) + # x here controls label position (inner / outer)
  scale_fill_brewer(palette=3) +
  scale_color_brewer(palette=3) +
  coord_polar(theta="y") +
  xlim(c(-1, 4)) +
  theme_void() +
  theme(legend.position = "none")
```

---

## 29. 13-scatter-plot

**Файл:** `13-scatter-plot_1.R`

```r
# the iris dataset is provided by R natively

# Create a color palette
library(paletteer)
colors = paletteer_c("scico::berlin", n=3)

# Scatterplot with categoric color scale
plot(
  x = iris$Petal.Length,
  y = iris$Petal.Width,
  bg = colors[ unclass(iris$Species) ],
  cex = 3,
  pch=21
)
```

---

## 30. 13-scatter-plot

**Файл:** `13-scatter-plot_2.R`

```r
# the iris dataset is provided by R natively

# Create a color palette
library(paletteer)
nColor <- 20
colors = paletteer_c("viridis::inferno", n=nColor)

# Transform the numeric variable in bins
rank <- as.factor( as.numeric( cut(iris$Petal.Width, nColor)))

# Scatterplot with color gradient
plot(
  x = iris$Petal.Length, 
  y = iris$Petal.Width,
  bg = colors[ rank ],
  cex = 3,
  pch=21
)
```

---

## 31. 130-ring-or-donut-chart

**Файл:** `130-ring-or-donut-chart_1.R`

```r
# The doughnut function permits to draw a donut plot
doughnut <-
function (x, labels = names(x), edges = 200, outer.radius = 0.8,
          inner.radius=0.6, clockwise = FALSE,
          init.angle = if (clockwise) 90 else 0, density = NULL,
          angle = 45, col = NULL, border = FALSE, lty = NULL,
          main = NULL, ...)
{
    if (!is.numeric(x) || any(is.na(x) | x < 0))
        stop("'x' values must be positive.")
    if (is.null(labels))
        labels <- as.character(seq_along(x))
    else labels <- as.graphicsAnnot(labels)
    x <- c(0, cumsum(x)/sum(x))
    dx <- diff(x)
    nx <- length(dx)
    plot.new()
    pin <- par("pin")
    xlim <- ylim <- c(-1, 1)
    if (pin[1L] > pin[2L])
        xlim <- (pin[1L]/pin[2L]) * xlim
    else ylim <- (pin[2L]/pin[1L]) * ylim
    plot.window(xlim, ylim, "", asp = 1)
    if (is.null(col))
        col <- if (is.null(density))
          palette()
        else par("fg")
    col <- rep(col, length.out = nx)
    border <- rep(border, length.out = nx)
    lty <- rep(lty, length.out = nx)
    angle <- rep(angle, length.out = nx)
    density <- rep(density, length.out = nx)
    twopi <- if (clockwise)
        -2 * pi
    else 2 * pi
    t2xy <- function(t, radius) {
        t2p <- twopi * t + init.angle * pi/180
        list(x = radius * cos(t2p),
             y = radius * sin(t2p))
    }
    for (i in 1L:nx) {
        n <- max(2, floor(edges * dx[i]))
        P <- t2xy(seq.int(x[i], x[i + 1], length.out = n),
                  outer.radius)
        polygon(c(P$x, 0), c(P$y, 0), density = density[i],
                angle = angle[i], border = border[i],
                col = col[i], lty = lty[i])
        Pout <- t2xy(mean(x[i + 0:1]), outer.radius)
        lab <- as.character(labels[i])
        if (!is.na(lab) && nzchar(lab)) {
            lines(c(1, 1.05) * Pout$x, c(1, 1.05) * Pout$y)
            text(1.1 * Pout$x, 1.1 * Pout$y, labels[i],
                 xpd = TRUE, adj = ifelse(Pout$x < 0, 1, 0),
                 ...)
        }
        ## Add white disc          
        Pin <- t2xy(seq.int(0, 1, length.out = n*nx),
                  inner.radius)
        polygon(Pin$x, Pin$y, density = density[i],
                angle = angle[i], border = border[i],
                col = "white", lty = lty[i])
    }

    title(main = main, ...)
    invisible(NULL)
}


# Let's use the function, it works like PiePlot !
# inner.radius controls the width of the ring!
doughnut( c(3,5,9,12) , inner.radius=0.5, col=c(rgb(0.2,0.2,0.4,0.5), rgb(0.8,0.2,0.4,0.5), rgb(0.2,0.9,0.4,0.4) , rgb(0.0,0.9,0.8,0.4)) )
```

---

## 32. 131-pie-plot-with-r

**Файл:** `131-pie-plot-with-r_1.R`

```r
# Create Data
Prop <- c(3,7,9,1,2)
 
# Make the default Pie Plot
pie(Prop)
```

---

## 33. 131-pie-plot-with-r

**Файл:** `131-pie-plot-with-r_2.R`

```r
# You can also custom the labels:
pie(Prop , labels = c("Gr-A","Gr-B","Gr-C","Gr-D","Gr-E"))
```

---

## 34. 131-pie-plot-with-r

**Файл:** `131-pie-plot-with-r_3.R`

```r
# If you give a low value to the "edge" argument, you go from something circular to a shape with edges
pie(Prop , labels = c("Gr-A","Gr-B","Gr-C","Gr-D","Gr-E") , edges=10)
```

---

## 35. 131-pie-plot-with-r

**Файл:** `131-pie-plot-with-r_4.R`

```r
# The density arguments adds stripes. You can control the angle of this lines with "angle"
pie(Prop , labels = c("Gr-A","Gr-B","Gr-C","Gr-D","Gr-E") , density=10 , angle=c(20,90,30,10,0))
```

---

## 36. 131-pie-plot-with-r

**Файл:** `131-pie-plot-with-r_5.R`

```r
# Prepare a color palette. Here with R color brewer:
library(RColorBrewer)
myPalette <- brewer.pal(5, "Set2") 

# You can change the border of each area with the classical parameters:
pie(Prop , labels = c("Gr-A","Gr-B","Gr-C","Gr-D","Gr-E"), border="white", col=myPalette )
```

---

## 37. 135-stacked-density-graph

**Файл:** `135-stacked-density-graph_1.R`

```r
# Libraries
library(ggplot2)
library(hrbrthemes)
library(dplyr)
library(tidyr)
library(viridis)

# The diamonds dataset is natively available with R.

# Without transparency (left)
p1 <- ggplot(data=diamonds, aes(x=price, group=cut, fill=cut)) +
    geom_density(adjust=1.5) +
    theme_ipsum()
#p1

# With transparency (right)
p2 <- ggplot(data=diamonds, aes(x=price, group=cut, fill=cut)) +
    geom_density(adjust=1.5, alpha=.4) +
    theme_ipsum()
#p2
```

---

## 38. 135-stacked-density-graph

**Файл:** `135-stacked-density-graph_2.R`

```r
# Load dataset from github
data <- read.table("https://raw.githubusercontent.com/zonination/perceptions/master/probly.csv", header=TRUE, sep=",")
data <- data %>%
  gather(key="text", value="value") %>%
  mutate(text = gsub("\\.", " ",text)) %>%
  mutate(value = round(as.numeric(value),0))

# A dataframe for annotations
annot <- data.frame(
  text = c("Almost No Chance", "About Even", "Probable", "Almost Certainly"),
  x = c(5, 53, 65, 79),
  y = c(0.15, 0.4, 0.06, 0.1)
)

# Plot
data %>%
  filter(text %in% c("Almost No Chance", "About Even", "Probable", "Almost Certainly")) %>%
  ggplot( aes(x=value, color=text, fill=text)) +
    geom_density(alpha=0.6) +
    scale_fill_viridis(discrete=TRUE) +
    scale_color_viridis(discrete=TRUE) +
    geom_text( data=annot, aes(x=x, y=y, label=text, color=text), hjust=0, size=4.5) +
    theme_ipsum() +
    theme(
      legend.position="none"
    ) +
    ylab("") +
    xlab("Assigned Probability (%)")
```

---

## 39. 135-stacked-density-graph

**Файл:** `135-stacked-density-graph_3.R`

```r
# Using Small multiple
ggplot(data=diamonds, aes(x=price, group=cut, fill=cut)) +
    geom_density(adjust=1.5) +
    theme_ipsum() +
    facet_wrap(~cut) +
    theme(
      legend.position="none",
      panel.spacing = unit(0.1, "lines"),
      axis.ticks.x=element_blank()
    )
```

---

## 40. 135-stacked-density-graph

**Файл:** `135-stacked-density-graph_4.R`

```r
# Stacked density plot:
p <- ggplot(data=diamonds, aes(x=price, group=cut, fill=cut)) +
    geom_density(adjust=1.5, position="fill") +
    theme_ipsum()
#p
```

---

## 41. 136-stacked-area-chart

**Файл:** `136-stacked-area-chart_1.R`

```r
# Packages
library(ggplot2)
library(dplyr)
 
# create data
time <- as.numeric(rep(seq(1,7),each=7))  # x Axis
value <- runif(49, 10, 100)               # y Axis
group <- rep(LETTERS[1:7],times=7)        # group, one shape per group
data <- data.frame(time, value, group)

# stacked area chart
ggplot(data, aes(x=time, y=value, fill=group)) + 
    geom_area()
```

---

## 42. 136-stacked-area-chart

**Файл:** `136-stacked-area-chart_2.R`

```r
# Give a specific order:
data$group <- factor(data$group , levels=c("B", "A", "D", "E", "G", "F", "C") )

# Plot again
ggplot(data, aes(x=time, y=value, fill=group)) + 
    geom_area()

# Note: you can also sort levels alphabetically:
myLevels <- levels(data$group)
data$group <- factor(data$group , levels=sort(myLevels) )

# Note: sort following values at time = 5
myLevels <- data %>%
  filter(time==6) %>%
  arrange(value)
data$group <- factor(data$group , levels=myLevels$group )
```

---

## 43. 136-stacked-area-chart

**Файл:** `136-stacked-area-chart_3.R`

```r
# Compute percentages with dplyr
library(dplyr)
data <- data  %>%
  group_by(time, group) %>%
  summarise(n = sum(value)) %>%
  mutate(percentage = n / sum(n))

# Plot
ggplot(data, aes(x=time, y=percentage, fill=group)) + 
    geom_area(alpha=0.6 , size=1, colour="black")

# Note: compute percentages without dplyr:
my_fun <- function(vec){ 
  as.numeric(vec[2]) / sum(data$value[data$time==vec[1]]) *100 
}
data$percentage <- apply(data , 1 , my_fun)
```

---

## 44. 136-stacked-area-chart

**Файл:** `136-stacked-area-chart_4.R`

```r
# Library
library(viridis)
library(hrbrthemes)

# Plot
ggplot(data, aes(x=time, y=value, fill=group)) + 
    geom_area(alpha=0.6 , size=.5, colour="white") +
    scale_fill_viridis(discrete = T) +
    theme_ipsum() + 
    ggtitle("The race between ...")
```

---

## 45. 142-basic-radar-chart

**Файл:** `142-basic-radar-chart_1.R`

```r
# Library
library(fmsb)
 
# Create data: note in High school for Jonathan:
data <- as.data.frame(matrix( sample( 2:20 , 10 , replace=T) , ncol=10))
colnames(data) <- c("math" , "english" , "biology" , "music" , "R-coding", "data-viz" , "french" , "physic", "statistic", "sport" )
 
# To use the fmsb package, I have to add 2 lines to the dataframe: the max and min of each topic to show on the plot!
data <- rbind(rep(20,10) , rep(0,10) , data)
 
# Check your data, it has to look like this!
# head(data)

# The default radar chart 
radarchart(data)
```

---

## 46. 142-basic-radar-chart

**Файл:** `142-basic-radar-chart_2.R`

```r
# Library
library(fmsb)
 
# Create data: note in High school for Jonathan:
data <- as.data.frame(matrix( sample( 2:20 , 10 , replace=T) , ncol=10))
colnames(data) <- c("math" , "english" , "biology" , "music" , "R-coding", "data-viz" , "french" , "physic", "statistic", "sport" )
 
# To use the fmsb package, I have to add 2 lines to the dataframe: the max and min of each topic to show on the plot!
data <- rbind(rep(20,10) , rep(0,10) , data)
 
# Check your data, it has to look like this!
# head(data)

# Custom the radarChart !
radarchart( data  , axistype=1 , 
 
    #custom polygon
    pcol=rgb(0.2,0.5,0.5,0.9) , pfcol=rgb(0.2,0.5,0.5,0.5) , plwd=4 , 
 
    #custom the grid
    cglcol="grey", cglty=1, axislabcol="grey", caxislabels=seq(0,20,5), cglwd=0.8,
 
    #custom labels
    vlcex=0.8 
    )
```

---

## 47. 143-spider-chart-with-saveral-individuals

**Файл:** `143-spider-chart-with-saveral-individuals_1.R`

```r
# Library
library(fmsb)
 
# Create data: note in High school for several students
set.seed(99)
data <- as.data.frame(matrix( sample( 0:20 , 15 , replace=F) , ncol=5))
colnames(data) <- c("math" , "english" , "biology" , "music" , "R-coding" )
rownames(data) <- paste("mister" , letters[1:3] , sep="-")
 
# To use the fmsb package, I have to add 2 lines to the dataframe: the max and min of each variable to show on the plot!
data <- rbind(rep(20,5) , rep(0,5) , data)
 
# plot with default options:
radarchart(data)
```

---

## 48. 143-spider-chart-with-saveral-individuals

**Файл:** `143-spider-chart-with-saveral-individuals_2.R`

```r
# Library
library(fmsb)
 
# Create data: note in High school for several students
set.seed(99)
data <- as.data.frame(matrix( sample( 0:20 , 15 , replace=F) , ncol=5))
colnames(data) <- c("math" , "english" , "biology" , "music" , "R-coding" )
rownames(data) <- paste("mister" , letters[1:3] , sep="-")
 
# To use the fmsb package, I have to add 2 lines to the dataframe: the max and min of each variable to show on the plot!
data <- rbind(rep(20,5) , rep(0,5) , data)

# Color vector
colors_border=c( rgb(0.2,0.5,0.5,0.9), rgb(0.8,0.2,0.5,0.9) , rgb(0.7,0.5,0.1,0.9) )
colors_in=c( rgb(0.2,0.5,0.5,0.4), rgb(0.8,0.2,0.5,0.4) , rgb(0.7,0.5,0.1,0.4) )

# plot with default options:
radarchart( data  , axistype=1 , 
    #custom polygon
    pcol=colors_border , pfcol=colors_in , plwd=4 , plty=1,
    #custom the grid
    cglcol="grey", cglty=1, axislabcol="grey", caxislabels=seq(0,20,5), cglwd=0.8,
    #custom labels
    vlcex=0.8 
    )

# Add a legend
legend(x=0.7, y=1, legend = rownames(data[-c(1,2),]), bty = "n", pch=20 , col=colors_in , text.col = "grey", cex=1.2, pt.cex=3)
```

---

## 49. 143-spider-chart-with-saveral-individuals

**Файл:** `143-spider-chart-with-saveral-individuals_3.R`

```r
# Library
library(fmsb)
 
# Create data: note in High school for several students
set.seed(99)
data <- as.data.frame(matrix( sample( 0:20 , 15 , replace=F) , ncol=5))
colnames(data) <- c("math" , "english" , "biology" , "music" , "R-coding" )
rownames(data) <- paste("mister" , letters[1:3] , sep="-")
 
# To use the fmsb package, I have to add 2 lines to the dataframe: the max and min of each variable to show on the plot!
data <- rbind(rep(20,5) , rep(0,5) , data)
 
# Set graphic colors
library(RColorBrewer)
coul <- brewer.pal(3, "BuPu")
colors_border <- coul
library(scales)
colors_in <- alpha(coul,0.3)

# If you remove the 2 first lines, the function compute the max and min of each variable with the available data:
radarchart( data[-c(1,2),]  , axistype=0 , maxmin=F,
    #custom polygon
    pcol=colors_border , pfcol=colors_in , plwd=4 , plty=1,
    #custom the grid
    cglcol="grey", cglty=1, axislabcol="black", cglwd=0.8, 
    #custom labels
    vlcex=0.8 
    )

# Add a legend
legend(x=0.7, y=1, legend = rownames(data[-c(1,2),]), bty = "n", pch=20 , col=colors_in , text.col = "grey", cex=1.2, pt.cex=3)
```

---

## 50. 145-two-different-y-axis-on-the-same-plot

**Файл:** `145-two-different-y-axis-on-the-same-plot_1.R`

```r
#library
library(latticeExtra)
 
# create data
set.seed(1)
x <- 1:100
var1 <- cumsum(rnorm(100))
var2 <- var1^2
data <- data.frame(x,var1,var2)
 
 
# usual line chart
xyplot(var1 + var2 ~ x, data, type = "l", col=c("steelblue", "#69b3a2") , lwd=2)
```

---

## 51. 145-two-different-y-axis-on-the-same-plot

**Файл:** `145-two-different-y-axis-on-the-same-plot_2.R`

```r
#library
library(latticeExtra)
 
# create data
set.seed(1)
x <- 1:100
var1 <- cumsum(rnorm(100))
var2 <- var1^2
data <- data.frame(x,var1,var2)
 
 
# --> construct separate plots for each series
obj1 <- xyplot(var1 ~ x, data, type = "l" , lwd=2, col="steelblue")
obj2 <- xyplot(var2 ~ x, data, type = "l", lwd=2, col="#69b3a2")
 
# --> Make the plot with second y axis:
doubleYScale(obj1, obj2, add.ylab2 = TRUE, use.style=FALSE )
```

---

## 52. 145-two-different-y-axis-on-the-same-plot

**Файл:** `145-two-different-y-axis-on-the-same-plot_3.R`

```r
#library
library(latticeExtra)
 
# create data
set.seed(1)
x <- 1:100
var1 <- cumsum(rnorm(100))
var2 <- var1^2
data <- data.frame(x,var1,var2)
 
 
# --> construct separate plots for each series
obj1 <- xyplot(var1 ~ x, data, type = "l" , lwd=2)
obj2 <- xyplot(var2 ~ x, data, type = "l", lwd=2)
 
# --> Make the plot with second y axis AND legend:
doubleYScale(obj1, obj2, text = c("obj1", "obj2") , add.ylab2 = TRUE)
```

---

## 53. 15-wordcloud

**Файл:** `15-wordcloud_1.R`

```r
#Charge the wordcloud library
library(wordcloud)
 
#Create a list of words (Random words concerning my work)
a <- c("Cereal","WSSMV","SBCMV","Experimentation","Talk","Conference","Writing", 
   "Publication","Analysis","Bioinformatics","Science","Statistics","Data", 
   "Programming","Wheat","Virus","Genotyping","Work","Fun","Surfing","R", "R",
   "Data-Viz","Python","Linux","Programming","Graph Gallery","Biologie", "Resistance",
   "Computing","Data-Science","Reproductible","GitHub","Script")
 
#I give a frequency to each word of this list 
b <- sample(seq(0,1,0.01) , length(a) , replace=TRUE) 
 
#The package will automatically make the wordcloud ! (I add a black background)
par(bg="black") 
wordcloud(a , b , col=terrain.colors(length(a) , alpha=0.9) , rot.per=0.3 )
```

---

## 54. 154-basic-interactive-streamgraph-2

**Файл:** `154-basic-interactive-streamgraph-2_1.R`

```r
# Library
library(streamgraph)
 
# Create data:
data <- data.frame(
  year=rep(seq(1990,2016) , each=10),
  name=rep(letters[1:10] , 27),
  value=sample( seq(0,1,0.0001) , 270)
)
 
# Basic stream graph: just give the 3 arguments
pp <- streamgraph(data, key="name", value="value", date="year", height="300px", width="1000px")
pp 

# save the widget
# library(htmlwidgets)
# saveWidget(pp, file=paste0( getwd(), "/HtmlWidget/streamgraphBasic.html"))
```

---

## 55. 155-interactive-streamgraph-change-offset

**Файл:** `155-interactive-streamgraph-change-offset_1.R`

```r
# Library
library(streamgraph)

# Create data:
data <- data.frame(
  year=rep(seq(1990,2016) , each=10),
  name=rep(letters[1:10] , 27),
  value=sample( seq(0,1,0.0001) , 270)
)

# Type 1 (default)
p1 <- streamgraph(data, key="name", value="value", date="year" , 
    offset="silhouette",
    width="400px", height="300px"
    )
 
# Type 2 
p2 <- streamgraph(data, key="name", value="value", date="year" , 
    offset="zero",
    width="400px", height="300px"
    )
 
# Type 3.
p3 <- streamgraph(data, key="name", value="value", date="year" , 
    offset="expand",
    width="400px", height="300px"
    )

# save the widget
# library(htmlwidgets)
# saveWidget(p1, file=paste0( getwd(), "/HtmlWidget/streamgraphOffset1.html"))
# saveWidget(p2, file=paste0( getwd(), "/HtmlWidget/streamgraphOffset2.html"))
# saveWidget(p3, file=paste0( getwd(), "/HtmlWidget/streamgraphOffset3.html"))
```

---

## 56. 156-interactive-streamgraph-with-legend

**Файл:** `156-interactive-streamgraph-with-legend_1.R`

```r
# Library
library(streamgraph)
 
# Create data:
data <- data.frame(
  year=rep(seq(1990,2016) , each=10),
  name=rep(letters[1:10] , 27),
  value=sample( seq(0,1,0.0001) , 270)
)
 
# Stream graph with a legend
pp <- streamgraph(data, key="name", value="value", date="year", height="300px", width="1000px") %>%
  sg_legend(show=TRUE, label="names: ")
  

# save the widget
# library(htmlwidgets)
# saveWidget(pp, file=paste0( getwd(), "/HtmlWidget/streamgraphDropdown.html"))
```

---

## 57. 157-interactive-streamchart-change-shape

**Файл:** `157-interactive-streamchart-change-shape_1.R`

```r
# Library
library(streamgraph)

# Create data:
data <- data.frame(
  year=rep(seq(1990,2016) , each=10),
  name=rep(letters[1:10] , 27),
  value=sample( seq(0,1,0.0001) , 270)
)

# Shape: classic
p1 <- streamgraph(data, key="name", value="value", date="year",
    width="400px", height="300px"
    )

# Shape: stacked area graph
p2 <- streamgraph(data, key="name", value="value", date="year" ,interpolate="linear" ,
    width="400px", height="300px"
    )

# Shape: stacked barplot
p3 <- streamgraph(data, key="name", value="value", date="year" ,interpolate="step" ,
    width="400px", height="300px"
    )

# save the widget
# library(htmlwidgets)
# saveWidget(p1, file=paste0( getwd(), "/HtmlWidget/streamgraphShape1.html"))
# saveWidget(p2, file=paste0( getwd(), "/HtmlWidget/streamgraphShape2.html"))
# saveWidget(p3, file=paste0( getwd(), "/HtmlWidget/streamgraphShape3.html"))
```

---

## 58. 158-change-color-in-interactive-streamgraph

**Файл:** `158-change-color-in-interactive-streamgraph_1.R`

```r
# Library
library(streamgraph)

# Create data:
data <- data.frame(
  year=rep(seq(1990,2016) , each=10),
  name=rep(letters[1:10] , 27),
  value=sample( seq(0,1,0.0001) , 270)
)

# Graph 1: choose a RColorBrewer palette -> continuous
p1 <- streamgraph(data, key="name", value="value", date="year",
    width="400px", height="300px"
    ) %>%
  sg_fill_brewer("Blues")

# Graph 2: choose a RColorBrewer palette -> categorical
p2 <- streamgraph(data, key="name", value="value", date="year",
    width="400px", height="300px"
    ) %>%
  sg_fill_brewer("Pastel1")

# Graph 3: choose color manually with number, color name, rgb ...
p3 <- streamgraph(data, key="name", value="value", date="year"  ,
    width="400px", height="300px"
    ) %>%
  sg_fill_manual(c(1:10))

# save the widget
# library(htmlwidgets)
# saveWidget(p1, file=paste0( getwd(), "/HtmlWidget/streamgraphColor1.html"))
# saveWidget(p2, file=paste0( getwd(), "/HtmlWidget/streamgraphColor2.html"))
# saveWidget(p3, file=paste0( getwd(), "/HtmlWidget/streamgraphColor3.html"))
```

---

## 59. 159-save-interactive-streamgraph-to-static-image-png

**Файл:** `159-save-interactive-streamgraph-to-static-image-png_1.R`

```r
# Library
library(streamgraph)
# Create data:
data <- data.frame(
  year=rep(seq(1990,2016) , each=10),
  name=rep(letters[1:10] , 27),
  value=sample( seq(0,1,0.0001) , 270)
)
# Start with a classic stream graph. It is supposed to open in a browser
streamgraph(data, key="name", value="value", date="year")
# Copy the URL of the html window you get
# load webshot library
library(webshot)

#install phantom:
webshot::install_phantomjs()
# Make a webshot in pdf : high quality but can not choose printed zone
webshot("paste_your_html_here.html" , "output.pdf", delay = 0.2)

# Make a webshot in png : Low quality - but you can choose shape
webshot("paste_your_html_here" , "output.png", delay = 0.2 , cliprect = c(440, 0, 1000, 10))
```

---

## 60. 163-interactive-area-chart-plotly

**Файл:** `163-interactive-area-chart-plotly_1.R`

```r
# Libraries
library(ggplot2)
library(dplyr)
library(plotly)
library(hrbrthemes)

# Load dataset from github
data <- read.table("https://raw.githubusercontent.com/holtzy/data_to_viz/master/Example_dataset/3_TwoNumOrdered.csv", header=T)
data$date <- as.Date(data$date)

# Usual area chart
p <- data %>%
  ggplot( aes(x=date, y=value)) +
    geom_area(fill="#69b3a2", alpha=0.5) +
    geom_line(color="#69b3a2") +
    ylab("bitcoin price ($)") +
    theme_ipsum()

# Turn it interactive with ggplotly
p <- ggplotly(p)
p
```

---

## 61. 163-interactive-area-chart-plotly

**Файл:** `163-interactive-area-chart-plotly_2.R`

```r
# save the widget
#library(htmlwidgets)
#saveWidget(p, file="HtmlWidget/plotly-line-chart.html")
```

---

## 62. 163-interactive-area-chart-plotly

**Файл:** `163-interactive-area-chart-plotly_3.R`

```r
# library
library(plotly)
 
# Create data
var1 <- seq(1,8)
var2 <- c(0,1,4,1,8,7,5,4)
var3 <- c(7,8,4,2,1,2,0,1)

# Area chart with 2 groups
p <- plot_ly(x = var1, y = var2, type="scatter", mode="markers", fill = "tozeroy")
p <- add_trace(p, x = var1, y = var3, type="scatter", mode="markers", fill = "tonexty")
p
```

---

## 63. 163-interactive-area-chart-plotly

**Файл:** `163-interactive-area-chart-plotly_4.R`

```r
# save the widget
# library(htmlwidgets)
#saveWidget(p, file="HtmlWidget/plotly-area-chart.html")
```

---

## 64. 164-area-chart-ggplot2

**Файл:** `164-area-chart-ggplot2_1.R`

```r
# Libraries
library(ggplot2)

# create data
xValue <- 1:50
yValue <- cumsum(rnorm(50))
data <- data.frame(xValue,yValue)

# Plot
ggplot(data, aes(x=xValue, y=yValue)) +
  geom_area()
```

---

## 65. 164-area-chart-ggplot2

**Файл:** `164-area-chart-ggplot2_2.R`

```r
# Libraries
library(ggplot2)
library(hrbrthemes)

# create data
xValue <- 1:10
yValue <- abs(cumsum(rnorm(10)))
data <- data.frame(xValue,yValue)

# Plot
ggplot(data, aes(x=xValue, y=yValue)) +
  geom_area( fill="#69b3a2", alpha=0.4) +
  geom_line(color="#69b3a2", size=2) +
  geom_point(size=3, color="#69b3a2") +
  theme_ipsum() +
  ggtitle("Evolution of something")
```

---

## 66. 165-basic-area-chart

**Файл:** `165-basic-area-chart_1.R`

```r
# Create data
data <- data.frame(x=seq(1,10), y=sample(seq(1,15),10))

# Draw line on top
plot(data, col=rgb(0.2,0.1,0.5,0.9), type="o", lwd=3, xlab="", ylab="size",
     pch=20)

# Fill the area
polygon(c(min(data$x), data$x, max(data$x)),
        c(min(data$y), data$y, min(data$y)),
        col=rgb(0.2,0.1,0.5,0.2), border=FALSE)
```

---

## 67. 175-choropleth-map-cartography-pkg

**Файл:** `175-choropleth-map-cartography-pkg_1.R`

```r
# Use the cartography library to do the choropleth map
library(cartography)

# Load data
data(nuts2006)

# Build a choropleth
choroLayer(spdf = nuts2.spdf, df = nuts2.df, var = "pop2008" , legend.pos = "right")
title("Population in 2008")
```

---

## 68. 175-choropleth-map-cartography-pkg

**Файл:** `175-choropleth-map-cartography-pkg_2.R`

```r
# Download the shape file from the web and unzip it:
# download.file("http://thematicmapping.org/downloads/TM_WORLD_BORDERS_SIMPL-0.3.zip" , destfile="world_shape_file.zip")
# system("unzip world_shape_file.zip")

# Load it as a geospatial object in R
library(rgdal)
my_spdf <- readOGR( dsn= "/Users/yan.holtz/Desktop/R-graph-gallery/world_shape_file/" , layer="TM_WORLD_BORDERS_SIMPL-0.3", verbose=FALSE) 
africa <- my_spdf[my_spdf@data$REGION==2 , ]

africa@data$POP2005 <- as.numeric(africa@data$POP2005)

# Use the cartography library to do the choropleth map
library(cartography)
choroLayer(spdf = africa, df = africa@data, var = "POP2005")
title("Number of people living in Africa in 2005")
```

---

## 69. 176-custom-choropleth-map-cartography-pkg

**Файл:** `176-custom-choropleth-map-cartography-pkg_1.R`

```r
# Cartography Library
library(cartography)
library(sp)

# Upload data attached with the package.
data(nuts2006)
 
# Now we have a spdf file (shape file) called nuts2.spdf with shape of european regions.
# We also have a dataframe with information concerning every region.Both object have a first column "id" that makes the link between them.
head(nuts2.df)
 
# Annual growth per region
nuts2.df$cagr <- 100 * (((nuts2.df$pop2008/nuts2.df$pop1999)^(1/9)) -  1)
 
# Build a color palette
cols <- carto.pal(pal1 = "green.pal", n1 = 2, pal2 = "red.pal", n2 = 4)
 
# plot backgroud shapes (sea and world)
plot(nuts0.spdf, border = NA, col = NA, bg = "#A6CAE0")
plot(world.spdf, col = "#E3DEBF", border = NA, add = TRUE)
 
# Add annual growth
choroLayer(spdf = nuts2.spdf, df = nuts2.df, var = "cagr", 
    breaks = c(-2.43, -1, 0, 0.5, 1, 2, 3.1), col = cols, 
    border = "grey40", lwd = 0.5, legend.pos = "right", 
    legend.title.txt = "taux de croissance\nannuel moyen", 
    legend.values.rnd = 2, add = TRUE)
 
# Add borders
plot(nuts0.spdf, border = "grey20", lwd = 0.75, add = TRUE)
 
# Add titles, legend ...
layoutLayer(title = "Growth rate in Europe", 
    author = "cartography", sources = "Eurostat, 2008", 
    frame = TRUE, col = NA, scale = NULL, coltitle = "black", 
    south = TRUE)
```

---

## 70. 177-map-with-proportional-symbols

**Файл:** `177-map-with-proportional-symbols_1.R`

```r
# Library
library(cartography)
library(sp)

# Upload data attached with the package.
data(nuts2006)

# Now we have a geospatial object called nuts2.spdf containing the shape of european regions. We can plot it with the plot function.
# summary(nuts2.spdf)

# We also have a dataframe with information concerning every region.
# head(nuts2.df)
# Both object have a first column "id" that makes the link between them.

# Plot Europe
plot(nuts0.spdf, border = NA, col = NA, bg = "#A6CAE0")
plot(world.spdf, col = "#E3DEBF", border = NA, add = TRUE)
plot(nuts0.spdf, col = "#D1914D", border = "grey80",  add = TRUE)

# Add circles proportional to the total population
propSymbolsLayer(spdf = nuts0.spdf, df = nuts0.df,
    var = "pop2008", symbols = "circle", col = "#920000",
    legend.pos = "right", legend.title.txt = "Total\npopulation (2008)",
    legend.style = "c")

# Add titles, legend...
layoutLayer(title = "Countries Population in Europe",
    author = "cartography", sources = "Eurostat, 2008",
    scale = NULL, south = TRUE)
```

---

## 71. 180-change-background-in-leaflet-map

**Файл:** `180-change-background-in-leaflet-map_1.R`

```r
# Load the library
library(leaflet)

# Note: if you do not already installed it, install it with:
# install.packages("leaflet")

# Background 1: NASA
m <- leaflet() %>% 
   addTiles() %>% 
   setView( lng = 2.34, lat = 48.85, zoom = 5 ) %>% 
   addProviderTiles("NASAGIBS.ViirsEarthAtNight2012")
m
 
# Background 2: World Imagery
m <- leaflet() %>% 
   addTiles() %>% 
   setView( lng = 2.34, lat = 48.85, zoom = 3 ) %>% 
   addProviderTiles("Esri.WorldImagery")
m

# save the widget in a html file if needed.
# library(htmlwidgets)
# saveWidget(m, file=paste0( getwd(), "/HtmlWidget/backgroundMapTile.html", width="1000px"))
```

---

## 72. 182-add-circles-rectangles-on-leaflet-map

**Файл:** `182-add-circles-rectangles-on-leaflet-map_1.R`

```r
#library
library(leaflet)
 
# Create 20 markers (Random points)
data = data.frame(
   long=sample(seq(-150,150),20),
   lat=sample(seq(-50,50),20),
   val=round(rnorm(20),2),
   name=paste("point",letters[1:20],sep="_")
) 
 
# Show a circle at each position
m = leaflet(data = data) %>%
   addTiles() %>%
   addCircleMarkers(~long, ~lat , popup = ~as.character(name))
m
```

---

## 73. 182-add-circles-rectangles-on-leaflet-map

**Файл:** `182-add-circles-rectangles-on-leaflet-map_2.R`

```r
# save the widget
# library(htmlwidgets)
# saveWidget(m, file="HtmlWidget/leaflet-182-add-circles.html", selfcontained = F)
```

---

## 74. 182-add-circles-rectangles-on-leaflet-map

**Файл:** `182-add-circles-rectangles-on-leaflet-map_3.R`

```r
# Create 20 markers (Random points)
data = data.frame(
   long=sample(seq(-150,150),20),
   lat=sample(seq(-50,50),20),
   val=round(rnorm(20),2),
   name=paste("point",letters[1:20],sep="_")
) 
 
# Show a CUSTOM circle at each position. Size defined in Pixel. Size does not change when you zoom
m=leaflet(data = data) %>%
   addTiles() %>%
   addCircleMarkers(
      ~long, ~lat, 
      radius=~val*14 , 
      color=~ifelse(data$val>0 , "red", "orange"),
      stroke = TRUE, 
      fillOpacity = 0.2,
      popup = ~as.character(name)
   ) 
m
```

---

## 75. 182-add-circles-rectangles-on-leaflet-map

**Файл:** `182-add-circles-rectangles-on-leaflet-map_4.R`

```r
# save the widget
# library(htmlwidgets)
# saveWidget(m, file="HtmlWidget/leaflet-182-add-circles-2.html", selfcontained = F)
```

---

## 76. 182-add-circles-rectangles-on-leaflet-map

**Файл:** `182-add-circles-rectangles-on-leaflet-map_5.R`

```r
#library
library(leaflet)
 
# Create 20 markers (Random points)
data = data.frame(
   long=sample(seq(-150,150),20),
   lat=sample(seq(-50,50),20),
   val=round(rnorm(20),2),
   name=paste("point",letters[1:20],sep="_")
) 
 
# Show a CUSTOM circle at each position. Size in meters --> change when you zoom.
m = leaflet(data = data) %>%
   addTiles() %>%
   addCircles(
      ~long, ~lat, 
      radius=~val*1000000 , 
      color=~ifelse(data$val>0 , "red", "orange"),
      stroke = TRUE, 
      fillOpacity = 0.2,
      popup = ~as.character(name)
   ) %>% 
  setView(lng = 166.45, lat = 21, zoom = 2)
m
```

---

## 77. 182-add-circles-rectangles-on-leaflet-map

**Файл:** `182-add-circles-rectangles-on-leaflet-map_6.R`

```r
# save the widget
# library(htmlwidgets)
# saveWidget(m, file="HtmlWidget/leaflet-182-add-circles-3.html", selfcontained = F)
```

---

## 78. 182-add-circles-rectangles-on-leaflet-map

**Файл:** `182-add-circles-rectangles-on-leaflet-map_7.R`

```r
#library
library(leaflet)
 
# Create 20 markers (Random points)
data = data.frame(
   long=sample(seq(-150,150),20),
   lat=sample(seq(-50,50),20),
   val=round(rnorm(20),2),
   name=paste("point",letters[1:20],sep="_")
) 
 
# Show a rectangle
m = leaflet() %>% addTiles() %>%  
  addRectangles(
    lng1=-118.456554, lat1=34.078039,
    lng2=-118.436383, lat2=34.062717,
    fillColor = "transparent"
  )
m
```

---

## 79. 182-add-circles-rectangles-on-leaflet-map

**Файл:** `182-add-circles-rectangles-on-leaflet-map_8.R`

```r
# save the widget
# library(htmlwidgets)
# saveWidget(m, file="HtmlWidget/leaflet-182-add-rectangles.html", selfcontained = F)
```

---

## 80. 183-choropleth-map-with-leaflet

**Файл:** `183-choropleth-map-with-leaflet_1.R`

```r
# Download the shapefile (note that I put it in a folder called DATA)
download.file(
  "https://raw.githubusercontent.com/holtzy/R-graph-gallery/master/DATA/world_shape_file.zip",
  destfile = "DATA/world_shape_file.zip"
)
# You now have it in your current working directory, have a look!

# Unzip this file. You can do it with R (as below), or clicking on the object you downloaded.
system("unzip DATA/world_shape_file.zip")
#  -- > You now have 4 files. One of these files is a .shp file! (world_shape_file.shp)
```

---

## 81. 183-choropleth-map-with-leaflet

**Файл:** `183-choropleth-map-with-leaflet_2.R`

```r
# Read this shape file with the sf library.
library(sf)
world_sf <- read_sf(paste0(
  getwd(), "/DATA/world_shape_file/",
  "TM_WORLD_BORDERS_SIMPL-0.3.shp"
))

# Clean the data object
library(dplyr)
world_sf <- world_sf %>%
  mutate(POP2005 = ifelse(POP2005 == 0, NA, round(POP2005 / 1000000, 2)))

# -- > Now you have a sf object (simple feature data frame). You can start doing maps!
```

---

## 82. 183-choropleth-map-with-leaflet

**Файл:** `183-choropleth-map-with-leaflet_3.R`

```r
# Library
library(leaflet)

# Create a color palette for the map:
mypalette <- colorNumeric(
  palette = "viridis", domain = world_sf$POP2005,
  na.color = "transparent"
)
mypalette(c(45, 43))

# Basic choropleth with leaflet?
m <- leaflet(world_sf) %>%
  addTiles() %>%
  setView(lat = 10, lng = 0, zoom = 2) %>%
  addPolygons(fillColor = ~ mypalette(POP2005), stroke = FALSE)

m

# save the widget in a html file if needed.
# library(htmlwidgets)
# saveWidget(m, file=paste0( getwd(), "/HtmlWidget/choroplethLeaflet1.html"))
```

---

## 83. 183-choropleth-map-with-leaflet

**Файл:** `183-choropleth-map-with-leaflet_4.R`

```r
# load ggplot2
library(ggplot2)

# Distribution of the population per country?
ggplot(world_sf, aes(x = POP2005)) +
  geom_histogram(bins = 20, fill = "#69b3a2", color = "white") +
  xlab("Population (M)") +
  theme_bw()
```

---

## 84. 183-choropleth-map-with-leaflet

**Файл:** `183-choropleth-map-with-leaflet_5.R`

```r
# Color by quantile
m <- leaflet(world_sf) %>%
  addTiles() %>%
  setView(lat = 10, lng = 0, zoom = 2) %>%
  addPolygons(
    stroke = FALSE, fillOpacity = 0.5,
    smoothFactor = 0.5, color = ~ colorQuantile("YlOrRd", POP2005)(POP2005)
  )
m

# # save the widget in a html file if needed.
# htmlwidgets::saveWidget(m, file=paste0( getwd(), "/HtmlWidget/choroplethLeaflet2.html"))

# Numeric palette
m <- leaflet(world_sf) %>%
  addTiles() %>%
  setView(lat = 10, lng = 0, zoom = 2) %>%
  addPolygons(
    stroke = FALSE, fillOpacity = 0.5, smoothFactor = 0.5,
    color = ~ colorNumeric("YlOrRd", POP2005)(POP2005)
  )
m


# htmlwidgets::saveWidget(m, file=paste0( getwd(), "/HtmlWidget/choroplethLeaflet3.html"))

# Bin
m <- leaflet(world_sf) %>%
  addTiles() %>%
  setView(lat = 10, lng = 0, zoom = 2) %>%
  addPolygons(
    stroke = FALSE, fillOpacity = 0.5, smoothFactor = 0.5,
    color = ~ colorBin("YlOrRd", POP2005)(POP2005)
  )
m

# htmlwidgets::saveWidget(m, file=paste0( getwd(), "/HtmlWidget/choroplethLeaflet4.html"))
```

---

## 85. 183-choropleth-map-with-leaflet

**Файл:** `183-choropleth-map-with-leaflet_6.R`

```r
# Create a color palette with handmade bins.
library(RColorBrewer)
mybins <- c(0, 10, 20, 50, 100, 500, Inf)
mypalette <- colorBin(
  palette = "YlOrBr", domain = world_sf$POP2005,
  na.color = "transparent", bins = mybins
)

# Prepare the text for tooltips:
mytext <- paste(
  "Country: ", world_sf$NAME, "<br/>",
  "Area: ", world_sf$AREA, "<br/>",
  "Population: ", round(world_sf$POP2005, 2),
  sep = ""
) %>%
  lapply(htmltools::HTML)

# Final Map
m <- leaflet(world_sf) %>%
  addTiles() %>%
  setView(lat = 10, lng = 0, zoom = 2) %>%
  addPolygons(
    fillColor = ~ mypalette(POP2005),
    stroke = TRUE,
    fillOpacity = 0.9,
    color = "white",
    weight = 0.3,
    label = mytext,
    labelOptions = labelOptions(
      style = list("font-weight" = "normal", padding = "3px 8px"),
      textsize = "13px",
      direction = "auto"
    )
  ) %>%
  addLegend(
    pal = mypalette, values = ~POP2005, opacity = 0.9,
    title = "Population (M)", position = "bottomleft"
  )

m

# save the widget in a html file if needed.
# htmlwidgets::saveWidget(m, file=paste0( getwd(), "/HtmlWidget/choroplethLeaflet5.html"))
```

---

## 86. 19-map-leafletr

**Файл:** `19-map-leafletr_1.R`

```r
# Library
library(leaflet)

# load example data (Fiji Earthquakes) + keep only 100 first lines
data(quakes)
quakes <-  head(quakes, 100)

# Create a color palette with handmade bins.
mybins <- seq(4, 6.5, by=0.5)
mypalette <- colorBin( palette="YlOrBr", domain=quakes$mag, na.color="transparent", bins=mybins)

# Prepare the text for the tooltip:
mytext <- paste(
   "Depth: ", quakes$depth, "<br/>", 
   "Stations: ", quakes$stations, "<br/>", 
   "Magnitude: ", quakes$mag, sep="") %>%
  lapply(htmltools::HTML)

# Final Map
m <- leaflet(quakes) %>% 
  addTiles()  %>% 
  setView( lat=-27, lng=170 , zoom=4) %>%
  addProviderTiles("Esri.WorldImagery") %>%
  addCircleMarkers(~long, ~lat, 
    fillColor = ~mypalette(mag), fillOpacity = 0.7, color="white", radius=8, stroke=FALSE,
    label = mytext,
    labelOptions = labelOptions( style = list("font-weight" = "normal", padding = "3px 8px"), textsize = "13px", direction = "auto")
  ) %>%
  addLegend( pal=mypalette, values=~mag, opacity=0.9, title = "Magnitude", position = "bottomright" )

m 

# save the widget in a html file if needed.
# library(htmlwidgets)
# saveWidget(m, file=paste0( getwd(), "/HtmlWidget/bubblemapQuakes.html"))
```

---

## 87. 190-mirrored-histogram

**Файл:** `190-mirrored-histogram_1.R`

```r
#Create Data
x1 = rnorm(100)
x2 = rnorm(100)+rep(2,100)
par(mfrow=c(2,1))
 
#Make the plot
par(mar=c(0,5,3,3))
hist(x1 , main="" , xlim=c(-2,5), ylab="Frequency for x1", xlab="", ylim=c(0,25) , xaxt="n", las=1 , col="slateblue1", breaks=10)
par(mar=c(5,5,0,3))
hist(x2 , main="" , xlim=c(-2,5), ylab="Frequency for x2", xlab="Value of my variable", ylim=c(25,0) , las=1 , col="tomato3"  , breaks=10)
```

---

## 88. 191-manage-date-data

**Файл:** `191-manage-date-data_1.R`

```r
# Create data
set.seed(124)
date <- paste(   "2015/03/" , sample(seq(1,31),6) , sep="")
value <- sample(seq(1,100) , 6)
data <- data.frame(date,value)

# Date and time are recognized as factor:
str(data)
```

---

## 89. 191-manage-date-data

**Файл:** `191-manage-date-data_2.R`

```r
## 'data.frame':    6 obs. of  2 variables:
##  $ date : Factor w/ 6 levels "2015/03/12","2015/03/13",..: 4 2 3 1 5 6
##  $ value: int  59 49 91 28 75 82
```

---

## 90. 191-manage-date-data

**Файл:** `191-manage-date-data_3.R`

```r
# Create data
set.seed(124)
date <- paste(   "2015/03/" , sample(seq(1,31),6) , sep="")
value <- sample(seq(1,100) , 6)
data <- data.frame(date,value)

# Date and time are recognized as factor:
#str(data)

# So ploting them works bad --> wrong order, date without value are not represented, 
plot(data$value~data$date, type="b")
```

---

## 91. 191-manage-date-data

**Файл:** `191-manage-date-data_4.R`

```r
# Create data
set.seed(124)
date <- paste(   "2015/03/" , sample(seq(1,31),6) , sep="")
value <- sample(seq(1,100) , 6)
data <- data.frame(date,value)

# Let's change the date to the "date" format:
data$date <- as.Date(data$date)
 
# So we can sort the table:
data <- data[order(data$date) , ]
 
# Easy to make it better now:
plot(data$value~data$date , type="b" , lwd=3 , col=rgb(0.1,0.7,0.1,0.8) , ylab="value of ..." , xlab="date" , bty="l" , pch=20 , cex=4)
abline(h=seq(0,100,10) , col="grey", lwd=0.8)
```

---

## 92. 196-the-wordcloud2-library

**Файл:** `196-the-wordcloud2-library_1.R`

```r
# library
library(wordcloud2) 
 
# have a look to the example dataset
# head(demoFreq)

# Basic plot
wordcloud2(data=demoFreq, size=1.6)
```

---

## 93. 196-the-wordcloud2-library

**Файл:** `196-the-wordcloud2-library_2.R`

```r
# library
library(wordcloud2) 
 
# Gives a proposed palette
wordcloud2(demoFreq, size=1.6, color='random-dark')
 
# or a vector of colors. vector must be same length than input data
wordcloud2(demoFreq, size=1.6, color=rep_len( c("green","blue"), nrow(demoFreq) ) )
 
# Change the background color
wordcloud2(demoFreq, size=1.6, color='random-light', backgroundColor="black")
```

---

## 94. 196-the-wordcloud2-library

**Файл:** `196-the-wordcloud2-library_3.R`

```r
# library
library(wordcloud2) 
 
# Change the shape:
wordcloud2(demoFreq, size = 0.7, shape = 'star')
 
# Change the shape using your image
wordcloud2(demoFreq, figPath = "~/Desktop/R-graph-gallery/img/other/peaceAndLove.jpg", size = 1.5, color = "skyblue", backgroundColor="black")
```

---

## 95. 196-the-wordcloud2-library

**Файл:** `196-the-wordcloud2-library_4.R`

```r
# library
library(wordcloud2) 
 
# wordcloud
wordcloud2(demoFreq, size = 2.3, minRotation = -pi/6, maxRotation = -pi/6, rotateRatio = 1)
```

---

## 96. 196-the-wordcloud2-library

**Файл:** `196-the-wordcloud2-library_5.R`

```r
# library
library(wordcloud2) 
 
# wordcloud
wordcloud2(demoFreqC, size = 2, fontFamily = "????????????", color = "random-light", backgroundColor = "grey")
```

---

## 97. 196-the-wordcloud2-library

**Файл:** `196-the-wordcloud2-library_6.R`

```r
# library
library(wordcloud2) 
 
letterCloud( demoFreq, word = "R", color='random-light' , backgroundColor="black")
letterCloud( demoFreq, word = "PEACE", color="white", backgroundColor="pink")
```

---

## 98. 196-the-wordcloud2-library

**Файл:** `196-the-wordcloud2-library_7.R`

```r
# load wordcloud2
library(wordcloud2) 

# install webshot
library(webshot)
webshot::install_phantomjs()

# Make the graph
my_graph <- wordcloud2(demoFreq, size=1.5)

# save it in html
library("htmlwidgets")
saveWidget(my_graph,"tmp.html",selfcontained = F)

# and in png or pdf
webshot("tmp.html","fig_1.pdf", delay =5, vwidth = 480, vheight=480)
```

---

## 99. 199-correlation-matrix-with-ggally

**Файл:** `199-correlation-matrix-with-ggally_1.R`

```r
# Quick display of two cabapilities of GGally, to assess the distribution and correlation of variables 
library(GGally)
 
# From the help page:
data(flea)
ggpairs(flea, columns = 2:4, ggplot2::aes(colour=species))
```

---

## 100. 199-correlation-matrix-with-ggally

**Файл:** `199-correlation-matrix-with-ggally_2.R`

```r
# Quick display of two cabapilities of GGally, to assess the distribution and correlation of variables 
library(GGally)
 
# From the help page:
data(tips, package = "reshape")
ggpairs(
  tips[, c(1, 3, 4, 2)],
  upper = list(continuous = "density", combo = "box_no_facet"),
  lower = list(continuous = "points", combo = "dot_no_facet")
)
```

---

## 101. 2-two-histograms-with-melt-colors

**Файл:** `2-two-histograms-with-melt-colors_1.R`

```r
#Create data
set.seed(1)
Ixos=rnorm(4000 , 120 , 30)     
Primadur=rnorm(4000 , 200 , 30) 
 
# First distribution
hist(Ixos, breaks=30, xlim=c(0,300), col=rgb(1,0,0,0.5), xlab="height", 
     ylab="nbr of plants", main="distribution of height of 2 durum wheat varieties" )

# Second with add=T to plot on top
hist(Primadur, breaks=30, xlim=c(0,300), col=rgb(0,0,1,0.5), add=T)

# Add legend
legend("topright", legend=c("Ixos","Primadur"), col=c(rgb(1,0,0,0.5), 
     rgb(0,0,1,0.5)), pt.cex=2, pch=15 )
```

---

## 102. 2-two-histograms-with-melt-colors

**Файл:** `2-two-histograms-with-melt-colors_2.R`

```r
par(
  mfrow=c(1,2),
  mar=c(4,4,1,0)
)

hist(Ixos, breaks=30 , xlim=c(0,300) , col=rgb(1,0,0,0.5) , xlab="height" , ylab="nbr of plants" , main="" )
hist(Primadur, breaks=30 , xlim=c(0,300) , col=rgb(0,0,1,0.5) , xlab="height" , ylab="" , main="")
```

---

## 103. 200-change-color-in-lineplot-following-y-value

**Файл:** `200-change-color-in-lineplot-following-y-value_1.R`

```r
# library
library(plotrix)
 
#create color palette
library(RColorBrewer)
my_colors = brewer.pal(8, "Set2") 
 
# Create data
x<-seq(1,100)
y<-sin(x/5)+x/20
 
# Plot x and y
par(mar=c(4,4,2,2))
clplot(x, y, main="", lwd=5, levels=c(1,2,3,4,5), col=my_colors, showcuts=T , bty="n")
```

---

## 104. 201-levelplot-with-latticeextra

**Файл:** `201-levelplot-with-latticeextra_1.R`

```r
# library
library(latticeExtra) 
 
# create data
set.seed(1) 
data <- data.frame(x = rnorm(100), y = rnorm(100)) 
data$z <- with(data, x * y + rnorm(100, sd = 1)) 
 
# showing data points on the same color scale 
levelplot(z ~ x * y, data, 
          panel = panel.levelplot.points, cex = 1.2
    ) + 
    layer_(panel.2dsmoother(..., n = 200))
```

---

## 105. 202-barplot-for-likert-type-items

**Файл:** `202-barplot-for-likert-type-items_1.R`

```r
# library
library(likert) 
 
# Use a provided dataset
data(pisaitems) 
items28 <- pisaitems[, substr(names(pisaitems), 1, 5) == "ST24Q"] 
 
# Build plot
p <- likert(items28) 
plot(p)
```

---

## 106. 208-basic-barplot

**Файл:** `208-basic-barplot_1.R`

```r
# create dummy data
data <- data.frame(
  name=letters[1:5],
  value=sample(seq(4,15),5)
)

# The most basic barplot you can do:
barplot(height=data$value, names=data$name)
```

---

## 107. 21-distribution-plot-using-ggplot2

**Файл:** `21-distribution-plot-using-ggplot2_1.R`

```r
# Libraries
library(ggplot2)
library(dplyr)

# Load dataset from github
data <- read.table("https://raw.githubusercontent.com/holtzy/data_to_viz/master/Example_dataset/1_OneNum.csv", header=TRUE)

# Make the histogram
data %>%
  filter( price<300 ) %>%
  ggplot( aes(x=price)) +
    geom_density(fill="#69b3a2", color="#e9ecef", alpha=0.8)
```

---

## 108. 21-distribution-plot-using-ggplot2

**Файл:** `21-distribution-plot-using-ggplot2_2.R`

```r
# Libraries
library(ggplot2)
library(dplyr)
library(hrbrthemes)

# Load dataset from github
data <- read.table("https://raw.githubusercontent.com/holtzy/data_to_viz/master/Example_dataset/1_OneNum.csv", header=TRUE)

# Make the histogram
data %>%
  filter( price<300 ) %>%
  ggplot( aes(x=price)) +
    geom_density(fill="#69b3a2", color="#e9ecef", alpha=0.8) +
    ggtitle("Night price distribution of Airbnb appartements") +
    theme_ipsum()
```

---

## 109. 210-custom-barplot-layout

**Файл:** `210-custom-barplot-layout_1.R`

```r
# create dummy data
data <- data.frame(
  name=letters[1:5],
  value=sample(seq(4,15),5)
)

# The most basic barplot you can do:
barplot(height=data$value, names=data$name, col="#69b3a2")
```

---

## 110. 210-custom-barplot-layout

**Файл:** `210-custom-barplot-layout_2.R`

```r
# create dummy data
data <- data.frame(
  name=letters[1:5],
  value=sample(seq(4,15),5)
)

# The most basic barplot you can do:
barplot(height=data$value, names=data$name, col="#69b3a2", horiz=T , las=1)
```

---

## 111. 210-custom-barplot-layout

**Файл:** `210-custom-barplot-layout_3.R`

```r
# create dummy data
data <- data.frame(
  name=letters[1:5],
  value=sample(seq(4,15),5)
)

# Uniform color
barplot(height=data$value, names.arg=c("group1","group2","group3","group4","group5"), col="#69b3a2")
```

---

## 112. 210-custom-barplot-layout

**Файл:** `210-custom-barplot-layout_4.R`

```r
# create dummy data
data <- data.frame(
  name=letters[1:5],
  value=sample(seq(4,15),5)
)

# Customize labels (left)
barplot(height=data$value, names=data$name, 
        names.arg=c("group1","group2","group3","group4","group5"), 
        font.axis=2, 
        col.axis="orange", 
        cex.axis=1.5 
        )

# Customize title (right)
barplot(height=data$value, names=data$name, 
        xlab="category", 
        font.lab=2, 
        col.lab="orange", 
        cex.lab=2  
        )
```

---

## 113. 210-custom-barplot-layout

**Файл:** `210-custom-barplot-layout_5.R`

```r
# create dummy data
data <- data.frame(
  name=letters[1:5],
  value=sample(seq(4,15),5)
)

# Increase margin size
par(mar=c(11,4,4,4))

# Uniform color
barplot(height=data$value,
        col="#69b3a2",
        names.arg=c("very long group name 1","very long group name 2","very long group name 3","very long group name 4","very long group name 5"), 
        las=2 
)
```

---

## 114. 211-basic-grouped-or-stacked-barplot

**Файл:** `211-basic-grouped-or-stacked-barplot_1.R`

```r
# Create data
set.seed(112)
data <- matrix(sample(1:30,15) , nrow=3)
colnames(data) <- c("A","B","C","D","E")
rownames(data) <- c("var1","var2","var3")
 
# Grouped barplot
barplot(data, 
        col=colors()[c(23,89,12)] , 
        border="white", 
        font.axis=2, 
        beside=T, 
        legend=rownames(data), 
        xlab="group", 
        font.lab=2)
```

---

## 115. 211-basic-grouped-or-stacked-barplot

**Файл:** `211-basic-grouped-or-stacked-barplot_2.R`

```r
# Create data
set.seed(112)
data <- matrix(sample(1:30,15) , nrow=3)
colnames(data) <- c("A","B","C","D","E")
rownames(data) <- c("var1","var2","var3")


# Get the stacked barplot
barplot(data, 
        col=colors()[c(23,89,12)] , 
        border="white", 
        space=0.04, 
        font.axis=2, 
        xlab="group")
```

---

## 116. 211-basic-grouped-or-stacked-barplot

**Файл:** `211-basic-grouped-or-stacked-barplot_3.R`

```r
# Create data
set.seed(1124)
data <- matrix(sample(1:30,15) , nrow=3)
colnames(data) <- c("A","B","C","D","E")
rownames(data) <- c("var1","var2","var3")
 
# create color palette:
library(RColorBrewer)
coul <- brewer.pal(3, "Pastel2") 
 
# Transform this data in %
data_percentage <- apply(data, 2, function(x){x*100/sum(x,na.rm=T)})
 
# Make a stacked barplot--> it will be in %!
barplot(data_percentage, col=coul , border="white", xlab="group")
```

---

## 117. 215-the-heatmap-function

**Файл:** `215-the-heatmap-function_1.R`

```r
# The mtcars dataset:
data <- as.matrix(mtcars)

# Default Heatmap
heatmap(data)
```

---

## 118. 215-the-heatmap-function

**Файл:** `215-the-heatmap-function_2.R`

```r
# Use 'scale' to normalize
heatmap(data, scale="column")
```

---

## 119. 215-the-heatmap-function

**Файл:** `215-the-heatmap-function_3.R`

```r
# No dendrogram nor reordering for neither column or row
heatmap(data, Colv = NA, Rowv = NA, scale="column")
```

---

## 120. 215-the-heatmap-function

**Файл:** `215-the-heatmap-function_4.R`

```r
# 1: native palette from R
heatmap(data, scale="column", col = cm.colors(256))
heatmap(data, scale="column", col = terrain.colors(256))
 
# 2: Rcolorbrewer palette
library(RColorBrewer)
coul <- colorRampPalette(brewer.pal(8, "PiYG"))(25)
heatmap(data, scale="column", col = coul)
```

---

## 121. 215-the-heatmap-function

**Файл:** `215-the-heatmap-function_5.R`

```r
# Add classic arguments like main title and axis title
heatmap(data, Colv = NA, Rowv = NA, scale="column", col = coul, xlab="variable", ylab="car", main="heatmap")
 
# Custom x and y labels with cexRow and labRow (col respectively)
heatmap(data, scale="column", cexRow=1.5, labRow=paste("new_", rownames(data),sep=""), col= colorRampPalette(brewer.pal(8, "Blues"))(25))
```

---

## 122. 215-the-heatmap-function

**Файл:** `215-the-heatmap-function_6.R`

```r
# Example: grouping from the first letter:
my_group <- as.numeric(as.factor(substr(rownames(data), 1 , 1)))
colSide <- brewer.pal(9, "Set1")[my_group]
colMain <- colorRampPalette(brewer.pal(8, "Blues"))(25)
heatmap(data, Colv = NA, Rowv = NA, scale="column" , RowSideColors=colSide, col=colMain   )
```

---

## 123. 218-basic-barplots-with-ggplot2

**Файл:** `218-basic-barplots-with-ggplot2_1.R`

```r
# Load ggplot2
library(ggplot2)

# Create data
data <- data.frame(
  name=c("A","B","C","D","E") ,  
  value=c(3,12,5,18,45)
  )

# Barplot
ggplot(data, aes(x=name, y=value)) + 
  geom_bar(stat = "identity")
```

---

## 124. 218-basic-barplots-with-ggplot2

**Файл:** `218-basic-barplots-with-ggplot2_2.R`

```r
# Libraries
library(ggplot2)

# 1: uniform color. Color is for the border, fill is for the inside
ggplot(mtcars, aes(x=as.factor(cyl) )) +
  geom_bar(color="blue", fill=rgb(0.1,0.4,0.5,0.7) )
 
# 2: Using Hue
ggplot(mtcars, aes(x=as.factor(cyl), fill=as.factor(cyl) )) + 
  geom_bar( ) +
  scale_fill_hue(c = 40) +
  theme(legend.position="none")
 
# 3: Using RColorBrewer
ggplot(mtcars, aes(x=as.factor(cyl), fill=as.factor(cyl) )) + 
  geom_bar( ) +
  scale_fill_brewer(palette = "Set1") +
  theme(legend.position="none")

 
# 4: Using greyscale:
ggplot(mtcars, aes(x=as.factor(cyl), fill=as.factor(cyl) )) + 
  geom_bar( ) +
  scale_fill_grey(start = 0.25, end = 0.75) +
  theme(legend.position="none")

 
# 5: Set manualy
ggplot(mtcars, aes(x=as.factor(cyl), fill=as.factor(cyl) )) +  
  geom_bar( ) +
  scale_fill_manual(values = c("red", "green", "blue") ) +
  theme(legend.position="none")
```

---

## 125. 218-basic-barplots-with-ggplot2

**Файл:** `218-basic-barplots-with-ggplot2_3.R`

```r
# Load ggplot2
library(ggplot2)

# Create data
data <- data.frame(
  name=c("A","B","C","D","E") ,  
  value=c(3,12,5,18,45)
  )

# Barplot
ggplot(data, aes(x=name, y=value)) + 
  geom_bar(stat = "identity") +
  coord_flip()
```

---

## 126. 218-basic-barplots-with-ggplot2

**Файл:** `218-basic-barplots-with-ggplot2_4.R`

```r
# Load ggplot2
library(ggplot2)

# Create data
data <- data.frame(
  name=c("A","B","C","D","E") ,  
  value=c(3,12,5,18,45)
  )

# Barplot
ggplot(data, aes(x=name, y=value)) + 
  geom_bar(stat = "identity", width=0.2)
```

---

## 127. 22-order-boxplot-labels-by-names

**Файл:** `22-order-boxplot-labels-by-names_1.R`

```r
#Creating data 
names <- c(rep("A", 20) , rep("B", 20) , rep("C", 20), rep("D", 20))
value <- c( sample(2:5, 20 , replace=T) , sample(6:10, 20 , replace=T), 
       sample(1:7, 20 , replace=T), sample(3:10, 20 , replace=T) )
data <- data.frame(names,value)
 
# Classic boxplot (A-B-C-D order)
# boxplot(data$value ~ data$names)
 
# I reorder the groups order : I change the order of the factor data$names
data$names <- factor(data$names , levels=c("A", "D", "C", "B"))
 
#The plot is now ordered !
boxplot(data$value ~ data$names , col=rgb(0.3,0.5,0.4,0.6) , ylab="value" , 
    xlab="names in desired order")
```

---

## 128. 220-basic-ggplot2-histogram

**Файл:** `220-basic-ggplot2-histogram_1.R`

```r
# library
library(ggplot2)
 
# dataset:
data=data.frame(value=rnorm(100))

# basic histogram
p <- ggplot(data, aes(x=value)) + 
  geom_histogram()

#p
```

---

## 129. 220-basic-ggplot2-histogram

**Файл:** `220-basic-ggplot2-histogram_2.R`

```r
# Libraries
library(tidyverse)
library(hrbrthemes)

# Load dataset from github
data <- read.table("https://raw.githubusercontent.com/holtzy/data_to_viz/master/Example_dataset/1_OneNum.csv", header=TRUE)

# plot
p <- data %>%
  filter( price<300 ) %>%
  ggplot( aes(x=price)) +
    geom_histogram( binwidth=3, fill="#69b3a2", color="#e9ecef", alpha=0.9) +
    ggtitle("Bin size = 3") +
    theme_ipsum() +
    theme(
      plot.title = element_text(size=15)
    )
#p
```

---

## 130. 224-basic-circular-plot

**Файл:** `224-basic-circular-plot_1.R`

```r
# Upload library
library(circlize)
 
# Create data
data = data.frame(
    factor = sample(letters[1:8], 1000, replace = TRUE),
    x = rnorm(1000), 
    y = runif(1000)
    )
 
# Step1: Initialise the chart giving factor and x-axis.
circos.initialize( factors=data$factor, x=data$x )
 
# Step 2: Build the regions. 
circos.trackPlotRegion(factors = data$factor, y = data$y, panel.fun = function(x, y) {
    circos.axis()
    })
 
# Step 3: Add points
circos.trackPoints(data$factor, data$x, data$y, col = "blue", pch = 16, cex = 0.5)
```

---

## 131. 225-circular-plot-custom-a-track

**Файл:** `225-circular-plot-custom-a-track_1.R`

```r
# Upload library
library(circlize)

# Create data
data = data.frame(
    factor = sample(letters[1:8], 1000, replace = TRUE),
    x = rnorm(1000),
    y = runif(1000)
    )

# Step1: Initialise the chart giving factor and x-axis.
circos.initialize( factors=data$factor, x=data$x )

# Step 2: Build the regions.
circos.trackPlotRegion(factors = data$factor, y = data$y, panel.fun = function(x, y) {
    circos.axis()
    })

# Step 3: Add points
circos.trackPoints(data$factor, data$x, data$y)
```

---

## 132. 225-circular-plot-custom-a-track

**Файл:** `225-circular-plot-custom-a-track_2.R`

```r
# Upload library
library(circlize)

# Create data
data = data.frame(
    factor = sample(letters[1:8], 1000, replace = TRUE),
    x = rnorm(1000),
    y = runif(1000)
    )

# General Customization:
par(
  mar = c(1, 1, 1, 1),           # Margin around chart
  bg = rgb(0.4,0.1,0.7,0.05)     # background color
) 
circos.par("track.height" = 0.6) # track hight, 0.6 = 60% of total height

# Step1: Initialise the chart giving factor and x-axis.
circos.initialize( factors=data$factor, x=data$x )

# Step2: Build regions. 
circos.trackPlotRegion(factors = data$factor, y = data$y, panel.fun = function(x, y) {
    circos.axis(
        h="top",                   # x axis on the inner or outer part of the track?
        labels=TRUE,               # show the labels of the axis?
        major.tick=TRUE,           # show ticks?
        labels.cex=0.5,            # labels size (higher=bigger)
        labels.font=1,             # labels font (1, 2, 3 , 4)
        direction="outside",       # ticks point to the outside or inside of the circle ?
        minor.ticks=4,             # Number of minor (=small) ticks
        major.tick.percentage=0.1, # The size of the ticks in percentage of the track height
        lwd=2                      # thickness of ticks and x axis.
        )
    })

# Step 3: Add points
circos.trackPoints(data$factor, data$x, data$y, col = "#69b3a2", pch = 16, cex = 0.5)
```

---

## 133. 226-plot-types-for-circular-plot

**Файл:** `226-plot-types-for-circular-plot_1.R`

```r
# Upload library
library(circlize)
circos.par("track.height" = 0.4)

# Create data
data = data.frame(
    factor = sample(letters[1:8], 1000, replace = TRUE),
    x = rnorm(1000),
    y = runif(1000)
    )

# Step1: Initialise the chart giving factor and x-axis.
circos.initialize( factors=data$factor, x=data$x )

# Step 2: Build the regions.
circos.trackPlotRegion(factors = data$factor, y = data$y, panel.fun = function(x, y) {
    circos.axis()
    })

# Step 3: Add points
circos.trackPoints(data$factor, data$x, data$y, col="#69b3a2")
```

---

## 134. 226-plot-types-for-circular-plot

**Файл:** `226-plot-types-for-circular-plot_2.R`

```r
# Upload library
library(circlize)
circos.par("track.height" = 0.4)

# Create data
data = data.frame(
    factor = sample(letters[1:8], 1000, replace = TRUE),
    x = rnorm(1000),
    y = runif(1000)
    )

# Step1: Initialise the chart giving factor and x-axis.
circos.initialize( factors=data$factor, x=data$x )

# Step 2: Build the regions.
circos.trackPlotRegion(factors = data$factor, y = data$y, panel.fun = function(x, y) {
    circos.axis()
    })

# Step 3: Add points
circos.trackLines(data$factor, data$x[order(data$x)], data$y[order(data$x)], col = rgb(0.1,0.5,0.8,0.3), lwd=2)
```

---

## 135. 226-plot-types-for-circular-plot

**Файл:** `226-plot-types-for-circular-plot_3.R`

```r
# Upload library
library(circlize)
circos.par("track.height" = 0.4)

# Create data
data = data.frame(
    factor = sample(letters[1:8], 1000, replace = TRUE),
    x = rnorm(1000),
    y = runif(1000)
    )

# Step1: Initialise the chart giving factor and x-axis.
circos.initialize( factors=data$factor, x=data$x )

# Step 2: Build the regions.
circos.trackPlotRegion(factors = data$factor, y = data$y, panel.fun = function(x, y) {
    circos.axis()
    })

# Step 3: Add points
circos.trackLines(data$factor, data$x[order(data$x)], data$y[order(data$x)], col = rgb(0.1,0.5,0.8,0.3), lwd=2, type="h")
```

---

## 136. 226-plot-types-for-circular-plot

**Файл:** `226-plot-types-for-circular-plot_4.R`

```r
# Upload library
library(circlize)
circos.par("track.height" = 0.4)

# Create data
data = data.frame(
    factor = sample(letters[1:8], 1000, replace = TRUE),
    x = rnorm(1000),
    y = runif(1000)
    )

# Step1: Initialise the chart giving factor and x-axis.
circos.initialize( factors=data$factor, x=data$x )

circos.trackHist(data$factor, data$x, bg.col = "white", col = "#69b3a2")
```

---

## 137. 227-add-several-tracks

**Файл:** `227-add-several-tracks_1.R`

```r
#library
library(circlize)
circos.clear()

#Create data
data = data.frame(
    factor = sample(letters[1:8], 1000, replace = TRUE),
    x = rnorm(1000), 
    y = runif(1000)
    )
 
#Initialize the plot.
par(mar = c(1, 1, 1, 1) ) 
circos.initialize(factors = data$factor, x = data$x )
 

# Build the regions of track #1 
circos.trackPlotRegion(factors = data$factor, y=data$y, panel.fun = function(x, y) {
    circos.axis(labels.cex=0.5, labels.font=1, lwd=0.8)
    })
# --> Add a scatterplot on it:
circos.trackPoints(data$factor, data$x, data$y, col = rgb(0.1,0.5,0.8,0.3), pch=20)
 
 
# Build the regions of track #2:
circlize::circos.trackPlotRegion(factors = data$factor, y=data$y, panel.fun = function(x, y) {
    circos.axis(labels=FALSE, major.tick=FALSE)
    })
# --> Add a scatterplot on it
circos.trackPoints(data$factor, data$x, data$y, col = rgb(0.9,0.5,0.8,0.3), pch=20, cex=2)
 
 
# Add track #3 --> don't forget you can custom the height of tracks!
circos.par("track.height" = 0.4)
circos.trackPlotRegion(factors = data$factor, y=data$y, panel.fun = function(x, y) {
    circos.axis(labels=FALSE, major.tick=FALSE)
    })
circos.trackLines(data$factor, data$x, data$y, col = rgb(0.9,0.5,0.1,0.3), pch=20, cex=2, type="h")
# and continue as long as needed!
```

---

## 138. 228-add-links-between-regions

**Файл:** `228-add-links-between-regions_1.R`

```r
# library
library(circlize)
 
# Create data
set.seed(123)
data = data.frame(
    factor = sample(letters[1:8], 1000, replace = TRUE),
    x = rnorm(1000), 
    y = runif(1000)
    )
 
# Initialize the plot.
par(mar = c(1, 1, 1, 1) ) 
circos.initialize(factors = data$factor, x = data$x )
 
# Build the regions of track #1
circos.trackPlotRegion(factors = data$factor, y=data$y , bg.col = rgb(0.1,0.1,seq(0,1,0.1),0.4) , bg.border = NA)
 
# Add a link between a point and another
circos.link("a", 0, "b", 0, h = 0.4)
 
# Add a link between a point and a zone
circos.link("e", 0, "g", c(-1,1), col = "green", lwd = 2, lty = 2, border="black" )
 
# Add a link between a zone and another
circos.link("c", c(-0.5, 0.5), "d", c(-0.5,0.5), col = "red", border = "blue", h = 0.2)
```

---

## 139. 229-several-circular-plots-in-a-figure

**Файл:** `229-several-circular-plots-in-a-figure_1.R`

```r
# library
library(circlize)
# Arrange the layout
layout(matrix(1:9, 3, 3)) 
 
# A loop to create 9 circular plots
for(i in 1:9) {
    par(mar = c(0.5, 0.5, 0.5, 0.5), bg=rgb(1,1,1,0.1) )
    factors = 1:8
    circos.par(cell.padding = c(0, 0, 0, 0)) 
    circos.initialize(factors, xlim = c(0, 1)) 
    circos.trackPlotRegion(ylim = c(0, 1), track.height = 0.05, bg.col = rand_color(8), bg.border = NA ) 
 
    # add links
    for(i in 1:20) {
        se = sample(1:8, 2)
        circos.link(se[1], runif(2), se[2], runif(2), col = rand_color(1, transparency = 0.4)) 
        
    }
    circos.clear()
}
```

---

## 140. 23-add-colors-to-specific-groups-of-a-boxplot

**Файл:** `23-add-colors-to-specific-groups-of-a-boxplot_1.R`

```r
#Create data
names <- c(rep("Maestro", 20) , rep("Presto", 20) , 
      rep("Nerak", 20), rep("Eskimo", 20), rep("Nairobi", 20), rep("Artiko", 20))
value <- c(  sample(3:10, 20 , replace=T) , sample(2:5, 20 , replace=T) , 
      sample(6:10, 20 , replace=T), sample(6:10, 20 , replace=T) , 
      sample(1:7, 20 , replace=T), sample(3:10, 20 , replace=T) )
data <- data.frame(names,value)

# Prepare a vector of colors with specific color for Nairobi and Eskimo
myColors <- ifelse(levels(data$names)=="Nairobi" , rgb(0.1,0.1,0.7,0.5) , 
              ifelse(levels(data$names)=="Eskimo", rgb(0.8,0.1,0.3,0.6),
              "grey90" ) )

# Build the plot
boxplot(data$value ~ data$names , 
    col=myColors , 
    ylab="disease" , xlab="- variety -")
 
# Add a legend
legend("bottomleft", legend = c("Positiv control","Negativ control") , 
    col = c(rgb(0.1,0.1,0.7,0.5) , rgb(0.8,0.1,0.3,0.6)) , bty = "n", pch=20 , pt.cex = 3, cex = 1, horiz = FALSE, inset = c(0.03, 0.1))
```

---

## 141. 230-draw-part-of-the-circular-plot-only

**Файл:** `230-draw-part-of-the-circular-plot-only_1.R`

```r
# library
library(circlize)
 
# Create data
factors <- letters[1:4]
x1 <- runif(100)
y1 <- runif(100)
 
# general parameter of the plot. 
# With canvas.xlim and canvas.ylim we kind of "zoom on a part of the plot:
par(mar = c(1, 2, 0.1, 0.1) )
circos.par("track.height" = 0.7, "canvas.xlim" = c(0, 1), "canvas.ylim" = c(0, 1), "gap.degree" = 0, "clock.wise" = FALSE)
 
# Make the usual plot, but with no border
circos.initialize(factors = factors, xlim = c(0, 1)) 
circos.trackPlotRegion(factors = factors, ylim = c(0, 1), bg.border = NA ) 
 
# Finally we plot only the firs sector, so let's change its border to "black" to see it
circos.updatePlotRegion(sector.index = "a", bg.border = "grey" , bg.lwd=0.2)
 
# Now we can add a plot in this section! You can repeat these steps to add several regions
circos.lines(x1, y1, pch = 16, cex = 0.5, type="h" , col="#69b3a2" , lwd=3)
 
# Add axis
circos.axis(h="bottom" , labels.cex=0.4, direction = "inside" )
 
#clear
circos.clear()
```

---

## 142. 234-a-very-basic-treemap

**Файл:** `234-a-very-basic-treemap_1.R`

```r
# library
library(treemap)
 
# Create data
group <- c("group-1","group-2","group-3")
value <- c(13,5,22)
data <- data.frame(group,value)
 
# treemap
treemap(data,
            index="group",
            vSize="value",
            type="index"
            )
```

---

## 143. 235-treemap-with-subgroups

**Файл:** `235-treemap-with-subgroups_1.R`

```r
# library
library(treemap)
 
# Build Dataset
group <- c(rep("group-1",4),rep("group-2",2),rep("group-3",3))
subgroup <- paste("subgroup" , c(1,2,3,4,1,2,1,2,3), sep="-")
value <- c(13,5,22,12,11,7,3,1,23)
data <- data.frame(group,subgroup,value)
 
# treemap
treemap(data,
            index=c("group","subgroup"),
            vSize="value",
            type="index"
            )
```

---

## 144. 236-custom-your-treemap

**Файл:** `236-custom-your-treemap_1.R`

```r
# library
library(treemap)

# Create data
group <- c(rep("group-1", 4), rep("group-2", 2), rep("group-3", 3))
subgroup <- paste("subgroup", c(1, 2, 3, 4, 1, 2, 1, 2, 3), sep = "-")
value <- c(13, 5, 22, 12, 11, 7, 3, 1, 23)
data <- data.frame(group, subgroup, value)

# Custom labels:
treemap(data,
    index = c("group", "subgroup"), vSize = "value", type = "index",
    fontsize.labels = c(15, 12), # size of labels. Give the size per level of aggregation: size for group, size for subgroup, sub-subgroups...
    fontcolor.labels = c("white", "orange"), # Color of labels
    fontface.labels = c(2, 1), # Font of labels: 1,2,3,4 for normal, bold, italic, bold-italic...
    bg.labels = c("transparent"), # Background color of labels
    align.labels = list(
        c("center", "center"),
        c("right", "bottom")
    ), # Where to place labels in the rectangle?
    overlap.labels = 0.5, # number between 0 and 1 that determines the tolerance of the overlap between labels. 0 means that labels of lower levels are not printed if higher level labels overlap, 1  means that labels are always printed. In-between values, for instance the default value .5, means that lower level labels are printed if other labels do not overlap with more than .5  times their area size.
    inflate.labels = F, # If true, labels are bigger when rectangle is bigger.
)
```

---

## 145. 236-custom-your-treemap

**Файл:** `236-custom-your-treemap_2.R`

```r
# Custom borders:
treemap(data,
    index = c("group", "subgroup"), vSize = "value", type = "index",
    border.col = c("black", "white"), # Color of borders of groups, of subgroups, of subsubgroups ....
    border.lwds = c(7, 2) # Width of colors
)
```

---

## 146. 236-custom-your-treemap

**Файл:** `236-custom-your-treemap_3.R`

```r
# General features:
treemap(data,
    index = c("group", "subgroup"), vSize = "value",
    type = "index", # How you color the treemap. type help(treemap) for more info
    palette = "Set1", # Select your color palette from the RColorBrewer presets or make your own.
    title = "My Treemap", # Customize your title
    fontsize.title = 12, # Size of the title
)
```

---

## 147. 237-interactive-treemap

**Файл:** `237-interactive-treemap_1.R`

```r
# library
library(treemap)
library(d3treeR)
 
# dataset
group <- c(rep("group-1",4),rep("group-2",2),rep("group-3",3))
subgroup <- paste("subgroup" , c(1,2,3,4,1,2,1,2,3), sep="-")
value <- c(13,5,22,12,11,7,3,1,23)
data <- data.frame(group,subgroup,value)
 
# basic treemap
p <- treemap(data,
            index=c("group","subgroup"),
            vSize="value",
            type="index",
            palette = "Set2",
            bg.labels=c("white"),
            align.labels=list(
              c("center", "center"), 
              c("right", "bottom")
            )  
          )            
 
# make it interactive ("rootname" becomes the title of the plot):
inter <- d3tree2( p ,  rootname = "General" )

# save the widget
# library(htmlwidgets)
# saveWidget(inter, file=paste0( getwd(), "/HtmlWidget/interactiveTreemap.html"))
```

---

## 148. 24-boxplot-with-variable-width

**Файл:** `24-boxplot-with-variable-width_1.R`

```r
# Dummy data
names <- c(rep("A", 20) , rep("B", 8) , rep("C", 30), rep("D", 80))
value <- c( sample(2:5, 20 , replace=T) , sample(4:10, 8 , replace=T), 
       sample(1:7, 30 , replace=T), sample(3:8, 80 , replace=T) )
data <- data.frame(names,value)
 
 
# Calculate proportion of each level
proportion <- table(data$names)/nrow(data)
 
#Draw the boxplot, with the width proportionnal to the occurence !
boxplot(data$value ~ data$names , width=proportion , col=c("orange" , "seagreen"))
```

---

## 149. 242-use-leaflet-control-widget

**Файл:** `242-use-leaflet-control-widget_1.R`

```r
# Load libraries
library(leaflet)

# Make data with several positions
data_red <- data.frame(LONG=42+rnorm(10), LAT=23+rnorm(10), PLACE=paste("Red_place_",seq(1,10)))
data_blue <- data.frame(LONG=42+rnorm(10), LAT=23+rnorm(10), PLACE=paste("Blue_place_",seq(1,10)))

# Initialize the leaflet map:
m <- leaflet() %>% 
  setView(lng=42, lat=23, zoom=6 ) %>%

  # Add two tiles
  addProviderTiles("Esri.WorldImagery", group="background 1") %>%
  addTiles(options = providerTileOptions(noWrap = TRUE), group="background 2") %>%

  # Add 2 marker groups
  addCircleMarkers(data=data_red, lng=~LONG , lat=~LAT, radius=8 , color="black",
                   fillColor="red", stroke = TRUE, fillOpacity = 0.8, group="Red") %>%
  addCircleMarkers(data=data_blue, lng=~LONG , lat=~LAT, radius=8 , color="black",
                   fillColor="blue", stroke = TRUE, fillOpacity = 0.8, group="Blue") %>%

  # Add the control widget
  addLayersControl(overlayGroups = c("Red","Blue") , baseGroups = c("background 1","background 2"), 
                   options = layersControlOptions(collapsed = FALSE))

m

# save the widget in a html file if needed.
# library(htmlwidgets)
# saveWidget(m, file=paste0( getwd(), "/HtmlWidget/bubblemapControl.html"))
```

---

## 150. 247-network-chart-layouts

**Файл:** `247-network-chart-layouts_1.R`

```r
# library
library(igraph)
 
# Create data
data <- matrix(sample(0:1, 400, replace=TRUE, prob=c(0.8,0.2)), nrow=20)
network <- graph_from_adjacency_matrix(data , mode='undirected', diag=F )
 
# When ploting, we can use different layouts:
par(mfrow=c(2,2), mar=c(1,1,1,1))
plot(network, layout=layout.sphere, main="sphere")
plot(network, layout=layout.circle, main="circle")
plot(network, layout=layout.random, main="random")
plot(network, layout=layout.fruchterman.reingold, main="fruchterman.reingold")
 
# See the complete list with
# help(layout)
```

---

## 151. 248-igraph-plotting-parameters

**Файл:** `248-igraph-plotting-parameters_1.R`

```r
# Library
library(igraph)

# Create data
set.seed(1)
data <- matrix(sample(0:1, 100, replace=TRUE, prob=c(0.8,0.2)), nc=10)
network <- graph_from_adjacency_matrix(data , mode='undirected', diag=F )

# Default network
par(mar=c(0,0,0,0))
plot(network)
```

---

## 152. 248-igraph-plotting-parameters

**Файл:** `248-igraph-plotting-parameters_2.R`

```r
plot(network,
    vertex.color = rgb(0.8,0.2,0.2,0.9),           # Node color
    vertex.frame.color = "Forestgreen",            # Node border color
    vertex.shape=c("circle","square"),             # One of “none”, “circle”, “square”, “csquare”, “rectangle” “crectangle”, “vrectangle”, “pie”, “raster”, or “sphere”
    vertex.size=c(15:24),                          # Size of the node (default is 15)
    vertex.size2=NA,                               # The second size of the node (e.g. for a rectangle)
    )
```

---

## 153. 248-igraph-plotting-parameters

**Файл:** `248-igraph-plotting-parameters_3.R`

```r
plot(network,
    vertex.label=LETTERS[1:10],                    # Character vector used to label the nodes
    vertex.label.color=c("red","blue"),
    vertex.label.family="Times",                   # Font family of the label (e.g.“Times”, “Helvetica”)
    vertex.label.font=c(1,2,3,4),                  # Font: 1 plain, 2 bold, 3, italic, 4 bold italic, 5 symbol
    vertex.label.cex=c(0.5,1,1.5),                 # Font size (multiplication factor, device-dependent)
    vertex.label.dist=0,                           # Distance between the label and the vertex
    vertex.label.degree=0 ,                        # The position of the label in relation to the vertex (use pi)
    )
```

---

## 154. 248-igraph-plotting-parameters

**Файл:** `248-igraph-plotting-parameters_4.R`

```r
plot(network,
    edge.color=rep(c("red","pink"),5),           # Edge color
    edge.width=seq(1,10),                        # Edge width, defaults to 1
    edge.arrow.size=1,                           # Arrow size, defaults to 1
    edge.arrow.width=1,                          # Arrow width, defaults to 1
    edge.lty=c("solid")                           # Line type, could be 0 or “blank”, 1 or “solid”, 2 or “dashed”, 3 or “dotted”, 4 or “dotdash”, 5 or “longdash”, 6 or “twodash”
    #edge.curved=c(rep(0,5), rep(1,5))            # Edge curvature, range 0-1 (FALSE sets it to 0, TRUE to 0.5)
    )
```

---

## 155. 248-igraph-plotting-parameters

**Файл:** `248-igraph-plotting-parameters_5.R`

```r
par(bg="black")

plot(network, 
    
    # === vertex
    vertex.color = rgb(0.8,0.4,0.3,0.8),          # Node color
    vertex.frame.color = "white",                 # Node border color
    vertex.shape="circle",                        # One of “none”, “circle”, “square”, “csquare”, “rectangle” “crectangle”, “vrectangle”, “pie”, “raster”, or “sphere”
    vertex.size=14,                               # Size of the node (default is 15)
    vertex.size2=NA,                              # The second size of the node (e.g. for a rectangle)
    
    # === vertex label
    vertex.label=LETTERS[1:10],                   # Character vector used to label the nodes
    vertex.label.color="white",
    vertex.label.family="Times",                  # Font family of the label (e.g.“Times”, “Helvetica”)
    vertex.label.font=2,                          # Font: 1 plain, 2 bold, 3, italic, 4 bold italic, 5 symbol
    vertex.label.cex=1,                           # Font size (multiplication factor, device-dependent)
    vertex.label.dist=0,                          # Distance between the label and the vertex
    vertex.label.degree=0 ,                       # The position of the label in relation to the vertex (use pi)
    
    # === Edge
    edge.color="white",                           # Edge color
    edge.width=4,                                 # Edge width, defaults to 1
    edge.arrow.size=1,                            # Arrow size, defaults to 1
    edge.arrow.width=1,                           # Arrow width, defaults to 1
    edge.lty="solid",                             # Line type, could be 0 or “blank”, 1 or “solid”, 2 or “dashed”, 3 or “dotted”, 4 or “dotdash”, 5 or “longdash”, 6 or “twodash”
    edge.curved=0.3    ,                          # Edge curvature, range 0-1 (FALSE sets it to 0, TRUE to 0.5)
    )
```

---

## 156. 249-igraph-network-map-a-color

**Файл:** `249-igraph-network-map-a-color_1.R`

```r
# library
library(igraph)
 
# create data:
links <- data.frame(
    source=c("A","A", "A", "A", "A","J", "B", "B", "C", "C", "D","I"),
    target=c("B","B", "C", "D", "J","A","E", "F", "G", "H", "I","I"),
    importance=(sample(1:4, 12, replace=T))
    )
nodes <- data.frame(
    name=LETTERS[1:10],
    carac=c( rep("young",3),rep("adult",2), rep("old",5))
    )
 
# Turn it into igraph object
network <- graph_from_data_frame(d=links, vertices=nodes, directed=F) 
 
# Make a palette of 3 colors
library(RColorBrewer)
coul  <- brewer.pal(3, "Set1") 
 
# Create a vector of color
my_color <- coul[as.numeric(as.factor(V(network)$carac))]
 
# Make the plot
plot(network, vertex.color=my_color)
 
# Add a legend
legend("bottomleft", legend=levels(as.factor(V(network)$carac))  , col = coul , bty = "n", pch=20 , pt.cex = 3, cex = 1.5, text.col=coul , horiz = FALSE, inset = c(0.1, 0.1))
```

---

## 157. 249-igraph-network-map-a-color

**Файл:** `249-igraph-network-map-a-color_2.R`

```r
# Check
#E(network)$importance

# Plot
plot(network, vertex.color=my_color, edge.width=E(network)$importance*2 )
legend("bottomleft", legend=levels(as.factor(V(network)$carac))  , col = coul , bty = "n", pch=20 , pt.cex = 3, cex = 1.5, text.col=coul , horiz = FALSE, inset = c(0.1, 0.1))
```

---

## 158. 25-histogram-without-border

**Файл:** `25-histogram-without-border_1.R`

```r
# Create data 
my_variable=c(rnorm(1000 , 0 , 2) , rnorm(1000 , 9 , 2))
 
# Draw the histogram with border=F
hist(my_variable , breaks=40 , col=rgb(0.2,0.8,0.5,0.5) , border=F , main="")
```

---

## 159. 250-correlation-network-with-igraph

**Файл:** `250-correlation-network-with-igraph_1.R`

```r
# library
library(igraph)
 
# data
# head(mtcars)
 
# Make a correlation matrix:
mat <- cor(t(mtcars[,c(1,3:6)]))
```

---

## 160. 250-correlation-network-with-igraph

**Файл:** `250-correlation-network-with-igraph_2.R`

```r
# Keep only high correlations
mat[mat<0.995] <- 0
 
# Make an Igraph object from this matrix:
network <- graph_from_adjacency_matrix( mat, weighted=T, mode="undirected", diag=F)

# Basic chart
plot(network)
```

---

## 161. 250-correlation-network-with-igraph

**Файл:** `250-correlation-network-with-igraph_3.R`

```r
# color palette
library(RColorBrewer)
coul <- brewer.pal(nlevels(as.factor(mtcars$cyl)), "Set2")

# Map the color to cylinders
my_color <- coul[as.numeric(as.factor(mtcars$cyl))]

# plot
par(bg="grey13", mar=c(0,0,0,0))
set.seed(4)
plot(network, 
    vertex.size=12,
    vertex.color=my_color, 
    vertex.label.cex=0.7,
    vertex.label.color="white",
    vertex.frame.color="transparent"
    )

# title and legend
text(0,0,"mtcars network",col="white", cex=1.5)
legend(x=-0.2, y=-0.12, 
       legend=paste( levels(as.factor(mtcars$cyl)), " cylinders", sep=""), 
       col = coul , 
       bty = "n", pch=20 , pt.cex = 2, cex = 1,
       text.col="white" , horiz = F)
```

---

## 162. 250-correlation-network-with-igraph

**Файл:** `250-correlation-network-with-igraph_4.R`

```r
plot(network,
    edge.color=rep(c("red","pink"),5),           # Edge color
    edge.width=seq(1,10),                        # Edge width, defaults to 1
    edge.arrow.size=1,                           # Arrow size, defaults to 1
    edge.arrow.width=1,                          # Arrow width, defaults to 1
    edge.lty=c("solid")                           # Line type, could be 0 or “blank”, 1 or “solid”, 2 or “dashed”, 3 or “dotted”, 4 or “dotdash”, 5 or “longdash”, 6 or “twodash”
    #edge.curved=c(rep(0,5), rep(1,5))            # Edge curvature, range 0-1 (FALSE sets it to 0, TRUE to 0.5)
    )
```

---

## 163. 250-correlation-network-with-igraph

**Файл:** `250-correlation-network-with-igraph_5.R`

```r
par(bg="black")

plot(network,

    # === vertex
    vertex.color = rgb(0.8,0.4,0.3,0.8),          # Node color
    vertex.frame.color = "white",                 # Node border color
    vertex.shape="circle",                        # One of “none”, “circle”, “square”, “csquare”, “rectangle” “crectangle”, “vrectangle”, “pie”, “raster”, or “sphere”
    vertex.size=14,                               # Size of the node (default is 15)
    vertex.size2=NA,                              # The second size of the node (e.g. for a rectangle)

    # === vertex label
    vertex.label=LETTERS[1:10],                   # Character vector used to label the nodes
    vertex.label.color="white",
    vertex.label.family="Times",                  # Font family of the label (e.g.“Times”, “Helvetica”)
    vertex.label.font=2,                          # Font: 1 plain, 2 bold, 3, italic, 4 bold italic, 5 symbol
    vertex.label.cex=1,                           # Font size (multiplication factor, device-dependent)
    vertex.label.dist=0,                          # Distance between the label and the vertex
    vertex.label.degree=0 ,                       # The position of the label in relation to the vertex (use pi)

    # === Edge
    edge.color="white",                           # Edge color
    edge.width=4,                                 # Edge width, defaults to 1
    edge.arrow.size=1,                            # Arrow size, defaults to 1
    edge.arrow.width=1,                           # Arrow width, defaults to 1
    edge.lty="solid",                             # Line type, could be 0 or “blank”, 1 or “solid”, 2 or “dashed”, 3 or “dotted”, 4 or “dotdash”, 5 or “longdash”, 6 or “twodash”
    edge.curved=0.3    ,                          # Edge curvature, range 0-1 (FALSE sets it to 0, TRUE to 0.5)
    )
```

---

## 164. 251-network-with-node-size-based-on-edges-number

**Файл:** `251-network-with-node-size-based-on-edges-number_1.R`

```r
# library
library(igraph)
 
# create data:
links=data.frame(
    source=c("A","A", "A", "A", "A","J", "B", "B", "C", "C", "D","I"),
    target=c("B","B", "C", "D", "J","A","E", "F", "G", "H", "I","I")
    )
 
# Turn it into igraph object
network <- graph_from_data_frame(d=links, directed=F) 
 
# Count the number of degree for each node:
deg <- degree(network, mode="all")
 
# Plot
plot(network, vertex.size=deg*6, vertex.color=rgb(0.1,0.7,0.8,0.5) )
```

---

## 165. 257-input-formats-for-network-charts

**Файл:** `257-input-formats-for-network-charts_1.R`

```r
#library
library(igraph)

# Create data
set.seed(10)
data <- matrix(sample(0:2, 25, replace=TRUE), nrow=5)
colnames(data) = rownames(data) = LETTERS[1:5]
 
# build the graph object
network <- graph_from_adjacency_matrix(data)
 
# plot it
plot(network)
```

---

## 166. 257-input-formats-for-network-charts

**Файл:** `257-input-formats-for-network-charts_2.R`

```r
# lib
library(igraph)

# data
set.seed(1)
data <- matrix(sample(0:2, 15, replace=TRUE), nrow=3)
colnames(data) <- letters[1:5]
rownames(data) <- LETTERS[1:3]
 
# create the network object
network <- graph_from_incidence_matrix(data)
 
# plot it
plot(network)
```

---

## 167. 257-input-formats-for-network-charts

**Файл:** `257-input-formats-for-network-charts_3.R`

```r
# create data:
links <- data.frame(
    source=c("A","A", "A", "A", "A","F", "B"),
    target=c("B","B", "C", "D", "F","A","E")
    )

# create the network object
network <- graph_from_data_frame(d=links, directed=F) 

# plot it
plot(network)
```

---

## 168. 257-input-formats-for-network-charts

**Файл:** `257-input-formats-for-network-charts_4.R`

```r
# create data:
network <- graph_from_literal( A-B-C-D, E-A-E-A, D-C-A, D-A-D-C )

# plot it
plot(network)
```

---

## 169. 26-add-text-over-a-boxplot

**Файл:** `26-add-text-over-a-boxplot_1.R`

```r
# Dummy data
names <- c(rep("A", 20) , rep("B", 8) , rep("C", 30), rep("D", 80))
value <- c( sample(2:5, 20 , replace=T) , sample(4:10, 8 , replace=T), 
       sample(1:7, 30 , replace=T), sample(3:8, 80 , replace=T) )
data <- data.frame(names,value)
 
# Draw the boxplot. Note result is also stored in a object called boundaries
boundaries <- boxplot(data$value ~ data$names , col="#69b3a2" , ylim=c(1,11))
# Now you can type boundaries$stats to get the boundaries of the boxes

# Add sample size on top
nbGroup <- nlevels(data$names)
text( 
  x=c(1:nbGroup), 
  y=boundaries$stats[nrow(boundaries$stats),] + 0.5, 
  paste("n = ",table(data$names),sep="")  
)
```

---

## 170. 262-basic-boxplot-with-ggplot2

**Файл:** `262-basic-boxplot-with-ggplot2_1.R`

```r
# Load ggplot2
library(ggplot2)
 
# The mtcars dataset is natively available
# head(mtcars)
 
# A really basic boxplot.
ggplot(mtcars, aes(x=as.factor(cyl), y=mpg)) + 
    geom_boxplot(fill="slateblue", alpha=0.2) + 
    xlab("cyl")
```

---

## 171. 263-ggplot2-boxplot-parameters

**Файл:** `263-ggplot2-boxplot-parameters_1.R`

```r
# Load ggplot2
library(ggplot2)
 
# The mpg dataset is natively available
#head(mpg)
 
# geom_boxplot proposes several arguments to custom appearance
ggplot(mpg, aes(x=class, y=hwy)) + 
    geom_boxplot(
        
        # custom boxes
        color="blue",
        fill="blue",
        alpha=0.2,
        
        # Notch?
        notch=TRUE,
        notchwidth = 0.8,
        
        # custom outliers
        outlier.colour="red",
        outlier.fill="red",
        outlier.size=3
    
    )
```

---

## 172. 264-control-ggplot2-boxplot-colors

**Файл:** `264-control-ggplot2-boxplot-colors_1.R`

```r
# library
library(ggplot2)
 
# The mtcars dataset is natively available in R
#head(mpg)
 
# Top Left: Set a unique color with fill, colour, and alpha
ggplot(mpg, aes(x=class, y=hwy)) + 
    geom_boxplot(color="red", fill="orange", alpha=0.2)
 
# Top Right: Set a different color for each group
ggplot(mpg, aes(x=class, y=hwy, fill=class)) + 
    geom_boxplot(alpha=0.3) +
    theme(legend.position="none")

# Bottom Left
ggplot(mpg, aes(x=class, y=hwy, fill=class)) + 
    geom_boxplot(alpha=0.3) +
    theme(legend.position="none") +
    scale_fill_brewer(palette="BuPu")
 
# Bottom Right
ggplot(mpg, aes(x=class, y=hwy, fill=class)) + 
    geom_boxplot(alpha=0.3) +
    theme(legend.position="none") +
    scale_fill_brewer(palette="Dark2")
```

---

## 173. 264-control-ggplot2-boxplot-colors

**Файл:** `264-control-ggplot2-boxplot-colors_2.R`

```r
# Libraries
library(ggplot2)
library(dplyr)
library(hrbrthemes)

# Work with the natively available mpg dataset
mpg %>% 
  
  # Add a column called 'type': do we want to highlight the group or not?
  mutate( type=ifelse(class=="subcompact","Highlighted","Normal")) %>%
  
  # Build the boxplot. In the 'fill' argument, give this column
  ggplot( aes(x=class, y=hwy, fill=type, alpha=type)) + 
    geom_boxplot() +
    scale_fill_manual(values=c("#69b3a2", "grey")) +
    scale_alpha_manual(values=c(1,0.1)) +
    theme_ipsum() +
    theme(legend.position = "none") +
    xlab("")
```

---

## 174. 265-grouped-boxplot-with-ggplot2

**Файл:** `265-grouped-boxplot-with-ggplot2_1.R`

```r
# library
library(ggplot2)
 
# create a data frame
variety=rep(LETTERS[1:7], each=40)
treatment=rep(c("high","low"),each=20)
note=seq(1:280)+sample(1:150, 280, replace=T)
data=data.frame(variety, treatment ,  note)
 
# grouped boxplot
ggplot(data, aes(x=variety, y=note, fill=treatment)) + 
    geom_boxplot()
```

---

## 175. 265-grouped-boxplot-with-ggplot2

**Файл:** `265-grouped-boxplot-with-ggplot2_2.R`

```r
# One box per treatment
p1 <- ggplot(data, aes(x=variety, y=note, fill=treatment)) + 
    geom_boxplot() +
    facet_wrap(~treatment)
# one box per variety
p2 <- ggplot(data, aes(x=variety, y=note, fill=treatment)) + 
    geom_boxplot() +
    facet_wrap(~variety, scale="free")
```

---

## 176. 266-ggplot2-boxplot-with-variable-width

**Файл:** `266-ggplot2-boxplot-with-variable-width_1.R`

```r
# library
library(ggplot2)
 
# create data
names <- c(rep("A", 20) , rep("B", 5) , rep("C", 30), rep("D", 100))
value <- c( sample(2:5, 20 , replace=T) , sample(4:10, 5 , replace=T), sample(1:7, 30 , replace=T), sample(3:8, 100 , replace=T) )
data <- data.frame(names,value)
 
# prepare a special xlab with the number of obs for each group
my_xlab <- paste(levels(data$names),"\n(N=",table(data$names),")",sep="")
 
# plot
ggplot(data, aes(x=names, y=value, fill=names)) +
    geom_boxplot(varwidth = TRUE, alpha=0.2) +
    theme(legend.position="none") +
    scale_x_discrete(labels=my_xlab)
```

---

## 177. 267-reorder-a-variable-in-ggplot2

**Файл:** `267-reorder-a-variable-in-ggplot2_1.R`

```r
# Library
library(ggplot2)
library(dplyr)

# Dataset 1: one value per group
data <- data.frame(
  name=c("north","south","south-east","north-west","south-west","north-east","west","east"),
  val=sample(seq(1,10), 8 )
)
 
# Dataset 2: several values per group (natively provided in R)
# mpg
```

---

## 178. 267-reorder-a-variable-in-ggplot2

**Файл:** `267-reorder-a-variable-in-ggplot2_2.R`

```r
# load the library
library(forcats)

# Reorder following the value of another column:
data %>%
  mutate(name = fct_reorder(name, val)) %>%
  ggplot( aes(x=name, y=val)) +
    geom_bar(stat="identity", fill="#f68060", alpha=.6, width=.4) +
    coord_flip() +
    xlab("") +
    theme_bw()
 
# Reverse side
data %>%
  mutate(name = fct_reorder(name, desc(val))) %>%
  ggplot( aes(x=name, y=val)) +
    geom_bar(stat="identity", fill="#f68060", alpha=.6, width=.4) +
    coord_flip() +
    xlab("") +
    theme_bw()
```

---

## 179. 267-reorder-a-variable-in-ggplot2

**Файл:** `267-reorder-a-variable-in-ggplot2_3.R`

```r
# Using median
mpg %>%
  mutate(class = fct_reorder(class, hwy, .fun='median')) %>%
  ggplot( aes(x=reorder(class, hwy), y=hwy, fill=class)) + 
    geom_boxplot() +
    xlab("class") +
    theme(legend.position="none") +
    xlab("")
 
# Using number of observation per group
mpg %>%
  mutate(class = fct_reorder(class, hwy, .fun='length' )) %>%
  ggplot( aes(x=class, y=hwy, fill=class)) + 
    geom_boxplot() +
    xlab("class") +
    theme(legend.position="none") +
    xlab("") +
    xlab("")
```

---

## 180. 267-reorder-a-variable-in-ggplot2

**Файл:** `267-reorder-a-variable-in-ggplot2_4.R`

```r
# Reorder following a precise order
p <- data %>%
  mutate(name = fct_relevel(name, 
            "north", "north-east", "east", 
            "south-east", "south", "south-west", 
            "west", "north-west")) %>%
  ggplot( aes(x=name, y=val)) +
    geom_bar(stat="identity") +
    xlab("")
#p
```

---

## 181. 267-reorder-a-variable-in-ggplot2

**Файл:** `267-reorder-a-variable-in-ggplot2_5.R`

```r
data %>%
  arrange(val) %>%    # First sort by val. This sort the dataframe but NOT the factor levels
  mutate(name=factor(name, levels=name)) %>%   # This trick update the factor levels
  ggplot( aes(x=name, y=val)) +
    geom_segment( aes(xend=name, yend=0)) +
    geom_point( size=4, color="orange") +
    coord_flip() +
    theme_bw() +
    xlab("")
 
data %>%
  arrange(val) %>%
  mutate(name = factor(name, levels=c("north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"))) %>%
  ggplot( aes(x=name, y=val)) +
    geom_segment( aes(xend=name, yend=0)) +
    geom_point( size=4, color="orange") +
    theme_bw() +
    xlab("")
```

---

## 182. 267-reorder-a-variable-in-ggplot2

**Файл:** `267-reorder-a-variable-in-ggplot2_6.R`

```r
# reorder is close to order, but is made to change the order of the factor levels.
mpg$class = with(mpg, reorder(class, hwy, median))

p <- mpg %>%
  ggplot( aes(x=class, y=hwy, fill=class)) + 
    geom_violin() +
    xlab("class") +
    theme(legend.position="none") +
    xlab("")
#p
```

---

## 183. 268-ggplot2-boxplot-from-continuous-variable

**Файл:** `268-ggplot2-boxplot-from-continuous-variable_1.R`

```r
# library
library(ggplot2)
library(dplyr)
library(hrbrthemes)

# Start with the diamonds dataset, natively available in R:
p <- diamonds %>%
  
  # Add a new column called 'bin': cut the initial 'carat' in bins
  mutate( bin=cut_width(carat, width=0.5, boundary=0) ) %>%
  
  # plot
  ggplot( aes(x=bin, y=price) ) +
    geom_boxplot(fill="#69b3a2") +
    theme_ipsum() +
    xlab("Carat")
```

---

## 184. 269-ggplot2-boxplot-with-average-value

**Файл:** `269-ggplot2-boxplot-with-average-value_1.R`

```r
# Library
library(ggplot2)
 
# create data
names=c(rep("A", 20) , rep("B", 8) , rep("C", 30), rep("D", 80))
value=c( sample(2:5, 20 , replace=T) , sample(4:10, 8 , replace=T), sample(1:7, 30 , replace=T), sample(3:8, 80 , replace=T) )
data=data.frame(names,value)
 
# plot
p <- ggplot(data, aes(x=names, y=value, fill=names)) +
    geom_boxplot(alpha=0.7) +
    stat_summary(fun.y=mean, geom="point", shape=20, size=14, color="red", fill="red") +
    theme(legend.position="none") +
    scale_fill_brewer(palette="Set1")
```

---

## 185. 27-levelplot-with-lattice

**Файл:** `27-levelplot-with-lattice_1.R`

```r
# Load the lattice package
library("lattice")
 
# Dummy data
x <- seq(1,10, length.out=20)
y <- seq(1,10, length.out=20)
data <- expand.grid(X=x, Y=y)
data$Z <- runif(400, 0, 5)

## Try it out
levelplot(Z ~ X*Y, data=data  ,xlab="X",
          main="")
```

---

## 186. 27-levelplot-with-lattice

**Файл:** `27-levelplot-with-lattice_2.R`

```r
# Load the library
library("lattice")
 
# Dummy data
data <- matrix(runif(100, 0, 5) , 10 , 10)
colnames(data) <- letters[c(1:10)]
rownames(data) <- paste( rep("row",10) , c(1:10) , sep=" ")
 
# plot it flipping the axis
levelplot(data)
```

---

## 187. 27-levelplot-with-lattice

**Файл:** `27-levelplot-with-lattice_3.R`

```r
# Load the library
library("lattice")
 
# Dummy data
data <- matrix(runif(100, 0, 5) , 10 , 10)
colnames(data) <- letters[c(1:10)]
rownames(data) <- paste( rep("row",10) , c(1:10) , sep=" ")
 
# plot it flipping the axis
levelplot( t(data[c(nrow(data):1) , ]),
           col.regions=heat.colors(100))
```

---

## 188. 27-levelplot-with-lattice

**Файл:** `27-levelplot-with-lattice_4.R`

```r
# Lattice package
require(lattice)

# The volcano dataset is provided, it looks like that:
#head(volcano)

# 1: native palette from R
levelplot(volcano, col.regions = terrain.colors(100)) # try cm.colors() or terrain.colors()

# 2: Rcolorbrewer palette
library(RColorBrewer)
coul <- colorRampPalette(brewer.pal(8, "PiYG"))(25)
levelplot(volcano, col.regions = coul) # try cm.colors() or terrain.colors()

# 3: Viridis
library(viridisLite)
coul <- viridis(100)
levelplot(volcano, col.regions = coul) 
#levelplot(volcano, col.regions = magma(100))
```

---

## 189. 272-basic-scatterplot-with-ggplot2

**Файл:** `272-basic-scatterplot-with-ggplot2_1.R`

```r
# library
library(ggplot2)
 
# The iris dataset is provided natively by R
#head(iris)
 
# basic scatterplot
ggplot(iris, aes(x=Sepal.Length, y=Sepal.Width)) + 
    geom_point()
```

---

## 190. 273-custom-your-scatterplot-ggplot2

**Файл:** `273-custom-your-scatterplot-ggplot2_1.R`

```r
# library
library(ggplot2)
 
# Iris dataset is natively provided by R
#head(iris)
 
# use options!
ggplot(iris, aes(x=Sepal.Length, y=Sepal.Width)) + 
    geom_point(
        color="orange",
        fill="#69b3a2",
        shape=21,
        alpha=0.5,
        size=6,
        stroke = 2
        )
```

---

## 191. 273-custom-your-scatterplot-ggplot2

**Файл:** `273-custom-your-scatterplot-ggplot2_2.R`

```r
# library
library(ggplot2)
library(hrbrthemes)

# Iris dataset is natively provided by R
#head(iris)
 
# use options!
ggplot(iris, aes(x=Sepal.Length, y=Sepal.Width)) + 
    geom_point(
        color="black",
        fill="#69b3a2",
        shape=22,
        alpha=0.5,
        size=6,
        stroke = 1
        ) +
    theme_ipsum()
```

---

## 192. 274-map-a-variable-to-ggplot2-scatterplot

**Файл:** `274-map-a-variable-to-ggplot2-scatterplot_1.R`

```r
# Transparency
ggplot(iris, aes(x=Sepal.Length, y=Sepal.Width, alpha=Species)) + 
    geom_point(size=6, color="#69b3a2") +
    ggtitle("Transparency") +
    theme_ipsum()

# Shape
ggplot(iris, aes(x=Sepal.Length, y=Sepal.Width, shape=Species)) + 
    geom_point(size=6, color="lightblue") +
    ggtitle("Shape") +
    theme_ipsum()

# Size
ggplot(iris, aes(x=Sepal.Length, y=Sepal.Width, size=Petal.Width)) + 
    geom_point(color="darkred") +
    ggtitle("Size") +
    theme_ipsum()
```

---

## 193. 274-map-a-variable-to-ggplot2-scatterplot

**Файл:** `274-map-a-variable-to-ggplot2-scatterplot_2.R`

```r
# load ggplot2
library(ggplot2)
library(hrbrthemes)

# A basic scatterplot with color depending on Species
ggplot(iris, aes(x=Sepal.Length, y=Sepal.Width, shape=Species, alpha=Species, size=Species, color=Species)) + 
    geom_point() +
    theme_ipsum()
```

---

## 194. 275-add-text-labels-with-ggplot2

**Файл:** `275-add-text-labels-with-ggplot2_1.R`

```r
# library
library(ggplot2)
 
# Keep 30 first rows in the mtcars natively available dataset
data=head(mtcars, 30)
 
# 1/ add text with geom_text, use nudge to nudge the text
ggplot(data, aes(x=wt, y=mpg)) +
  geom_point() + # Show dots
  geom_text(
    label=rownames(data), 
    nudge_x = 0.25, nudge_y = 0.25, 
    check_overlap = T
  )
```

---

## 195. 275-add-text-labels-with-ggplot2

**Файл:** `275-add-text-labels-with-ggplot2_2.R`

```r
# library
library(ggplot2)
 
# Keep 30 first rows in the mtcars natively available dataset
data=head(mtcars, 30)
 
# 1/ add text with geom_text, use nudge to nudge the text
ggplot(data, aes(x=wt, y=mpg)) +
  geom_point() + # Show dots
  geom_label(
    label=rownames(data), 
    nudge_x = 0.25, nudge_y = 0.25, 
    check_overlap = T
  )
```

---

## 196. 275-add-text-labels-with-ggplot2

**Файл:** `275-add-text-labels-with-ggplot2_3.R`

```r
# library
library(ggplot2)
 
# Keep 30 first rows in the mtcars natively available dataset
data=head(mtcars, 30)
 
# Add one annotation
ggplot(data, aes(x=wt, y=mpg)) +
  geom_point() + # Show dots
  geom_label(
    label="Look at this!", 
    x=4.1,
    y=20,
    label.padding = unit(0.55, "lines"), # Rectangle size around label
    label.size = 0.35,
    color = "black",
    fill="#69b3a2"
  )
```

---

## 197. 275-add-text-labels-with-ggplot2

**Файл:** `275-add-text-labels-with-ggplot2_4.R`

```r
# library
library(ggplot2)
library(dplyr)
library(tibble)

# Keep 30 first rows in the mtcars natively available dataset
data=head(mtcars, 30)

# Change data rownames as a real column called 'carName'
data <- data %>%
  rownames_to_column(var="carName")
  
# Plot
ggplot(data, aes(x=wt, y=mpg)) +
  geom_point() + 
  geom_label( 
    data=data %>% filter(mpg>20 & wt>3), # Filter data first
    aes(label=carName)
  )
```

---

## 198. 276-scatterplot-with-rug-ggplot2

**Файл:** `276-scatterplot-with-rug-ggplot2_1.R`

```r
# library
library(ggplot2)

# Iris dataset
head(iris)

# plot
ggplot(data=iris, aes(x=Sepal.Length, Petal.Length)) +
  geom_point() +
  geom_rug(col="steelblue",alpha=0.1, size=1.5)
```

---

## 199. 277-marginal-histogram-for-ggplot2

**Файл:** `277-marginal-histogram-for-ggplot2_1.R`

```r
# library
library(ggplot2)
library(ggExtra)
 
# The mtcars dataset is proposed in R
head(mtcars)
 
# classic plot :
p <- ggplot(mtcars, aes(x=wt, y=mpg, color=cyl, size=cyl)) +
      geom_point() +
      theme(legend.position="none")
 
# with marginal histogram
p1 <- ggMarginal(p, type="histogram")
 
# marginal density
p2 <- ggMarginal(p, type="density")
 
# marginal boxplot
p3 <- ggMarginal(p, type="boxplot")
```

---

## 200. 277-marginal-histogram-for-ggplot2

**Файл:** `277-marginal-histogram-for-ggplot2_2.R`

```r
# library
library(ggplot2)
library(ggExtra)
 
# The mtcars dataset is proposed in R
head(mtcars)
 
# classic plot :
p <- ggplot(mtcars, aes(x=wt, y=mpg, color=cyl, size=cyl)) +
      geom_point() +
      theme(legend.position="none")
 
# Set relative size of marginal plots (main plot 10x bigger than marginals)
p1 <- ggMarginal(p, type="histogram", size=10)
 
# Custom marginal plots:
p2 <- ggMarginal(p, type="histogram", fill = "slateblue", xparams = list(  bins=10))
 
# Show only marginal plot for x axis
p3 <- ggMarginal(p, margins = 'x', color="purple", size=4)
```

---

## 201. 279-plotting-time-series-with-ggplot2

**Файл:** `279-plotting-time-series-with-ggplot2_1.R`

```r
# Libraries
library(ggplot2)
library(dplyr)

# Dummy data
data <- data.frame(
  day = as.Date("2017-06-14") - 0:364,
  value = runif(365) + seq(-140, 224)^2 / 10000
)

# Most basic bubble plot
p <- ggplot(data, aes(x=day, y=value)) +
  geom_line() + 
  xlab("")
p
```

---

## 202. 279-plotting-time-series-with-ggplot2

**Файл:** `279-plotting-time-series-with-ggplot2_2.R`

```r
p+scale_x_date(date_labels = "%b")
p+scale_x_date(date_labels = "%Y %b %d")
p+scale_x_date(date_labels = "%W")
p+scale_x_date(date_labels = "%m-%Y")
```

---

## 203. 279-plotting-time-series-with-ggplot2

**Файл:** `279-plotting-time-series-with-ggplot2_3.R`

```r
p + scale_x_date(date_breaks = "1 week", date_labels = "%W")
p + scale_x_date(date_minor_breaks = "2 day")
```

---

## 204. 279-plotting-time-series-with-ggplot2

**Файл:** `279-plotting-time-series-with-ggplot2_4.R`

```r
# Libraries
library(ggplot2)
library(dplyr)
library(hrbrthemes)

# Dummy data
data <- data.frame(
  day = as.Date("2017-06-14") - 0:364,
  value = runif(365) - seq(-140, 224)^2 / 10000
)

# Most basic bubble plot
p <- ggplot(data, aes(x=day, y=value)) +
  geom_line( color="#69b3a2") + 
  xlab("") +
  theme_ipsum() +
  theme(axis.text.x=element_text(angle=60, hjust=1)) 

p
```

---

## 205. 279-plotting-time-series-with-ggplot2

**Файл:** `279-plotting-time-series-with-ggplot2_5.R`

```r
# Libraries
library(ggplot2)
library(dplyr)
library(hrbrthemes)

# Dummy data
data <- data.frame(
  day = as.Date("2017-06-14") - 0:364,
  value = runif(365) + seq(-140, 224)^2 / 10000
)

# Most basic bubble plot
p <- ggplot(data, aes(x=day, y=value)) +
  geom_line( color="steelblue") + 
  geom_point() +
  xlab("") +
  theme_ipsum() +
  theme(axis.text.x=element_text(angle=60, hjust=1)) +
  scale_x_date(limit=c(as.Date("2017-01-01"),as.Date("2017-02-11"))) +
  ylim(0,1.5)

p
```

---

## 206. 283-the-hourly-heatmap

**Файл:** `283-the-hourly-heatmap_1.R`

```r
library(ggplot2)
library(dplyr) # easier data wrangling 
library(viridis) # colour blind friendly palette, works in B&W also
library(Interpol.T) #  will generate a large dataset on initial load
library(lubridate) # for easy date manipulation
library(ggExtra) # because remembering ggplot theme options is beyond me
library(tidyr) 
 
 
data <- data(Trentino_hourly_T,package = "Interpol.T")
 
names(h_d_t)[1:5]<- c("stationid","date","hour","temp","flag")
df <- tbl_df(h_d_t) %>%
  filter(stationid =="T0001")
 
df <- df %>% mutate(year = year(date),
                  month = month(date, label=TRUE),
                  day = day(date))
  
df$date<-ymd(df$date) # not necessary for plot but 
#useful if you want to do further work with the data
 
#cleanup
rm(list=c("h_d_t","mo_bias","Tn","Tx",
          "Th_int_list","calibration_l",
          "calibration_shape","Tm_list"))
 
 
#create plotting df
df <-df %>% select(stationid,day,hour,month,year,temp)%>%
        fill(temp) #optional - see note below
 
# Re: use of fill
# This code is for demonstrating a visualisation technique
# There are 5 missing hourly values in the dataframe.
 
# see the original plot here (from my ggplot demo earlier this year) to see the white spaces where the missing values occcur:
# https://github.com/johnmackintosh/ggplotdemo/blob/master/temp8.png 
 
# I used 'fill' from  tidyr to take the prior value for each missing value and replace the NA
# This is a quick fix for the blog post only - _do not_ do this with your real world data
 
# Should really use either use replace_NA or complete(with fill)in tidyr 
# OR 
# Look into more specialist way of replacing these missing values -e.g. imputation.
 
 
 
statno <-unique(df$stationid)
 
 
 
######## Plotting starts here#####################
p <-ggplot(df,aes(day,hour,fill=temp))+
  geom_tile(color= "white",size=0.1) + 
  scale_fill_viridis(name="Hrly Temps C",option ="C")
p <-p + facet_grid(year~month)
p <-p + scale_y_continuous(trans = "reverse", breaks = unique(df$hour))
p <-p + scale_x_continuous(breaks =c(1,10,20,31))
p <-p + theme_minimal(base_size = 8)
p <-p + labs(title= paste("Hourly Temps - Station",statno), x="Day", y="Hour Commencing")
p <-p + theme(legend.position = "bottom")+
  theme(plot.title=element_text(size = 14))+
  theme(axis.text.y=element_text(size=6)) +
  theme(strip.background = element_rect(colour="white"))+
  theme(plot.title=element_text(hjust=0))+
  theme(axis.ticks=element_blank())+
  theme(axis.text=element_text(size=7))+
  theme(legend.title=element_text(size=8))+
  theme(legend.text=element_text(size=6))+
  removeGrid()#ggExtra
 
# you will want to expand your plot screen before this bit!
p #awesomeness
```

---

## 207. 29-basic-dendrogram

**Файл:** `29-basic-dendrogram_1.R`

```r
# Dataset 
data <- matrix( sample(seq(1,2000),200), ncol = 10 )
rownames(data) <- paste0("sample_" , seq(1,20))
colnames(data) <- paste0("variable",seq(1,10))

# Euclidean distance
dist <- dist(data[ , c(4:8)] , diag=TRUE)

# Hierarchical Clustering with hclust
hc <- hclust(dist)

# Plot the result
plot(hc)
```

---

## 208. 29-basic-dendrogram

**Файл:** `29-basic-dendrogram_2.R`

```r
# store the dedrogram in an object
dhc <- as.dendrogram(hc)

# set the margin
par(mar=c(4,4,2,2))

# Plot the Second group
plot(dhc[[2]] , main= "zoom on a part of the dendrogram")
```

---

## 209. 294-basic-ridgeline-plot

**Файл:** `294-basic-ridgeline-plot_1.R`

```r
# library
library(ggridges)
library(ggplot2)
 
# Diamonds dataset is provided by R natively
#head(diamonds)
 
# basic example
ggplot(diamonds, aes(x = price, y = cut, fill = cut)) +
  geom_density_ridges() +
  theme_ridges() + 
  theme(legend.position = "none")
```

---

## 210. 294-basic-ridgeline-plot

**Файл:** `294-basic-ridgeline-plot_2.R`

```r
# library
library(ggridges)
library(ggplot2)
library(dplyr)
library(tidyr)
library(forcats)

# Load dataset from github
data <- read.table("https://raw.githubusercontent.com/zonination/perceptions/master/probly.csv", header=TRUE, sep=",")
data <- data %>% 
  gather(key="text", value="value") %>%
  mutate(text = gsub("\\.", " ",text)) %>%
  mutate(value = round(as.numeric(value),0)) %>%
  filter(text %in% c("Almost Certainly","Very Good Chance","We Believe","Likely","About Even", "Little Chance", "Chances Are Slight", "Almost No Chance"))

# Plot
data %>%
  mutate(text = fct_reorder(text, value)) %>%
  ggplot( aes(y=text, x=value,  fill=text)) +
    geom_density_ridges(alpha=0.6, stat="binline", bins=20) +
    theme_ridges() +
    theme(
      legend.position="none",
      panel.spacing = unit(0.1, "lines"),
      strip.text.x = element_text(size = 8)
    ) +
    xlab("") +
    ylab("Assigned Probability (%)")
```

---

## 211. 294-basic-ridgeline-plot

**Файл:** `294-basic-ridgeline-plot_3.R`

```r
# library
library(ggridges)
library(ggplot2)
library(viridis)
library(hrbrthemes)

# Plot
ggplot(lincoln_weather, aes(x = `Mean Temperature [F]`, y = `Month`, fill = ..x..)) +
  geom_density_ridges_gradient(scale = 3, rel_min_height = 0.01) +
  scale_fill_viridis(name = "Temp. [F]", option = "C") +
  labs(title = 'Temperatures in Lincoln NE in 2016') +
  theme_ipsum() +
    theme(
      legend.position="none",
      panel.spacing = unit(0.1, "lines"),
      strip.text.x = element_text(size = 8)
    )
```

---

## 212. 295-basic-circular-barplot

**Файл:** `295-basic-circular-barplot_1.R`

```r
# Libraries
library(tidyverse)
 
# Create dataset
data <- data.frame(
  id=seq(1,60),
  individual=paste( "Mister ", seq(1,60), sep=""),
  value=sample( seq(10,100), 60, replace=T)
)
 
# Make the plot
p <- ggplot(data, aes(x=as.factor(id), y=value)) +       # Note that id is a factor. If x is numeric, there is some space between the first bar
  
  # This add the bars with a blue color
  geom_bar(stat="identity", fill=alpha("blue", 0.3)) +
  
  # Limits of the plot = very important. The negative value controls the size of the inner circle, the positive one is useful to add size over each bar
  ylim(-100,120) +
  
  # Custom the theme: no axis title and no cartesian grid
  theme_minimal() +
  theme(
    axis.text = element_blank(),
    axis.title = element_blank(),
    panel.grid = element_blank(),
    plot.margin = unit(rep(-2,4), "cm")     # This remove unnecessary margin around plot
  ) +
  
  # This makes the coordinate polar instead of cartesian.
  coord_polar(start = 0)
p
```

---

## 213. 296-add-labels-to-circular-barplot

**Файл:** `296-add-labels-to-circular-barplot_1.R`

```r
# Libraries
library(tidyverse)
 
# Create dataset
data <- data.frame(
  id=seq(1,60),
  individual=paste( "Mister ", seq(1,60), sep=""),
  value=sample( seq(10,100), 60, replace=T)
)
 
# ----- This section prepare a dataframe for labels ---- #
# Get the name and the y position of each label
label_data <- data
 
# calculate the ANGLE of the labels
number_of_bar <- nrow(label_data)
angle <-  90 - 360 * (label_data$id-0.5) /number_of_bar     # I substract 0.5 because the letter must have the angle of the center of the bars. Not extreme right(1) or extreme left (0)
 
# calculate the alignment of labels: right or left
# If I am on the left part of the plot, my labels have currently an angle < -90
label_data$hjust<-ifelse( angle < -90, 1, 0)
 
# flip angle BY to make them readable
label_data$angle<-ifelse(angle < -90, angle+180, angle)
# ----- ------------------------------------------- ---- #
 
 
# Start the plot
p <- ggplot(data, aes(x=as.factor(id), y=value)) +       # Note that id is a factor. If x is numeric, there is some space between the first bar
  
  # This add the bars with a blue color
  geom_bar(stat="identity", fill=alpha("skyblue", 0.7)) +
  
  # Limits of the plot = very important. The negative value controls the size of the inner circle, the positive one is useful to add size over each bar
  ylim(-100,120) +
  
  # Custom the theme: no axis title and no cartesian grid
  theme_minimal() +
  theme(
    axis.text = element_blank(),
    axis.title = element_blank(),
    panel.grid = element_blank(),
    plot.margin = unit(rep(-1,4), "cm")      # Adjust the margin to make in sort labels are not truncated!
  ) +
  
  # This makes the coordinate polar instead of cartesian.
  coord_polar(start = 0) +
  
  # Add the labels, using the label_data dataframe that we have created before
  geom_text(data=label_data, aes(x=id, y=value+10, label=individual, hjust=hjust), color="black", fontface="bold",alpha=0.6, size=2.5, angle= label_data$angle, inherit.aes = FALSE ) 
 
p
```

---

## 214. 297-circular-barplot-with-groups

**Файл:** `297-circular-barplot-with-groups_1.R`

```r
# library
library(tidyverse)
 
# Create dataset
data <- data.frame(
  individual=paste( "Mister ", seq(1,60), sep=""),
  value=sample( seq(10,100), 60, replace=T)
)
 
# Set a number of 'empty bar'
empty_bar <- 10
 
# Add lines to the initial dataset
to_add <- matrix(NA, empty_bar, ncol(data))
colnames(to_add) <- colnames(data)
data <- rbind(data, to_add)
data$id <- seq(1, nrow(data))
 
# Get the name and the y position of each label
label_data <- data
number_of_bar <- nrow(label_data)
angle <- 90 - 360 * (label_data$id-0.5) /number_of_bar     # I substract 0.5 because the letter must have the angle of the center of the bars. Not extreme right(1) or extreme left (0)
label_data$hjust <- ifelse( angle < -90, 1, 0)
label_data$angle <- ifelse(angle < -90, angle+180, angle)
 
# Make the plot
p <- ggplot(data, aes(x=as.factor(id), y=value)) +       # Note that id is a factor. If x is numeric, there is some space between the first bar
  geom_bar(stat="identity", fill=alpha("green", 0.3)) +
  ylim(-100,120) +
  theme_minimal() +
  theme(
    axis.text = element_blank(),
    axis.title = element_blank(),
    panel.grid = element_blank(),
    plot.margin = unit(rep(-1,4), "cm") 
  ) +
  coord_polar(start = 0) + 
  geom_text(data=label_data, aes(x=id, y=value+10, label=individual, hjust=hjust), color="black", fontface="bold",alpha=0.6, size=2.5, angle= label_data$angle, inherit.aes = FALSE ) 
 
p
```

---

## 215. 297-circular-barplot-with-groups

**Файл:** `297-circular-barplot-with-groups_2.R`

```r
# library
library(tidyverse)
 
# Create dataset
data <- data.frame(
  individual=paste( "Mister ", seq(1,60), sep=""),
  group=c( rep('A', 10), rep('B', 30), rep('C', 14), rep('D', 6)) ,
  value=sample( seq(10,100), 60, replace=T)
)
 
# Set a number of 'empty bar' to add at the end of each group
empty_bar <- 4
to_add <- data.frame( matrix(NA, empty_bar*nlevels(data$group), ncol(data)) )
colnames(to_add) <- colnames(data)
to_add$group <- rep(levels(data$group), each=empty_bar)
data <- rbind(data, to_add)
data <- data %>% arrange(group)
data$id <- seq(1, nrow(data))
 
# Get the name and the y position of each label
label_data <- data
number_of_bar <- nrow(label_data)
angle <- 90 - 360 * (label_data$id-0.5) /number_of_bar     # I substract 0.5 because the letter must have the angle of the center of the bars. Not extreme right(1) or extreme left (0)
label_data$hjust <- ifelse( angle < -90, 1, 0)
label_data$angle <- ifelse(angle < -90, angle+180, angle)
 
# Make the plot
p <- ggplot(data, aes(x=as.factor(id), y=value, fill=group)) +       # Note that id is a factor. If x is numeric, there is some space between the first bar
  geom_bar(stat="identity", alpha=0.5) +
  ylim(-100,120) +
  theme_minimal() +
  theme(
    legend.position = "none",
    axis.text = element_blank(),
    axis.title = element_blank(),
    panel.grid = element_blank(),
    plot.margin = unit(rep(-1,4), "cm") 
  ) +
  coord_polar() + 
  geom_text(data=label_data, aes(x=id, y=value+10, label=individual, hjust=hjust), color="black", fontface="bold",alpha=0.6, size=2.5, angle= label_data$angle, inherit.aes = FALSE ) 
 
p
```

---

## 216. 297-circular-barplot-with-groups

**Файл:** `297-circular-barplot-with-groups_3.R`

```r
# Order data:
data = data %>% arrange(group, value)
```

---

## 217. 297-circular-barplot-with-groups

**Файл:** `297-circular-barplot-with-groups_4.R`

```r
# library
library(tidyverse)
 
# Create dataset
data <- data.frame(
  individual=paste( "Mister ", seq(1,60), sep=""),
  group=c( rep('A', 10), rep('B', 30), rep('C', 14), rep('D', 6)) ,
  value=sample( seq(10,100), 60, replace=T)
)
 
# Set a number of 'empty bar' to add at the end of each group
empty_bar <- 3
to_add <- data.frame( matrix(NA, empty_bar*nlevels(data$group), ncol(data)) )
colnames(to_add) <- colnames(data)
to_add$group <- rep(levels(data$group), each=empty_bar)
data <- rbind(data, to_add)
data <- data %>% arrange(group)
data$id <- seq(1, nrow(data))
 
# Get the name and the y position of each label
label_data <- data
number_of_bar <- nrow(label_data)
angle <- 90 - 360 * (label_data$id-0.5) /number_of_bar     # I substract 0.5 because the letter must have the angle of the center of the bars. Not extreme right(1) or extreme left (0)
label_data$hjust <- ifelse( angle < -90, 1, 0)
label_data$angle <- ifelse(angle < -90, angle+180, angle)
 
# prepare a data frame for base lines
base_data <- data %>% 
  group_by(group) %>% 
  summarize(start=min(id), end=max(id) - empty_bar) %>% 
  rowwise() %>% 
  mutate(title=mean(c(start, end)))
 
# prepare a data frame for grid (scales)
grid_data <- base_data
grid_data$end <- grid_data$end[ c( nrow(grid_data), 1:nrow(grid_data)-1)] + 1
grid_data$start <- grid_data$start - 1
grid_data <- grid_data[-1,]
 
# Make the plot
p <- ggplot(data, aes(x=as.factor(id), y=value, fill=group)) +       # Note that id is a factor. If x is numeric, there is some space between the first bar
  
  geom_bar(aes(x=as.factor(id), y=value, fill=group), stat="identity", alpha=0.5) +
  
  # Add a val=100/75/50/25 lines. I do it at the beginning to make sur barplots are OVER it.
  geom_segment(data=grid_data, aes(x = end, y = 80, xend = start, yend = 80), colour = "grey", alpha=1, size=0.3 , inherit.aes = FALSE ) +
  geom_segment(data=grid_data, aes(x = end, y = 60, xend = start, yend = 60), colour = "grey", alpha=1, size=0.3 , inherit.aes = FALSE ) +
  geom_segment(data=grid_data, aes(x = end, y = 40, xend = start, yend = 40), colour = "grey", alpha=1, size=0.3 , inherit.aes = FALSE ) +
  geom_segment(data=grid_data, aes(x = end, y = 20, xend = start, yend = 20), colour = "grey", alpha=1, size=0.3 , inherit.aes = FALSE ) +
  
  # Add text showing the value of each 100/75/50/25 lines
  annotate("text", x = rep(max(data$id),4), y = c(20, 40, 60, 80), label = c("20", "40", "60", "80") , color="grey", size=3 , angle=0, fontface="bold", hjust=1) +
  
  geom_bar(aes(x=as.factor(id), y=value, fill=group), stat="identity", alpha=0.5) +
  ylim(-100,120) +
  theme_minimal() +
  theme(
    legend.position = "none",
    axis.text = element_blank(),
    axis.title = element_blank(),
    panel.grid = element_blank(),
    plot.margin = unit(rep(-1,4), "cm") 
  ) +
  coord_polar() + 
  geom_text(data=label_data, aes(x=id, y=value+10, label=individual, hjust=hjust), color="black", fontface="bold",alpha=0.6, size=2.5, angle= label_data$angle, inherit.aes = FALSE ) +
  
  # Add base line information
  geom_segment(data=base_data, aes(x = start, y = -5, xend = end, yend = -5), colour = "black", alpha=0.8, size=0.6 , inherit.aes = FALSE )  +
  geom_text(data=base_data, aes(x = title, y = -18, label=group), hjust=c(1,1,0,0), colour = "black", alpha=0.8, size=4, fontface="bold", inherit.aes = FALSE)
 
p
```

---

## 218. 299-circular-stacked-barplot

**Файл:** `299-circular-stacked-barplot_1.R`

```r
# library
library(tidyverse)
library(viridis)
 
# Create dataset
data <- data.frame(
  individual=paste( "Mister ", seq(1,60), sep=""),
  group=factor(c( rep('A', 10), rep('B', 30), rep('C', 14), rep('D', 6))) ,
  value1=sample( seq(10,100), 60, replace=T),
  value2=sample( seq(10,100), 60, replace=T),
  value3=sample( seq(10,100), 60, replace=T)
)
 
# Transform data in a tidy format (long format)
data <- data %>% gather(key = "observation", value="value", -c(1,2))
```

---

## 219. 299-circular-stacked-barplot

**Файл:** `299-circular-stacked-barplot_2.R`

```r
# Set a number of 'empty bar' to add at the end of each group
empty_bar <- 2
nObsType <- nlevels(as.factor(data$observation))
to_add <- data.frame( matrix(NA, empty_bar*nlevels(data$group)*nObsType, ncol(data)) )
colnames(to_add) <- colnames(data)
to_add$group <- rep(levels(data$group), each=empty_bar*nObsType )
data <- rbind(data, to_add)
data <- data %>% arrange(group, individual)
data$id <- rep( seq(1, nrow(data)/nObsType) , each=nObsType)
 
# Get the name and the y position of each label
label_data <- data %>% group_by(id, individual) %>% summarize(tot=sum(value))
number_of_bar <- nrow(label_data)
angle <- 90 - 360 * (label_data$id-0.5) /number_of_bar     # I substract 0.5 because the letter must have the angle of the center of the bars. Not extreme right(1) or extreme left (0)
label_data$hjust <- ifelse( angle < -90, 1, 0)
label_data$angle <- ifelse(angle < -90, angle+180, angle)
 
# prepare a data frame for base lines
base_data <- data %>% 
  group_by(group) %>% 
  summarize(start=min(id), end=max(id) - empty_bar) %>% 
  rowwise() %>% 
  mutate(title=mean(c(start, end)))
 
# prepare a data frame for grid (scales)
grid_data <- base_data
grid_data$end <- grid_data$end[ c( nrow(grid_data), 1:nrow(grid_data)-1)] + 1
grid_data$start <- grid_data$start - 1
grid_data <- grid_data[-1,]
 
# Make the plot
p <- ggplot(data) +      
  
  # Add the stacked bar
  geom_bar(aes(x=as.factor(id), y=value, fill=observation), stat="identity", alpha=0.5) +
  scale_fill_viridis(discrete=TRUE) +
  
  # Add a val=100/75/50/25 lines. I do it at the beginning to make sur barplots are OVER it.
  geom_segment(data=grid_data, aes(x = end, y = 0, xend = start, yend = 0), colour = "grey", alpha=1, linewidth=0.3 , inherit.aes = FALSE ) +
  geom_segment(data=grid_data, aes(x = end, y = 50, xend = start, yend = 50), colour = "grey", alpha=1, linewidth=0.3 , inherit.aes = FALSE ) +
  geom_segment(data=grid_data, aes(x = end, y = 100, xend = start, yend = 100), colour = "grey", alpha=1, linewidth=0.3 , inherit.aes = FALSE ) +
  geom_segment(data=grid_data, aes(x = end, y = 150, xend = start, yend = 150), colour = "grey", alpha=1, linewidth=0.3 , inherit.aes = FALSE ) +
  geom_segment(data=grid_data, aes(x = end, y = 200, xend = start, yend = 200), colour = "grey", alpha=1, linewidth=0.3 , inherit.aes = FALSE ) +
  
  # Add text showing the value of each 100/75/50/25 lines
  ggplot2::annotate("text", x = rep(max(data$id),5), y = c(0, 50, 100, 150, 200), label = c("0", "50", "100", "150", "200") , color="grey", size=6 , angle=0, fontface="bold", hjust=1) +
  
  ylim(-150,max(label_data$tot, na.rm=T)) +
  theme_minimal() +
  theme(
    legend.position = "none",
    axis.text = element_blank(),
    axis.title = element_blank(),
    panel.grid = element_blank(),
    plot.margin = unit(rep(-1,4), "cm") 
  ) +
  coord_polar() +
  
  # Add labels on top of each bar
  geom_text(data=label_data, aes(x=id, y=tot+10, label=individual, hjust=hjust), color="black", fontface="bold",alpha=0.6, size=5, angle= label_data$angle, inherit.aes = FALSE ) +
  
  # Add base line information
  geom_segment(data=base_data, aes(x = start, y = -5, xend = end, yend = -5), colour = "black", alpha=0.8, size=0.6 , inherit.aes = FALSE )  +
  geom_text(data=base_data, aes(x = title, y = -18, label=group), hjust=c(1,1,0,0), colour = "black", alpha=0.8, size=4, fontface="bold", inherit.aes = FALSE)


# Save at png
ggsave(p, file="output.png", width=10, height=10)
```

---

## 220. 300-basic-lollipop-plot

**Файл:** `300-basic-lollipop-plot_1.R`

```r
# Libraries
library(ggplot2)

# Create data
data <- data.frame(x=seq(1,30), y=abs(rnorm(30)))
 
# Plot
ggplot(data, aes(x=x, y=y)) +
  geom_point() + 
  geom_segment( aes(x=x, xend=x, y=0, yend=y))
```

---

## 221. 300-basic-lollipop-plot

**Файл:** `300-basic-lollipop-plot_2.R`

```r
# Libraries
library(ggplot2)

# Create data
data <- data.frame(
  x=LETTERS[1:26], 
  y=abs(rnorm(26))
)
 
# Plot
ggplot(data, aes(x=x, y=y)) +
  geom_point() + 
  geom_segment( aes(x=x, xend=x, y=0, yend=y))
```

---

## 222. 301-custom-lollipop-chart

**Файл:** `301-custom-lollipop-chart_1.R`

```r
# Library
library(tidyverse)
 
# Create data
data <- data.frame(
  x=LETTERS[1:26],
  y=abs(rnorm(26))
)
 
# plot
ggplot(data, aes(x=x, y=y)) +
  geom_segment( aes(x=x, xend=x, y=0, yend=y)) +
  geom_point( size=5, color="red", fill=alpha("orange", 0.3), alpha=0.7, shape=21, stroke=2)
```

---

## 223. 301-custom-lollipop-chart

**Файл:** `301-custom-lollipop-chart_2.R`

```r
# Libraries
library(ggplot2)

# Create data
data <- data.frame(
  x=LETTERS[1:26],
  y=abs(rnorm(26))
)

# Plot
ggplot(data, aes(x=x, y=y)) +
  geom_segment( aes(x=x, xend=x, y=0, yend=y) , size=1, color="blue", linetype="dotdash" ) +
  geom_point()
```

---

## 224. 301-custom-lollipop-chart

**Файл:** `301-custom-lollipop-chart_3.R`

```r
# Libraries
library(ggplot2)

# Create data
data <- data.frame(
  x=LETTERS[1:26],
  y=abs(rnorm(26))
)

# Plot
ggplot(data, aes(x=x, y=y)) +
  geom_segment( aes(x=x, xend=x, y=0, yend=y), color="grey") +
  geom_point( color="orange", size=4) +
  theme_light() +
  theme(
    panel.grid.major.x = element_blank(),
    panel.border = element_blank(),
    axis.ticks.x = element_blank()
  ) +
  xlab("") +
  ylab("Value of Y")
```

---

## 225. 301-custom-lollipop-chart

**Файл:** `301-custom-lollipop-chart_4.R`

```r
# Libraries
library(ggplot2)

# Create data
data <- data.frame(
  x=LETTERS[1:26],
  y=abs(rnorm(26))
)

# Horizontal version
ggplot(data, aes(x=x, y=y)) +
  geom_segment( aes(x=x, xend=x, y=0, yend=y), color="skyblue") +
  geom_point( color="blue", size=4, alpha=0.6) +
  theme_light() +
  coord_flip() +
  theme(
    panel.grid.major.y = element_blank(),
    panel.border = element_blank(),
    axis.ticks.y = element_blank()
  )
```

---

## 226. 301-custom-lollipop-chart

**Файл:** `301-custom-lollipop-chart_5.R`

```r
# Libraries
library(ggplot2)

# Create data
data <- data.frame(
  x=LETTERS[1:26],
  y=abs(rnorm(26))
)

# Change baseline
ggplot(data, aes(x=x, y=y)) +
  geom_segment( aes(x=x, xend=x, y=1, yend=y), color="grey") +
  geom_point( color="orange", size=4) +
  theme_light() +
  theme(
    panel.grid.major.x = element_blank(),
    panel.border = element_blank(),
    axis.ticks.x = element_blank()
  ) +
  xlab("") +
  ylab("Value of Y")
```

---

## 227. 302-lollipop-chart-with-conditional-color

**Файл:** `302-lollipop-chart-with-conditional-color_1.R`

```r
# library
library(ggplot2)
library(dplyr)

# Create data (this takes more sense with a numerical X axis)
x <- seq(0, 2*pi, length.out=100)
data <- data.frame(
  x=x, 
  y=sin(x) + rnorm(100, sd=0.2)
)
 
# Add a column with your condition for the color
data <- data %>% 
  mutate(mycolor = ifelse(y>0, "type1", "type2"))
 
# plot
ggplot(data, aes(x=x, y=y)) +
  geom_segment( aes(x=x, xend=x, y=0, yend=y, color=mycolor), size=1.3, alpha=0.9) +
  theme_light() +
  theme(
    legend.position = "none",
    panel.border = element_blank(),
  ) +
  xlab("") +
  ylab("Value of Y")
```

---

## 228. 303-lollipop-plot-with-2-values

**Файл:** `303-lollipop-plot-with-2-values_1.R`

```r
# Library
library(ggplot2)
library(dplyr)
library(hrbrthemes)

# Create data
value1 <- abs(rnorm(26))*2
data <- data.frame(
  x=LETTERS[1:26], 
  value1=value1, 
  value2=value1+1+rnorm(26, sd=1) 
)
 
# Reorder data using average? Learn more about reordering in chart #267
data <- data %>% 
  rowwise() %>% 
  mutate( mymean = mean(c(value1,value2) )) %>% 
  arrange(mymean) %>% 
  mutate(x=factor(x, x))
 
# Plot
ggplot(data) +
  geom_segment( aes(x=x, xend=x, y=value1, yend=value2), color="grey") +
  geom_point( aes(x=x, y=value1), color=rgb(0.2,0.7,0.1,0.5), size=3 ) +
  geom_point( aes(x=x, y=value2), color=rgb(0.7,0.2,0.1,0.5), size=3 ) +
  coord_flip()+
  theme_ipsum() +
  theme(
    legend.position = "none",
  ) +
  xlab("") +
  ylab("Value of Y")
```

---

## 229. 304-highlight-a-group-in-lollipop

**Файл:** `304-highlight-a-group-in-lollipop_1.R`

```r
# Library
library(ggplot2)
library(dplyr)
library(hrbrthemes)

# Create data
set.seed(1000)
data <- data.frame(
  x=LETTERS[1:26], 
  y=abs(rnorm(26))
)
 
# Reorder the data
data <- data %>%
  arrange(y) %>%
  mutate(x=factor(x,x))
  
# Plot
p <- ggplot(data, aes(x=x, y=y)) +
  geom_segment(
    aes(x=x, xend=x, y=0, yend=y), 
    color=ifelse(data$x %in% c("A","D"), "orange", "grey"), 
    size=ifelse(data$x %in% c("A","D"), 1.3, 0.7)
  ) +
  geom_point(
    color=ifelse(data$x %in% c("A","D"), "orange", "grey"), 
    size=ifelse(data$x %in% c("A","D"), 5, 2)
  ) +
  theme_ipsum() +
  coord_flip() +
  theme(
    legend.position="none"
  ) +
  xlab("") +
  ylab("Value of Y") +
  ggtitle("How did groups A and D perform?")

# Add annotation
p + annotate("text", x=grep("D", data$x), y=data$y[which(data$x=="D")]*1.2, 
           label="Group D is very impressive", 
           color="orange", size=4 , angle=0, fontface="bold", hjust=0) + 
  
    annotate("text", x = grep("A", data$x), y = data$y[which(data$x=="A")]*1.2, 
           label = paste("Group A is not too bad\n (val=",data$y[which(data$x=="A")] %>% round(2),")",sep="" ) , 
           color="orange", size=4 , angle=0, fontface="bold", hjust=0)
```

---

## 230. 305-basic-circle-packing-with-one-level

**Файл:** `305-basic-circle-packing-with-one-level_1.R`

```r
# Libraries
library(packcircles)
library(ggplot2)
 
# Create data
data <- data.frame(group=paste("Group", letters[1:20]), value=sample(seq(1,100),20)) 
 
# Generate the layout. This function return a dataframe with one line per bubble. 
# It gives its center (x and y) and its radius, proportional of the value
packing <- circleProgressiveLayout(data$value, sizetype='area')
 
# We can add these packing information to the initial data frame
data <- cbind(data, packing)
 
# Check that radius is proportional to value. We don't want a linear relationship, since it is the AREA that must be proportionnal to the value
# plot(data$radius, data$value)
 
# The next step is to go from one center + a radius to the coordinates of a circle that
# is drawn by a multitude of straight lines.
dat.gg <- circleLayoutVertices(packing, npoints=50)
 
# Make the plot
ggplot() + 
  
  # Make the bubbles
  geom_polygon(data = dat.gg, aes(x, y, group = id, fill=as.factor(id)), colour = "black", alpha = 0.6) +
  
  # Add text in the center of each bubble + control its size
  geom_text(data = data, aes(x, y, size=value, label = group)) +
  scale_size_continuous(range = c(1,4)) +
  
  # General theme:
  theme_void() + 
  theme(legend.position="none") +
  coord_equal()
```

---

## 231. 306-custom-circle-packing-with-one-level

**Файл:** `306-custom-circle-packing-with-one-level_1.R`

```r
# libraries
library(packcircles)
library(ggplot2)
library(viridis)
 
# Create data
data <- data.frame(group=paste("Group", letters[1:20]), value=sample(seq(1,100),20)) 
 
# Generate the layout. sizetype can be area or radius, following your preference on what to be proportional to value.
packing <- circleProgressiveLayout(data$value, sizetype='area')
data <- cbind(data, packing)
dat.gg <- circleLayoutVertices(packing, npoints=50)
 
# Basic color customization
ggplot() + 
  geom_polygon(data = dat.gg, aes(x, y, group = id, fill=as.factor(id)), colour = "black", alpha = 0.6) +
  scale_fill_manual(values = magma(nrow(data))) +
  geom_text(data = data, aes(x, y, size=value, label = group)) +
  scale_size_continuous(range = c(1,4)) +
  theme_void() + 
  theme(legend.position="none") +
  coord_equal()
```

---

## 232. 306-custom-circle-packing-with-one-level

**Файл:** `306-custom-circle-packing-with-one-level_2.R`

```r
# First I need to add the 'value' of each group to dat.gg.
# Here I repeat each value 51 times since I create my polygons with 50 lines
dat.gg$value <- rep(data$value, each=51)

# Plot
ggplot() + 
  
  # Make the bubbles
  geom_polygon(data = dat.gg, aes(x, y, group = id, fill=value), colour = "black", alpha = 0.6) +
  scale_fill_distiller(palette = "BuPu", direction = 1 ) +
 
  # Add text in the center of each bubble + control its size
  geom_text(data = data, aes(x, y, size=value, label = group)) +
  scale_size_continuous(range = c(1,4)) +
 
  # General theme:
  theme_void()  + 
  theme(legend.position="none") + 
  coord_equal()
```

---

## 233. 306-custom-circle-packing-with-one-level

**Файл:** `306-custom-circle-packing-with-one-level_3.R`

```r
ggplot() + 
  
  # Make the bubbles
  geom_polygon(data = dat.gg, aes(x, y, group = id, fill=value), colour = "grey", alpha = 0.6, size=.5) +
  scale_fill_distiller(palette = "Spectral", direction = 1 ) +
  
  # Add text in the center of each bubble + control its size
  geom_label(data = data, aes(x, y, size=value, label = group)) +
  scale_size_continuous(range = c(1,4)) +
  
  # General theme:
  theme_void()  + 
  theme(
    legend.position="none",
    plot.background = element_rect(fill="black"),
    plot.title = element_text(color="white") 
  ) + 
  coord_equal() +
  ggtitle("A custom circle packing with\nblack background")
```

---

## 234. 307-add-space-in-circle-packing

**Файл:** `307-add-space-in-circle-packing_1.R`

```r
# libraries
library(packcircles)
library(ggplot2)
library(viridis)

# Create data
data <- data.frame(group=paste("Group", letters[1:20]), value=sample(seq(1,100),20)) 

# Generate the layout
packing <- circleProgressiveLayout(data$value, sizetype='area')
packing$radius <- 0.95*packing$radius
data <- cbind(data, packing)
dat.gg <- circleLayoutVertices(packing, npoints=50)

# Plot 
ggplot() + 
  geom_polygon(data = dat.gg, aes(x, y, group = id, fill=id), colour = "black", alpha = 0.6) +
  scale_fill_viridis() +
  geom_text(data = data, aes(x, y, size=value, label = group), color="black") +
  theme_void() + 
  theme(legend.position="none")+ 
  coord_equal()
```

---

## 235. 308-interactive-circle-packing

**Файл:** `308-interactive-circle-packing_1.R`

```r
# libraries
library(packcircles)
library(ggplot2)
library(viridis)
library(ggiraph)

# Create data
data <- data.frame(group=paste("Group_", sample(letters, 70, replace=T), sample(letters, 70, replace=T), sample(letters, 70, replace=T), sep="" ), value=sample(seq(1,70),70)) 

# Add a column with the text you want to display for each bubble:
data$text <- paste("name: ",data$group, "\n", "value:", data$value, "\n", "You can add a story here!")

# Generate the layout
packing <- circleProgressiveLayout(data$value, sizetype='area')
data <- cbind(data, packing)
dat.gg <- circleLayoutVertices(packing, npoints=50)

# Make the plot with a few differences compared to the static version:
p <- ggplot() + 
  geom_polygon_interactive(data = dat.gg, aes(x, y, group = id, fill=id, tooltip = data$text[id], data_id = id), colour = "black", alpha = 0.6) +
  scale_fill_viridis() +
  geom_text(data = data, aes(x, y, label = gsub("Group_", "", group)), size=2, color="black") +
  theme_void() + 
  theme(legend.position="none", plot.margin=unit(c(0,0,0,0),"cm") ) + 
  coord_equal()

# Turn it interactive
widg <- ggiraph(ggobj = p, width_svg = 7, height_svg = 7)
# widg

# save the widget
# library(htmlwidgets)
# saveWidget(widg, file=paste0( getwd(), "/HtmlWidget/circular_packing_interactive.html"))
```

---

## 236. 309-intro-to-hierarchical-edge-bundling

**Файл:** `309-intro-to-hierarchical-edge-bundling_1.R`

```r
# Libraries
library(ggraph)
library(igraph)
 
# create a data frame giving the hierarchical structure of your individuals. 
# Origin on top, then groups, then subgroups
d1 <- data.frame(from="origin", to=paste("group", seq(1,10), sep=""))
d2 <- data.frame(from=rep(d1$to, each=10), to=paste("subgroup", seq(1,100), sep="_"))
hierarchy <- rbind(d1, d2)
 
# create a vertices data.frame. One line per object of our hierarchy, giving features of nodes.
vertices <- data.frame(name = unique(c(as.character(hierarchy$from), as.character(hierarchy$to))) )
```

---

## 237. 309-intro-to-hierarchical-edge-bundling

**Файл:** `309-intro-to-hierarchical-edge-bundling_2.R`

```r
# Create a graph object with the igraph library
mygraph <- graph_from_data_frame( hierarchy, vertices=vertices )
# This is a network object, you visualize it as a network like shown in the network section!
 
# With igraph: 
plot(mygraph, vertex.label="", edge.arrow.size=0, vertex.size=2)
 
# With ggraph:
ggraph(mygraph, layout = 'dendrogram', circular = FALSE) + 
  geom_edge_link() +
  theme_void()
 
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_edge_diagonal() +
  theme_void()
```

---

## 238. 309-intro-to-hierarchical-edge-bundling

**Файл:** `309-intro-to-hierarchical-edge-bundling_3.R`

```r
# left: What happens if connections are represented with straight lines
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_edge_diagonal(alpha=0.1) +
  geom_conn_bundle(data = get_con(from = c(18,20,30), to = c(19, 50, 70)), alpha=1, width=1, colour="skyblue", tension = 0) +
  theme_void()
 
# right: using the bundle method (tension = 1)
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_edge_diagonal(alpha=0.1) +
  geom_conn_bundle(data = get_con(from = c(18,20,30), to = c(19, 50, 70)), alpha=1, width=1, colour="skyblue", tension = 1) +
  theme_void()
```

---

## 239. 309-intro-to-hierarchical-edge-bundling

**Файл:** `309-intro-to-hierarchical-edge-bundling_4.R`

```r
# create a dataframe with connection between leaves (individuals)
all_leaves <- paste("subgroup", seq(1,100), sep="_")
connect <- rbind( 
  data.frame( from=sample(all_leaves, 100, replace=T) , to=sample(all_leaves, 100, replace=T)), 
  data.frame( from=sample(head(all_leaves), 30, replace=T) , to=sample( tail(all_leaves), 30, replace=T)), 
  data.frame( from=sample(all_leaves[25:30], 30, replace=T) , to=sample( all_leaves[55:60], 30, replace=T)), 
  data.frame( from=sample(all_leaves[75:80], 30, replace=T) , to=sample( all_leaves[55:60], 30, replace=T)) 
  )
 
# The connection object must refer to the ids of the leaves:
from <- match( connect$from, vertices$name)
to <- match( connect$to, vertices$name)
 
# plot
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_conn_bundle(data = get_con(from = from, to = to), alpha=0.2, colour="skyblue", tension = 0) + 
  geom_node_point(aes(filter = leaf, x = x*1.05, y=y*1.05)) +
  theme_void()
 
# plot
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_conn_bundle(data = get_con(from = from, to = to), alpha=0.2, colour="skyblue", tension = 0.9) + 
  geom_node_point(aes(filter = leaf, x = x*1.05, y=y*1.05)) +
  theme_void()
```

---

## 240. 31-custom-colors-in-dendrogram

**Файл:** `31-custom-colors-in-dendrogram_1.R`

```r
# Build dataset (just copy and paste, this is NOT interesting)
sample <- paste(rep("sample_",24) , seq(1,24) , sep="")
specie <- c(rep("dicoccoides" , 8) , rep("dicoccum" , 8) , rep("durum" , 8))
treatment <- rep(c(rep("High",4 ) , rep("Low",4)),3)
data <- data.frame(sample,specie,treatment)
for (i in seq(1:5)){
  gene=sample(c(1:40) , 24 )
  data=cbind(data , gene)
  colnames(data)[ncol(data)]=paste("gene_",i,sep="")
 }
data[data$treatment=="High" , c(4:8)]=data[data$treatment=="High" , c(4:8)]+100
data[data$specie=="durum" , c(4:8)]=data[data$specie=="durum" , c(4:8)]-30
rownames(data) <- data[,1]    

# Have a look to the dataset
# head(data)

# Compute Euclidean distance between samples
dist=dist(data[ , c(4:8)] , diag=TRUE)

# Perfor clustering with hclust
hc <- hclust(dist)
dhc <- as.dendrogram(hc)

# Actually, each leaf of the tree has several attributes, like the color, the shape.. Have a look to it: 
specific_leaf <- dhc[[1]][[1]][[1]]
# specific_leaf
# attributes(specific_leaf)

#So if I Want to color each leaf of the Tree, I have to change the attribute of each leaf. This can be done using the dendrapply function. So I create a function that # # add 3 attributes to the leaf : one for the color (“lab.col”) ,one for the font “lab.font” and one for the size (“lab.cex”).
i=0
colLab<<-function(n){
    if(is.leaf(n)){
        
        #I take the current attributes
        a=attributes(n)
        
        #I deduce the line in the original data, and so the treatment and the specie.
        ligne=match(attributes(n)$label,data[,1])
        treatment=data[ligne,3];
            if(treatment=="Low"){col_treatment="blue"};if(treatment=="High"){col_treatment="red"}
        specie=data[ligne,2];
            if(specie=="dicoccoides"){col_specie="red"};if(specie=="dicoccum"){col_specie="Darkgreen"};if(specie=="durum"){col_specie="blue"}
        
        #Modification of leaf attribute
        attr(n,"nodePar")<-c(a$nodePar,list(cex=1.5,lab.cex=1,pch=20,col=col_treatment,lab.col=col_specie,lab.font=1,lab.cex=1))
        }
    return(n)
}

# Finally I just have to apply this to my dendrogram
dL <- dendrapply(dhc, colLab)
 
# And the plot
plot(dL , main="structure of the population")
legend("topright", 
     legend = c("High Nitrogen" , "Low Nitrogen" , "Durum" , "Dicoccoides" , "Dicoccum"), 
     col = c("red", "blue" , "blue" , "red" , "Darkgreen"), 
     pch = c(20,20,4,4,4), bty = "n",  pt.cex = 1.5, cex = 0.8 , 
     text.col = "black", horiz = FALSE, inset = c(0, 0.1))
```

---

## 241. 310-custom-hierarchical-edge-bundling

**Файл:** `310-custom-hierarchical-edge-bundling_1.R`

```r
# Libraries
library(ggraph)
library(igraph)
library(tidyverse)
 
# create a data frame giving the hierarchical structure of your individuals
set.seed(1234)
d1 <- data.frame(from="origin", to=paste("group", seq(1,10), sep=""))
d2 <- data.frame(from=rep(d1$to, each=10), to=paste("subgroup", seq(1,100), sep="_"))
hierarchy <- rbind(d1, d2)
 
# create a dataframe with connection between leaves (individuals)
all_leaves <- paste("subgroup", seq(1,100), sep="_")
connect <- rbind( 
  data.frame( from=sample(all_leaves, 100, replace=T) , to=sample(all_leaves, 100, replace=T)), 
  data.frame( from=sample(head(all_leaves), 30, replace=T) , to=sample( tail(all_leaves), 30, replace=T)), 
  data.frame( from=sample(all_leaves[25:30], 30, replace=T) , to=sample( all_leaves[55:60], 30, replace=T)), 
  data.frame( from=sample(all_leaves[75:80], 30, replace=T) , to=sample( all_leaves[55:60], 30, replace=T)) )
connect$value <- runif(nrow(connect))
 
# create a vertices data.frame. One line per object of our hierarchy
vertices  <-  data.frame(
  name = unique(c(as.character(hierarchy$from), as.character(hierarchy$to))) , 
  value = runif(111)
) 
# Let's add a column with the group of each name. It will be useful later to color points
vertices$group  <-  hierarchy$from[ match( vertices$name, hierarchy$to ) ]
 
 
# Create a graph object
mygraph <- graph_from_data_frame( hierarchy, vertices=vertices )
 
# The connection object must refer to the ids of the leaves:
from  <-  match( connect$from, vertices$name)
to  <-  match( connect$to, vertices$name)
 
# Basic graph
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_conn_bundle(data = get_con(from = from, to = to), alpha=0.2, colour="skyblue", tension = .5) + 
  geom_node_point(aes(filter = leaf, x = x*1.05, y=y*1.05)) +
  theme_void()
```

---

## 242. 310-custom-hierarchical-edge-bundling

**Файл:** `310-custom-hierarchical-edge-bundling_2.R`

```r
p <- ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_node_point(aes(filter = leaf, x = x*1.05, y=y*1.05)) +
  theme_void()

# 0.1
p +  geom_conn_bundle(data = get_con(from = from, to = to), alpha=0.2, colour="skyblue", width=0.9, 
                      tension=0.1) 
# 0.7
p +  geom_conn_bundle(data = get_con(from = from, to = to), alpha=0.2, colour="skyblue", width=0.9, 
                      tension=0.7) 
#1
p +  geom_conn_bundle(data = get_con(from = from, to = to), alpha=0.2, colour="skyblue", width=0.9, 
                      tension=1)
```

---

## 243. 310-custom-hierarchical-edge-bundling

**Файл:** `310-custom-hierarchical-edge-bundling_3.R`

```r
# Use the 'value' column of the connection data frame for the color:
p +  geom_conn_bundle(data = get_con(from = from, to = to), aes(colour=value, alpha=value)) 
 
# In this case you can change the color palette
p +  
  geom_conn_bundle(data = get_con(from = from, to = to), aes(colour=value)) +
  scale_edge_color_continuous(low="white", high="red")
p +  
  geom_conn_bundle(data = get_con(from = from, to = to), aes(colour=value)) +
  scale_edge_colour_distiller(palette = "BuPu")
 
# Color depends of the index: the from and the to are different
p +  
  geom_conn_bundle(data = get_con(from = from, to = to), width=1, alpha=0.2, aes(colour=..index..)) +
  scale_edge_colour_distiller(palette = "RdPu") +
  theme(legend.position = "none")
```

---

## 244. 310-custom-hierarchical-edge-bundling

**Файл:** `310-custom-hierarchical-edge-bundling_4.R`

```r
# Basic usual argument
p=ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_conn_bundle(data = get_con(from = from, to = to), width=1, alpha=0.2, aes(colour=..index..)) +
  scale_edge_colour_distiller(palette = "RdPu") +
  theme_void() +
  theme(legend.position = "none")
 
# just a blue uniform color. Note that the x*1.05 allows to make a space between the points and the connection ends
p + geom_node_point(aes(filter = leaf, x = x*1.05, y=y*1.05), colour="skyblue", alpha=0.3, size=3)
 
# It is good to color the points following their group appartenance
library(RColorBrewer)
p + geom_node_point(aes(filter = leaf, x = x*1.05, y=y*1.05, colour=group),   size=3) +
  scale_colour_manual(values= rep( brewer.pal(9,"Paired") , 30))
 
# And you can adjust the size to whatever variable quite easily!
p + 
  geom_node_point(aes(filter = leaf, x = x*1.05, y=y*1.05, colour=group, size=value, alpha=0.2)) +
  scale_colour_manual(values= rep( brewer.pal(9,"Paired") , 30)) +
  scale_size_continuous( range = c(0.1,10) )
```

---

## 245. 311-add-labels-to-hierarchical-edge-bundling

**Файл:** `311-add-labels-to-hierarchical-edge-bundling_1.R`

```r
# Libraries
library(ggraph)
library(igraph)
library(tidyverse)
library(RColorBrewer)
 
# create a data frame giving the hierarchical structure of your individuals
set.seed(1234)
d1 <- data.frame(from="origin", to=paste("group", seq(1,10), sep=""))
d2 <- data.frame(from=rep(d1$to, each=10), to=paste("subgroup", seq(1,100), sep="_"))
edges <- rbind(d1, d2)
 
# create a dataframe with connection between leaves (individuals)
all_leaves <- paste("subgroup", seq(1,100), sep="_")
connect <- rbind( 
  data.frame( from=sample(all_leaves, 100, replace=T) , to=sample(all_leaves, 100, replace=T)), 
  data.frame( from=sample(head(all_leaves), 30, replace=T) , to=sample( tail(all_leaves), 30, replace=T)), 
  data.frame( from=sample(all_leaves[25:30], 30, replace=T) , to=sample( all_leaves[55:60], 30, replace=T)), 
  data.frame( from=sample(all_leaves[75:80], 30, replace=T) , to=sample( all_leaves[55:60], 30, replace=T)) )
connect$value <- runif(nrow(connect))
 
# create a vertices data.frame. One line per object of our hierarchy
vertices  <-  data.frame(
  name = unique(c(as.character(edges$from), as.character(edges$to))) , 
  value = runif(111)
) 
# Let's add a column with the group of each name. It will be useful later to color points
vertices$group  <-  edges$from[ match( vertices$name, edges$to ) ]
```

---

## 246. 311-add-labels-to-hierarchical-edge-bundling

**Файл:** `311-add-labels-to-hierarchical-edge-bundling_2.R`

```r
#Let's add information concerning the label we are going to add: angle, horizontal adjustement and potential flip
#calculate the ANGLE of the labels
vertices$id <- NA
myleaves <- which(is.na( match(vertices$name, edges$from) ))
nleaves <- length(myleaves)
vertices$id[ myleaves ] <- seq(1:nleaves)
vertices$angle <- 90 - 360 * vertices$id / nleaves
 
# calculate the alignment of labels: right or left
# If I am on the left part of the plot, my labels have currently an angle < -90
vertices$hjust <- ifelse( vertices$angle < -90, 1, 0)
 
# flip angle BY to make them readable
vertices$angle <- ifelse(vertices$angle < -90, vertices$angle+180, vertices$angle)
```

---

## 247. 311-add-labels-to-hierarchical-edge-bundling

**Файл:** `311-add-labels-to-hierarchical-edge-bundling_3.R`

```r
# Create a graph object
mygraph <- igraph::graph_from_data_frame( edges, vertices=vertices )
 
# The connection object must refer to the ids of the leaves:
from  <-  match( connect$from, vertices$name)
to  <-  match( connect$to, vertices$name)
 
# Basic usual argument
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_node_point(aes(filter = leaf, x = x*1.05, y=y*1.05)) +
  geom_conn_bundle(data = get_con(from = from, to = to), alpha=0.2, colour="skyblue", width=0.9) +
  geom_node_text(aes(x = x*1.1, y=y*1.1, filter = leaf, label=name, angle = angle, hjust=hjust), size=1.5, alpha=1) +
  theme_void() +
  theme(
    legend.position="none",
    plot.margin=unit(c(0,0,0,0),"cm"),
  ) +
  expand_limits(x = c(-1.2, 1.2), y = c(-1.2, 1.2))
```

---

## 248. 311-add-labels-to-hierarchical-edge-bundling

**Файл:** `311-add-labels-to-hierarchical-edge-bundling_4.R`

```r
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_conn_bundle(data = get_con(from = from, to = to), alpha=0.2, width=0.9, aes(colour=..index..)) +
  scale_edge_colour_distiller(palette = "RdPu") +
  
  geom_node_text(aes(x = x*1.15, y=y*1.15, filter = leaf, label=name, angle = angle, hjust=hjust, colour=group), size=2, alpha=1) +
  
  geom_node_point(aes(filter = leaf, x = x*1.07, y=y*1.07, colour=group, size=value, alpha=0.2)) +
  scale_colour_manual(values= rep( brewer.pal(9,"Paired") , 30)) +
  scale_size_continuous( range = c(0.1,10) ) +
  
  theme_void() +
  theme(
    legend.position="none",
    plot.margin=unit(c(0,0,0,0),"cm"),
  ) +
  expand_limits(x = c(-1.3, 1.3), y = c(-1.3, 1.3))
```

---

## 249. 313-basic-circle-packing-with-several-levels

**Файл:** `313-basic-circle-packing-with-several-levels_1.R`

```r
# Libraries
library(ggraph)
library(igraph)
library(tidyverse)
 
# We need a data frame giving a hierarchical structure. Let's consider the flare dataset:
edges <- flare$edges
 
# Usually we associate another dataset that give information about each node of the dataset:
vertices <- flare$vertices
 
# Then we have to make a 'graph' object using the igraph library:
mygraph <- graph_from_data_frame( edges, vertices=vertices )
 
# Make the plot
ggraph(mygraph, layout = 'circlepack') + 
  geom_node_circle() +
  theme_void()
```

---

## 250. 313-basic-circle-packing-with-several-levels

**Файл:** `313-basic-circle-packing-with-several-levels_2.R`

```r
ggraph(mygraph, layout='dendrogram', circular=TRUE) + 
  geom_edge_diagonal() +
  theme_void() +
  theme(legend.position="none")
```

---

## 251. 313-basic-circle-packing-with-several-levels

**Файл:** `313-basic-circle-packing-with-several-levels_3.R`

```r
ggraph(mygraph, layout='dendrogram', circular=FALSE) + 
  geom_edge_diagonal() +
  theme_void() +
  theme(legend.position="none")
```

---

## 252. 313-basic-circle-packing-with-several-levels

**Файл:** `313-basic-circle-packing-with-several-levels_4.R`

```r
ggraph(mygraph, 'treemap', weight = size) + 
  geom_node_tile(aes(fill = depth), size = 0.25) +
  theme_void() +
  theme(legend.position="none")
```

---

## 253. 313-basic-circle-packing-with-several-levels

**Файл:** `313-basic-circle-packing-with-several-levels_5.R`

```r
ggraph(mygraph, 'partition', circular = TRUE) + 
  geom_node_arc_bar(aes(fill = depth), size = 0.25) +
  theme_void() +
  theme(legend.position="none")
```

---

## 254. 313-basic-circle-packing-with-several-levels

**Файл:** `313-basic-circle-packing-with-several-levels_6.R`

```r
ggraph(mygraph) + 
  geom_edge_link() + 
  geom_node_point() +
  theme_void() +
  theme(legend.position="none")
```

---

## 255. 314-custom-circle-packing-with-several-levels

**Файл:** `314-custom-circle-packing-with-several-levels_1.R`

```r
# Libraries
library(ggraph)
library(igraph)
library(tidyverse)
library(viridis)
 
# We need a data frame giving a hierarchical structure. Let's consider the flare dataset:
edges <- flare$edges
vertices <- flare$vertices
mygraph <- graph_from_data_frame( edges, vertices=vertices )
 
# Control the size of each circle: (use the size column of the vertices data frame)
ggraph(mygraph, layout = 'circlepack', weight=size) + 
  geom_node_circle() +
  theme_void()
```

---

## 256. 314-custom-circle-packing-with-several-levels

**Файл:** `314-custom-circle-packing-with-several-levels_2.R`

```r
# Left: color depends of depth
p <- ggraph(mygraph, layout = 'circlepack', weight=size) + 
  geom_node_circle(aes(fill = depth)) +
  theme_void() + 
  theme(legend.position="FALSE")
p
```

---

## 257. 314-custom-circle-packing-with-several-levels

**Файл:** `314-custom-circle-packing-with-several-levels_3.R`

```r
# Adjust color palette: colorBrewer
p + scale_fill_distiller(palette = "RdPu")
```

---

## 258. 314-custom-circle-packing-with-several-levels

**Файл:** `314-custom-circle-packing-with-several-levels_4.R`

```r
# Create a subset of the dataset (I remove 1 level)
edges <- flare$edges %>% 
  filter(to %in% from) %>% 
  droplevels()
vertices <- flare$vertices %>% 
  filter(name %in% c(edges$from, edges$to)) %>% 
  droplevels()
vertices$size <- runif(nrow(vertices))
 
# Rebuild the graph object
mygraph <- graph_from_data_frame( edges, vertices=vertices )
 
# left
ggraph(mygraph, layout = 'circlepack', weight=size ) + 
  geom_node_circle(aes(fill = depth)) +
  geom_node_text( aes(label=shortName, filter=leaf, fill=depth, size=size)) +
  theme_void() + 
  theme(legend.position="FALSE") + 
  scale_fill_viridis()
```

---

## 259. 314-custom-circle-packing-with-several-levels

**Файл:** `314-custom-circle-packing-with-several-levels_5.R`

```r
# Right 
ggraph(mygraph, layout = 'circlepack', weight=size ) + 
  geom_node_circle(aes(fill = depth)) +
  geom_node_label( aes(label=shortName, filter=leaf, size=size)) +
  theme_void() + 
  theme(legend.position="FALSE") + 
  scale_fill_viridis()
```

---

## 260. 315-hide-first-level-in-circle-packing

**Файл:** `315-hide-first-level-in-circle-packing_1.R`

```r
# Libraries
library(ggraph)
library(igraph)
library(tidyverse)
library(viridis)
 
# We need a data frame giving a hierarchical structure. Let's consider the flare dataset:
edges=flare$edges
vertices = flare$vertices
mygraph <- graph_from_data_frame( edges, vertices=vertices )
 
# Hide the first level (right)
ggraph(mygraph, layout = 'circlepack', weight=size) + 
  geom_node_circle(aes(fill = as.factor(depth), color = as.factor(depth) )) +
  scale_fill_manual(values=c("0" = "white", "1" = viridis(4)[1], "2" = viridis(4)[2], "3" = viridis(4)[3], "4"=viridis(4)[4])) +
  scale_color_manual( values=c("0" = "white", "1" = "black", "2" = "black", "3" = "black", "4"="black") ) +
  theme_void() + 
  theme(legend.position="FALSE")
```

---

## 261. 315-hide-first-level-in-circle-packing

**Файл:** `315-hide-first-level-in-circle-packing_2.R`

```r
# Second one: hide 2 first levels
ggraph(mygraph, layout = 'circlepack', weight=size) + 
  geom_node_circle(aes(fill = as.factor(depth), color = as.factor(depth) )) +
  scale_fill_manual(values=c("0" = "white", "1" = "white", "2" = magma(4)[2], "3" = magma(4)[3], "4"=magma(4)[4])) +
  scale_color_manual( values=c("0" = "white", "1" = "white", "2" = "black", "3" = "black", "4"="black") ) +
  theme_void() + 
  theme(legend.position="FALSE")
```

---

## 262. 315-hide-first-level-in-circle-packing

**Файл:** `315-hide-first-level-in-circle-packing_3.R`

```r
# Add the data.tree library
library(data.tree)

# Rebuild the data
edges <-flare$edges
vertices <- flare$vertices

# Transform it in a 'tree' format
tree <- FromDataFrameNetwork(edges)

# Then I can easily get the level of each node, and add it to the initial data frame:
mylevels <- data.frame( name=tree$Get('name'), level=tree$Get("level") )
vertices <- vertices %>% 
  left_join(., mylevels, by=c("name"="name"))

# Now we can add label for level1 and 2 only for example:
vertices <- vertices %>% 
  mutate(new_label=ifelse(level==2, shortName, NA))
mygraph <- graph_from_data_frame( edges, vertices=vertices )

# Make the graph
ggraph(mygraph, layout = 'circlepack', weight=size) + 
  geom_node_circle(aes(fill = as.factor(depth), color = as.factor(depth) )) +
  scale_fill_manual(values=c("0" = "white", "1" = viridis(4)[1], "2" = viridis(4)[2], "3" = viridis(4)[3], "4"=viridis(4)[4])) +
  scale_color_manual( values=c("0" = "white", "1" = "black", "2" = "black", "3" = "black", "4"="black") ) +
  geom_node_label( aes(label=new_label), size=4) +
  theme_void() + 
  theme(legend.position="FALSE", plot.margin = unit(rep(0,4), "cm"))
```

---

## 263. 316-possible-inputs-for-the-dygraphs-library

**Файл:** `316-possible-inputs-for-the-dygraphs-library_1.R`

```r
# Library
library(dygraphs)
 
# --- Format 1: time is represented by a simple number. (must be numeric and ordered)
data <- data.frame( 
  time=c( seq(0,20,0.5), 40), 
  value=runif(42)
)

# Double check time is numeric
str(data)

# Use dygraph
p <- dygraph(data)
p
```

---

## 264. 316-possible-inputs-for-the-dygraphs-library

**Файл:** `316-possible-inputs-for-the-dygraphs-library_2.R`

```r
# Libraries
library(dygraphs)
library(xts) # To make the convertion data-frame / xts format
 
# Format 2: time is represented by a date.
data <- data.frame(
  time=seq(from=Sys.Date()-40, to=Sys.Date(), by=1 ), 
  value=runif(41)
)
 
# Your time column MUST be a time format!, check it out with str()
str(data)
 
# Then you can create the xts format, and thus use dygraph
don <- xts(x = data$value, order.by = data$time)

# Make the chart
p <- dygraph(don)
p
```

---

## 265. 316-possible-inputs-for-the-dygraphs-library

**Файл:** `316-possible-inputs-for-the-dygraphs-library_3.R`

```r
# Libraries
library(dygraphs)
library(xts) # To make the convertion data-frame / xts format

# Format 3: Several variables for each date
data <- data.frame(
  time=seq(from=Sys.Date()-40, to=Sys.Date(), by=1 ), 
  value1=runif(41), 
  value2=runif(41)+0.7
)

# Then you can create the xts format:
don=xts( x=data[,-1], order.by=data$time)

# Chart
p <- dygraph(don)
p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dygraphs316-3.html"))
```

---

## 266. 316-possible-inputs-for-the-dygraphs-library

**Файл:** `316-possible-inputs-for-the-dygraphs-library_4.R`

```r
# libraries
library(dygraphs)
library(xts) # To make the convertion data-frame / xts format
library(lubridate) # You will love it to work with dates
library(tidyverse)
 
# Load the data (hosted on the gallery website)
path = 'https://raw.githubusercontent.com/holtzy/R-graph-gallery/master/DATA/bike.csv'
path = 'DATA/bike.csv'
data <- read.table(path, header=T, sep=",")
 
# Check the format, it is not a date yet !
str(data)
 
# The wanna-be-date column looks like that: "2011-02-19 02:00:00". This is Year, Month, Day, Hour, Minute, Second. Thus I can transform it with the function: ymd_hms
data$datetime <- ymd_hms(data$datetime)
 
# Check if it worked properly!
str(data)
 
# It does! Let's go to the its format like seen above, and make the dygraph
don <- xts(x = data$count, order.by = data$datetime)

# Chart
p <- dygraph(don)
p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dygraphs316-4.html"))
```

---

## 267. 317-time-series-with-the-dygraphs-library

**Файл:** `317-time-series-with-the-dygraphs-library_1.R`

```r
# Library
library(dygraphs)
library(xts)          # To make the convertion data-frame / xts format
 
# Create data 
data <- data.frame(
  time=seq(from=Sys.Date()-40, to=Sys.Date(), by=1 ), 
  value=runif(41)
)

# Double check time is at the date format
str(data$time)

# Switch to XTS format
data <- xts(x = data$value, order.by = data$time)
 
# Default = line plot --> See chart #316
 
# Add points
p <- dygraph(data) %>%
  dyOptions( drawPoints = TRUE, pointSize = 4 )
p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dygraphs317-1.html"))
```

---

## 268. 317-time-series-with-the-dygraphs-library

**Файл:** `317-time-series-with-the-dygraphs-library_2.R`

```r
p <- dygraph(data) %>%
  dyOptions( fillGraph=TRUE )
p

# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dygraphs317-2.html"))
```

---

## 269. 317-time-series-with-the-dygraphs-library

**Файл:** `317-time-series-with-the-dygraphs-library_3.R`

```r
p <- dygraph(data) %>%
  dyOptions( stepPlot=TRUE, fillGraph=TRUE)
p

# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dygraphs317-3.html"))
```

---

## 270. 317-time-series-with-the-dygraphs-library

**Файл:** `317-time-series-with-the-dygraphs-library_4.R`

```r
p <- dygraph(data) %>%
  dyOptions( stemPlot=TRUE)
p

# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dygraphs317-4.html"))
```

---

## 271. 317-time-series-with-the-dygraphs-library

**Файл:** `317-time-series-with-the-dygraphs-library_5.R`

```r
# Create data (needs 4 data points per date stamp)
trend <- sin(seq(1,41))+runif(41)
data <- data.frame(
  time=seq(from=Sys.Date()-40, to=Sys.Date(), by=1 ), 
  value1=trend, 
  value2=trend+rnorm(41), 
  value3=trend+rnorm(41), 
  value4=trend+rnorm(41) 
)

# switch to xts format
data <- xts(x = data[,-1], order.by = data$time)

# Plot it
p <- dygraph(data) %>%
  dyCandlestick()
p

# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dygraphs317-5.html"))
```

---

## 272. 317-time-series-with-the-dygraphs-library

**Файл:** `317-time-series-with-the-dygraphs-library_6.R`

```r
# Create data
trend <- sin(seq(1,41))+runif(41)
data <- data.frame(
  time=seq(from=Sys.Date()-40, to=Sys.Date(), by=1 ), 
  trend=trend, 
  max=trend+abs(rnorm(41)), 
  min=trend-abs(rnorm(41, sd=1))
)

# switch to xts format
data <- xts(x = data[,-1], order.by = data$time)

# Plot
p <- dygraph(data) %>%
  dySeries(c("min", "trend", "max"))
p

# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dygraphs317-6.html"))
```

---

## 273. 318-custom-dygraphs-time-series-example

**Файл:** `318-custom-dygraphs-time-series-example_1.R`

```r
# Library
library(dygraphs)
library(xts)          # To make the convertion data-frame / xts format
library(tidyverse)
library(lubridate)
 
# Read the data (hosted on the gallery website)
path = 'https://raw.githubusercontent.com/holtzy/R-graph-gallery/master/DATA/bike.csv'
path = 'DATA/bike.csv'
data <- read.table(path, header=T, sep=",") %>% head(300)

# Check type of variable
# str(data)
 
# Since my time is currently a factor, I have to convert it to a date-time format!
data$datetime <- ymd_hms(data$datetime)
 
# Then you can create the xts necessary to use dygraph
don <- xts(x = data$count, order.by = data$datetime)

# Finally the plot
p <- dygraph(don) %>%
  dyOptions(labelsUTC = TRUE, fillGraph=TRUE, fillAlpha=0.1, drawGrid = FALSE, colors="#D8AE5A") %>%
  dyRangeSelector() %>%
  dyCrosshair(direction = "vertical") %>%
  dyHighlight(highlightCircleSize = 5, highlightSeriesBackgroundAlpha = 0.2, hideOnMouseOut = FALSE)  %>%
  dyRoller(rollPeriod = 1)

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dygraphs318.html"))
```

---

## 274. 320-the-basis-of-bubble-plot

**Файл:** `320-the-basis-of-bubble-plot_1.R`

```r
# Libraries
library(ggplot2)
library(dplyr)

# The dataset is provided in the gapminder library
library(gapminder)
data <- gapminder %>% filter(year=="2007") %>% dplyr::select(-year)

# Most basic bubble plot
ggplot(data, aes(x=gdpPercap, y=lifeExp, size = pop)) +
    geom_point(alpha=0.7)
```

---

## 275. 320-the-basis-of-bubble-plot

**Файл:** `320-the-basis-of-bubble-plot_2.R`

```r
# Libraries
library(ggplot2)
library(dplyr)

# The dataset is provided in the gapminder library
library(gapminder)
data <- gapminder %>% filter(year=="2007") %>% dplyr::select(-year)

# Most basic bubble plot
data %>%
  arrange(desc(pop)) %>%
  mutate(country = factor(country, country)) %>%
  ggplot(aes(x=gdpPercap, y=lifeExp, size = pop)) +
    geom_point(alpha=0.5) +
    scale_size(range = c(.1, 24), name="Population (M)")
```

---

## 276. 320-the-basis-of-bubble-plot

**Файл:** `320-the-basis-of-bubble-plot_3.R`

```r
# Libraries
library(ggplot2)
library(dplyr)

# The dataset is provided in the gapminder library
library(gapminder)
data <- gapminder %>% filter(year=="2007") %>% dplyr::select(-year)

# Most basic bubble plot
data %>%
  arrange(desc(pop)) %>%
  mutate(country = factor(country, country)) %>%
  ggplot(aes(x=gdpPercap, y=lifeExp, size=pop, color=continent)) +
    geom_point(alpha=0.5) +
    scale_size(range = c(.1, 24), name="Population (M)")
```

---

## 277. 320-the-basis-of-bubble-plot

**Файл:** `320-the-basis-of-bubble-plot_4.R`

```r
# Libraries
library(ggplot2)
library(dplyr)
library(hrbrthemes)
library(viridis)

# The dataset is provided in the gapminder library
library(gapminder)
data <- gapminder %>% filter(year=="2007") %>% dplyr::select(-year)

# Most basic bubble plot
data %>%
  arrange(desc(pop)) %>%
  mutate(country = factor(country, country)) %>%
  ggplot(aes(x=gdpPercap, y=lifeExp, size=pop, fill=continent)) +
    geom_point(alpha=0.5, shape=21, color="black") +
    scale_size(range = c(.1, 24), name="Population (M)") +
    scale_fill_viridis(discrete=TRUE, guide=FALSE, option="A") +
    theme_ipsum() +
    theme(legend.position="bottom") +
    ylab("Life Expectancy") +
    xlab("Gdp per Capita") +
    theme(legend.position = "none")
```

---

## 278. 321-introduction-to-interactive-sankey-diagram-2

**Файл:** `321-introduction-to-interactive-sankey-diagram-2_1.R`

```r
# Library
library(networkD3)
library(dplyr)
 
# A connection data frame is a list of flows with intensity for each flow
links <- data.frame(
  source=c("group_A","group_A", "group_B", "group_C", "group_C", "group_E"), 
  target=c("group_C","group_D", "group_E", "group_F", "group_G", "group_H"), 
  value=c(2,3, 2, 3, 1, 3)
  )
 
# From these flows we need to create a node data frame: it lists every entities involved in the flow
nodes <- data.frame(
  name=c(as.character(links$source), 
  as.character(links$target)) %>% unique()
)
 
# With networkD3, connection must be provided using id, not using real name like in the links dataframe.. So we need to reformat it.
links$IDsource <- match(links$source, nodes$name)-1 
links$IDtarget <- match(links$target, nodes$name)-1
 
# Make the Network
p <- sankeyNetwork(Links = links, Nodes = nodes,
              Source = "IDsource", Target = "IDtarget",
              Value = "value", NodeID = "name", 
              sinksRight=FALSE)
p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/sankeyBasic1.html"))
```

---

## 279. 321-introduction-to-interactive-sankey-diagram-2

**Файл:** `321-introduction-to-interactive-sankey-diagram-2_2.R`

```r
# Library
library(networkD3)
library(dplyr)
 
# Create an incidence matrix. Usually the flow goes from the row names to the column names.
# Remember that our connection are directed since we are working with a flow.
set.seed(1)
data <- matrix(sample( seq(0,40), 49, replace=T ), 7, 7)
data[data < 35] <- 0
colnames(data) = rownames(data) = c("group_A", "group_B", "group_C", "group_D", "group_E", "group_F", "group_G")

# Transform it to connection data frame with tidyr from the tidyverse:
links <- data %>% 
  as.data.frame() %>% 
  rownames_to_column(var="source") %>% 
  gather(key="target", value="value", -1) %>%
  filter(value != 0)
 
# From these flows we need to create a node data frame: it lists every entities involved in the flow
nodes <- data.frame(
  name=c(as.character(links$source), as.character(links$target)) %>% 
    unique()
  )
 
# With networkD3, connection must be provided using id, not using real name like in the links dataframe.. So we need to reformat it.
links$IDsource <- match(links$source, nodes$name)-1 
links$IDtarget <- match(links$target, nodes$name)-1
 
# Make the Network
p <- sankeyNetwork(Links = links, Nodes = nodes,
                     Source = "IDsource", Target = "IDtarget",
                     Value = "value", NodeID = "name", 
                     sinksRight=FALSE)

p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/sankeyBasic2.html"))
```

---

## 280. 322-custom-colours-in-sankey-diagram

**Файл:** `322-custom-colours-in-sankey-diagram_1.R`

```r
# Library
library(networkD3)
library(dplyr)

# Make a connection data frame
links <- data.frame(
  source=c("group_A","group_A", "group_B", "group_C", "group_C", "group_E"), 
  target=c("group_C","group_D", "group_E", "group_F", "group_G", "group_H"), 
  value=c(2,3, 2, 3, 1, 3)
)
 
# From these flows we need to create a node data frame: it lists every entities involved in the flow
nodes <- data.frame(
  name=c(as.character(links$source), as.character(links$target)) %>% 
    unique()
)

# With networkD3, connection must be provided using id, not using real name like in the links dataframe.. So we need to reformat it.
links$IDsource <- match(links$source, nodes$name)-1 
links$IDtarget <- match(links$target, nodes$name)-1
 
# prepare color scale: I give one specific color for each node.
my_color <- 'd3.scaleOrdinal() .domain(["group_A", "group_B","group_C", "group_D", "group_E", "group_F", "group_G", "group_H"]) .range(["blue", "blue" , "blue", "red", "red", "yellow", "purple", "purple"])'
 
# Make the Network. I call my colour scale with the colourScale argument
p <- sankeyNetwork(Links = links, Nodes = nodes, Source = "IDsource", Target = "IDtarget", 
              Value = "value", NodeID = "name", colourScale=my_color)
p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/sankeyColor1.html"))
```

---

## 281. 322-custom-colours-in-sankey-diagram

**Файл:** `322-custom-colours-in-sankey-diagram_2.R`

```r
# Add a 'group' column to the nodes data frame:
nodes$group <- as.factor(c("a","a","a","a","a","b","b","b"))
 
# Give a color for each group:
my_color <- 'd3.scaleOrdinal() .domain(["a", "b"]) .range(["#69b3a2", "steelblue"])'
 
# Make the Network
p <- sankeyNetwork(Links = links, Nodes = nodes, Source = "IDsource", Target = "IDtarget", 
              Value = "value", NodeID = "name", 
              colourScale=my_color, NodeGroup="group")
p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/sankeyColor2.html"))
```

---

## 282. 322-custom-colours-in-sankey-diagram

**Файл:** `322-custom-colours-in-sankey-diagram_3.R`

```r
# Add a 'group' column to each connection:
links$group <- as.factor(c("type_a","type_a","type_a","type_b","type_b","type_b"))
 
# Add a 'group' column to each node. Here I decide to put all of them in the same group to make them grey
nodes$group <- as.factor(c("my_unique_group"))
 
# Give a color for each group:
my_color <- 'd3.scaleOrdinal() .domain(["type_a", "type_b", "my_unique_group"]) .range(["#69b3a2", "steelblue", "grey"])'
 
# Make the Network
p <- sankeyNetwork(Links = links, Nodes = nodes, Source = "IDsource", Target = "IDtarget", 
                   Value = "value", NodeID = "name", 
                   colourScale=my_color, LinkGroup="group", NodeGroup="group")

p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/sankeyColor3.html"))
```

---

## 283. 323-sankey-diagram-with-the-networkd3-library

**Файл:** `323-sankey-diagram-with-the-networkd3-library_1.R`

```r
# Load package
library(networkD3)
 
# Load energy projection data
URL <- "https://cdn.rawgit.com/christophergandrud/networkD3/master/JSONdata/energy.json"
Energy <- jsonlite::fromJSON(URL)

 
# Now we have 2 data frames: a 'links' data frame with 3 columns (from, to, value), and a 'nodes' data frame that gives the name of each node.
head( Energy$links )
head( Energy$nodes )
 
# Thus we can plot it
p <- sankeyNetwork(Links = Energy$links, Nodes = Energy$nodes, Source = "source",
              Target = "target", Value = "value", NodeID = "name",
              units = "TWh", fontSize = 12, nodeWidth = 30)
p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/sankeyEnergy.html"))
```

---

## 284. 327-chloropleth-map-from-geojson-with-ggplot2

**Файл:** `327-chloropleth-map-from-geojson-with-ggplot2_1.R`

```r
# Geospatial data available at the geojson format
tmp_geojson <- tempfile(fileext = ".geojson")

download.file(
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes.geojson",
  tmp_geojson
)
library(sf)
my_sf <- read_sf(tmp_geojson)

# Since it is a bit too much data, I select only a subset of it:
my_sf <- my_sf[substr(my_sf$code, 1, 2) %in% c(
  "06", "83",
  "13", "30", "34", "11", "66"
), ]
```

---

## 285. 327-chloropleth-map-from-geojson-with-ggplot2

**Файл:** `327-chloropleth-map-from-geojson-with-ggplot2_2.R`

```r
library(ggplot2)
ggplot(my_sf) +
  geom_sf(fill = "white", color = "black", linewidth = 0.3) +
  theme_void()
```

---

## 286. 327-chloropleth-map-from-geojson-with-ggplot2

**Файл:** `327-chloropleth-map-from-geojson-with-ggplot2_3.R`

```r
# read data
data <- read.table(
  "https://raw.githubusercontent.com/holtzy/R-graph-gallery/master/DATA/data_on_french_states.csv",
  header = T, sep = ";"
)

head(data)
```

---

## 287. 327-chloropleth-map-from-geojson-with-ggplot2

**Файл:** `327-chloropleth-map-from-geojson-with-ggplot2_4.R`

```r
# Distribution of the number of restaurant?
library(dplyr)
data %>%
  ggplot(aes(x = nb_equip)) +
  geom_histogram(bins = 10, fill = "skyblue", color = "black") +
  scale_x_log10()
```

---

## 288. 327-chloropleth-map-from-geojson-with-ggplot2

**Файл:** `327-chloropleth-map-from-geojson-with-ggplot2_5.R`

```r
# Make the merge
my_sf_merged <- my_sf %>%
  left_join(data, by = c("code" = "depcom")) %>%
  # Note that if the number of restaurant is NA, it is in fact 0
  mutate(nb_equip = ifelse(is.na(nb_equip), 0.01, nb_equip))
```

---

## 289. 327-chloropleth-map-from-geojson-with-ggplot2

**Файл:** `327-chloropleth-map-from-geojson-with-ggplot2_6.R`

```r
ggplot(my_sf_merged) +
  geom_sf(aes(fill = nb_equip)) +
  theme_void()
```

---

## 290. 327-chloropleth-map-from-geojson-with-ggplot2

**Файл:** `327-chloropleth-map-from-geojson-with-ggplot2_7.R`

```r
p <- ggplot(my_sf_merged) +
  geom_sf(aes(fill = nb_equip), linewidth = 0, alpha = 0.9) +
  theme_void() +
  scale_fill_viridis_c(
    trans = "log", breaks = c(1, 5, 10, 20, 50, 100),
    name = "Number of restaurant",
    guide = guide_legend(
      keyheight = unit(3, units = "mm"),
      keywidth = unit(12, units = "mm"),
      label.position = "bottom",
      title.position = "top",
      nrow = 1
    )
  ) +
  labs(
    title = "South of France Restaurant concentration",
    subtitle = "Number of restaurant per city district",
    caption = "Data: INSEE | Creation: Yan Holtz | r-graph-gallery.com"
  ) +
  theme(
    text = element_text(color = "#22211d"),
    plot.background = element_rect(fill = "#f5f5f2", color = NA),
    panel.background = element_rect(fill = "#f5f5f2", color = NA),
    legend.background = element_rect(fill = "#f5f5f2", color = NA),
    plot.title = element_text(
      size = 20, hjust = 0.01, color = "#4e4d47",
      margin = margin(
        b = -0.1, t = 0.4, l = 2,
        unit = "cm"
      )
    ),
    plot.subtitle = element_text(
      size = 15, hjust = 0.01,
      color = "#4e4d47",
      margin = margin(
        b = -0.1, t = 0.43, l = 2,
        unit = "cm"
      )
    ),
    plot.caption = element_text(
      size = 10,
      color = "#4e4d47",
      margin = margin(
        b = 0.3, r = -99, t = 0.3,
        unit = "cm"
      )
    ),
    legend.position = c(0.7, 0.09)
  )

p
```

---

## 291. 328-hexbin-map-of-the-usa

**Файл:** `328-hexbin-map-of-the-usa_1.R`

```r
# library
library(tidyverse)
library(sf)
library(RColorBrewer)

# Download the Hexagon boundaries at geojson format here: https://team.carto.com/u/andrew/tables/andrew.us_states_hexgrid/public/map.

# Load this file. (Note: I stored in a folder called DATA)
my_sf <- read_sf("DATA/us_states_hexgrid.geojson.json")

# Bit of reformatting
my_sf <- my_sf %>%
  mutate(google_name = gsub(" \\(United States\\)", "", google_name))

# Show it
plot(st_geometry(my_sf))
```

---

## 292. 328-hexbin-map-of-the-usa

**Файл:** `328-hexbin-map-of-the-usa_2.R`

```r
ggplot(my_sf) +
  geom_sf(fill = "skyblue", color = "white") +
  geom_sf_text(aes(label = iso3166_2)) +
  theme_void()
```

---

## 293. 328-hexbin-map-of-the-usa

**Файл:** `328-hexbin-map-of-the-usa_3.R`

```r
# Load marriage data
data <- read.table("https://raw.githubusercontent.com/holtzy/R-graph-gallery/master/DATA/State_mariage_rate.csv",
  header = T, sep = ",", na.strings = "---"
)

# Distribution of the marriage rate?
data %>%
  ggplot(aes(x = y_2015)) +
  geom_histogram(bins = 20, fill = "#69b3a2", color = "white") +
  scale_x_continuous(breaks = seq(1, 30))
```

---

## 294. 328-hexbin-map-of-the-usa

**Файл:** `328-hexbin-map-of-the-usa_4.R`

```r
# Merge geospatial and numerical information
my_sf_wed <- my_sf %>%
  left_join(data, by = c("google_name" = "state"))

# Make a first choropleth map
ggplot(my_sf_wed) +
  geom_sf(aes(fill = y_2015)) +
  scale_fill_gradient(trans = "log") +
  theme_void()
```

---

## 295. 328-hexbin-map-of-the-usa

**Файл:** `328-hexbin-map-of-the-usa_5.R`

```r
# Prepare binning
my_sf_wed$bin <- cut(my_sf_wed$y_2015,
  breaks = c(seq(5, 10), Inf),
  labels = c("5-6", "6-7", "7-8", "8-9", "9-10", "10+"),
  include.lowest = TRUE
)

# Prepare a color scale coming from the viridis color palette
library(viridis)
my_palette <- rev(magma(8))[c(-1, -8)]

# plot
ggplot(my_sf_wed) +
  geom_sf(aes(fill = bin), linewidth = 0, alpha = 0.9) +
  geom_sf_text(aes(label = iso3166_2), color = "white", size = 3, alpha = 0.6) +
  theme_void() +
  scale_fill_manual(
    values = my_palette,
    name = "Wedding per 1000 people in 2015",
    guide = guide_legend(
      keyheight = unit(3, units = "mm"),
      keywidth = unit(12, units = "mm"),
      label.position = "bottom", title.position = "top", nrow = 1
    )
  ) +
  ggtitle("A map of marriage rates, state by state") +
  theme(
    legend.position = c(0.5, 0.9),
    text = element_text(color = "#22211d"),
    plot.background = element_rect(fill = "#f5f5f2", color = NA),
    panel.background = element_rect(fill = "#f5f5f2", color = NA),
    legend.background = element_rect(fill = "#f5f5f2", color = NA),
    plot.title = element_text(
      size = 22, hjust = 0.5, color = "#4e4d47",
      margin = margin(b = -0.1, t = 0.4, l = 2, unit = "cm")
    )
  )
```

---

## 296. 329-hexbin-map-for-distribution

**Файл:** `329-hexbin-map-for-distribution_1.R`

```r
# Libraries
library(tidyverse)
library(viridis)
library(hrbrthemes)
library(mapdata)

# Load dataset from github
data <- read.table("https://raw.githubusercontent.com/holtzy/data_to_viz/master/Example_dataset/17_ListGPSCoordinates.csv", sep=",", header=T)

# Get the world polygon
world <- map_data("world")

# plot
ggplot(data, aes(x=homelon, y=homelat)) + 
    geom_polygon(data = world, aes(x=long, y = lat, group = group), fill="grey", alpha=0.3) +
    geom_bin2d(bins=100) +
    ggplot2::annotate("text", x = 175, y = 80, label="Where people tweet about #Surf", colour = "black", size=4, alpha=1, hjust=1) +
    ggplot2::annotate("segment", x = 100, xend = 175, y = 73, yend = 73, colour = "black", size=0.2, alpha=1) +
    theme_void() +
    ylim(-70, 80) +
    scale_fill_viridis(
      trans = "log", 
      breaks = c(1,7,54,403,3000),
      name="Tweet # recorded in 8 months", 
      guide = guide_legend( keyheight = unit(2.5, units = "mm"), keywidth=unit(10, units = "mm"), label.position = "bottom", title.position = 'top', nrow=1) 
    )  +
    ggtitle( "" ) +
    theme(
      legend.position = c(0.8, 0.09),
      legend.title=element_text(color="black", size=8),
      text = element_text(color = "#22211d"),
      plot.title = element_text(size= 13, hjust=0.1, color = "#4e4d47", margin = margin(b = -0.1, t = 0.4, l = 2, unit = "cm")),
    )
```

---

## 297. 329-hexbin-map-for-distribution

**Файл:** `329-hexbin-map-for-distribution_2.R`

```r
# Libraries
library(tidyverse)
library(viridis)
library(hrbrthemes)
library(mapdata)

# Load dataset from github
data <- read.table("https://raw.githubusercontent.com/holtzy/data_to_viz/master/Example_dataset/17_ListGPSCoordinates.csv", sep=",", header=T)

# plot
data %>%
  filter(homecontinent=='Europe') %>%
  ggplot( aes(x=homelon, y=homelat)) + 
    geom_hex(bins=59) +
    ggplot2::annotate("text", x = -27, y = 72, label="Where people tweet about #Surf", colour = "black", size=5, alpha=1, hjust=0) +
    ggplot2::annotate("segment", x = -27, xend = 10, y = 70, yend = 70, colour = "black", size=0.2, alpha=1) +
    theme_void() +
    xlim(-30, 70) +
    ylim(24, 72) +
    scale_fill_viridis(
      option="B",
      trans = "log", 
      breaks = c(1,7,54,403,3000),
      name="Tweet # recorded in 8 months", 
      guide = guide_legend( keyheight = unit(2.5, units = "mm"), keywidth=unit(10, units = "mm"), label.position = "bottom", title.position = 'top', nrow=1) 
    )  +
    ggtitle( "" ) +
    theme(
      legend.position = c(0.8, 0.09),
      legend.title=element_text(color="black", size=8),
      text = element_text(color = "#22211d"),
      plot.background = element_rect(fill = "#f5f5f2", color = NA), 
      panel.background = element_rect(fill = "#f5f5f2", color = NA), 
      legend.background = element_rect(fill = "#f5f5f2", color = NA),
      plot.title = element_text(size= 13, hjust=0.1, color = "#4e4d47", margin = margin(b = -0.1, t = 0.4, l = 2, unit = "cm")),
    )
```

---

## 298. 330-bubble-map-with-ggplot2

**Файл:** `330-bubble-map-with-ggplot2_1.R`

```r
# Libraries
library(ggplot2)
library(dplyr)

# Get the world polygon and extract UK
library(giscoR)
UK <- gisco_get_countries(country = "UK", resolution = 1)
```

---

## 299. 330-bubble-map-with-ggplot2

**Файл:** `330-bubble-map-with-ggplot2_2.R`

```r
# Get a data frame with longitude, latitude, and size of bubbles (a bubble = a city)
library(maps)
data <- world.cities %>% filter(country.etc == "UK")
```

---

## 300. 330-bubble-map-with-ggplot2

**Файл:** `330-bubble-map-with-ggplot2_3.R`

```r
# Left chart
ggplot() +
  geom_sf(data = UK, fill = "grey", alpha = 0.3) +
  geom_point(data = data, aes(x = long, y = lat)) +
  theme_void() +
  ylim(50, 59)

# Second graphic with names of the 10 biggest cities
library(ggrepel)
ggplot() +
  geom_sf(data = UK, fill = "grey", alpha = 0.3) +
  geom_point(data = data, aes(x = long, y = lat, alpha = pop)) +
  geom_text_repel(
    data = data %>% arrange(pop) %>% tail(10),
    aes(x = long, y = lat, label = name), size = 5
  ) +
  geom_point(
    data = data %>% arrange(pop) %>% tail(10), aes(x = long, y = lat),
    color = "red", size = 3
  ) +
  theme_void() +
  ylim(50, 59) +
  theme(legend.position = "none")
```

---

## 301. 330-bubble-map-with-ggplot2

**Файл:** `330-bubble-map-with-ggplot2_4.R`

```r
# Left: use size and color
ggplot() +
  geom_sf(data = UK, fill = "grey", alpha = 0.3) +
  geom_point(data = data, aes(x = long, y = lat, size = pop, color = pop)) +
  scale_size_continuous(range = c(1, 12)) +
  scale_color_viridis_c(trans = "log") +
  theme_void() +
  ylim(50, 59)

# Center: reorder your dataset first! Big cities appear later = on top
data %>%
  arrange(pop) %>%
  mutate(name = factor(name, unique(name))) %>%
  ggplot() +
  geom_sf(data = UK, fill = "grey", alpha = 0.3) +
  geom_point(aes(x = long, y = lat, size = pop, color = pop), alpha = 0.9) +
  scale_size_continuous(range = c(1, 12)) +
  scale_color_viridis_c(trans = "log") +
  theme_void() +
  ylim(50, 59) +
  theme(legend.position = "none")

# Right: just use arrange(desc(pop)) instead
data %>%
  arrange(desc(pop)) %>%
  mutate(name = factor(name, unique(name))) %>%
  ggplot() +
  geom_sf(data = UK, fill = "grey", alpha = 0.3) +
  geom_point(aes(x = long, y = lat, size = pop, color = pop), alpha = 0.9) +
  scale_size_continuous(range = c(1, 12)) +
  scale_color_viridis_c(trans = "log") +
  theme_void() +
  ylim(50, 59) +
  theme(legend.position = "none")
```

---

## 302. 330-bubble-map-with-ggplot2

**Файл:** `330-bubble-map-with-ggplot2_5.R`

```r
# Create breaks for the color scale
mybreaks <- c(0.02, 0.04, 0.08, 1, 7)

# Reorder data to show biggest cities on top
data <- data %>%
  arrange(pop) %>%
  mutate(name = factor(name, unique(name))) %>%
  mutate(pop = pop / 1000000)

# Build the map
data %>%
  ggplot() +
  geom_sf(data = UK, fill = "grey", alpha = 0.3) +
  geom_point(aes(x = long, y = lat, size = pop, color = pop, alpha = pop),
    shape = 20, stroke = FALSE
  ) +
  scale_size_continuous(
    name = "Population (in M)", trans = "log",
    range = c(1, 12), breaks = mybreaks
  ) +
  scale_alpha_continuous(
    name = "Population (in M)", trans = "log",
    range = c(0.1, .9), breaks = mybreaks
  ) +
  scale_color_viridis_c(
    option = "magma", trans = "log",
    breaks = mybreaks, name = "Population (in M)"
  ) +
  theme_void() +
  guides(colour = guide_legend()) +
  ggtitle("The 1000 biggest cities in the UK") +
  theme(
    legend.position = c(1, 0.6),
    text = element_text(color = "#22211d"),
    plot.margin = margin(r = 2, l = 2, unit = "cm"),
    plot.background = element_rect(fill = "#f5f5f2", color = NA),
    panel.background = element_rect(fill = "#f5f5f2", color = NA),
    plot.title = element_text(size = 14, hjust = 0.5, color = "#4e4d47"),
    legend.title = element_text(size = 8),
    legend.text = element_text(size = 8)
  )
```

---

## 303. 330-bubble-map-with-ggplot2

**Файл:** `330-bubble-map-with-ggplot2_6.R`

```r
# Load the plotly package
library(plotly)

# Rorder data + Add a new column with tooltip text
data <- data %>%
  arrange(pop) %>%
  mutate(name = factor(name, unique(name))) %>%
  mutate(mytext = paste(
    "City: ", name, "\n",
    "Population: ", pop,
    sep = ""
  ))

# Make the map (static)
p <- data %>%
  ggplot() +
  geom_sf(data = UK, fill = "grey", alpha = 0.3) +
  geom_point(aes(
    x = long, y = lat, size = pop, color = pop, text = mytext,
    alpha = pop
  )) +
  scale_size_continuous(range = c(1, 9)) +
  scale_color_viridis_c(option = "inferno", trans = "log") +
  scale_alpha_continuous(trans = "log") +
  theme_void() +
  theme(legend.position = "none")

p <- ggplotly(p, tooltip = "text")
p

# save the widget in a html file if needed.
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/bubblemapUK.html"))
```

---

## 304. 331-basic-cartogram

**Файл:** `331-basic-cartogram_1.R`

```r
# Get the shape file of Africa, see how on
# https://r-graph-gallery.com/168-load-a-shape-file-into-r.html

# I stored the data on a DATA folder and read it from there
library(sf)
wrld_simpl <- read_sf("DATA/world_shape_file/TM_WORLD_BORDERS_SIMPL-0.3.shp")
afr <- wrld_simpl[wrld_simpl$REGION == 2, ]

# We can visualize the region's boundaries with the plot function
plot(st_geometry(afr))
```

---

## 305. 331-basic-cartogram

**Файл:** `331-basic-cartogram_2.R`

```r
# We work with the cartogram library
library(cartogram)

# construct a cartogram using the population in 2005

# need first to "change" the projection to Mercator (AKA Google Maps): EPSG: 3857
afr_merc <- st_transform(afr, 3857)

afr_cartogram <- cartogram_cont(afr_merc, "POP2005", itermax = 5)

# And back to the previous projection
afr_cartogram <- st_transform(afr_cartogram, st_crs(afr))

# This is a new geospatial object, we can visualise it!
plot(st_geometry(afr_cartogram))
```

---

## 306. 331-basic-cartogram

**Файл:** `331-basic-cartogram_3.R`

```r
# It is a new geospatial object: we can use all the usual techniques on it! Let's start with a basic ggplot2 choropleth map:
library(tidyverse)
ggplot(afr_cartogram) +
  geom_sf(aes(fill = POP2005), linewidth = 0, alpha = 0.9) +
  theme_void()
```

---

## 307. 331-basic-cartogram

**Файл:** `331-basic-cartogram_4.R`

```r
# As seen before, we can do better with a bit of customization
ggplot(afr_cartogram) +
  geom_sf(aes(fill = POP2005 / 1000000), linewidth = 0, alpha = 0.9) +
  theme_void() +
  scale_fill_viridis_c(
    name = "Population (M)",
    breaks = c(1, 50, 100, 140),
    guide = guide_legend(
      keyheight = unit(3, units = "mm"),
      keywidth = unit(12, units = "mm"),
      label.position = "bottom",
      title.position = "top", nrow = 1
    )
  ) +
  labs(title = "Africa 2005 Population") +
  theme(
    text = element_text(color = "#22211d"),
    plot.background = element_rect(fill = "#f5f5f4", color = NA),
    panel.background = element_rect(fill = "#f5f5f4", color = NA),
    legend.background = element_rect(fill = "#f5f5f4", color = NA),
    plot.title = element_text(
      size = 22, hjust = 0.5,
      color = "#4e4d47",
      margin = margin(
        b = -0.1, t = 0.4, l = 2,
        unit = "cm"
      )
    ),
    legend.position = c(0.2, 0.26)
  )
```

---

## 308. 332-hexbin-chloropleth-cartogram

**Файл:** `332-hexbin-chloropleth-cartogram_1.R`

```r
# library
library(tidyverse)
library(sf)
library(RColorBrewer)

# Hexagons boundaries at geojson format were found here, and stored on my github https://team.carto.com/u/andrew/tables/andrew.us_states_hexgrid/public/map.

# Load this file. (Note: I stored in a folder called DATA)
my_sf <- read_sf("DATA/us_states_hexgrid.geojson.json")

# Bit of reformatting
my_sf <- my_sf %>%
  mutate(google_name = gsub(" \\(United States\\)", "", google_name))

# Show it
plot(st_geometry(my_sf))
```

---

## 309. 332-hexbin-chloropleth-cartogram

**Файл:** `332-hexbin-chloropleth-cartogram_2.R`

```r
# Library
library(cartogram)

# Load the population per states (source: https://www.census.gov/data/tables/2017/demo/popest/nation-total.html)
pop <- read.table("https://raw.githubusercontent.com/holtzy/R-graph-gallery/master/DATA/pop_US.csv", sep = ",", header = T)
pop$pop <- pop$pop / 1000000

# merge both
my_sf <- my_sf %>% left_join(., pop, by = c("google_name" = "state"))

# Compute the cartogram, using this population information
# First we need to change the projection, we use Mercator (AKA Google Maps, EPSG 3857)
my_sf_merc <- st_transform(my_sf, 3857)
cartogram <- cartogram_cont(my_sf_merc, "pop")

# Back to original projection
cartogram <- st_transform(cartogram, st_crs(my_sf))

# First look!
plot(st_geometry(cartogram))
```

---

## 310. 332-hexbin-chloropleth-cartogram

**Файл:** `332-hexbin-chloropleth-cartogram_3.R`

```r
# Library
# plot
ggplot(cartogram) +
  geom_sf(aes(fill = pop), linewidth = 0.05, alpha = 0.9, color = "black") +
  scale_fill_gradientn(
    colours = brewer.pal(7, "BuPu"), name = "population (in M)",
    labels = scales::label_comma(),
    guide = guide_legend(
      keyheight = unit(3, units = "mm"),
      keywidth = unit(12, units = "mm"),
      title.position = "top",
      label.position = "bottom"
    )
  ) +
  geom_sf_text(aes(label = iso3166_2), color = "white", size = 3, alpha = 0.6) +
  theme_void() +
  ggtitle("Another look on the US population") +
  theme(
    legend.position = c(0.5, 0.9),
    legend.direction = "horizontal",
    text = element_text(color = "#22211d"),
    plot.background = element_rect(fill = "#f5f5f9", color = NA),
    panel.background = element_rect(fill = "#f5f5f9", color = NA),
    legend.background = element_rect(fill = "#f5f5f9", color = NA),
    plot.title = element_text(size = 22, hjust = 0.5, color = "#4e4d47", margin = margin(b = -0.1, t = 0.4, l = 2, unit = "cm")),
  )
```

---

## 311. 334-basic-dendrogram-with-ggraph

**Файл:** `334-basic-dendrogram-with-ggraph_1.R`

```r
# libraries
library(ggraph)
library(igraph)
library(tidyverse)
 
# create an edge list data frame giving the hierarchical structure of your individuals
d1 <- data.frame(from="origin", to=paste("group", seq(1,5), sep=""))
d2 <- data.frame(from=rep(d1$to, each=5), to=paste("subgroup", seq(1,25), sep="_"))
edges <- rbind(d1, d2)
 
# Create a graph object 
mygraph <- graph_from_data_frame( edges )
 
# Basic tree
ggraph(mygraph, layout = 'dendrogram', circular = FALSE) + 
  geom_edge_diagonal() +
  geom_node_point() +
  theme_void()
```

---

## 312. 334-basic-dendrogram-with-ggraph

**Файл:** `334-basic-dendrogram-with-ggraph_2.R`

```r
# libraries
library(ggraph)
library(igraph)
library(tidyverse)
 
# create a data frame 
data <- data.frame(
  level1="CEO",
  level2=c( rep("boss1",4), rep("boss2",4)),
  level3=paste0("mister_", letters[1:8])
)
 
# transform it to a edge list!
edges_level1_2 <- data %>% select(level1, level2) %>% unique %>% rename(from=level1, to=level2)
edges_level2_3 <- data %>% select(level2, level3) %>% unique %>% rename(from=level2, to=level3)
edge_list=rbind(edges_level1_2, edges_level2_3)
 
# Now we can plot that
mygraph <- graph_from_data_frame( edge_list )
ggraph(mygraph, layout = 'dendrogram', circular = FALSE) + 
  geom_edge_diagonal() +
  geom_node_point() +
  theme_void()
```

---

## 313. 335-custom-ggraph-dendrogram

**Файл:** `335-custom-ggraph-dendrogram_1.R`

```r
# Libraries
library(ggraph)
library(igraph)
library(tidyverse)
theme_set(theme_void())
 
# data: edge list
d1 <- data.frame(from="origin", to=paste("group", seq(1,7), sep=""))
d2 <- data.frame(from=rep(d1$to, each=7), to=paste("subgroup", seq(1,49), sep="_"))
edges <- rbind(d1, d2)
 
# We can add a second data frame with information for each node!
name <- unique(c(as.character(edges$from), as.character(edges$to)))
vertices <- data.frame(
  name=name,
  group=c( rep(NA,8) ,  rep( paste("group", seq(1,7), sep=""), each=7)),
  cluster=sample(letters[1:4], length(name), replace=T),
  value=sample(seq(10,30), length(name), replace=T)
)
 
# Create a graph object
mygraph <- graph_from_data_frame( edges, vertices=vertices)
```

---

## 314. 335-custom-ggraph-dendrogram

**Файл:** `335-custom-ggraph-dendrogram_2.R`

```r
# Left
ggraph(mygraph, layout = 'dendrogram', circular = FALSE) + 
  geom_edge_diagonal()
```

---

## 315. 335-custom-ggraph-dendrogram

**Файл:** `335-custom-ggraph-dendrogram_3.R`

```r
# Right
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_edge_diagonal()
```

---

## 316. 335-custom-ggraph-dendrogram

**Файл:** `335-custom-ggraph-dendrogram_4.R`

```r
# Left
ggraph(mygraph, layout = 'dendrogram') + 
  geom_edge_link()
```

---

## 317. 335-custom-ggraph-dendrogram

**Файл:** `335-custom-ggraph-dendrogram_5.R`

```r
# Right
ggraph(mygraph, layout = 'dendrogram') + 
  geom_edge_diagonal()
```

---

## 318. 335-custom-ggraph-dendrogram

**Файл:** `335-custom-ggraph-dendrogram_6.R`

```r
# Left
ggraph(mygraph, layout = 'dendrogram') + 
  geom_edge_diagonal() +
  geom_node_text(aes( label=name, filter=leaf) , angle=90 , hjust=1, nudge_y = -0.01) +
  ylim(-.4, NA)
```

---

## 319. 335-custom-ggraph-dendrogram

**Файл:** `335-custom-ggraph-dendrogram_7.R`

```r
# Right
ggraph(mygraph, layout = 'dendrogram') + 
  geom_edge_diagonal() +
  geom_node_text(aes( label=name, filter=leaf) , angle=90 , hjust=1, nudge_y = -0.04) +
  geom_node_point(aes(filter=leaf) , alpha=0.6) +
  ylim(-.5, NA)
```

---

## 320. 335-custom-ggraph-dendrogram

**Файл:** `335-custom-ggraph-dendrogram_8.R`

```r
ggraph(mygraph, layout = 'dendrogram') + 
  geom_edge_diagonal() +
  geom_node_text(aes( label=name, filter=leaf, color=group) , angle=90 , hjust=1, nudge_y=-0.1) +
  geom_node_point(aes(filter=leaf, size=value, color=group) , alpha=0.6) +
  ylim(-.6, NA) +
  theme(legend.position="none")
```

---

## 321. 336-interactive-dendrogram-with-collapsibletree

**Файл:** `336-interactive-dendrogram-with-collapsibletree_1.R`

```r
# Load library
# install.packages("collapsibleTree")
library(collapsibleTree) 
 
# input data must be a nested data frame:
head(warpbreaks)
 
# Represent this tree:
p <- collapsibleTree( warpbreaks, c("wool", "tension", "breaks"))
p

# save the widget
# library(htmlwidgets)
# saveWidget(p, file=paste0( getwd(), "/HtmlWidget/dendrogram_interactive.html"))
```

---

## 322. 339-circular-dendrogram-with-ggraph

**Файл:** `339-circular-dendrogram-with-ggraph_1.R`

```r
# Libraries
library(ggraph)
library(igraph)
library(tidyverse)
library(RColorBrewer) 
# create a data frame giving the hierarchical structure of your individuals
d1=data.frame(from="origin", to=paste("group", seq(1,10), sep=""))
d2=data.frame(from=rep(d1$to, each=10), to=paste("subgroup", seq(1,100), sep="_"))
edges=rbind(d1, d2)
 
# create a vertices data.frame. One line per object of our hierarchy
vertices = data.frame(
  name = unique(c(as.character(edges$from), as.character(edges$to))) , 
  value = runif(111)
) 
# Let's add a column with the group of each name. It will be useful later to color points
vertices$group = edges$from[ match( vertices$name, edges$to ) ]
 
 
#Let's add information concerning the label we are going to add: angle, horizontal adjustement and potential flip
#calculate the ANGLE of the labels
vertices$id=NA
myleaves=which(is.na( match(vertices$name, edges$from) ))
nleaves=length(myleaves)
vertices$id[ myleaves ] = seq(1:nleaves)
vertices$angle= 90 - 360 * vertices$id / nleaves
 
# calculate the alignment of labels: right or left
# If I am on the left part of the plot, my labels have currently an angle < -90
vertices$hjust<-ifelse( vertices$angle < -90, 1, 0)
 
# flip angle BY to make them readable
vertices$angle<-ifelse(vertices$angle < -90, vertices$angle+180, vertices$angle)
 
# Create a graph object
mygraph <- graph_from_data_frame( edges, vertices=vertices )
 
# Make the plot
ggraph(mygraph, layout = 'dendrogram', circular = TRUE) + 
  geom_edge_diagonal(colour="grey") +
  scale_edge_colour_distiller(palette = "RdPu") +
  geom_node_text(aes(x = x*1.15, y=y*1.15, filter = leaf, label=name, angle = angle, hjust=hjust, colour=group), size=2.7, alpha=1) +
  geom_node_point(aes(filter = leaf, x = x*1.07, y=y*1.07, colour=group, size=value, alpha=0.2)) +
  scale_colour_manual(values= rep( brewer.pal(9,"Paired") , 30)) +
  scale_size_continuous( range = c(0.1,10) ) +
  theme_void() +
  theme(
    legend.position="none",
    plot.margin=unit(c(0,0,0,0),"cm"),
  ) +
  expand_limits(x = c(-1.3, 1.3), y = c(-1.3, 1.3))
```

---

## 323. 339-circular-dendrogram-with-ggraph

**Файл:** `339-circular-dendrogram-with-ggraph_2.R`

```r
## R version 3.5.3 (2019-03-11)
## Platform: x86_64-apple-darwin15.6.0 (64-bit)
## Running under: macOS Mojave 10.14.6
##
## Matrix products: default
## BLAS: /Library/Frameworks/R.framework/Versions/3.5/Resources/lib/libRblas.0.dylib
## LAPACK: /Library/Frameworks/R.framework/Versions/3.5/Resources/lib/libRlapack.dylib
##
## locale:
## [1] en_US.UTF-8/en_US.UTF-8/en_US.UTF-8/C/en_US.UTF-8/en_US.UTF-8
##
## attached base packages:
## [1] stats     graphics  grDevices utils     datasets  methods   base
##
## other attached packages:
##  [1] RColorBrewer_1.1-2 forcats_0.5.1      stringr_1.4.0      dplyr_1.0.6
##  [5] purrr_0.3.4        readr_1.4.0        tidyr_1.1.3        tibble_3.1.2
##  [9] tidyverse_1.3.1    igraph_1.2.4.1     ggraph_1.0.2       ggplot2_3.3.3
##
## loaded via a namespace (and not attached):
##  [1] ggrepel_0.8.0     Rcpp_1.0.1        lubridate_1.7.10  assertthat_0.2.1
##  [5] digest_0.6.20     utf8_1.1.4        ggforce_0.2.1     R6_2.4.0
##  [9] cellranger_1.1.0  plyr_1.8.4        backports_1.1.4   reprex_2.0.0
## [13] evaluate_0.13     highr_0.8         httr_1.4.2        pillar_1.6.1
## [17] rlang_0.4.11      readxl_1.3.1      rstudioapi_0.13   rmarkdown_1.12
## [21] labeling_0.3      polyclip_1.10-0   munsell_0.5.0     broom_0.7.6
## [25] compiler_3.5.3    modelr_0.1.8      xfun_0.23         pkgconfig_2.0.2
## [29] htmltools_0.3.6   tidyselect_1.1.1  gridExtra_2.3     fansi_0.4.0
## [33] viridisLite_0.3.0 crayon_1.4.1      dbplyr_2.1.1      withr_2.4.2
## [37] MASS_7.3-51.1     grid_3.5.3        jsonlite_1.7.2    gtable_0.3.0
## [41] lifecycle_1.0.0   DBI_1.0.0         magrittr_2.0.1    scales_1.0.0
## [45] cli_2.5.0         stringi_1.4.3     farver_1.1.0      viridis_0.5.1
## [49] fs_1.5.0          xml2_1.3.2        ellipsis_0.3.2    generics_0.0.2
## [53] vctrs_0.3.8       tools_3.5.3       glue_1.4.2        tweenr_1.0.1
## [57] hms_1.1.0         yaml_2.2.0        colorspace_1.4-1  rvest_1.0.0
## [61] knitr_1.33        haven_2.3.1
```

---

## 324. 340-custom-your-dendrogram-with-dendextend

**Файл:** `340-custom-your-dendrogram-with-dendextend_1.R`

```r
# Library
library(tidyverse)
 
# Data
head(mtcars)
 
# Clusterisation using 3 variables
mtcars %>% 
  select(mpg, cyl, disp) %>% 
  dist() %>% 
  hclust() %>% 
  as.dendrogram() -> dend
 
# Plot
par(mar=c(7,3,1,1))  # Increase bottom margin to have the complete label
plot(dend)
```

---

## 325. 340-custom-your-dendrogram-with-dendextend

**Файл:** `340-custom-your-dendrogram-with-dendextend_2.R`

```r
# library
library(dendextend)

# Chart (left)
dend %>% 
  # Custom branches
  set("branches_col", "grey") %>% set("branches_lwd", 3) %>%
  # Custom labels
  set("labels_col", "orange") %>% set("labels_cex", 0.8) %>%
  plot()
```

---

## 326. 340-custom-your-dendrogram-with-dendextend

**Файл:** `340-custom-your-dendrogram-with-dendextend_3.R`

```r
# Middle
dend %>% 
  set("nodes_pch", 19)  %>% 
  set("nodes_cex", 0.7) %>% 
  set("nodes_col", "orange") %>% 
  plot()
```

---

## 327. 340-custom-your-dendrogram-with-dendextend

**Файл:** `340-custom-your-dendrogram-with-dendextend_4.R`

```r
# right
dend %>% 
  set("leaves_pch", 19)  %>% 
  set("leaves_cex", 0.7) %>% 
  set("leaves_col", "skyblue") %>% 
  plot()
```

---

## 328. 340-custom-your-dendrogram-with-dendextend

**Файл:** `340-custom-your-dendrogram-with-dendextend_5.R`

```r
# Color in function of the cluster
par(mar=c(1,1,1,7))
dend %>%
  set("labels_col", value = c("skyblue", "orange", "grey"), k=3) %>%
  set("branches_k_color", value = c("skyblue", "orange", "grey"), k = 3) %>%
  plot(horiz=TRUE, axes=FALSE)
abline(v = 350, lty = 2)
```

---

## 329. 340-custom-your-dendrogram-with-dendextend

**Файл:** `340-custom-your-dendrogram-with-dendextend_6.R`

```r
# Highlight a cluster with rectangle
par(mar=c(9,1,1,1))
dend %>%
  set("labels_col", value = c("skyblue", "orange", "grey"), k=3) %>%
  set("branches_k_color", value = c("skyblue", "orange", "grey"), k = 3) %>%
  plot(axes=FALSE)
rect.dendrogram( dend, k=3, lty = 5, lwd = 0, x=1, col=rgb(0.1, 0.2, 0.4, 0.1) )
```

---

## 330. 340-custom-your-dendrogram-with-dendextend

**Файл:** `340-custom-your-dendrogram-with-dendextend_7.R`

```r
# Create a vector of colors, darkgreen if am is 0, green if 1.
my_colors <- ifelse(mtcars$am==0, "forestgreen", "green")
 
# Make the dendrogram
par(mar=c(10,1,1,1))
dend %>%
  set("labels_col", value = c("skyblue", "orange", "grey"), k=3) %>%
  set("branches_k_color", value = c("skyblue", "orange", "grey"), k = 3) %>%
  set("leaves_pch", 19)  %>% 
  set("nodes_cex", 0.7) %>% 
  plot(axes=FALSE)
 
# Add the colored bar
colored_bars(colors = my_colors, dend = dend, rowLabels = "am")
```

---

## 331. 340-custom-your-dendrogram-with-dendextend

**Файл:** `340-custom-your-dendrogram-with-dendextend_8.R`

```r
# Make 2 dendrograms, using 2 different clustering methods
d1 <- USArrests %>% dist() %>% hclust( method="average" ) %>% as.dendrogram()
d2 <- USArrests %>% dist() %>% hclust( method="complete" ) %>% as.dendrogram()
 
# Custom these kendo, and place them in a list
dl <- dendlist(
  d1 %>% 
    set("labels_col", value = c("skyblue", "orange", "grey"), k=3) %>%
    set("branches_lty", 1) %>%
    set("branches_k_color", value = c("skyblue", "orange", "grey"), k = 3),
  d2 %>% 
    set("labels_col", value = c("skyblue", "orange", "grey"), k=3) %>%
    set("branches_lty", 1) %>%
    set("branches_k_color", value = c("skyblue", "orange", "grey"), k = 3)
)
 
# Plot them together
tanglegram(dl, 
           common_subtrees_color_lines = FALSE, highlight_distinct_edges  = TRUE, highlight_branches_lwd=FALSE, 
           margin_inner=7,
           lwd=2
)
```

---

## 332. 341-stacked-barplot-with-negative-values

**Файл:** `341-stacked-barplot-with-negative-values_1.R`

```r
# Load the dataset that is stored on the web
data <- read.table("https://raw.githubusercontent.com/holtzy/R-graph-gallery/master/DATA/stacked_barplot_negative_values.csv", header=T, sep=",")
```

---

## 333. 341-stacked-barplot-with-negative-values

**Файл:** `341-stacked-barplot-with-negative-values_2.R`

```r
library(knitr)
kable(head(data, 4))
```

---

## 334. 341-stacked-barplot-with-negative-values

**Файл:** `341-stacked-barplot-with-negative-values_3.R`

```r
# Load the package
library(tidyr)
library(dplyr)

# transform the format
data_long <- gather(data, group, value, groupA:groupD) %>%
  arrange(factor(x, levels = c("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct"))) %>% 
  mutate(x=factor(x, levels=unique(x)))

# And that's the result!
kable(head(data_long, 4))
```

---

## 335. 341-stacked-barplot-with-negative-values

**Файл:** `341-stacked-barplot-with-negative-values_4.R`

```r
# library
library(ggplot2)

# plot
ggplot(data_long, aes(fill=group, y=value, x=x)) + 
  geom_bar(position="stack", stat="identity")
```

---

## 336. 341-stacked-barplot-with-negative-values

**Файл:** `341-stacked-barplot-with-negative-values_5.R`

```r
# library
library(ggplot2)
library(hrbrthemes)
library(viridis)

# plot
ggplot(data_long, aes(fill=group, y=value, x=x)) + 
  geom_bar(position="stack", stat="identity") + 
  scale_fill_viridis(discrete=TRUE, name="") +
  theme_ipsum() +
  ylab("Money input") + 
  xlab("Month")
```

---

## 337. 35-xyplot

**Файл:** `35-xyplot_1.R`

```r
# Library
library(lattice)

# create data :
sample <- paste(rep("sample_",40) , seq(1,40) , sep="")
specie <- c(rep("carot" , 10) , rep("cumcumber" , 10) , rep("wheat" , 10) , rep("Potatoe" , 10) )
gene1 <- c( seq(5,14)+rnorm(10 , 4 , 1) , seq(5,14)+rnorm(10 , 4 , 1) , seq(5,14)+rnorm(10 , 4 , 1) , seq(5,14)+rnorm(10 , 4 , 1) )
gene2 <- c( seq(5,14)+rnorm(10 , 4 , 1) , seq(5,14)+rnorm(10 , 2 , 0.2) , seq(5,14)+rnorm(10 , 4 , 4) , seq(5,14)+rnorm(10 , 4 , 3) )
data <- data.frame(sample,specie,gene1,gene2)
 
# Make the graph
xyplot(gene1 ~ gene2 | specie , data=data , pch=20 , cex=3 , col=rgb(0.2,0.4,0.8,0.5) )
```

---

## 338. 354-highlight-specific-elements-in-line-chart

**Файл:** `354-highlight-specific-elements-in-line-chart_1.R`

```r
# dataset with 3 lines named "a", "b" and "c"
set.seed(1)
period = 100
df = data.frame(Date = seq(as.Date("2020-01-01"),
                           by = "day",
                           length.out = period), 
                Value = c(cumsum(rnorm(period)),
                          cumsum(rnorm(period)),
                          cumsum(rnorm(period))),
                Type = c(rep("a", period),
                         rep("b", period),
                         rep("c", period)))
```

---

## 339. 354-highlight-specific-elements-in-line-chart

**Файл:** `354-highlight-specific-elements-in-line-chart_2.R`

```r
# Install the packages if not already done
# install.packages("ggplot2")
# install.packages("gghighlight")

# Load the package
library(ggplot2)
library(gghighlight)
```

---

## 340. 354-highlight-specific-elements-in-line-chart

**Файл:** `354-highlight-specific-elements-in-line-chart_3.R`

```r
ggplot(df) +
  geom_line(aes(Date, Value, colour = Type)) +
  gghighlight(max(Value) > 10)
```

---

## 341. 354-highlight-specific-elements-in-line-chart

**Файл:** `354-highlight-specific-elements-in-line-chart_4.R`

```r
ggplot(df) +
  geom_line(aes(Date, Value, colour = Type), linewidth=1) +
  gghighlight(max(Value) > 10,
              unhighlighted_params = list(linewidth = 0.3,
                                          colour = alpha("blue", 0.7),
                                          linetype = "dashed"))
```

---

## 342. 354-highlight-specific-elements-in-line-chart

**Файл:** `354-highlight-specific-elements-in-line-chart_5.R`

```r
library(hrbrthemes)
library(patchwork)

plot1 = ggplot(df) +
  geom_line(aes(Date, Value, colour = Type), linewidth=0.4, color='#4393C3') +
  gghighlight(max(Value) > 10,
              unhighlighted_params = list(linewidth = 0.3,
                                          colour = alpha("darkred", 0.7),
                                          linetype = "dotted"),
              use_direct_label = FALSE) +
  theme_bw() + xlab("") + ylab("")

plot2 = ggplot(df) +
  geom_line(aes(Date, Value, colour = Type), linewidth=0.4, color='#4393C3') +
  gghighlight(min(Value) < -10,
              unhighlighted_params = list(linewidth = 0.3,
                                          colour = alpha("darkred", 0.7),
                                          linetype = "dotted"),
              use_direct_label = FALSE) +
  theme_bw() 

plot1 / plot2 + plot_annotation(title = 'This chart is built with gghighlight')
```

---

## 343. 357-area-chart-with-gradient

**Файл:** `357-area-chart-with-gradient_1.R`

```r
library(ggplot2)
library(ggpattern)
library(hrbrthemes)
```

---

## 344. 357-area-chart-with-gradient

**Файл:** `357-area-chart-with-gradient_2.R`

```r
set.seed(0)
n = 10
x = 1:n
y = x + rnorm(n=n, mean=100, sd=20)
df = data.frame(xValue = x,
                yValue = y)
```

---

## 345. 357-area-chart-with-gradient

**Файл:** `357-area-chart-with-gradient_3.R`

```r
ggplot(df, aes(x=xValue, y=yValue)) +
  geom_area(colour='black', fill='lightblue')
```

---

## 346. 357-area-chart-with-gradient

**Файл:** `357-area-chart-with-gradient_4.R`

```r
ggplot(df, aes(xValue, yValue)) + 
  geom_area_pattern(data = df,
                    pattern = "gradient",
                    pattern_fill = "white",
                    pattern_fill2 = "red")
```

---

## 347. 357-area-chart-with-gradient

**Файл:** `357-area-chart-with-gradient_5.R`

```r
ggplot(df, aes(xValue, yValue)) + 
  geom_area_pattern(data = df,
                    pattern = "gradient",
                    fill = "#00000010",
                    pattern_fill  = "#00000010",
                    pattern_fill2 = "blue")
```

---

## 348. 357-area-chart-with-gradient

**Файл:** `357-area-chart-with-gradient_6.R`

```r
ggplot(df, aes(xValue, yValue)) + 
  geom_area_pattern(data = df,
                    pattern = "gradient", 
                    fill = "#00000000",
                    pattern_fill  = "#00000000",
                    pattern_fill2 = "magenta") + 
  geom_line(data = df, colour = "black", linewidth = 0.8) +
  geom_point(shape = 16, size = 4.5, colour = "purple") +
  geom_point(shape = 16, size = 2.5, colour = "white") +
  ggtitle("Area chart with a color gradient and line with data points") + 
  theme_bw() +
  theme(plot.title = element_text(size = 14),
        panel.border       = element_blank(),
        axis.line.x        = element_line(),
        text               = element_text(size = 12),
        axis.ticks         = element_blank(),
        axis.text.y        = element_text(margin = margin(0,15,0,0, unit = "pt"))) +
  scale_alpha_identity() + labs(x="",y="")
```

---

## 349. 361-density-plot-with-labels-on-lines

**Файл:** `361-density-plot-with-labels-on-lines_1.R`

```r
# Install the packages if not already done
# install.packages("ggplot2")
# install.packages("geomtextpath")

# Load the package
library(ggplot2)
library(geomtextpath)
```

---

## 350. 361-density-plot-with-labels-on-lines

**Файл:** `361-density-plot-with-labels-on-lines_2.R`

```r
library(hrbrthemes)
data(iris)

ggplot(iris, aes(x = Sepal.Length, colour = Species, label = Species)) +
  geom_textdensity() +
  theme_bw() + guides(color = 'none')
```

---

## 351. 361-density-plot-with-labels-on-lines

**Файл:** `361-density-plot-with-labels-on-lines_3.R`

```r
library(hrbrthemes)
data(mtcars)

mtcars$labels = ifelse(mtcars$vs==0, "Type 0", "Type 1")
ggplot(mtcars, aes(x = qsec, colour = as.factor(labels), label = as.factor(labels))) +
  geom_textdensity(size = 6, fontface = 4, # size of 6, bold italic
                   vjust = -0.4, hjust = "ymid") +
  theme_bw() + guides(color = 'none')
```

---

## 352. 362-scatter-plot-with-trend-line-and-labels

**Файл:** `362-scatter-plot-with-trend-line-and-labels_1.R`

```r
# Install the packages if not already done
# install.packages("ggplot2")
# install.packages("geomtextpath")

# Load the package
library(ggplot2)
library(geomtextpath)
```

---

## 353. 362-scatter-plot-with-trend-line-and-labels

**Файл:** `362-scatter-plot-with-trend-line-and-labels_2.R`

```r
library(hrbrthemes)
data(iris)

ggplot(iris, aes(x = Sepal.Length, y = Sepal.Width)) +
  geom_point() +
  geom_labelsmooth(aes(label = 'My Label'), fill = "white",
                method = "lm", formula = y ~ x,
                size = 6, linewidth = 2, boxlinewidth = 0.6) +
  theme_bw() + guides(color = 'none') # remove legend
```

---

## 354. 362-scatter-plot-with-trend-line-and-labels

**Файл:** `362-scatter-plot-with-trend-line-and-labels_3.R`

```r
library(hrbrthemes)
data(iris)

ggplot(iris, aes(x = Sepal.Length, y = Petal.Length, color = Species)) +
  geom_point() +
  geom_labelsmooth(aes(label = Species), fill = "white",
                method = "lm", formula = y ~ x,
                size = 3, linewidth = 1, boxlinewidth = 0.4) +
  theme_bw() + guides(color = 'none') # remove legend
```

---

## 355. 368-black-and-white-barchart

**Файл:** `368-black-and-white-barchart_1.R`

```r
library(ggpattern)
library(ggplot2)
library(hrbrthemes)
```

---

## 356. 368-black-and-white-barchart

**Файл:** `368-black-and-white-barchart_2.R`

```r
df = data.frame(
  name=c("north","south","south-east","north-west","south-west"),
  val=sample(seq(7,15), 5)
)
```

---

## 357. 368-black-and-white-barchart

**Файл:** `368-black-and-white-barchart_3.R`

```r
ggplot(df, aes(x=name, y=val, fill=name)) +
  geom_bar(stat="identity", alpha=.6, width=.4) +
  scale_fill_grey(start=0, end=0.8) +  # start and end define the range of grays
  theme_bw()
```

---

## 358. 368-black-and-white-barchart

**Файл:** `368-black-and-white-barchart_4.R`

```r
ggplot(df, aes(x=name, y=val)) +
 geom_col_pattern(
    aes(pattern=name,
        pattern_angle=name,
        pattern_spacing=name
        ), 
    fill            = 'white',
    colour          = 'black', 
    pattern_density = 0.5, 
    pattern_fill    = 'black',
    pattern_colour  = 'darkgrey'
  ) +
  theme_bw()
```

---

## 359. 37-barplot-with-number-of-observation

**Файл:** `37-barplot-with-number-of-observation_1.R`

```r
# Data
data <- data.frame(
  name = c("DD","with himself","with DC","with Silur" ,"DC","with himself","with DD","with Silur" ,"Silur","with himself","with DD","with DC" ),
  average = sample(seq(1,10) , 12 , replace=T),
  number = sample(seq(4,39) , 12 , replace=T)
)

# Increase bottom margin
par(mar=c(6,4,4,4))


# Basic Barplot
my_bar <- barplot(data$average , border=F , names.arg=data$name , 
                  las=2 , 
                  col=c(rgb(0.3,0.1,0.4,0.6) , rgb(0.3,0.5,0.4,0.6) , rgb(0.3,0.9,0.4,0.6) ,  rgb(0.3,0.9,0.4,0.6)) , 
                  ylim=c(0,13) , 
                  main="" )

# Add abline
abline(v=c(4.9 , 9.7) , col="grey")
 
# Add the text 
text(my_bar, data$average+0.4 , paste("n: ", data$number, sep="") ,cex=1) 
 
#Legende
legend("topleft", legend = c("Alone","with Himself","With other genotype" ) , 
     col = c(rgb(0.3,0.1,0.4,0.6) , rgb(0.3,0.5,0.4,0.6) , rgb(0.3,0.9,0.4,0.6) ,  rgb(0.3,0.9,0.4,0.6)) , 
     bty = "n", pch=20 , pt.cex = 2, cex = 0.8, horiz = FALSE, inset = c(0.05, 0.05))
```

---

## 360. 370-basic-beeswarm-plot

**Файл:** `370-basic-beeswarm-plot_1.R`

```r
# install.packages("beeswarm")
library(beeswarm)
```

---

## 361. 370-basic-beeswarm-plot

**Файл:** `370-basic-beeswarm-plot_2.R`

```r
data(iris)
print(head(iris)) # display first rows
```

---

## 362. 370-basic-beeswarm-plot

**Файл:** `370-basic-beeswarm-plot_3.R`

```r
beeswarm(iris$Sepal.Length, horizontal=TRUE)
```

---

## 363. 371-custom-dots-beeswarm

**Файл:** `371-custom-dots-beeswarm_1.R`

```r
# install.packages("beeswarm")
library(beeswarm)
```

---

## 364. 371-custom-dots-beeswarm

**Файл:** `371-custom-dots-beeswarm_2.R`

```r
beeswarm(
  iris$Sepal.Length,
  col="blue"
)
```

---

## 365. 371-custom-dots-beeswarm

**Файл:** `371-custom-dots-beeswarm_3.R`

```r
beeswarm(
  iris$Sepal.Length,
  pch=16
)
```

---

## 366. 371-custom-dots-beeswarm

**Файл:** `371-custom-dots-beeswarm_4.R`

```r
beeswarm(
  iris$Sepal.Length,
  cex=2.5
)
```

---

## 367. 371-custom-dots-beeswarm

**Файл:** `371-custom-dots-beeswarm_5.R`

```r
beeswarm(
  iris$Sepal.Length,
  method="center",
  cex=2 # make the dots bigger
)
```

---

## 368. 372-grouped-beeswarm

**Файл:** `372-grouped-beeswarm_1.R`

```r
# install.packages("beeswarm")
library(beeswarm)
```

---

## 369. 372-grouped-beeswarm

**Файл:** `372-grouped-beeswarm_2.R`

```r
beeswarm(
  Sepal.Length ~ Species,
  data=iris
)
```

---

## 370. 372-grouped-beeswarm

**Файл:** `372-grouped-beeswarm_3.R`

```r
beeswarm(
  Sepal.Length ~ Species, 
  data=iris,
  col=c("orange", "lightblue", "magenta"),
  pch = 19 # fill the dots
)
```

---

## 371. 372-grouped-beeswarm

**Файл:** `372-grouped-beeswarm_4.R`

```r
beeswarm(
  Sepal.Length ~ Species, 
  data=iris,
  col=c("orange", "lightblue", "magenta"),
  pch = 19, # fill the dots
  corral = "gutter"
)
```

---

## 372. 373-basic-beeswarm-with-ggbeeswarm

**Файл:** `373-basic-beeswarm-with-ggbeeswarm_1.R`

```r
# install.packages("ggbeeswarm")
library(ggbeeswarm)
library(ggplot2)
```

---

## 373. 373-basic-beeswarm-with-ggbeeswarm

**Файл:** `373-basic-beeswarm-with-ggbeeswarm_2.R`

```r
ggplot(iris,aes(y=Sepal.Length,x='')) +
  geom_beeswarm()
```

---

## 374. 373-basic-beeswarm-with-ggbeeswarm

**Файл:** `373-basic-beeswarm-with-ggbeeswarm_3.R`

```r
ggplot(iris,aes(x=Sepal.Length,y='')) +
  geom_beeswarm()
```

---

## 375. 373-basic-beeswarm-with-ggbeeswarm

**Файл:** `373-basic-beeswarm-with-ggbeeswarm_4.R`

```r
ggplot(iris,aes(y=Sepal.Length,x='')) +
  geom_beeswarm(color='blue') +
  theme_minimal()
```

---

## 376. 373-basic-beeswarm-with-ggbeeswarm

**Файл:** `373-basic-beeswarm-with-ggbeeswarm_5.R`

```r
ggplot(iris,aes(y=Sepal.Length,x='')) +
  geom_beeswarm(method='center')
```

---

## 377. 374-grouped-beeswarm-with-ggbeeswarm

**Файл:** `374-grouped-beeswarm-with-ggbeeswarm_1.R`

```r
# install.packages("ggbeeswarm")
library(ggbeeswarm)
library(ggplot2)
```

---

## 378. 374-grouped-beeswarm-with-ggbeeswarm

**Файл:** `374-grouped-beeswarm-with-ggbeeswarm_2.R`

```r
ggplot(iris,aes(x=Species, y=Sepal.Length)) +
  geom_beeswarm()
```

---

## 379. 374-grouped-beeswarm-with-ggbeeswarm

**Файл:** `374-grouped-beeswarm-with-ggbeeswarm_3.R`

```r
ggplot(iris,aes(x=Species, y=Sepal.Length, colour=Species)) +
  geom_beeswarm()
```

---

## 380. 374-grouped-beeswarm-with-ggbeeswarm

**Файл:** `374-grouped-beeswarm-with-ggbeeswarm_4.R`

```r
ggplot(iris,aes(x=Species, y=Sepal.Length, colour=Species)) +
  geom_beeswarm() +
  scale_color_manual(values=c("#999999", "#E69F00", "#56B4E9")) +
  theme_minimal()
```

---

## 381. 4-barplot-with-error-bar

**Файл:** `4-barplot-with-error-bar_1.R`

```r
# Load ggplot2
library(ggplot2)

# create dummy data
data <- data.frame(
  name=letters[1:5],
  value=sample(seq(4,15),5),
  sd=c(1,0.2,3,2,4)
)
 
# Most basic error bar
ggplot(data) +
    geom_bar( aes(x=name, y=value), stat="identity", fill="skyblue", alpha=0.7) +
    geom_errorbar( aes(x=name, ymin=value-sd, ymax=value+sd), width=0.4, colour="orange", alpha=0.9, size=1.3)
```

---

## 382. 4-barplot-with-error-bar

**Файл:** `4-barplot-with-error-bar_2.R`

```r
# Load ggplot2
library(ggplot2)

# create dummy data
data <- data.frame(
  name=letters[1:5],
  value=sample(seq(4,15),5),
  sd=c(1,0.2,3,2,4)
)

# rectangle
ggplot(data) +
  geom_bar( aes(x=name, y=value), stat="identity", fill="skyblue", alpha=0.5) +
  geom_crossbar( aes(x=name, y=value, ymin=value-sd, ymax=value+sd), width=0.4, colour="orange", alpha=0.9, size=1.3)
 
# line
ggplot(data) +
  geom_bar( aes(x=name, y=value), stat="identity", fill="skyblue", alpha=0.5) +
  geom_linerange( aes(x=name, ymin=value-sd, ymax=value+sd), colour="orange", alpha=0.9, size=1.3)

# line + dot
ggplot(data) +
  geom_bar( aes(x=name, y=value), stat="identity", fill="skyblue", alpha=0.5) +
  geom_pointrange( aes(x=name, y=value, ymin=value-sd, ymax=value+sd), colour="orange", alpha=0.9, size=1.3)
 
# horizontal
ggplot(data) +
  geom_bar( aes(x=name, y=value), stat="identity", fill="skyblue", alpha=0.5) +
  geom_errorbar( aes(x=name, ymin=value-sd, ymax=value+sd), width=0.4, colour="orange", alpha=0.9, size=1.3) +
  coord_flip()
```

---

## 383. 4-barplot-with-error-bar

**Файл:** `4-barplot-with-error-bar_3.R`

```r
vec=c(1,3,5,9,38,7,2,4,9,19,19)
```

---

## 384. 4-barplot-with-error-bar

**Файл:** `4-barplot-with-error-bar_4.R`

```r
sd <- sd(vec)
sd <- sqrt(var(vec))
```

---

## 385. 4-barplot-with-error-bar

**Файл:** `4-barplot-with-error-bar_5.R`

```r
se = sd(vec) / sqrt(length(vec))
```

---

## 386. 4-barplot-with-error-bar

**Файл:** `4-barplot-with-error-bar_6.R`

```r
alpha=0.05
t=qt((1-alpha)/2 + .5, length(vec)-1)   # tend to 1.96 if sample size is big enough
CI=t*se
```

---

## 387. 4-barplot-with-error-bar

**Файл:** `4-barplot-with-error-bar_7.R`

```r
# Load ggplot2
library(ggplot2)
library(dplyr)

# Data
data <- iris %>% select(Species, Sepal.Length) 
 
# Calculates mean, sd, se and IC
my_sum <- data %>%
  group_by(Species) %>%
  summarise( 
    n=n(),
    mean=mean(Sepal.Length),
    sd=sd(Sepal.Length)
  ) %>%
  mutate( se=sd/sqrt(n))  %>%
  mutate( ic=se * qt((1-0.05)/2 + .5, n-1))
 
# Standard deviation
ggplot(my_sum) +
  geom_bar( aes(x=Species, y=mean), stat="identity", fill="forestgreen", alpha=0.5) +
  geom_errorbar( aes(x=Species, ymin=mean-sd, ymax=mean+sd), width=0.4, colour="orange", alpha=0.9, size=1.5) +
  ggtitle("using standard deviation")
 
# Standard Error
ggplot(my_sum) +
  geom_bar( aes(x=Species, y=mean), stat="identity", fill="forestgreen", alpha=0.5) +
  geom_errorbar( aes(x=Species, ymin=mean-se, ymax=mean+se), width=0.4, colour="orange", alpha=0.9, size=1.5) +
  ggtitle("using standard error")
 
# Confidence Interval
ggplot(my_sum) +
  geom_bar( aes(x=Species, y=mean), stat="identity", fill="forestgreen", alpha=0.5) +
  geom_errorbar( aes(x=Species, ymin=mean-ic, ymax=mean+ic), width=0.4, colour="orange", alpha=0.9, size=1.5) +
  ggtitle("using confidence interval")
```

---

## 388. 4-barplot-with-error-bar

**Файл:** `4-barplot-with-error-bar_8.R`

```r
#Let's build a dataset : height of 10 sorgho and poacee sample in 3 environmental conditions (A, B, C)
data <- data.frame(
  specie=c(rep("sorgho" , 10) , rep("poacee" , 10) ),
  cond_A=rnorm(20,10,4),
  cond_B=rnorm(20,8,3),
  cond_C=rnorm(20,5,4)
)

#Let's calculate the average value for each condition and each specie with the *aggregate* function
bilan <- aggregate(cbind(cond_A,cond_B,cond_C)~specie , data=data , mean)
rownames(bilan) <- bilan[,1]
bilan <- as.matrix(bilan[,-1])
 
#Plot boundaries
lim <- 1.2*max(bilan)

#A function to add arrows on the chart
error.bar <- function(x, y, upper, lower=upper, length=0.1,...){
  arrows(x,y+upper, x, y-lower, angle=90, code=3, length=length, ...)
}
 
#Then I calculate the standard deviation for each specie and condition :
stdev <- aggregate(cbind(cond_A,cond_B,cond_C)~specie , data=data , sd)
rownames(stdev) <- stdev[,1]
stdev <- as.matrix(stdev[,-1]) * 1.96 / 10
 
#I am ready to add the error bar on the plot using my "error bar" function !
ze_barplot <- barplot(bilan , beside=T , legend.text=T,col=c("blue" , "skyblue") , ylim=c(0,lim) , ylab="height")
error.bar(ze_barplot,bilan, stdev)
```

---

## 389. 405-very-basic-waffle

**Файл:** `405-very-basic-waffle_1.R`

```r
# library
#install.packages("waffle")
library(waffle)
 
# Create data
group <- c("group-1","group-2","group-3")
value <- c(13,5,22)
data <- data.frame(group,value)
```

---

## 390. 405-very-basic-waffle

**Файл:** `405-very-basic-waffle_2.R`

```r
waffle(data, rows = 5)
```

---

## 391. 405-very-basic-waffle

**Файл:** `405-very-basic-waffle_3.R`

```r
waffle(data, rows = 5, colors = c("#fb5607", "#ff006e", "#8338ec"))
```

---

## 392. 405-very-basic-waffle

**Файл:** `405-very-basic-waffle_4.R`

```r
waffle(data, rows = 5, colors = c("#fb5607", "#ff006e", "#8338ec"), legend_pos = "bottom")
```

---

## 393. 406-geom-waffle-introduction

**Файл:** `406-geom-waffle-introduction_1.R`

```r
# library
#install.packages("waffle")
library(waffle)
 
# Create data
group <- c("group-1","group-2","group-3")
value <- c(13,5,22)
data <- data.frame(group,value)
```

---

## 394. 406-geom-waffle-introduction

**Файл:** `406-geom-waffle-introduction_2.R`

```r
ggplot(data, aes(fill=group, values=value)) +
  geom_waffle() +
  theme_void()
```

---

## 395. 406-geom-waffle-introduction

**Файл:** `406-geom-waffle-introduction_3.R`

```r
ggplot(data, aes(fill=group, values=value)) +
  geom_waffle(color = "white") +
  scale_fill_manual(values = c("#999999", "#E69F00", "#56B4E9")) +
  theme_void()
```

---

## 396. 406-geom-waffle-introduction

**Файл:** `406-geom-waffle-introduction_4.R`

```r
ggplot(data, aes(fill=group, values=value)) +
  geom_waffle() +
  scale_fill_manual(
    values = c("#999999", "#E69F00", "#56B4E9"),
    labels = c("First group", "Second group", "Third group")) +
  theme_void()
```

---

## 397. 407-geom-waffle-multiple-groups

**Файл:** `407-geom-waffle-multiple-groups_1.R`

```r
# library
library(waffle)
library(dplyr)
 
# Create data
data <- data.frame(
  group = c("First group", "First group", "First group", "First group",
            "First group", "First group", "Second group", "Second group",
            "Second group", "Second group", "Third group", "Third group"),
  subgroup = c("A", "B", "C", "D", "E", "F", "A", "B", "C", "D", "A", "B"),
  value = c(10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120)
)
```

---

## 398. 407-geom-waffle-multiple-groups

**Файл:** `407-geom-waffle-multiple-groups_2.R`

```r
ggplot(data = data, aes(fill=subgroup, values=value)) +
  geom_waffle(color = "white", size = 1.125, n_rows = 6) +
  facet_wrap(~group, ncol=1) +
  theme_void()
```

---

## 399. 407-geom-waffle-multiple-groups

**Файл:** `407-geom-waffle-multiple-groups_3.R`

```r
ggplot(data = data, aes(fill=subgroup, values=value)) +
  geom_waffle(color = "white", size = 1.125, n_rows = 6) +
  facet_wrap(~group, ncol=1) +
  theme_void() +
  scale_fill_manual(values = c("#69b3a2", "#404080", "#FFA07A", "#FFD700", "#FF6347", "#4682B4"))
```

---

## 400. 408-basic-bump-plot

**Файл:** `408-basic-bump-plot_1.R`

```r
# Library
#install.packages("ggbump")
library(ggbump)
library(tidyverse)

# Create data
year <- rep(2019:2021, 3)
products_sold <- c(
  500, 600, 700,
  550, 650, 600,
  600, 400, 500
)
store <- c(
  "Store A", "Store A", "Store A",
  "Store B", "Store B", "Store B",
  "Store C", "Store C", "Store C"
)

# Create the new dataframe
df <- data.frame(
  year = year,
  products_sold = products_sold,
  store = store
)
```

---

## 401. 408-basic-bump-plot

**Файл:** `408-basic-bump-plot_2.R`

```r
ggplot(df, aes(x = year, y = products_sold, color = store)) +
  geom_bump(size = 2)
```

---

## 402. 408-basic-bump-plot

**Файл:** `408-basic-bump-plot_3.R`

```r
ggplot(df, aes(x = year, y = products_sold, color = store)) +
  geom_bump(size = 2) +
  geom_point(size = 6)
```

---

## 403. 409-customize-bump-plot

**Файл:** `409-customize-bump-plot_1.R`

```r
# Library
#install.packages("ggbump")
library(ggbump)
library(tidyverse)

# Create data
year <- rep(2019:2021, 3)
products_sold <- c(
  500, 600, 700,
  550, 650, 600,
  600, 400, 500
)
store <- c(
  "Store A", "Store A", "Store A",
  "Store B", "Store B", "Store B",
  "Store C", "Store C", "Store C"
)

# Create the new dataframe
df <- data.frame(
  year = year,
  products_sold = products_sold,
  store = store
)
```

---

## 404. 409-customize-bump-plot

**Файл:** `409-customize-bump-plot_2.R`

```r
ggplot(df, aes(x = year, y = products_sold, color = store)) +
  geom_bump(size = 2) +
  geom_point(size = 6)
```

---

## 405. 409-customize-bump-plot

**Файл:** `409-customize-bump-plot_3.R`

```r
ggplot(df, aes(x = year, y = products_sold, color = store)) +
  geom_bump(size = 2) +
  geom_point(size = 6) +
  scale_color_brewer(palette = "Paired") +
  theme_minimal()
```

---

## 406. 409-customize-bump-plot

**Файл:** `409-customize-bump-plot_4.R`

```r
ggplot(df, aes(x = year, y = products_sold, color = store)) +
  geom_bump(size = 2) +
  geom_point(size = 6) +
  geom_text(aes(label = store), nudge_y = 20, fontface = "bold", size=3) +
  scale_color_brewer(palette = "Paired") +
  theme_minimal() +
  labs(
    title = "Products sold per store",
    x = "Year",
    y = "Products sold"
  )
```

---

## 407. 412-customize-css-in-interactive-ggiraph

**Файл:** `412-customize-css-in-interactive-ggiraph_1.R`

```r
# library
library(ggplot2)
library(ggiraph)
library(tidyverse)

# Create data
data <- read.csv("https://raw.githubusercontent.com/holtzy/R-graph-gallery/master/DATA/dataConsumerConfidence.csv") %>%
  mutate(date = lubridate::my(Time)) %>%
  select(-Time) %>%
  pivot_longer(!date, names_to = "country", values_to = "value") %>%
  na.omit() %>%
  mutate(country = as.factor(country))
```

---

## 408. 412-customize-css-in-interactive-ggiraph

**Файл:** `412-customize-css-in-interactive-ggiraph_2.R`

```r
plot <- data %>%
  ggplot(mapping = aes(
    x = date,
    y = value,
    color = country,
    tooltip = country,
    data_id = country
  )) +
  geom_line_interactive(hover_nearest = TRUE) +
  theme_classic()

interactive_plot <- girafe(ggobj = plot)
htmltools::save_html(interactive_plot, "HtmlWidget/geom-line-interactive-1.html")
```

---

## 409. 412-customize-css-in-interactive-ggiraph

**Файл:** `412-customize-css-in-interactive-ggiraph_3.R`

```r
plot <- data %>%
  ggplot(mapping = aes(
    x = date,
    y = value,
    color = country,
    tooltip = country,
    data_id = country
  )) +
  geom_line_interactive(hover_nearest = TRUE) +
  theme_classic()

interactive_plot <- girafe(ggobj = plot)

interactive_plot <- girafe_options(
  interactive_plot,
  opts_hover(css = "fill:#ffe7a6;stroke:black;cursor:pointer;"),
  opts_selection(type = "single", css = "fill:red;stroke:black;"),
  opts_toolbar(saveaspng = FALSE)
)
htmltools::save_html(interactive_plot, "HtmlWidget/geom-line-interactive-2.html")
```

---

## 410. 412-customize-css-in-interactive-ggiraph

**Файл:** `412-customize-css-in-interactive-ggiraph_4.R`

```r
library(hrbrthemes) # for the `theme_ipsum()`

plot <- data %>%
  ggplot(mapping = aes(
    x = date,
    y = value,
    color = country,
    tooltip = country,
    data_id = country
  )) +
  geom_line_interactive(hover_nearest = TRUE) +
  theme_ipsum()

interactive_plot <- girafe(ggobj = plot)

interactive_plot <- girafe_options(
  interactive_plot,
  opts_hover(css = "stroke:#69B3A2; stroke-width: 3px; transition: all 0.3s ease;"),
  opts_hover_inv("opacity:0.5;filter:saturate(10%);"),
  opts_toolbar(saveaspng = FALSE)
)
htmltools::save_html(interactive_plot, "HtmlWidget/geom-line-interactive-3.html")
```

---

## 411. 412-customize-css-in-interactive-ggiraph

**Файл:** `412-customize-css-in-interactive-ggiraph_5.R`

```r
plot <- data %>%
  ggplot(mapping = aes(
    x = date,
    y = value,
    color = country,
    tooltip = country,
    data_id = country
  )) +
  geom_line_interactive(hover_nearest = TRUE) +
  theme_classic()

interactive_plot <- girafe(ggobj = plot)

hover_css <- "
  fill: #ffe7a6;
  fill-opacity: 0.5;
  stroke: black;
  stroke-width: 7px;
  stroke-dasharray: 5,5;
  transition: fill-opacity 0.5s, stroke-width 0.5s, stroke-dasharray 0.5s, filter 0.5s;
  filter: drop-shadow(0 0 5px rgba(0,0,0,0.5));
"

interactive_plot <- girafe_options(
  interactive_plot,
  opts_hover(css = hover_css),
  opts_toolbar(saveaspng = FALSE)
)
htmltools::save_html(interactive_plot, "HtmlWidget/geom-line-interactive-4.html")
```

---

## 412. 412-customize-css-in-interactive-ggiraph

**Файл:** `412-customize-css-in-interactive-ggiraph_6.R`

```r
plot <- data %>%
  ggplot(mapping = aes(
    x = date,
    y = value,
    color = country,
    group = country,
    tooltip = paste("Country:", country, "<br>Date:", date, "<br>Value:", round(value, 2)),
    data_id = country
  )) +
  geom_line_interactive(size = 1.2, hover_nearest = TRUE) +
  geom_point_interactive(aes(size = value), alpha = 0.7) +
  scale_color_viridis_d() +
  scale_size_continuous(range = c(1, 2)) +
  theme_minimal(base_size = 14) +
  labs(
    title = "Interactive Country Data Visualization",
    subtitle = "Try to hover and click on the lines!",
    caption = "R-Graph-Gallery.com",
    x = "Date",
    y = "Consumer Confidence"
  ) +
  theme(
    plot.title = element_text(hjust = 0.5, size = 20, face = "bold"),
    plot.subtitle = element_text(hjust = 0.5, size = 16, face = "italic"),
    legend.position = "none",
    panel.grid.minor = element_blank(),
    panel.background = element_rect(fill = "ivory", color = NA),
    plot.background = element_rect(fill = "ivory", color = NA)
  )

interactive_plot <- girafe(ggobj = plot)

hover_css <- "
  stroke: black;
  stroke-width: 1px;
  r: 8px;
  transition: all 0.3s ease;
"

tooltip_css <- "
  background-color: #2C3E50;
  color: #ECF0F1;
  padding: 10px;
  border-radius: 5px;
  font-family: 'Arial', sans-serif;
  font-size: 14px;
  box-shadow: 0px 0px 10px rgba(0,0,0,0.5);
"

interactive_plot <- girafe_options(
  interactive_plot,
  opts_hover(css = hover_css),
  opts_tooltip(css = tooltip_css, use_fill = TRUE),
  opts_selection(type = "multiple", only_shiny = FALSE),
  opts_zoom(min = 0.5, max = 2),
  opts_toolbar(saveaspng = TRUE, position = "topright", pngname = "country_data_plot"),
  opts_sizing(rescale = TRUE)
)
htmltools::save_html(interactive_plot, "HtmlWidget/geom-line-interactive-5.html")
```

---

## 413. 414-map-multiple-charts-in-ggiraph

**Файл:** `414-map-multiple-charts-in-ggiraph_1.R`

```r
library(ggiraph) # install.packages('ggiraph')
library(ggplot2) # install.packages('ggplot2')
library(dplyr) # install.packages('dplyr')
library(patchwork) # install.packages('patchwork')
library(tidyr) # install.packages('tidyr')
library(sf) # install.packages('sf')
set.seed(123)
```

---

## 414. 414-map-multiple-charts-in-ggiraph

**Файл:** `414-map-multiple-charts-in-ggiraph_2.R`

```r
library(ggiraph)
library(ggplot2)
library(dplyr)
library(patchwork)

data(mtcars)
mtcars$car <- rownames(mtcars)

# data_id in the aes mapping
p1 <- ggplot(mtcars, aes(wt, mpg, tooltip = car, data_id = car)) +
  geom_point_interactive(size = 4)

# data_id in the aes mapping
p2 <- ggplot(mtcars, aes(x = reorder(car, mpg), y = mpg, tooltip = car, data_id = car)) +
  geom_col_interactive() +
  coord_flip()

combined_plot <- p1 + p2 + plot_layout(ncol = 2)

interactive_plot <- girafe(ggobj = combined_plot)
htmltools::save_html(interactive_plot, "HtmlWidget/multiple-ggiraph-1.html")
```

---

## 415. 414-map-multiple-charts-in-ggiraph

**Файл:** `414-map-multiple-charts-in-ggiraph_3.R`

```r
# Read the full world map
world_sf <- read_sf("https://raw.githubusercontent.com/holtzy/R-graph-gallery/master/DATA/world.geojson")
world_sf <- world_sf %>%
  filter(!name %in% c("Antarctica", "Greenland"))

# Create a sample dataset
happiness_data <- data.frame(
  Country = c(
    "France", "Germany", "United Kingdom",
    "Japan", "China", "Vietnam",
    "United States of America", "Canada", "Mexico"
  ),
  Continent = c(
    "Europe", "Europe", "Europe",
    "Asia", "Asia", "Asia",
    "North America", "North America", "North America"
  ),
  Happiness_Score = rnorm(mean = 30, sd = 20, n = 9),
  GDP_per_capita = rnorm(mean = 30, sd = 20, n = 9),
  Social_support = rnorm(mean = 30, sd = 20, n = 9),
  Healthy_life_expectancy = rnorm(mean = 30, sd = 20, n = 9)
)

# Join the happiness data with the full world map
world_sf <- world_sf %>%
  left_join(happiness_data, by = c("name" = "Country"))
```

---

## 416. 414-map-multiple-charts-in-ggiraph

**Файл:** `414-map-multiple-charts-in-ggiraph_4.R`

```r
# Create the first chart (Scatter plot)
p1 <- ggplot(world_sf, aes(
  GDP_per_capita,
  Happiness_Score,
  tooltip = name,
  data_id = name,
  color = name
)) +
  geom_point_interactive(data = filter(world_sf, !is.na(Happiness_Score)), size = 4) +
  theme_minimal() +
  theme(
    axis.title.x = element_blank(),
    axis.title.y = element_blank(),
    legend.position = "none"
  )

# Create the second chart (Bar plot)
p2 <- ggplot(world_sf, aes(
  x = reorder(name, Happiness_Score),
  y = Happiness_Score,
  tooltip = name,
  data_id = name,
  fill = name
)) +
  geom_col_interactive(data = filter(world_sf, !is.na(Happiness_Score))) +
  coord_flip() +
  theme_minimal() +
  theme(
    axis.title.x = element_blank(),
    axis.title.y = element_blank(),
    legend.position = "none"
  )

# Create the third chart (choropleth)
p3 <- ggplot() +
  geom_sf(data = world_sf, fill = "lightgrey", color = "lightgrey") +
  geom_sf_interactive(
    data = filter(world_sf, !is.na(Happiness_Score)),
    aes(fill = name, tooltip = name, data_id = name)
  ) +
  coord_sf(crs = st_crs(3857)) +
  theme_void() +
  theme(
    axis.title.x = element_blank(),
    axis.title.y = element_blank(),
    legend.position = "none"
  )

# Combine the plots
combined_plot <- (p1 + p2) / p3 + plot_layout(heights = c(1, 2))

# Create the interactive plot
interactive_plot <- girafe(ggobj = combined_plot)
interactive_plot <- girafe_options(
  interactive_plot,
  opts_hover(css = "fill:red;stroke:black;")
)

# save as an html widget
htmltools::save_html(interactive_plot, "HtmlWidget/multiple-ggiraph-2.html")
```

---

## 417. 414-map-multiple-charts-in-ggiraph

**Файл:** `414-map-multiple-charts-in-ggiraph_5.R`

```r
# Create the first chart (Scatter plot)
p1 <- ggplot(world_sf, aes(
  GDP_per_capita,
  Happiness_Score,
  tooltip = name,
  data_id = Continent,
  color = Continent
)) +
  geom_point_interactive(data = filter(world_sf, !is.na(Happiness_Score)), size = 4) +
  theme_minimal() +
  theme(
    axis.title.x = element_blank(),
    axis.title.y = element_blank(),
    legend.position = "none"
  )

# Create the second chart (Bar plot)
p2 <- ggplot(world_sf, aes(
  x = reorder(name, Happiness_Score),
  y = Happiness_Score,
  tooltip = name,
  data_id = Continent,
  fill = Continent
)) +
  geom_col_interactive(data = filter(world_sf, !is.na(Happiness_Score))) +
  coord_flip() +
  theme_minimal() +
  theme(
    axis.title.x = element_blank(),
    axis.title.y = element_blank(),
    legend.position = "none"
  )

# Create the third chart (choropleth)
p3 <- ggplot() +
  geom_sf(data = world_sf, fill = "lightgrey", color = "lightgrey") +
  geom_sf_interactive(
    data = filter(world_sf, !is.na(Happiness_Score)),
    aes(fill = Continent, tooltip = name, data_id = Continent)
  ) +
  coord_sf(crs = st_crs(3857)) +
  theme_void() +
  theme(
    axis.title.x = element_blank(),
    axis.title.y = element_blank(),
    legend.position = "none"
  )

# Combine the plots
combined_plot <- (p1 + p2) / p3 + plot_layout(heights = c(1, 2))

# Create the interactive plot
interactive_plot <- girafe(ggobj = combined_plot)
interactive_plot <- girafe_options(
  interactive_plot,
  opts_hover(css = "fill:red;stroke:black;")
)

# Save the interactive plot
htmltools::save_html(interactive_plot, "HtmlWidget/multiple-ggiraph-3.html")
```

---

## 418. 414-map-multiple-charts-in-ggiraph

**Файл:** `414-map-multiple-charts-in-ggiraph_6.R`

```r
tooltip_css <- "
  border-radius: 12px;
  color: #333;
  background-color: white;
  padding: 10px;
  font-size: 14px;
"

hover_css <- "
  filter: brightness(75%);
  transition: all 0.3s ease;
"

# Add interactivity
interactive_plot <- interactive_plot %>%
  girafe_options(
    opts_hover(css = hover_css),
    opts_tooltip(css = tooltip_css)
  )

# Save the interactive plot
htmltools::save_html(interactive_plot, "HtmlWidget/multiple-ggiraph-4.html")
```

---

## 419. 414-map-multiple-charts-in-ggiraph

**Файл:** `414-map-multiple-charts-in-ggiraph_7.R`

```r
tooltip_css <- "
  background: linear-gradient(145deg, #f0f0f0, #e6e6e6);
  border: none;
  border-radius: 12px;
  box-shadow: 3px 3px 10px #d1d1d1, -3px -3px 10px #ffffff;
  color: #333;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 14px;
  padding: 12px;
  transition: all 0.5s ease-out;
"

hover_css <- "
  filter: brightness(75%);
  cursor: pointer;
  filter: brightness(1.2) drop-shadow(0 0 5px rgba(78, 84, 200, 0.5));
  transition: all 0.5s ease-out;
"

# Add interactivity
interactive_plot <- interactive_plot %>%
  girafe_options(
    opts_hover(css = hover_css),
    opts_tooltip(css = tooltip_css)
  )

# Save the interactive plot
htmltools::save_html(interactive_plot, "HtmlWidget/multiple-ggiraph-5.html")
```

---

## 420. 414-map-multiple-charts-in-ggiraph

**Файл:** `414-map-multiple-charts-in-ggiraph_8.R`

```r
tooltip_css <- "
  border-radius: 12px;
  color: #333;
  background-color: white;
  padding: 10px;
  font-size: 14px;
  transition: all 0.5s ease-out;
"

hover_css <- "
  filter: brightness(75%);
  cursor: pointer;
  transition: all 0.5s ease-out;
  filter: brightness(1.15);
"

# Add interactivity
interactive_plot <- interactive_plot %>%
  girafe_options(
    opts_hover(css = hover_css),
    opts_tooltip(css = tooltip_css),
    opts_hover_inv(css = "opacity:0.3; transition: all 0.2s ease-out;")
  )

# Save the interactive plot
htmltools::save_html(interactive_plot, "HtmlWidget/multiple-ggiraph-6.html")
```

---

## 421. 44-polynomial-curve-fitting

**Файл:** `44-polynomial-curve-fitting_1.R`

```r
x <- runif(300,  min=-10, max=10) 
y <- 0.1*x^3 - 0.5 * x^2 - x + 10 + rnorm(length(x),0,8) 
 
# plot of x and y :
plot(x,y,col=rgb(0.4,0.4,0.8,0.6),pch=16 , cex=1.3) 
 
# Can we find a polynome that fit this function ?
model <- lm(y ~ x + I(x^2) + I(x^3))
 
# I can get the features of this model :
#summary(model)
#model$coefficients
#summary(model)$adj.r.squared
 
# For each value of x, I can get the value of y estimated by the model, and add it to the current plot !
myPredict <- predict( model ) 
ix <- sort(x,index.return=T)$ix
lines(x[ix], myPredict[ix], col=2, lwd=2 )  

# I add the features of the model to the plot
coeff <- round(model$coefficients , 2)
text(3, -70 , paste("Model : ",coeff[1] , " + " , coeff[2] , "*x"  , "+" , coeff[3] , "*x^2" , "+" , coeff[4] , "*x^3" , "\n\n" , "P-value adjusted = ",round(summary(model)$adj.r.squared,2)))
```

---

## 422. 45-confidence-interval-around-polynomial-curve-fitting

**Файл:** `45-confidence-interval-around-polynomial-curve-fitting_1.R`

```r
# We create 2 vectors x and y. It is a polynomial function.
x <- runif(300, min=-30, max=30) 
y <- -1.2*x^3 + 1.1 * x^2 - x + 10 + rnorm(length(x),0,100*abs(x)) 

# Basic plot of x and y :
plot(x,y,col=rgb(0.4,0.4,0.8,0.6), pch=16 , cex=1.3 , xlab="" , ylab="") 

# Can we find a polynome that fit this function ?
model <- lm(y ~ x + I(x^2) + I(x^3))

# I can get the features of this model :
#summary(model)
#model$coefficients
#summary(model)$adj.r.squared

#For each value of x, I can get the value of y estimated by the model, and the confidence interval around this value.
myPredict <- predict( model , interval="predict" )

#Finally, I can add it to the plot using the line and the polygon function with transparency.
ix <- sort(x,index.return=T)$ix
lines(x[ix], myPredict[ix , 1], col=2, lwd=2 )
polygon(c(rev(x[ix]), x[ix]), c(rev(myPredict[ ix,3]), myPredict[ ix,2]), col = rgb(0.7,0.7,0.7,0.4) , border = NA)
```

---

## 423. 48-grouped-barplot-with-ggplot2

**Файл:** `48-grouped-barplot-with-ggplot2_1.R`

```r
# library
library(ggplot2)
 
# create a dataset
specie <- c(rep("sorgho" , 3) , rep("poacee" , 3) , rep("banana" , 3) , rep("triticum" , 3) )
condition <- rep(c("normal" , "stress" , "Nitrogen") , 4)
value <- abs(rnorm(12 , 0 , 15))
data <- data.frame(specie,condition,value)
 
# Grouped
ggplot(data, aes(fill=condition, y=value, x=specie)) + 
    geom_bar(position="dodge", stat="identity")
```

---

## 424. 48-grouped-barplot-with-ggplot2

**Файл:** `48-grouped-barplot-with-ggplot2_2.R`

```r
# library
library(ggplot2)
 
# create a dataset
specie <- c(rep("sorgho" , 3) , rep("poacee" , 3) , rep("banana" , 3) , rep("triticum" , 3) )
condition <- rep(c("normal" , "stress" , "Nitrogen") , 4)
value <- abs(rnorm(12 , 0 , 15))
data <- data.frame(specie,condition,value)
 
# Stacked
ggplot(data, aes(fill=condition, y=value, x=specie)) + 
    geom_bar(position="stack", stat="identity")
```

---

## 425. 48-grouped-barplot-with-ggplot2

**Файл:** `48-grouped-barplot-with-ggplot2_3.R`

```r
# library
library(ggplot2)
 
# create a dataset
specie <- c(rep("sorgho" , 3) , rep("poacee" , 3) , rep("banana" , 3) , rep("triticum" , 3) )
condition <- rep(c("normal" , "stress" , "Nitrogen") , 4)
value <- abs(rnorm(12 , 0 , 15))
data <- data.frame(specie,condition,value)
 
# Stacked + percent
ggplot(data, aes(fill=condition, y=value, x=specie)) + 
    geom_bar(position="fill", stat="identity")
```

---

## 426. 48-grouped-barplot-with-ggplot2

**Файл:** `48-grouped-barplot-with-ggplot2_4.R`

```r
# library
library(ggplot2)
library(viridis)
library(hrbrthemes)

# create a dataset
specie <- c(rep("sorgho" , 3) , rep("poacee" , 3) , rep("banana" , 3) , rep("triticum" , 3) )
condition <- rep(c("normal" , "stress" , "Nitrogen") , 4)
value <- abs(rnorm(12 , 0 , 15))
data <- data.frame(specie,condition,value)
 
# Small multiple
ggplot(data, aes(fill=condition, y=value, x=specie)) + 
    geom_bar(position="stack", stat="identity") +
    scale_fill_viridis(discrete = T) +
    ggtitle("Studying 4 species..") +
    theme_ipsum() +
    xlab("")
```

---

## 427. 48-grouped-barplot-with-ggplot2

**Файл:** `48-grouped-barplot-with-ggplot2_5.R`

```r
# library
library(ggplot2)
library(viridis)
library(hrbrthemes)

# create a dataset
specie <- c(rep("sorgho" , 3) , rep("poacee" , 3) , rep("banana" , 3) , rep("triticum" , 3) )
condition <- rep(c("normal" , "stress" , "Nitrogen") , 4)
value <- abs(rnorm(12 , 0 , 15))
data <- data.frame(specie,condition,value)
 
# Graph
ggplot(data, aes(fill=condition, y=value, x=condition)) + 
    geom_bar(position="dodge", stat="identity") +
    scale_fill_viridis(discrete = T, option = "E") +
    ggtitle("Studying 4 species..") +
    facet_wrap(~specie) +
    theme_ipsum() +
    theme(legend.position="none") +
    xlab("")
```

---

## 428. 5-correlation-of-discrete-variables

**Файл:** `5-correlation-of-discrete-variables_1.R`

```r
#Let's create 2 discrete variables 
a <- c(1,1,3,4,5,5,1,1,2,3,4,1,3,2,1,1,5,1,4,3,2,3,1,0,2)
b <- c(1,2,3,5,5,5,2,1,1,3,4,3,3,4,1,1,4,1,4,2,2,3,0,0,1)
 
#I count the occurence of each couple of values. Eg : number of time a=1 and b=1, number of time a=1 and b=2 etc...
AA <- xyTable(a,b)
 
#Now I can plot this ! I represent the dots as big as the couple occurs often
coeff_bigger <- 2
plot(AA$x , AA$y , cex=AA$number*coeff_bigger  , pch=16 , col=rgb(0,0,1,0.5) , xlab= "value of a" , ylab="value of b" , xlim=c(0,6) , ylim=c(0,6) )
text(AA$x , AA$y , AA$number )
 
#Note : It's easy to make a function that will compute this kind of plot automaticaly :
represent_discrete_variable <- function(var1, var2 , coeff_bigger){
  AA=xyTable(var1,var2)
  plot(AA$x , AA$y , cex=AA$number*coeff_bigger  , pch=16 , col="chocolate1" , xlab= "value of a" , ylab="value of b" )
  text (AA$x , AA$y , AA$number )
}
```

---

## 429. 50-51-52-scatter-plot-with-ggplot2

**Файл:** `50-51-52-scatter-plot-with-ggplot2_1.R`

```r
# Library
library(ggplot2)
library(hrbrthemes)

# Create dummy data
data <- data.frame(
  cond = rep(c("condition_1", "condition_2"), each=10), 
  my_x = 1:100 + rnorm(100,sd=9), 
  my_y = 1:100 + rnorm(100,sd=16) 
)

# Basic scatter plot.
p1 <- ggplot(data, aes(x=my_x, y=my_y)) + 
  geom_point( color="#69b3a2") +
  theme_ipsum()
 
# with linear trend
p2 <- ggplot(data, aes(x=my_x, y=my_y)) +
  geom_point() +
  geom_smooth(method=lm , color="red", se=FALSE) +
  theme_ipsum()

# linear trend + confidence interval
p3 <- ggplot(data, aes(x=my_x, y=my_y)) +
  geom_point() +
  geom_smooth(method=lm , color="red", fill="#69b3a2", se=TRUE) +
  theme_ipsum()
```

---

## 430. 6-graph-parameters-reminder

**Файл:** `6-graph-parameters-reminder_1.R`

```r
# initialization
par(mar=c(3,3,3,3))
num <- 0 ; 
num1 <- 0
plot(0,0 , xlim=c(0,21) , ylim=c(0.5,6.5), col="white" , yaxt="n" , ylab="" , xlab="")
 
#fill the graph
for (i in seq(1,20)){
  points(i,1 , pch=i , cex=3)
  points(i,2 , col=i , pch=16 , cex=3)
  points(i,3 , col="black" , pch=16 , cex=i*0.25)
  
  #lty
  if(i %in% c(seq(1,18,3))){
        num=num+1
    points(c(i,i+2), c(4,4) , col="black" , lty=num , type="l" , lwd=2)
        text(i+1.1 , 4.15 , num)
        }
  
  #type and lwd 
  if(i %in% c(seq(1,20,5))){
    num1=num1+1
    points(c(i,i+1,i+2,i+3), c(5,5,5,5) , col="black"  , type=c("p","l","b","o")[num1] , lwd=2)
    text(i+1.1 , 5.2 , c("p","l","b","o")[num1] )
    points(c(i,i+1,i+2,i+3), c(6,6,6,6) , col="black"  , type="l",  lwd=num1)
    text(i+1.1 , 6.2 , num1 )
 
    }
  }
 
#add axis
axis(2, at = c(1,2,3,4,5,6), labels = c("pch" , "col" , "cex" , "lty", "type" , "lwd" ), 
     tick = TRUE, col = "black", las = 1, cex.axis = 0.8)
```

---

## 431. 70-boxplot-with-categories-on-multiple-lines

**Файл:** `70-boxplot-with-categories-on-multiple-lines_1.R`

```r
# Create 2 vectors
a <- sample(2:24, 20 , replace=T)
b <- sample(4:14, 8 , replace=T)
 
# Make a list of these 2 vectors
C <- list(a,b)
 
# Change the names of the elements of the list :
names(C) <- c(paste("Category 1\n n=" , length(a) , sep=""), paste("Category 2\n n=" , length(b) , sep=""))
 
# Change the mgp argument: avoid text overlaps axis
par(mgp=c(3,2,0))
 
# Final Boxplot
boxplot(C , col="#69b3a2" , ylab="value" )
```

---

## 432. 71-split-screen-with-par-mfrow

**Файл:** `71-split-screen-with-par-mfrow_1.R`

```r
#Create data
a <- seq(1,29)+4*runif(29,0.4)
b <- seq(1,29)^2+runif(29,0.98)
 
#Divide the screen in 2 columns and 2 lines
par(mfrow=c(2,2))
 
#Add a plot in each sub-screen !
plot( a,b , pch=20)
plot(a-b , pch=18)
hist(a, border=F , col=rgb(0.2,0.2,0.8,0.7) , main="")
boxplot(a , col="grey" , xlab="a")
```

---

## 433. 73-box-style-with-the-bty-function

**Файл:** `73-box-style-with-the-bty-function_1.R`

```r
# Cut the screen in 4 parts
par(mfrow=c(2,2))
 
#Create data
a=seq(1,29)+4*runif(29,0.4)
b=seq(1,29)^2+runif(29,0.98)
 
# First graph
par(bty="l")
boxplot(a , col="#69b3a2" , xlab="bottom & left box")
# Second
par(bty="o")
boxplot(b , col="#69b3a2" , xlab="complete box", horizontal=TRUE)
# Third
par(bty="c")
boxplot(a , col="#69b3a2" , xlab="up & bottom & left box", width=0.5)
# Fourth
par(bty="n")
boxplot(a , col="#69b3a2" , xlab="no box")
```

---

## 434. 75-split-screen-with-layout

**Файл:** `75-split-screen-with-layout_1.R`

```r
# Dummy data
a <- seq(129,1)+4*runif(129,0.4)
b <- seq(1,129)^2+runif(129,0.98)
 
# Create the layout
nf <- layout( matrix(c(1,2), ncol=1) )

# Fill with plots
hist(a , breaks=30 , border=F , col=rgb(0.1,0.8,0.3,0.5) , xlab="distribution of a" , main="")
boxplot(a , xlab="a" , col=rgb(0.8,0.8,0.3,0.5) , las=2)
```

---

## 435. 75-split-screen-with-layout

**Файл:** `75-split-screen-with-layout_2.R`

```r
# Dummy data
a <- seq(129,1)+4*runif(129,0.4)
b <- seq(1,129)^2+runif(129,0.98)
 
# Create the layout
nf <- layout( matrix(c(1,2), ncol=2) )

# Fill with plots
hist(a , breaks=30 , border=F , col=rgb(0.1,0.8,0.3,0.5) , xlab="distribution of a" , main="")
boxplot(a , xlab="a" , col=rgb(0.8,0.8,0.3,0.5) , las=2)
```

---

## 436. 75-split-screen-with-layout

**Файл:** `75-split-screen-with-layout_3.R`

```r
# Dummy data
a <- seq(129,1)+4*runif(129,0.4)
b <- seq(1,129)^2+runif(129,0.98)
 
# Create the layout
nf <- layout( matrix(c(1,1,2,3), nrow=2, byrow=TRUE) )

# Fill with plots
hist(a , breaks=30 , border=F , col=rgb(0.1,0.8,0.3,0.5) , xlab="distribution of a" , main="")
boxplot(a , xlab="a" , col=rgb(0.8,0.8,0.3,0.5) , las=2)
boxplot(b , xlab="b" , col=rgb(0.4,0.2,0.3,0.5) , las=2)
```

---

## 437. 75-split-screen-with-layout

**Файл:** `75-split-screen-with-layout_4.R`

```r
# Dummy data
a <- seq(129,1)+4*runif(129,0.4)
b <- seq(1,129)^2+runif(129,0.98)
 
# Set the layout
nf <- layout(
  matrix(c(1,1,2,3), ncol=2, byrow=TRUE), 
  widths=c(3,1), 
  heights=c(2,2)
)

#Add the plots
hist(a , breaks=30 , border=F , col=rgb(0.1,0.8,0.3,0.5) , xlab="distribution of a" , main="")
boxplot(a , xlab="a" , col=rgb(0.8,0.8,0.3,0.5) , las=2)
boxplot(b , xlab="b" , col=rgb(0.4,0.2,0.3,0.5) , las=2)
```

---

## 438. 76_split_screen_function

**Файл:** `76_split_screen_function_1.R`

```r
#Create data
a <- seq(1,29)+4*runif(29,0.4)
b <- seq(1,29)^2+runif(29,0.98)
 
# I divide the screen in 2 line and 1 column only
my_screen_step1 <- split.screen(c(2, 1))
 
# I add one graph on the screen number 1 which is on top :
screen(my_screen_step1[1])
plot( a,b , pch=20 , xlab="value of a" , cex=3 , col=rgb(0.4,0.9,0.8,0.5) )
 
 
# I divide the second screen in 2 columns :
my_screen_step2 <- split.screen(c(1, 2), screen = my_screen_step1[2])
screen(my_screen_step2[1])
hist(a, border=F , col=rgb(0.2,0.2,0.8,0.7) , main="" , xlab="distribution of a")
screen(my_screen_step2[2])
hist(b, border=F , col=rgb(0.8,0.2,0.8,0.7) , main="" ,  xlab="distribution of b")
```

---

## 439. 77-turn-y-axis-upside-down

**Файл:** `77-turn-y-axis-upside-down_1.R`

```r
# Create data
x <- seq(1,29)^2+runif(29,0.98)
y <- abs(seq(1,29)+4*runif(29,0.4))

# Make the plotwith ylim in reverse
plot(y~x , ylim = rev(range(y)) ,
     lwd=4 , type="l" , bty="n" , ylab="value of y (decreasing)" , col=rgb(0.2,0.4,0.6,0.8) )

#Add the grey lines
abline(v=seq(0,900,100) , col="grey" , lwd=0.6)
```

---

## 440. 79-levelplot-with-ggplot2

**Файл:** `79-levelplot-with-ggplot2_1.R`

```r
# Library
library(ggplot2)

# Dummy data
x <- LETTERS[1:20]
y <- paste0("var", seq(1,20))
data <- expand.grid(X=x, Y=y)
data$Z <- runif(400, 0, 5)
 
# Heatmap 
ggplot(data, aes(X, Y, fill= Z)) + 
  geom_tile()
```

---

## 441. 79-levelplot-with-ggplot2

**Файл:** `79-levelplot-with-ggplot2_2.R`

```r
# Library
library(ggplot2)
library(hrbrthemes)

# Dummy data
x <- LETTERS[1:20]
y <- paste0("var", seq(1,20))
data <- expand.grid(X=x, Y=y)
data$Z <- runif(400, 0, 5)
 
# Give extreme colors:
ggplot(data, aes(X, Y, fill= Z)) + 
  geom_tile() +
  scale_fill_gradient(low="white", high="blue") +
  theme_ipsum()

# Color Brewer palette
ggplot(data, aes(X, Y, fill= Z)) + 
  geom_tile() +
  scale_fill_distiller(palette = "RdPu") +
  theme_ipsum()

# Color Brewer palette
library(viridis)
ggplot(data, aes(X, Y, fill= Z)) + 
  geom_tile() +
  scale_fill_viridis(discrete=FALSE) +
  theme_ipsum()
```

---

## 442. 79-levelplot-with-ggplot2

**Файл:** `79-levelplot-with-ggplot2_3.R`

```r
# Library
library(ggplot2)
library(tidyr)
library(tibble)
library(hrbrthemes)
library(dplyr)

# Volcano dataset
#volcano

# Heatmap 
volcano %>%
  
  # Data wrangling
  as_tibble() %>%
  rowid_to_column(var="X") %>%
  gather(key="Y", value="Z", -1) %>%
  
  # Change Y to numeric
  mutate(Y=as.numeric(gsub("V","",Y))) %>%

  # Viz
  ggplot(aes(X, Y, fill= Z)) + 
    geom_tile() +
    theme_ipsum() +
    theme(legend.position="none")
```

---

## 443. 79-levelplot-with-ggplot2

**Файл:** `79-levelplot-with-ggplot2_4.R`

```r
# Library
library(ggplot2)
library(hrbrthemes)
library(plotly)

# Dummy data
x <- LETTERS[1:20]
y <- paste0("var", seq(1,20))
data <- expand.grid(X=x, Y=y)
data$Z <- runif(400, 0, 5)
 
# new column: text for tooltip:
data <- data %>%
  mutate(text = paste0("x: ", x, "\n", "y: ", y, "\n", "Value: ",round(Z,2), "\n", "What else?"))

# classic ggplot, with text in aes
p <- ggplot(data, aes(X, Y, fill= Z, text=text)) + 
  geom_tile() +
  theme_ipsum()

ggplotly(p, tooltip="text")

# save the widget
# library(htmlwidgets)
# saveWidget(pp, file=paste0( getwd(), "/HtmlWidget/ggplotlyHeatmap.html"))
```

---

## 444. 81-barplot-with-variable-width

**Файл:** `81-barplot-with-variable-width_1.R`

```r
# Load ggplot2
library(ggplot2)
library(hrbrthemes) # for style

# make data
data <- data.frame(
  group=c("A ","B ","C ","D ") , 
  value=c(33,62,56,67) , 
  number_of_obs=c(100,500,459,342)
)
 
# Calculate the future positions on the x axis of each bar (left border, central position, right border)
data$right <- cumsum(data$number_of_obs) + 30*c(0:(nrow(data)-1))
data$left <- data$right - data$number_of_obs 
 
# Plot
ggplot(data, aes(ymin = 0)) + 
    geom_rect(aes(xmin = left, xmax = right, ymax = value, colour = group, fill = group)) +
    xlab("number of obs") + 
    ylab("value") +
    theme_ipsum() +
    theme(legend.position="none")
```

---

## 445. 82-boxplot-on-top-of-histogram

**Файл:** `82-boxplot-on-top-of-histogram_1.R`

```r
# Create data 
my_variable=c(rnorm(1000 , 0 , 2) , rnorm(1000 , 9 , 2))
 
# Layout to split the screen
layout(mat = matrix(c(1,2),2,1, byrow=TRUE),  height = c(1,8))
 
# Draw the boxplot and the histogram 
par(mar=c(0, 3.1, 1.1, 2.1))
boxplot(my_variable , horizontal=TRUE , ylim=c(-10,20), xaxt="n" , col=rgb(0.8,0.8,0,0.5) , frame=F)
par(mar=c(4, 3.1, 1.1, 2.1))
hist(my_variable , breaks=40 , col=rgb(0.2,0.8,0.5,0.5) , border=F , main="" , xlab="value of the variable", xlim=c(-10,20))
```

---

## 446. 83-histogram-with-colored-tail

**Файл:** `83-histogram-with-colored-tail_1.R`

```r
# Create data
my_variable=rnorm(2000, 0 , 10)
 
# Calculate histogram, but do not draw it
my_hist=hist(my_variable , breaks=40  , plot=F)
 
# Color vector
my_color= ifelse(my_hist$breaks < -10, rgb(0.2,0.8,0.5,0.5) , ifelse (my_hist$breaks >=10, "purple", rgb(0.2,0.2,0.2,0.2) ))
 
# Final plot
plot(my_hist, col=my_color , border=F , main="" , xlab="value of the variable", xlim=c(-40,40) )
```

---

## 447. 84-tukey-test

**Файл:** `84-tukey-test_1.R`

```r
# library
library(multcompView)
 
# Create data
set.seed(1)
treatment <- rep(c("A", "B", "C", "D", "E"), each=20) 
value=c( sample(2:5, 20 , replace=T) , sample(6:10, 20 , replace=T), sample(1:7, 20 , replace=T), sample(3:10, 20 , replace=T) , sample(10:20, 20 , replace=T) )
data=data.frame(treatment,value)
 
# What is the effect of the treatment on the value ?
model=lm( data$value ~ data$treatment )
ANOVA=aov(model)
 
# Tukey test to study each pair of treatment :
TUKEY <- TukeyHSD(x=ANOVA, 'data$treatment', conf.level=0.95)
 
# Tuckey test representation :
plot(TUKEY , las=1 , col="brown")
```

---

## 448. 84-tukey-test

**Файл:** `84-tukey-test_2.R`

```r
# I need to group the treatments that are not different each other together.
generate_label_df <- function(TUKEY, variable){
 
     # Extract labels and factor levels from Tukey post-hoc 
     Tukey.levels <- TUKEY[[variable]][,4]
     Tukey.labels <- data.frame(multcompLetters(Tukey.levels)['Letters'])
     
     #I need to put the labels in the same order as in the boxplot :
     Tukey.labels$treatment=rownames(Tukey.labels)
     Tukey.labels=Tukey.labels[order(Tukey.labels$treatment) , ]
     return(Tukey.labels)
     }
 
# Apply the function on my dataset
LABELS <- generate_label_df(TUKEY , "data$treatment")
 
 
# A panel of colors to draw each group with the same color :
my_colors <- c( 
  rgb(143,199,74,maxColorValue = 255),
  rgb(242,104,34,maxColorValue = 255), 
  rgb(111,145,202,maxColorValue = 255)
  )
 
# Draw the basic boxplot
a <- boxplot(data$value ~ data$treatment , ylim=c(min(data$value) , 1.1*max(data$value)) , col=my_colors[as.numeric(LABELS[,1])] , ylab="value" , main="")
 
# I want to write the letter over each box. Over is how high I want to write it.
over <- 0.1*max( a$stats[nrow(a$stats),] )
 
#Add the labels
text( c(1:nlevels(data$treatment)) , a$stats[nrow(a$stats),]+over , LABELS[,1]  , col=my_colors[as.numeric(LABELS[,1])] )
```

---

## 449. 89-box-and-scatter-plot-with-ggplot2

**Файл:** `89-box-and-scatter-plot-with-ggplot2_1.R`

```r
# Libraries
library(tidyverse)
library(hrbrthemes)
library(viridis)

# create a dataset
data <- data.frame(
  name=c( rep("A",500), rep("B",500), rep("B",500), rep("C",20), rep('D', 100)  ),
  value=c( rnorm(500, 10, 5), rnorm(500, 13, 1), rnorm(500, 18, 1), rnorm(20, 25, 4), rnorm(100, 12, 1) )
)

# Plot
data %>%
  ggplot( aes(x=name, y=value, fill=name)) +
    geom_boxplot() +
    scale_fill_viridis(discrete = TRUE, alpha=0.6) +
    geom_jitter(color="black", size=0.4, alpha=0.9) +
    theme_ipsum() +
    theme(
      legend.position="none",
      plot.title = element_text(size=11)
    ) +
    ggtitle("A boxplot with jitter") +
    xlab("")
```

---

## 450. 89-box-and-scatter-plot-with-ggplot2

**Файл:** `89-box-and-scatter-plot-with-ggplot2_2.R`

```r
# Boxplot basic
data %>%
  ggplot( aes(x=name, y=value, fill=name)) +
    geom_boxplot() +
    scale_fill_viridis(discrete = TRUE, alpha=0.6, option="A") +
    theme_ipsum() +
    theme(
      legend.position="none",
      plot.title = element_text(size=11)
    ) +
    ggtitle("Basic boxplot") +
    xlab("")

# Violin basic
data %>%
  ggplot( aes(x=name, y=value, fill=name)) +
    geom_violin() +
    scale_fill_viridis(discrete = TRUE, alpha=0.6, option="A") +
    theme_ipsum() +
    theme(
      legend.position="none",
      plot.title = element_text(size=11)
    ) +
    ggtitle("Violin chart") +
    xlab("")
```

---

## 451. 9-ordered-boxplot

**Файл:** `9-ordered-boxplot_1.R`

```r
# Create data : 7 varieties / 20 samples per variety / a numeric value for each sample
variety <- rep( c("soldur", "silur", "lloyd", "pescadou", "X4582", "Dudur", "Classic"), each=20)
note <- c( sample(2:5, 20 , replace=T) , sample(6:10, 20 , replace=T),
        sample(1:7, 30 , replace=T), sample(3:10, 70 , replace=T) )
data <- data.frame(variety, note)
 
# Create a vector named "new_order" containing the desired order
new_order <- with(data, reorder(variety , note, median , na.rm=T))
 
# Draw the boxplot using this new order
boxplot(data$note ~ new_order , ylab="sickness" , col="#69b3a2", boxwex=0.4 , main="")
```

---

## 452. 9-ordered-boxplot

**Файл:** `9-ordered-boxplot_2.R`

```r
#Creating data 
names <- c(rep("A", 20) , rep("B", 20) , rep("C", 20), rep("D", 20))
value <- c( sample(2:5, 20 , replace=T) , sample(6:10, 20 , replace=T), 
       sample(1:7, 20 , replace=T), sample(3:10, 20 , replace=T) )
data <- data.frame(names,value)
 
# Classic boxplot (A-B-C-D order)
# boxplot(data$value ~ data$names)
 
# I reorder the groups order : I change the order of the factor data$names
data$names <- factor(data$names , levels=c("A", "D", "C", "B"))
 
#The plot is now ordered !
boxplot(data$value ~ data$names , col=rgb(0.3,0.5,0.4,0.6) , ylab="value" , 
    xlab="names in desired order")
```

---

## 453. 9-ordered-boxplot

**Файл:** `9-ordered-boxplot_3.R`

```r
# Create dummy data
variety <- rep( c("soldur", "silur", "lloyd", "pescadou", "X4582", "Dudur", "Classic"), each=40)
treatment <- rep(c(rep("high" , 20) , rep("low" , 20)) , 7)
note <- c( rep(c(sample(0:4, 20 , replace=T) , sample(1:6, 20 , replace=T)),2), 
          rep(c(sample(5:7, 20 , replace=T), sample(5:9, 20 , replace=T)),2), 
          c(sample(0:4, 20 , replace=T) , sample(2:5, 20 , replace=T), 
          rep(c(sample(6:8, 20 , replace=T) , sample(7:10, 20 , replace=T)),2) ))
data=data.frame(variety, treatment ,  note)
 
# Reorder varieties (group) (mixing low and high treatments for the calculations)
new_order <- with(data, reorder(variety , note, mean , na.rm=T))
 
# Then I make the boxplot, asking to use the 2 factors : variety (in the good order) AND treatment :
par(mar=c(3,4,3,1))
myplot <- boxplot(note ~ treatment*new_order , data=data  , 
        boxwex=0.4 , ylab="sickness",
        main="sickness of several wheat lines" , 
        col=c("slateblue1" , "tomato") ,  
        xaxt="n")
 
# To add the label of x axis
my_names <- sapply(strsplit(myplot$names , '\\.') , function(x) x[[2]] )
my_names <- my_names[seq(1 , length(my_names) , 2)]
axis(1, 
     at = seq(1.5 , 14 , 2), 
     labels = my_names , 
     tick=FALSE , cex=0.3)

# Add the grey vertical lines
for(i in seq(0.5 , 20 , 2)){ 
  abline(v=i,lty=1, col="grey")
  }
 
# Add a legend
legend("bottomright", legend = c("High treatment", "Low treatment"), 
       col=c("slateblue1" , "tomato"),
       pch = 15, bty = "n", pt.cex = 3, cex = 1.2,  horiz = F, inset = c(0.1, 0.1))
```

---

## 454. 93-parrallel-plot

**Файл:** `93-parrallel-plot_1.R`

```r
# You need the MASS library
library(MASS)
 
# Vector color
my_colors <- colors()[as.numeric(iris$Species)*11]
 
# Make the graph !
parcoord(iris[,c(1:4)] , col= my_colors  )
```

---

## 455. 93-parrallel-plot

**Файл:** `93-parrallel-plot_2.R`

```r
# You need the MASS library
library(MASS)
 
# Vector color
library(RColorBrewer)
palette <- brewer.pal(3, "Set1") 
 my_colors <- palette[as.numeric(iris$Species)]

# Make the graph !
parcoord(iris[,c(1,3,4,2)] , col= my_colors  )
```

---

## 456. 93-parrallel-plot

**Файл:** `93-parrallel-plot_3.R`

```r
# You need the MASS library
library(MASS)
 
# Let's use the Iris dataset as an example
data(iris)
 
# Vector color: red if Setosa, grey otherwise.
isSetosa <- ifelse(iris$Species=="setosa","red","grey")

# Make the graph !
parcoord(iris[,c(1,3,4,2)] , col=isSetosa  )
```

---

## 457. 94-violin-plot

**Файл:** `94-violin-plot_1.R`

```r
# Load the vioplot library
library(vioplot)
 
# Create data
treatment <- c(rep("A", 40) , rep("B", 40) , rep("C", 40) )
value <- c( sample(2:5, 40 , replace=T) , sample(c(1:5,12:17), 40 , replace=T), sample(1:7, 40 , replace=T) )
data <- data.frame(treatment,value)
 
# Draw the plot
with(data , vioplot( 
  value[treatment=="A"] , value[treatment=="B"], value[treatment=="C"],  
  col=rgb(0.1,0.4,0.7,0.7) , names=c("A","B","C") 
))
```

---

## 458. 95-violin-plot-with-ggplot2

**Файл:** `95-violin-plot-with-ggplot2_1.R`

```r
# Library
library(ggplot2)

# create a dataset
data <- data.frame(
  name=c( rep("A",500), rep("B",500), rep("B",500), rep("C",20), rep('D', 100)  ),
  value=c( rnorm(500, 10, 5), rnorm(500, 13, 1), rnorm(500, 18, 1), rnorm(20, 25, 4), rnorm(100, 12, 1) )
)

# Most basic violin chart
p <- ggplot(data, aes(x=name, y=value, fill=name)) + # fill=name allow to automatically dedicate a color for each group
  geom_violin()

#p
```

---

## 459. 95-violin-plot-with-ggplot2

**Файл:** `95-violin-plot-with-ggplot2_2.R`

```r
# Library
library(ggplot2)
library(dplyr)

# Create data
data <- data.frame(
  name=c( rep("A",500), rep("B",500), rep("B",500), rep("C",20), rep('D', 100)  ),
  value=c( rnorm(500, 10, 5), rnorm(500, 13, 1), rnorm(500, 18, 1), rnorm(20, 25, 4), rnorm(100, 12, 1) ) %>% round(2)
)
```

---

## 460. 95-violin-plot-with-ggplot2

**Файл:** `95-violin-plot-with-ggplot2_3.R`

```r
# Basic violin
ggplot(data, aes(x=name, y=value, fill=name)) + 
  geom_violin()
```

---

## 461. 95-violin-plot-with-ggplot2

**Файл:** `95-violin-plot-with-ggplot2_4.R`

```r
# Let's use the iris dataset as an example:
data_wide <- iris[ , 1:4]
```

---

## 462. 95-violin-plot-with-ggplot2

**Файл:** `95-violin-plot-with-ggplot2_5.R`

```r
library(tidyr)
library(ggplot2)
library(dplyr)
data_wide %>% 
  gather(key="MesureType", value="Val") %>%
  ggplot( aes(x=MesureType, y=Val, fill=MesureType)) +
    geom_violin()
```

---

## 463. 96-boxplot-with-jitter

**Файл:** `96-boxplot-with-jitter_1.R`

```r
# Create data
names <- c(rep("A", 80) , rep("B", 50) , rep("C", 70))
value <- c( rnorm(80 , mean=10 , sd=9) , rnorm(50 , mean=2 , sd=15) , rnorm(70 , mean=30 , sd=10) )
data <- data.frame(names,value)
 
# Basic boxplot
boxplot(data$value ~ data$names , col=terrain.colors(4) )
 
# Add data points
mylevels <- levels(data$names)
levelProportions <- summary(data$names)/nrow(data)
for(i in 1:length(mylevels)){
 
  thislevel <- mylevels[i]
  thisvalues <- data[data$names==thislevel, "value"]
   
  # take the x-axis indices and add a jitter, proportional to the N in each level
  myjitter <- jitter(rep(i, length(thisvalues)), amount=levelProportions[i]/2)
  points(myjitter, thisvalues, pch=20, col=rgb(0,0,0,.9)) 
   
}
```

---

## 464. 97-correlation-ellipses

**Файл:** `97-correlation-ellipses_1.R`

```r
# Libraries
library(ellipse)
library(RColorBrewer)
 
# Use of the mtcars data proposed by R
data <- cor(mtcars)
 
# Build a Pannel of 100 colors with Rcolor Brewer
my_colors <- brewer.pal(5, "Spectral")
my_colors <- colorRampPalette(my_colors)(100)
 
# Order the correlation matrix
ord <- order(data[1, ])
data_ord <- data[ord, ord]
plotcorr(data_ord , col=my_colors[data_ord*50+50] , mar=c(1,1,1,1)  )
```

---

## 465. 98-basic-scatterplot-matrix

**Файл:** `98-basic-scatterplot-matrix_1.R`

```r
# Data: numeric variables of the native mtcars dataset
data <- mtcars[ , c(1,3:6)]
 
# Plot
plot(data , pch=20 , cex=1.5 , col="#69b3a2")
```

---

## 466. 99-scatterplot-matrix-car-package

**Файл:** `99-scatterplot-matrix-car-package_1.R`

```r
# Packages
library(car)
library(RColorBrewer) # for the color palette

# Let's use the car dataset natively available in R
data <- mtcars

# Make the plot
my_colors <- brewer.pal(nlevels(as.factor(data$cyl)), "Set2")
scatterplotMatrix(~mpg+disp+drat|cyl, data=data , 
      reg.line="" , smoother="", col=my_colors , 
      smoother.args=list(col="grey") , cex=1.5 , 
      pch=c(15,16,17) , 
      main="Scatter plot with Three Cylinder Options"
      )
```

---

