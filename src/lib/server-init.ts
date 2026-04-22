// Server initialization tasks
// Run once when server starts

import { startCleanupTask } from './analytics/fileManager';

let initialized = false;

export function initializeServer() {
    if (initialized) return;
    
    console.log('[Server] Initializing...');
    
    // Start analytics file cleanup task
    startCleanupTask();
    
    initialized = true;
    console.log('[Server] Initialization complete');
}
