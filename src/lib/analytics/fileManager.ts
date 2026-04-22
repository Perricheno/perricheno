// File Manager for Analytics Data
// Saves files to shared volume with automatic cleanup after 24 hours

import fs from 'fs/promises';
import path from 'path';
import { downloadTextFromStorage } from '@/lib/storage';
import type { AgentUpload } from '@/lib/db';

const ANALYTICS_DIR = '/tmp/analytics-data';
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms

/**
 * Save upload files to shared volume for R/Python compilers
 * Returns map of uploadId -> filepath
 */
export async function saveFilesToDisk(uploads: AgentUpload[]): Promise<Map<string, string>> {
    const fileMap = new Map<string, string>();
    
    // Ensure directory exists
    await fs.mkdir(ANALYTICS_DIR, { recursive: true });
    
    for (const upload of uploads) {
        try {
            // Generate unique filename with timestamp
            const timestamp = Date.now();
            const ext = upload.filename.split('.').pop()?.toLowerCase() || 'csv';
            const safeFilename = `${upload.id}_${timestamp}.${ext}`;
            const filepath = path.join(ANALYTICS_DIR, safeFilename);
            
            let content: string;
            
            // Get content from DB or Storage
            if (upload.text_content) {
                content = upload.text_content;
            } else if (upload.storage_path) {
                // Download from Storage (XLSX will be auto-converted to CSV)
                content = await downloadTextFromStorage(upload.storage_path);
            } else {
                console.warn(`[FileManager] No content for upload ${upload.id}`);
                continue;
            }
            
            // Save to disk
            await fs.writeFile(filepath, content, 'utf-8');
            
            fileMap.set(upload.id, filepath);
            
            console.log(`[FileManager] Saved ${upload.filename} → ${filepath}`);
            
        } catch (e) {
            console.error(`[FileManager] Failed to save ${upload.filename}:`, e);
        }
    }
    
    return fileMap;
}

/**
 * Clean up old files (older than 24 hours)
 */
export async function cleanupOldFiles(): Promise<void> {
    try {
        const files = await fs.readdir(ANALYTICS_DIR);
        const now = Date.now();
        let deletedCount = 0;
        
        for (const file of files) {
            const filepath = path.join(ANALYTICS_DIR, file);
            
            try {
                const stats = await fs.stat(filepath);
                const age = now - stats.mtimeMs;
                
                // Delete if older than 24 hours
                if (age > CLEANUP_INTERVAL) {
                    await fs.unlink(filepath);
                    deletedCount++;
                }
            } catch (e) {
                // File might have been deleted already, ignore
            }
        }
        
        if (deletedCount > 0) {
            console.log(`[FileManager] Cleaned up ${deletedCount} old files`);
        }
    } catch (e) {
        console.error('[FileManager] Cleanup failed:', e);
    }
}

/**
 * Start automatic cleanup task (runs every hour)
 */
export function startCleanupTask(): void {
    // Run cleanup every hour
    setInterval(() => {
        cleanupOldFiles().catch(e => {
            console.error('[FileManager] Scheduled cleanup failed:', e);
        });
    }, 60 * 60 * 1000); // 1 hour
    
    // Run initial cleanup
    cleanupOldFiles().catch(e => {
        console.error('[FileManager] Initial cleanup failed:', e);
    });
    
    console.log('[FileManager] Cleanup task started (runs every hour, deletes files older than 24h)');
}

/**
 * Delete specific files after use
 */
export async function deleteFiles(filepaths: string[]): Promise<void> {
    for (const filepath of filepaths) {
        try {
            await fs.unlink(filepath);
        } catch (e) {
            // Ignore errors (file might not exist)
        }
    }
}
