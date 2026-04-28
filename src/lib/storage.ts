import * as Minio from 'minio';
import path from 'path';

// Define Max file size
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'perricheno_admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'perricheno_minio_pass'
});

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'perricheno-bucket';

export async function uploadToStorage(
    userId: number,
    file: File
): Promise<{ path: string; publicUrl: string }> {
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectName = `${userId}/${timestamp}-${sanitizedName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Put object to MinIO
    await minioClient.putObject(
        BUCKET_NAME,
        objectName,
        buffer,
        buffer.length,
        { 'Content-Type': file.type || 'application/octet-stream' }
    );

    // Using presigned GET URL for 'publicUrl' since bucket might not be entirely public
    const publicUrl = await minioClient.presignedGetObject(BUCKET_NAME, objectName, 24 * 60 * 60);

    return {
        path: objectName,
        publicUrl
    };
}

export async function deleteFromStorage(filePath: string): Promise<void> {
    try {
        await minioClient.removeObject(BUCKET_NAME, filePath);
    } catch (e) {
        console.error('[Storage] Delete error:', e);
    }
}

export async function getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
        return await minioClient.presignedGetObject(BUCKET_NAME, filePath, expiresIn);
    } catch (e) {
        console.error('[Storage] getSignedUrl error:', e);
        return '';
    }
}

export async function downloadFromStorage(filePath: string): Promise<ArrayBuffer> {
    try {
        const dataStream = await minioClient.getObject(BUCKET_NAME, filePath);
        
        return new Promise((resolve, reject) => {
            const chunks: any[] = [];
            dataStream.on('data', (chunk) => chunks.push(chunk));
            dataStream.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
            });
            dataStream.on('error', (err) => reject(err));
        });
    } catch (e: any) {
        throw new Error(`Download failed: ${e.message}`);
    }
}

export async function downloadTextFromStorage(filePath: string): Promise<string> {
    const buffer = await downloadFromStorage(filePath);
    
    if (filePath.match(/\.xlsx?$/i)) {
        try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            return XLSX.utils.sheet_to_csv(worksheet);
        } catch (e) {
            console.error('[Storage] XLSX conversion failed:', e);
        }
    }
    
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
}

export async function fileExistsInStorage(filePath: string): Promise<boolean> {
    try {
        await minioClient.statObject(BUCKET_NAME, filePath);
        return true;
    } catch {
        return false;
    }
}

export async function getFileMetadata(filePath: string): Promise<{
    size: number;
    mimeType: string;
    lastModified: string;
} | null> {
    try {
        const stat = await minioClient.statObject(BUCKET_NAME, filePath);
        
        let mimeType = stat.metaData['content-type'] || 'application/octet-stream';
        // fallback
        if (filePath.endsWith('.csv')) mimeType = 'text/csv';
        if (filePath.endsWith('.json')) mimeType = 'application/json';
        if (filePath.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        
        return {
            size: stat.size,
            mimeType,
            lastModified: stat.lastModified.toISOString()
        };
    } catch (e) {
        return null;
    }
}
