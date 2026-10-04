import { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeFileName, formatBytes } from '@/lib/formatters';

export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file before attempting upload.
 * Checks for presence, zero-byte empty files, and size limits.
 */
export function validateFileForUpload(
  file: File | null | undefined,
  maxSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES
): UploadValidationResult {
  if (!file) {
    return {
      valid: false,
      error: 'Please select a file to upload.',
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'Cannot upload empty (0 byte) files.',
    };
  }

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size (${formatBytes(file.size)}) exceeds the maximum allowed limit of ${formatBytes(
        maxSizeBytes
      )}.`,
    };
  }

  return { valid: true };
}

export interface UploadOptions {
  supabase: SupabaseClient;
  file: File;
  onProgress?: (status: string) => void;
  maxSizeBytes?: number;
}

/**
 * Handles the complete secure upload workflow:
 * 1. Validates file
 * 2. Authenticates current user strictly via Supabase JWT
 * 3. Enforces isolated storage path: {user_id}/{timestamp}-{clean_filename}
 * 4. Uploads to private Supabase Storage bucket ('user-files')
 * 5. Records metadata in public.files table
 * 6. Automatically rolls back (removes storage object) if database insertion fails
 */
export async function uploadUserFile({
  supabase,
  file,
  onProgress,
  maxSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
}: UploadOptions) {
  // 1. Validation check
  const validation = validateFileForUpload(file, maxSizeBytes);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Authentication check: strictly extract user ID from authenticated JWT
  onProgress?.('Verifying authenticated session...');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.id) {
    throw new Error('Authentication required: You must be signed in to upload files.');
  }

  // 3. Storage path: enforce user ID folder isolation and sanitize filename
  const safeName = sanitizeFileName(file.name);
  const timestamp = Date.now();
  const storagePath = `${user.id}/${timestamp}-${safeName}`;

  onProgress?.('Uploading to private storage vault...');

  // 4. Upload binary into private storage bucket
  const { error: storageError } = await supabase.storage
    .from('user-files')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (storageError) {
    throw new Error(`Storage upload failed: ${storageError.message}`);
  }

  // 5. Insert metadata into PostgreSQL with automatic rollback on error
  onProgress?.('Saving file metadata...');
  try {
    const { data: dbData, error: dbError } = await supabase
      .from('files')
      .insert({
        user_id: user.id, // Enforced from auth session, NEVER from client parameters
        file_name: file.name,
        file_path: storagePath,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database record failed: ${dbError.message}`);
    }

    onProgress?.('Upload complete!');
    return {
      success: true,
      file: dbData,
      storagePath,
    };
  } catch (error: any) {
    // CRITICAL ROLLBACK: If DB write fails, delete newly uploaded storage object to prevent orphan storage files
    console.error('Database write failed during upload. Rolling back storage file:', storagePath, error);
    try {
      await supabase.storage.from('user-files').remove([storagePath]);
    } catch (cleanupError) {
      console.error('Storage rollback cleanup error:', cleanupError);
    }
    throw error;
  }
}
