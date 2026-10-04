'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatBytes } from '@/lib/formatters';
import {
  DEFAULT_MAX_FILE_SIZE_BYTES,
  validateFileForUpload,
  uploadUserFile,
} from '@/lib/upload-service';
import {
  UploadCloud,
  File,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowUpCircle,
} from 'lucide-react';

interface FileUploadZoneProps {
  onUploadSuccess: () => void;
  maxSizeBytes?: number;
}

export default function FileUploadZone({
  onUploadSuccess,
  maxSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
}: FileUploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: globalThis.File) => {
    const validation = validateFileForUpload(file, maxSizeBytes);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file selected.');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    // 1. Validate that a file was actually selected
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload first.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUploading(true);

    try {
      // 2. Perform the secure upload via uploadUserFile
      await uploadUserFile({
        supabase,
        file: selectedFile,
        maxSizeBytes,
        onProgress: (status) => setUploadProgress(status),
      });

      // 3. Notify user and refresh file list
      setSuccessMessage(`"${selectedFile.name}" was uploaded successfully.`);
      clearSelectedFile();
      onUploadSuccess();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(err.message || 'An error occurred while uploading your file.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Upload Files</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Files are stored privately in your personal folder (Max limit: {formatBytes(maxSizeBytes)}).
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
          <span className="leading-snug">{successMessage}</span>
        </div>
      )}

      {/* Dropzone Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50/60 scale-[1.005]'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
        } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          disabled={isUploading}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-12 h-12 mb-3 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>

          <p className="text-sm font-semibold text-slate-800">
            Click to browse or drag and drop your file here
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Any standard file type supported (PDF, images, documents, zip) up to{' '}
            {formatBytes(maxSizeBytes)}
          </p>
        </div>
      </div>

      {/* Selected File Card */}
      {selectedFile && (
        <div className="mt-4 p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl flex-shrink-0">
              <File className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-500">
                {formatBytes(selectedFile.size)} &bull;{' '}
                {selectedFile.type || 'Unknown type'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              disabled={isUploading}
              onClick={clearSelectedFile}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              title="Remove selected file"
            >
              <X className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={isUploading}
              onClick={handleUpload}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-4 h-4" />
                  <span>Upload File</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Uploading Status */}
      {isUploading && (
        <div className="mt-3 flex items-center space-x-2 text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />
          <span>{uploadProgress || 'Processing upload...'}</span>
        </div>
      )}
    </section>
  );
}
