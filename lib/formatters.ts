/**
 * Helper utility to format byte sizes into human-readable strings (KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes || bytes <= 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Helper utility to format ISO date strings into a clean readable date/time.
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Extract clean, sanitized file extension or simplified type name.
 */
export function getFileTypeLabel(mimeType: string, fileName: string): string {
  if (fileName.includes('.')) {
    const ext = fileName.split('.').pop()?.toUpperCase();
    if (ext && ext.length <= 5) return ext;
  }

  if (mimeType.includes('/')) {
    const sub = mimeType.split('/')[1]?.toUpperCase();
    if (sub) return sub;
  }

  return 'FILE';
}

/**
 * Sanitizes a filename to prevent directory traversal and remove problematic characters.
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.');
}
