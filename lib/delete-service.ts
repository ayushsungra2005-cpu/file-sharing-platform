/**
 * Client-Side Secure File Deletion Service
 *
 * Calls the secure server API endpoint DELETE /api/files/[id], which:
 * 1. Verifies caller is authenticated
 * 2. Checks file ownership via PostgreSQL RLS
 * 3. Validates storage path format
 * 4. Deletes the physical storage object
 * 5. Deletes the PostgreSQL database record
 */
export async function deleteFileSecurely(fileId: string): Promise<{ success: boolean; message: string }> {
  if (!fileId) {
    throw new Error('Invalid file ID provided for deletion.');
  }

  const response = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please log in again to delete files.');
    }
    if (response.status === 403) {
      throw new Error(data.error || 'Access denied: You do not have permission to delete this file.');
    }
    if (response.status === 404) {
      throw new Error(data.error || 'File not found or has already been deleted.');
    }
    throw new Error(data.error || 'Failed to delete the file. Please try again.');
  }

  return {
    success: true,
    message: data.message || 'File deleted successfully.',
  };
}
