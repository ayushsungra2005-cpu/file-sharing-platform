-- ==============================================================================
-- Migration: Create files table and configure strict Row Level Security (RLS)
-- Platform: Supabase PostgreSQL
-- ==============================================================================

-- 1. Create the files table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create performance indexes
-- Note: Indexing user_id is critical because every RLS check filters by user_id
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files(created_at DESC);

-- 3. Enable Row Level Security (RLS)
-- By enabling RLS, access is denied by default unless an explicit policy permits it.
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Optional hardening: Ensure RLS is enforced even if table owner executes queries
ALTER TABLE public.files FORCE ROW LEVEL SECURITY;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Policy 1: SELECT (View)
-- Allows authenticated users to view ONLY their own file records.
CREATE POLICY "Users can view only their own files"
    ON public.files
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy 2: INSERT (Create)
-- Allows authenticated users to insert records ONLY if the record's user_id matches their own auth.uid().
CREATE POLICY "Users can insert only their own files"
    ON public.files
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy 3: UPDATE (Modify)
-- Allows authenticated users to update ONLY their own file records.
-- 'USING' ensures the target row belongs to the user.
-- 'WITH CHECK' ensures the user cannot transfer the record to another user_id.
CREATE POLICY "Users can update only their own files"
    ON public.files
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy 4: DELETE (Remove)
-- Allows authenticated users to delete ONLY their own file records.
CREATE POLICY "Users can delete only their own files"
    ON public.files
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
