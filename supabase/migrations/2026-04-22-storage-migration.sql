-- Migration: Add Supabase Storage support for agent_uploads
-- Date: 2026-04-22

-- Step 1: Create storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('agent-uploads', 'agent-uploads', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Add new columns to agent_uploads table
ALTER TABLE agent_uploads
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Step 3: Make text_content nullable (for files stored in Storage)
ALTER TABLE agent_uploads
ALTER COLUMN text_content DROP NOT NULL;

-- Step 4: Create storage policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Policy: Users can upload their own files
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'agent-uploads' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'agent-uploads' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'agent-uploads' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 5: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_uploads_storage_path 
ON agent_uploads(storage_path) 
WHERE storage_path IS NOT NULL;

-- Step 6: Add comment
COMMENT ON COLUMN agent_uploads.storage_path IS 'Path to file in Supabase Storage (for files > 1MB)';
COMMENT ON COLUMN agent_uploads.file_size IS 'File size in bytes';
COMMENT ON COLUMN agent_uploads.mime_type IS 'MIME type of the file';
