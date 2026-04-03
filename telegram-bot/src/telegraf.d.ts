declare module "telegraf" {
    export class Telegraf {
        constructor(token: string);
        start(handler: (ctx: any) => Promise<void>): void;
        help(handler: (ctx: any) => Promise<void>): void;
        command(name: string, handler: (ctx: any) => Promise<void>): void;
        webhookCallback(path: string, options?: any): any;
        launch(options?: any): Promise<void>;
        stop(reason?: string): void;
        telegram: {
            setWebhook(url: string, options?: any): Promise<void>;
        };
    }
}
