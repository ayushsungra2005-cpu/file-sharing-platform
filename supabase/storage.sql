-- ==============================================================================
-- Migration: Create private storage bucket 'user-files' and apply Storage RLS
-- Platform: Supabase Storage
-- ==============================================================================

-- 1. Create a private bucket for user files (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-files', 'user-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Storage RLS Policies on storage.objects
-- Rule: The first folder segment in the object path MUST match the user's UUID:
-- Pattern: {user_id}/{filename}

-- Policy 1: SELECT (View / Download)
-- Users can only read objects stored under their own user folder
CREATE POLICY "Users can view only their own storage objects"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'user-files'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy 2: INSERT (Upload)
-- Users can only upload objects into a folder matching their user UUID
CREATE POLICY "Users can upload only into their own storage folder"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'user-files'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy 3: DELETE (Delete)
-- Users can only delete objects inside their own folder
CREATE POLICY "Users can delete only their own storage objects"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'user-files'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
