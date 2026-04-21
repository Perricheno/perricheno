// Ambient shims so the editor stops flagging Node globals when
// node_modules isn't installed locally (deploys ship fully-typed).
// On the server these merge with @types/node without conflict.

declare namespace NodeJS {
    interface ProcessEnv {
        [key: string]: string | undefined;
    }
    interface Process {
        env: ProcessEnv;
    }
}

declare const process: NodeJS.Process;
