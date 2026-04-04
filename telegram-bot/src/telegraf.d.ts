import { Context } from 'telegraf';

declare module 'telegraf' {
    interface Context {
        session: {
            step: string;
            isProcessing: boolean;
            visual: {
                text: string[];
                images: { fileId: string; caption: string }[];
                files: { fileId: string; fileName: string }[];
                title: string;
                lang: 'python' | 'r';
                type?: string;
                chatId?: number;
            };
        };
    }
}
