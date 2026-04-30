# R ggplot2 Example
# This example demonstrates a high-quality, academic publication-ready plot.
# DO NOT copy this code exactly; use it to understand the EXPECTED QUALITY, styling, and syntax.

library(ggplot2)
library(dplyr)
library(ggthemes)

# Ensure modern academic styling
# Assume 'data' is provided in the environment. DO NOT create dummy data unless strictly necessary.
# Create a beautiful, minimalist scatter plot
p <- ggplot(data, aes(x = variable_x, y = variable_y, color = category)) +
  geom_point(alpha = 0.8, size = 3) +
  geom_smooth(method = "lm", se = FALSE, linetype = "dashed", color = "black") +
  scale_color_calc() + # Professional color palette from ggthemes
  theme_minimal(base_size = 14) +
  theme(
    plot.title = element_text(face = "bold", size = 16, margin = margin(b = 10)),
    plot.subtitle = element_text(color = "grey40", size = 12, margin = margin(b = 15)),
    panel.grid.minor = element_blank(),
    panel.grid.major.x = element_blank(),
    legend.position = "bottom",
    legend.title = element_blank()
  ) +
  labs(
    title = "Academic Scatter Plot Example",
    subtitle = "Relationship between X and Y across categories",
    x = "Independent Variable (Units)",
    y = "Dependent Variable (Units)"
  )

# Always save the plot to a PDF file for inclusion in LaTeX
ggsave("figure.pdf", plot = p, width = 8, height = 5, device = cairo_pdf)
