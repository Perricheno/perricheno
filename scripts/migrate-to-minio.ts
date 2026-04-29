import * as fs from 'fs/promises';
import * as path from 'path';
import * as Minio from 'minio';
import 'dotenv/config';

// Initialize Minio client
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'perricheno_admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'perricheno_minio_pass'
});

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'perricheno-bucket';

async function migrateData() {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads');

    try {
        await fs.access(uploadDir);
    } catch {
        console.log("No data/uploads directory found. Nothing to migrate.");
        return;
    }

    // Function to recursively get all files in a directory
    async function getFiles(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? getFiles(res) : res;
        }));
        return Array.prototype.concat(...files);
    }

    console.log("Reading local files from data/uploads...");
    const files = await getFiles(uploadDir);
    console.log(`Found ${files.length} files to migrate.`);

    // Make sure bucket exists
    try {
        const exists = await minioClient.bucketExists(BUCKET_NAME);
        if (!exists) {
            console.log(`Bucket ${BUCKET_NAME} does not exist, creating...`);
            await minioClient.makeBucket(BUCKET_NAME);
            // Optionally set public read policy here if needed
        }
    } catch (e: any) {
        console.error("Error accessing/creating bucket:", e.message);
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const filePath of files) {
        // Relative path starts exactly inside data/uploads/
        // i.e., userId/filename
        const relativePath = path.relative(uploadDir, filePath).replace(/\\/g, '/');
        
        try {
            // Check if it already exists
            try {
                await minioClient.statObject(BUCKET_NAME, relativePath);
                console.log(`[SKIPPED] ${relativePath} already exists in MinIO.`);
                continue; // Skip uploading if it already exists
            } catch (err: any) {
                // If the error code isn't NotFound, it might be a connectivity issue.
                if (err.code !== 'NotFound' && err.message?.indexOf('NoSuchKey') === -1) {
                     console.error(`Error checking object ${relativePath}:`, err.message);
                }
            }

            console.log(`[UPLOADING] ${relativePath}...`);
            await minioClient.fPutObject(BUCKET_NAME, relativePath, filePath);
            successCount++;
        } catch (e: any) {
            console.error(`[ERROR] Failed to upload ${relativePath}:`, e.message);
            errorCount++;
        }
    }

    console.log(`Migration complete! Successfully uploaded ${successCount} files. Errors: ${errorCount}.`);
}

migrateData()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
