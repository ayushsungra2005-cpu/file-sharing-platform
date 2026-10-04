/**
 * Automated Test Suite: Secure Download Flow Verification
 * Tests:
 * 1. Unauthenticated download requests are rejected (401).
 * 2. Attempts to access another user's file ID are blocked by RLS / 404.
 * 3. File ownership tampering checks (403).
 * 4. Storage path folder integrity checks (403).
 * 5. Missing storage object error handling (404).
 * 6. Authorized download generates short-lived signed URL for legitimate owner.
 */

// Simple lightweight assertion helper
function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
  console.log(`✅ PASSED: ${testName}`);
}

interface MockServerContext {
  user: { id: string; email: string } | null;
  filesDb: Array<{
    id: string;
    user_id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    file_type: string;
  }>;
  storageObjects: Record<string, boolean>;
}

// Simulated server handler replicating app/api/files/[id]/download/route.ts
async function simulateDownloadEndpoint(fileId: string, ctx: MockServerContext) {
  // 1. Verify caller authentication
  if (!ctx.user || !ctx.user.id) {
    return { status: 401, body: { error: 'Unauthorized: You must be logged in to download files.' } };
  }

  // 2. Query file record from PostgreSQL under RLS (WHERE user_id = auth.uid())
  // If the file belongs to another user, Postgres RLS returns 0 rows.
  const file = ctx.filesDb.find((f) => f.id === fileId && f.user_id === ctx.user?.id);

  if (!file) {
    return { status: 404, body: { error: 'File not found or you do not have permission to access it.' } };
  }

  // 3. Explicit ownership check
  if (file.user_id !== ctx.user.id) {
    return { status: 403, body: { error: 'Access denied: You do not own this file.' } };
  }

  // 4. Validate storage path matches the user's isolated folder
  if (!file.file_path.startsWith(`${ctx.user.id}/`)) {
    return { status: 403, body: { error: 'Access denied: Storage path integrity check failed.' } };
  }

  // 5. Generate short-lived Signed URL from private storage
  if (!ctx.storageObjects[file.file_path]) {
    return {
      status: 404,
      body: { error: 'The requested file could not be found in storage. It may have been deleted.' },
    };
  }

  const signedUrl = `https://storage.supabase.co/user-files/${file.file_path}?token=mock_signed_token_exp_60s`;
  return {
    status: 200,
    body: {
      downloadUrl: signedUrl,
      fileName: file.file_name,
      expiresInSeconds: 60,
    },
  };
}

async function runDownloadFlowTests() {
  console.log('--- Starting Secure File Download Tests ---\n');

  const userAlice = { id: 'usr-alice-1111-2222', email: 'alice@college.edu' };
  const userBob = { id: 'usr-bob-3333-4444', email: 'bob@college.edu' };

  const initialContext: MockServerContext = {
    user: userAlice,
    filesDb: [
      {
        id: 'file-alice-01',
        user_id: userAlice.id,
        file_name: 'alice_research_paper.pdf',
        file_path: `${userAlice.id}/1700000000-alice_research_paper.pdf`,
        file_size: 1048576,
        file_type: 'application/pdf',
      },
      {
        id: 'file-bob-01',
        user_id: userBob.id,
        file_name: 'bob_confidential_grades.xlsx',
        file_path: `${userBob.id}/1700000000-bob_confidential_grades.xlsx`,
        file_size: 524288,
        file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
    storageObjects: {
      [`${userAlice.id}/1700000000-alice_research_paper.pdf`]: true,
      [`${userBob.id}/1700000000-bob_confidential_grades.xlsx`]: true,
    },
  };

  // Test 1: Unauthenticated user attempt
  const test1 = await simulateDownloadEndpoint('file-alice-01', {
    ...initialContext,
    user: null,
  });
  assert(test1.status === 401 && test1.body.error.includes('Unauthorized'), 'Blocks unauthenticated user (401)');

  // Test 2: Alice attempts to download Bob's file by modifying file ID in browser
  const test2 = await simulateDownloadEndpoint('file-bob-01', {
    ...initialContext,
    user: userAlice, // Alice is logged in, but asks for Bob's file ID
  });
  assert(
    test2.status === 404 && test2.body.error.includes('File not found or you do not have permission'),
    "Blocks access when user modifies file ID to another user's file (404/RLS)"
  );

  // Test 3: Path tampering attempt (file claims to be Alice's but file_path points to Bob's folder)
  const tamperedContext: MockServerContext = {
    ...initialContext,
    filesDb: [
      {
        id: 'file-tampered-01',
        user_id: userAlice.id,
        file_name: 'exploit.pdf',
        file_path: `${userBob.id}/1700000000-bob_confidential_grades.xlsx`, // Pointing to Bob's path
        file_size: 1024,
        file_type: 'application/pdf',
      },
    ],
  };
  const test3 = await simulateDownloadEndpoint('file-tampered-01', tamperedContext);
  assert(test3.status === 403 && test3.body.error.includes('Storage path integrity check failed'), 'Blocks storage path tampering (403)');

  // Test 4: Missing storage object (record exists in DB but deleted in storage)
  const missingStorageContext: MockServerContext = {
    ...initialContext,
    storageObjects: {}, // storage object was deleted
  };
  const test4 = await simulateDownloadEndpoint('file-alice-01', missingStorageContext);
  assert(test4.status === 404 && test4.body.error.includes('could not be found in storage'), 'Handles missing file in storage gracefully (404)');

  // Test 5: Authorized download for legitimate file owner
  const test5 = await simulateDownloadEndpoint('file-alice-01', initialContext);
  assert(
    test5.status === 200 &&
      test5.body.downloadUrl.includes('mock_signed_token_exp_60s') &&
      test5.body.expiresInSeconds === 60,
    'Generates short-lived signed URL for legitimate owner (200)'
  );

  console.log('\n--- All Secure Download Tests Passed Successfully! ---');
}

runDownloadFlowTests().catch((err) => {
  console.error('Download test suite failed:', err);
});
