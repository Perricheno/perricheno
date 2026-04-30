# Python Matplotlib/Seaborn Example
# This example demonstrates a high-quality, academic publication-ready plot.
# DO NOT copy this code exactly; use it to understand the EXPECTED QUALITY, styling, and syntax.

import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

# Set academic style (minimalist, clean)
sns.set_theme(style="whitegrid", context="paper", font_scale=1.2)
plt.rcParams["font.family"] = "serif"
plt.rcParams["axes.spines.top"] = False
plt.rcParams["axes.spines.right"] = False

# Assume 'df' is a pandas DataFrame provided in the environment.
fig, ax = plt.subplots(figsize=(8, 5))

# Create a beautiful distribution plot
sns.histplot(data=df, x="value", hue="category", kde=True, 
             palette="deep", alpha=0.6, ax=ax)

ax.set_title("Academic Distribution Plot Example", fontweight="bold", pad=15)
ax.set_xlabel("Value Measurement (Units)")
ax.set_ylabel("Frequency")

# Customize legend
if ax.get_legend():
    ax.get_legend().set_title(None)
    ax.get_legend().set_frame_on(False)

plt.tight_layout()

# Always save the plot to a PDF file for inclusion in LaTeX
plt.savefig("figure.pdf", format="pdf", bbox_inches="tight")
