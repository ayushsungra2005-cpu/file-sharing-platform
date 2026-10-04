/**
 * Client-Side Secure Download Service
 *
 * Calls the secure server API endpoint /api/files/[id]/download, which:
 * 1. Checks user authentication
 * 2. Checks file ownership via PostgreSQL RLS
 * 3. Validates path integrity
 * 4. Generates a temporary 60-second Signed URL
 * 5. Automatically initiates browser download
 */
export async function downloadFileSecurely(
  fileId: string,
  fallbackFileName = 'download'
): Promise<void> {
  if (!fileId) {
    throw new Error('Invalid file ID provided for download.');
  }

  const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/download`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please log in again to download files.');
    }
    if (response.status === 403) {
      throw new Error(data.error || 'Access denied: You do not have permission to download this file.');
    }
    if (response.status === 404) {
      throw new Error(data.error || 'File not found or has been removed from storage.');
    }
    throw new Error(data.error || 'Failed to download file. Please try again.');
  }

  if (!data.downloadUrl) {
    throw new Error('No valid download URL was generated.');
  }

  // Trigger browser download via invisible link
  const link = document.createElement('a');
  link.href = data.downloadUrl;
  link.download = data.fileName || fallbackFileName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
