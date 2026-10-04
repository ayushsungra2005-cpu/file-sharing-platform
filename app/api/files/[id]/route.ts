import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * Secure File Deletion Route Handler
 * DELETE /api/files/[id]
 *
 * Enforces multi-tier security:
 * 1. Verifies caller is authenticated via active Supabase session.
 * 2. Queries PostgreSQL under RLS to ensure the file belongs to this user.
 * 3. Never trusts client-supplied file paths: reads file_path strictly from verified DB row.
 * 4. Verifies the storage path begins with user.id/ to block path tampering.
 * 5. Deletes the storage object from the private bucket.
 * 6. Deletes the database record from public.files table.
 * 7. Returns clear, user-friendly errors for unauthorized access or failures.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const fileId = resolvedParams?.id;

    if (!fileId) {
      return NextResponse.json(
        { error: 'Invalid request: File ID is required for deletion.' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // 1. Verify caller authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to delete files.' },
        { status: 401 }
      );
    }

    // 2. Query file record from PostgreSQL under RLS (WHERE user_id = auth.uid())
    const { data: file, error: dbError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (dbError || !file) {
      // If the file belongs to another user, RLS causes PostgreSQL to return 0 rows.
      // We respond with a generic 404 to avoid leaking existence of other users' files.
      return NextResponse.json(
        { error: 'File not found or you do not have permission to delete it.' },
        { status: 404 }
      );
    }

    // 3. Explicit ownership check (tamper protection)
    if (file.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied: You do not own this file.' },
        { status: 403 }
      );
    }

    // 4. Validate storage path matches the user's isolated folder
    if (!file.file_path.startsWith(`${user.id}/`)) {
      console.error(
        `Security Alert: Storage path violation during delete for file ${fileId}. Path: ${file.file_path}, User: ${user.id}`
      );
      return NextResponse.json(
        { error: 'Access denied: Storage path integrity check failed.' },
        { status: 403 }
      );
    }

    // 5. Delete binary object from private storage bucket
    const { error: storageError } = await supabase.storage
      .from('user-files')
      .remove([file.file_path]);

    if (storageError) {
      console.warn('Warning: Storage object deletion encountered an issue:', storageError.message);
      // We log and continue so the user can still remove corrupted/orphaned database records
    }

    // 6. Delete metadata record from PostgreSQL public.files table
    const { error: deleteDbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', user.id); // Explicit user_id constraint alongside RLS

    if (deleteDbError) {
      console.error('Error removing database record:', deleteDbError);
      return NextResponse.json(
        { error: `Failed to delete file record: ${deleteDbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `File "${file.file_name}" was deleted successfully.`,
      deletedId: fileId,
    });
  } catch (error: any) {
    console.error('Secure delete handler exception:', error);
    return NextResponse.json(
      { error: 'Internal server error while deleting file.' },
      { status: 500 }
    );
  }
}
