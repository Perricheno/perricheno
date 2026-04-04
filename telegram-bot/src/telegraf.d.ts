import { Context } from 'telegraf';

declare module 'telegraf' {
    interface Context {
        session: {
            step: string;
            visual: {
                text: string[];
                images: { fileId: string; caption: string }[];
                files: { fileId: string; fileName: string }[];
                title: string;
                lang: 'python' | 'r';
                type?: string;
            };
        };
    }
}
