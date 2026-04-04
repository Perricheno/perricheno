// Shared Session Store — extracted to its own module to prevent circular dependencies
// between bot.ts and handlers that need access to the store.

export const sessionStore = new Map<number, any>();
