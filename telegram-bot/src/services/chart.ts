/**
 * Service for generating charts from data using QuickChart API (or similar)
 * It takes chart configuration and returns a PNG buffer and the JS code.
 */
export async function generateChartImage(type: 'bar' | 'line' | 'pie', data: any, options: any = {}) {
    const chartConfig = {
        type: type,
        data: data,
        options: {
            title: { display: true, text: options.title || 'Perricheno Analytics' },
            devicePixelRatio: 2,
            ...options
        }
    };

    // QuickChart URL (no API key needed for basic usage, very fast)
    const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
    const chartUrl = `https://quickchart.io/chart?c=${encodedConfig}`;
    
    const response = await fetch(chartUrl);
    const arrayBuffer = await response.arrayBuffer();
    const code = `// Perricheno Chart Generation Code\nconst chartConfig = ${JSON.stringify(chartConfig, null, 2)};`;

    return {
        buffer: Buffer.from(arrayBuffer),
        code: code,
        url: chartUrl
    };
}

/**
 * AI Logic to parse user prompt into chart data
 * Simplified version using our internal endpoint
 */
export async function parsePromptToChart(prompt: string) {
    // In a real scenario, we'd call an LLM here to get the JSON.
    // For now, let's assume a structured mock that extracts numbers and labels.
    console.log(`[AI] Parsing prompt: ${prompt}`);
    
    // Logic for mock/demo purposes:
    if (prompt.includes("доходы") || prompt.includes("money")) {
        return {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr'],
                datasets: [{ label: 'Revenue ($)', data: [1200, 1900, 1500, 2100] }]
            }
        };
    }
    
    return null;
}
