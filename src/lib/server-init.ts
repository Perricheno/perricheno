// Server initialization tasks
// Run once when server starts

import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { startCleanupTask } from './analytics/fileManager';
import { startTaskScheduler } from './db';

let initialized = false;

export function initializeServer() {
    if (initialized) return;
    // `next build` renders layouts (across several worker processes) to collect
    // page data, which would otherwise start real background timers - hitting
    // the production DB/Telegram bot on every deploy - without ever serving
    // a real request. Skip entirely during the build phase.
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;

    console.log('[Server] Initializing...');

    // Start analytics file cleanup task
    startCleanupTask();

    // Start reminder-notification / stuck-session cleanup polling
    startTaskScheduler();

    initialized = true;
    console.log('[Server] Initialization complete');
}
