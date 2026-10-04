'use client';

import { useState } from 'react';
import { FileRecord } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { formatBytes, formatDate, getFileTypeLabel } from '@/lib/formatters';
import { downloadFileSecurely } from '@/lib/download-service';
import { deleteFileSecurely } from '@/lib/delete-service';
import DeleteConfirmModal from './DeleteConfirmModal';
import {
  FileText,
  FileImage,
  FileArchive,
  FileCode,
  FileAudio,
  FileVideo,
  File,
  Download,
  Trash2,
  Loader2,
  Search,
  AlertCircle,
  Inbox,
} from 'lucide-react';

interface FileListProps {
  files: FileRecord[];
  isLoading: boolean;
  onRefresh: () => void;
}

export default function FileList({ files, isLoading, onRefresh }: FileListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteModalFile, setDeleteModalFile] = useState<FileRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const supabase = createClient();

  // Helper to determine the best matching Lucide icon based on mime type and extension
  const renderFileIcon = (file: FileRecord) => {
    const type = file.file_type.toLowerCase();
    const name = file.file_name.toLowerCase();

    if (type.startsWith('image/')) {
      return (
        <div className="p-2.5 bg-pink-50 text-pink-600 rounded-xl">
          <FileImage className="w-5 h-5" />
        </div>
      );
    }
    if (type.includes('pdf') || name.endsWith('.pdf')) {
      return (
        <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (
      type.includes('zip') ||
      type.includes('tar') ||
      type.includes('compressed') ||
      name.endsWith('.zip') ||
      name.endsWith('.rar') ||
      name.endsWith('.7z')
    ) {
      return (
        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
          <FileArchive className="w-5 h-5" />
        </div>
      );
    }
    if (
      type.includes('javascript') ||
      type.includes('typescript') ||
      type.includes('json') ||
      type.includes('html') ||
      type.includes('python') ||
      name.endsWith('.ts') ||
      name.endsWith('.tsx') ||
      name.endsWith('.js') ||
      name.endsWith('.py') ||
      name.endsWith('.sql')
    ) {
      return (
        <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
          <FileCode className="w-5 h-5" />
        </div>
      );
    }
    if (type.startsWith('audio/')) {
      return (
        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
          <FileAudio className="w-5 h-5" />
        </div>
      );
    }
    if (type.startsWith('video/')) {
      return (
        <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
          <FileVideo className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
        <File className="w-5 h-5" />
      </div>
    );
  };

  // Secure download using verified server endpoint
  const handleDownload = async (file: FileRecord) => {
    setActionError(null);
    try {
      setDownloadingId(file.id);
      await downloadFileSecurely(file.id, file.file_name);
    } catch (err: any) {
      console.error('Download error:', err);
      setActionError(err.message || 'Could not download the file.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Delete file permanently using verified server endpoint
  const handleDeleteConfirm = async () => {
    if (!deleteModalFile) return;

    setActionError(null);
    try {
      setIsDeleting(true);
      await deleteFileSecurely(deleteModalFile.id);

      // Close modal and refresh list
      setDeleteModalFile(null);
      onRefresh();
    } catch (err: any) {
      console.error('Delete error:', err);
      setActionError(err.message || 'Could not delete the file.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter files by search query
  const filteredFiles = files.filter(
    (file) =>
      file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.file_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">My Files</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {files.length} {files.length === 1 ? 'file' : 'files'} securely stored in your personal vault
          </p>
        </div>

        {files.length > 0 && (
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your files..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        )}
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
          <span className="leading-snug">{actionError}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm">Loading your files securely...</p>
        </div>
      ) : files.length === 0 ? (
        /* Empty State */
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
          <div className="w-14 h-14 mx-auto mb-3 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No files uploaded yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Upload files in the section above. They will be stored privately and visible only to you.
          </p>
        </div>
      ) : filteredFiles.length === 0 ? (
        /* No Search Matches */
        <div className="py-12 text-center text-slate-500">
          <p className="text-sm">No files match your search query "{searchQuery}".</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
          >
            Clear search filter
          </button>
        </div>
      ) : (
        /* Responsive Files Table */
        <div className="overflow-x-auto -mx-6 sm:mx-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th scope="col" className="px-6 py-3">Filename</th>
                <th scope="col" className="px-6 py-3 hidden sm:table-cell">Type</th>
                <th scope="col" className="px-6 py-3 hidden md:table-cell">Size</th>
                <th scope="col" className="px-6 py-3 hidden lg:table-cell">Uploaded Date</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredFiles.map((file) => (
                <tr
                  key={file.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  {/* Filename & Icon */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {renderFileIcon(file)}
                      <div className="min-w-0 max-w-[200px] sm:max-w-xs md:max-w-sm">
                        <p
                          className="text-sm font-semibold text-slate-900 truncate"
                          title={file.file_name}
                        >
                          {file.file_name}
                        </p>
                        <p className="text-xs text-slate-500 sm:hidden mt-0.5">
                          {formatBytes(file.file_size)} &bull; {formatDate(file.created_at)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* File Type Badge */}
                  <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {getFileTypeLabel(file.file_type, file.file_name)}
                    </span>
                  </td>

                  {/* File Size */}
                  <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell text-sm text-slate-600 font-mono">
                    {formatBytes(file.file_size)}
                  </td>

                  {/* Upload Date */}
                  <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell text-sm text-slate-500">
                    {formatDate(file.created_at)}
                  </td>

                  {/* Actions: Download & Delete */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="inline-flex items-center space-x-1.5">
                      {/* Download Button */}
                      <button
                        type="button"
                        onClick={() => handleDownload(file)}
                        disabled={downloadingId === file.id}
                        className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        title="Download file securely"
                      >
                        {downloadingId === file.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeleteModalFile(file)}
                        className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalFile && (
        <DeleteConfirmModal
          isOpen={!!deleteModalFile}
          fileName={deleteModalFile.file_name}
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteModalFile(null)}
        />
      )}
    </section>
  );
}
