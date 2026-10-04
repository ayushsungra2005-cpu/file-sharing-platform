/**
 * Automated Test Suite: Secure Upload Flow Verification
 * Tests all requirements from:
 * 1. File selection validation
 * 2. Empty (0-byte) file rejection
 * 3. File size limit enforcement
 * 4. Authentication enforcement
 * 5. Isolated storage path formatting and filename sanitization
 * 6. Ownership protection (user_id strictly from auth session)
 * 7. Storage rollback on database insert failure
 */

import { validateFileForUpload, uploadUserFile, DEFAULT_MAX_FILE_SIZE_BYTES } from '../lib/upload-service';
import { sanitizeFileName } from '../lib/formatters';

// Simple lightweight assertion helper
function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
  console.log(`✅ PASSED: ${testName}`);
}

async function runUploadFlowTests() {
  console.log('--- Starting Secure File Upload Tests ---\n');

  // Test 1: Validate file selection (reject null or undefined)
  const test1 = validateFileForUpload(null);
  assert(!test1.valid && test1.error === 'Please select a file to upload.', 'Rejects null file selection');

  const test1b = validateFileForUpload(undefined);
  assert(!test1b.valid && test1b.error === 'Please select a file to upload.', 'Rejects undefined file selection');

  // Test 2: Reject empty (0-byte) files
  const emptyFile = { name: 'empty.txt', size: 0, type: 'text/plain' } as File;
  const test2 = validateFileForUpload(emptyFile);
  assert(!test2.valid && test2.error === 'Cannot upload empty (0 byte) files.', 'Rejects 0-byte file');

  // Test 3: Reject oversized files exceeding max limit
  const oversizedFile = {
    name: 'large_video.mp4',
    size: DEFAULT_MAX_FILE_SIZE_BYTES + 1024,
    type: 'video/mp4',
  } as File;
  const test3 = validateFileForUpload(oversizedFile);
  assert(!test3.valid && test3.error?.includes('exceeds the maximum allowed limit'), 'Rejects oversized file');

  // Test 4: Accept valid files within size limit
  const validFile = {
    name: 'project_report.pdf',
    size: 2 * 1024 * 1024, // 2 MB
    type: 'application/pdf',
  } as File;
  const test4 = validateFileForUpload(validFile);
  assert(test4.valid && !test4.error, 'Accepts valid file within size limit');

  // Test 5: Storage path sanitization & directory traversal prevention
  const dangerousName = '../../etc/passwd.. malicious.exe';
  const sanitized = sanitizeFileName(dangerousName);
  assert(!sanitized.includes('..') && !sanitized.includes('/'), 'Sanitizes directory traversal patterns');

  // Test 6: Enforce Authentication & Reject Unauthenticated Uploads
  let unauthenticatedErrorCaught = false;
  const mockUnauthenticatedSupabase: any = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error('No active session') }),
    },
  };

  try {
    await uploadUserFile({
      supabase: mockUnauthenticatedSupabase,
      file: validFile,
    });
  } catch (err: any) {
    unauthenticatedErrorCaught = err.message.includes('Authentication required');
  }
  assert(unauthenticatedErrorCaught, 'Rejects unauthenticated upload attempts');

  // Test 7: Verify Rollback on Database Insert Failure
  let storageRemovedPath = '';
  let databaseInsertAttemptedWithUserId = '';

  const mockAuthenticatedUser = { id: 'usr-123e4567-e89b-12d3-a456-426614174000', email: 'student@college.edu' };

  const mockSupabaseWithFailingDB: any = {
    auth: {
      getUser: async () => ({ data: { user: mockAuthenticatedUser }, error: null }),
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _file: any) => {
          assert(bucket === 'user-files', 'Uploads to private bucket "user-files"');
          assert(path.startsWith(`${mockAuthenticatedUser.id}/`), 'Enforces user ID folder prefix in storage path');
          return { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          storageRemovedPath = paths[0];
          return { data: {}, error: null };
        },
      }),
    },
    from: (table: string) => ({
      insert: (record: any) => {
        assert(table === 'files', 'Targets "files" database table');
        databaseInsertAttemptedWithUserId = record.user_id;
        return {
          select: () => ({
            single: async () => {
              // Simulate database error (e.g. connection timeout or constraint error)
              return { data: null, error: { message: 'Database connection failed' } };
            },
          }),
        };
      },
    }),
  };

  let rollbackErrorCaught = false;
  try {
    await uploadUserFile({
      supabase: mockSupabaseWithFailingDB,
      file: validFile,
    });
  } catch (err: any) {
    rollbackErrorCaught = true;
  }

  assert(rollbackErrorCaught, 'Throws error when database write fails');
  assert(
    databaseInsertAttemptedWithUserId === mockAuthenticatedUser.id,
    'Ensures user_id passed to database is strictly taken from auth session'
  );
  assert(
    storageRemovedPath.startsWith(`${mockAuthenticatedUser.id}/`),
    'Rolls back and deletes storage object when database insert fails'
  );

  console.log('\n--- All Secure Upload Tests Passed Successfully! ---');
}

// Run tests
runUploadFlowTests().catch((err) => {
  console.error('Test suite failed:', err);
});
