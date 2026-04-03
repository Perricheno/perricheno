declare module "telegraf" {
    export class Telegraf {
        constructor(token: string);
        start(handler: (ctx: any) => Promise<void>): void;
        help(handler: (ctx: any) => Promise<void>): void;
        command(name: string, handler: (ctx: any) => Promise<void>): void;
        action(trigger: string | RegExp, handler: (ctx: any) => Promise<void>): void;
        on(updateType: string, handler: (ctx: any) => Promise<void>): void;
        webhookCallback(path: string, options?: any): any;
        launch(options?: any): Promise<void>;
        stop(reason?: string): void;
        catch(handler: (err: any, ctx: any) => void): void;
        telegram: {
            setWebhook(url: string, options?: any): Promise<void>;
        };
    }

    export const Markup: {
        inlineKeyboard(buttons: any[][]): any;
        button: {
            callback(text: string, data: string): any;
            url(text: string, url: string): any;
        };
    };

    export interface Context {
        from: any;
        message: any;
        callbackQuery: any;
        updateType: string;
        match: any;
        reply(text: string, extra?: any): Promise<any>;
        replyWithPhoto(photo: any, extra?: any): Promise<any>;
        replyWithDocument(doc: any, extra?: any): Promise<any>;
        editMessageText(text: string, extra?: any): Promise<any>;
        answerCbQuery(text?: string): Promise<any>;
        sendChatAction(action: string): Promise<any>;
    }
}
