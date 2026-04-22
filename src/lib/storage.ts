// Supabase Storage helper functions for agent uploads
// Handles file uploads, downloads, and deletions

import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'agent-uploads';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Upload a file to Supabase Storage
 * Files are organized by user ID: {userId}/{timestamp}-{filename}
 */
export async function uploadToStorage(
    userId: number,
    file: File
): Promise<{ path: string; publicUrl: string }> {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${userId}/${timestamp}-${sanitizedName}`;
    
    // Upload to Storage
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream'
        });
    
    if (error) {
        console.error('[Storage] Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path);
    
    return {
        path: data.path,
        publicUrl: urlData.publicUrl
    };
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFromStorage(path: string): Promise<void> {
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);
    
    if (error) {
        console.error('[Storage] Delete error:', error);
        throw new Error(`Delete failed: ${error.message}`);
    }
}

/**
 * Get a signed URL for private file access
 * @param path - Storage path
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 */
export async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, expiresIn);
    
    if (error) {
        console.error('[Storage] Signed URL error:', error);
        throw new Error(`Failed to get signed URL: ${error.message}`);
    }
    
    return data.signedUrl;
}

/**
 * Download file content from Storage
 * Used by Analytics Pipeline to process files
 */
export async function downloadFromStorage(path: string): Promise<ArrayBuffer> {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(path);
    
    if (error) {
        console.error('[Storage] Download error:', error);
        throw new Error(`Download failed: ${error.message}`);
    }
    
    return await data.arrayBuffer();
}

/**
 * Download file as text (for CSV, JSON, etc.)
 * Automatically converts XLSX to CSV
 */
export async function downloadTextFromStorage(path: string): Promise<string> {
    const buffer = await downloadFromStorage(path);
    
    // Check if it's an XLSX file
    if (path.match(/\.xlsx?$/i)) {
        try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(buffer, { type: 'array' });
            
            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to CSV
            const csv = XLSX.utils.sheet_to_csv(worksheet);
            
            console.log(`[Storage] Converted XLSX to CSV: ${path} (${csv.length} chars)`);
            return csv;
        } catch (e) {
            console.error('[Storage] XLSX conversion failed:', e);
            // Fallback to text decode
        }
    }
    
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
}

/**
 * Check if file exists in Storage
 */
export async function fileExistsInStorage(path: string): Promise<boolean> {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(path.split('/')[0], {
            search: path.split('/').pop()
        });
    
    if (error) return false;
    return data && data.length > 0;
}

/**
 * Get file metadata from Storage
 */
export async function getFileMetadata(path: string): Promise<{
    size: number;
    mimeType: string;
    lastModified: string;
} | null> {
    try {
        const signedUrl = await getSignedUrl(path, 60);
        const response = await fetch(signedUrl, { method: 'HEAD' });
        
        if (!response.ok) return null;
        
        return {
            size: parseInt(response.headers.get('content-length') || '0'),
            mimeType: response.headers.get('content-type') || 'application/octet-stream',
            lastModified: response.headers.get('last-modified') || new Date().toISOString()
        };
    } catch (e) {
        console.error('[Storage] Metadata error:', e);
        return null;
    }
}
