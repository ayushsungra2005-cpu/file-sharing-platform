'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileRecord } from '@/types';
import FileUploadZone from './FileUploadZone';
import FileList from './FileList';
import { formatBytes } from '@/lib/formatters';
import { Files, HardDrive, ShieldCheck, RefreshCw } from 'lucide-react';

interface DashboardContentProps {
  userEmail: string;
  userId: string;
}

export default function DashboardContent({ userEmail, userId }: DashboardContentProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch only this user's files (guaranteed by Supabase Row-Level Security)
  const fetchFiles = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      setFetchError(null);

      const { data, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setFiles(data || []);
    } catch (err: any) {
      console.error('Error fetching files:', err);
      setFetchError('Failed to load your files. Please check your connection and refresh.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Compute storage usage stats
  const totalSizeBytes = files.reduce((acc, file) => acc + (Number(file.file_size) || 0), 0);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full w-fit mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Cryptographically Isolated Storage</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Welcome, {userEmail.split('@')[0]}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Your files are stored privately in Supabase Storage and guarded by PostgreSQL RLS.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchFiles(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh files"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Files className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Files
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {isLoading ? '...' : files.length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Storage Used
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {isLoading ? '...' : formatBytes(totalSizeBytes)}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Access Control
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">Strict RLS</p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <FileUploadZone onUploadSuccess={() => fetchFiles(false)} />

      {/* My Files Section */}
      <FileList files={files} isLoading={isLoading} onRefresh={() => fetchFiles(false)} />
    </div>
  );
}
