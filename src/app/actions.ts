"use server";

import fs from "fs/promises";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "src", "data", "settings.json");

export interface ChatSettings {
    webhookTest: string;
    webhookProd: string;
    useTestWebhook: boolean;
    models: string[];
    selectedModel: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
}

const DEFAULTS: ChatSettings = {
    webhookTest: "https://n8n.perricheno.ru/webhook-test/519031b9-1222-44f2-803e-06e0d142c8b1",
    webhookProd: "https://n8n.perricheno.ru/webhook/519031b9-1222-44f2-803e-06e0d142c8b1",
    useTestWebhook: true,
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "claude-3.5-sonnet", "claude-3-haiku", "gemini-2.0-flash"],
    selectedModel: "gpt-4o",
    systemPrompt: "You are a helpful assistant.",
    temperature: 0.7,
    maxTokens: 2000,
};

export async function getSettings(): Promise<ChatSettings> {
    try {
        const data = await fs.readFile(SETTINGS_FILE, "utf-8");
        return { ...DEFAULTS, ...JSON.parse(data) };
    } catch {
        return DEFAULTS;
    }
}

export async function saveSettings(settings: ChatSettings): Promise<void> {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 4), "utf-8");
}
