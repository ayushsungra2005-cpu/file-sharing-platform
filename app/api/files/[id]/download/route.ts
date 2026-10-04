import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * Secure File Download Route Handler
 * GET /api/files/[id]/download
 *
 * Enforces multi-tier security:
 * 1. Verifies caller is authenticated via active Supabase session.
 * 2. Queries PostgreSQL under RLS to ensure the file exists and belongs to this user.
 * 3. Explicitly verifies file.user_id === user.id.
 * 4. Verifies the storage path begins with user.id/ to block path tampering.
 * 5. Generates a temporary 60-second Signed URL from the private bucket.
 * 6. Returns user-friendly errors for unauthorized access or missing objects.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const fileId = resolvedParams?.id;

    if (!fileId) {
      return NextResponse.json(
        { error: 'Invalid request: File ID is required.' },
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
        { error: 'Unauthorized: You must be logged in to download files.' },
        { status: 401 }
      );
    }

    // 2. Query file record from PostgreSQL
    // Row-Level Security automatically filters by auth.uid() = user_id
    const { data: file, error: dbError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (dbError || !file) {
      // If the file belongs to another user, RLS causes PostgreSQL to return 0 rows.
      // We respond with a generic 404 to avoid leaking existence of other users' files.
      return NextResponse.json(
        { error: 'File not found or you do not have permission to access it.' },
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
        `Security Alert: Storage path violation for file ${fileId}. Path: ${file.file_path}, User: ${user.id}`
      );
      return NextResponse.json(
        { error: 'Access denied: Storage path integrity check failed.' },
        { status: 403 }
      );
    }

    // 5. Generate short-lived Signed URL (valid for 60 seconds)
    const { data: signedData, error: storageError } = await supabase.storage
      .from('user-files')
      .createSignedUrl(file.file_path, 60, {
        download: file.file_name, // Forces browser download with original name
      });

    if (storageError || !signedData?.signedUrl) {
      console.error('Storage signed URL generation error:', storageError);
      return NextResponse.json(
        {
          error:
            'The requested file could not be found in storage. It may have been deleted.',
        },
        { status: 404 }
      );
    }

    // 6. Return secure signed URL
    return NextResponse.json({
      downloadUrl: signedData.signedUrl,
      fileName: file.file_name,
      expiresInSeconds: 60,
    });
  } catch (error: any) {
    console.error('Secure download handler exception:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing file download.' },
      { status: 500 }
    );
  }
}
