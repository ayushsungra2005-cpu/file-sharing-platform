# CloudVault - Private File-Sharing Platform

A secure, private cloud file-sharing web application built for college project demonstrations using **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

---

## Features

- **Authentication:** Email & Password registration and login via Supabase Auth.
- **Strict Tenant Isolation:** Each user has an isolated private vault. One user can never view, download, or delete another user's files.
- **Private Storage:** Files are stored in a private Supabase Storage bucket (`user-files`), never exposed through public links.
- **Secure Downloads:** Authenticated downloads powered by short-lived (60-second) cryptographic Signed URLs.
- **File Management:** Displays filename, dynamic file type badge/icon, human-readable size (KB/MB), and upload date.
- **Upload Dropzone:** Drag-and-drop file picker with file size validation ($\le 25\text{ MB}$), empty file protection, and automatic storage-to-database rollback on failure.
- **Safe Deletion:** Interactive confirmation modal before removing files from both storage and database.
- **Documented Security:** Access-control decisions documented in [`DECISIONS.md`](./DECISIONS.md).

---

## Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Backend & Auth:** [Supabase](https://supabase.com/) (`@supabase/ssr`, `@supabase/supabase-js`)
- **Database:** Supabase PostgreSQL with Row-Level Security (RLS)
- **Object Storage:** Supabase Storage with Storage RLS

---

## Quick Start Setup

### 1. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com/).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Run the Database Schema script found in [`supabase/schema.sql`](./supabase/schema.sql).
4. Run the Storage script found in [`supabase/storage.sql`](./supabase/storage.sql).

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

Fill in your project credentials from **Supabase Dashboard -> Project Settings -> API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

### 3. Install Dependencies & Run

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the application.

---

## Verifying Access Control & RLS

To test that one user can never see another user's files:
1. Register Account A (`studentA@college.edu`) and upload a file.
2. Sign out and register Account B (`studentB@college.edu`).
3. Notice that Account B's dashboard shows **0 files** and an empty vault.
4. Upload a different file under Account B.
5. Log back into Account A: Account A only sees their own original file.

---

## Running Automated Security & Functionality Tests

Run the complete 15-point automated security and functionality review:

```bash
npm test
```

Or run individual test suites:
- `npm run test:upload`: File selection, 0-byte check, size limit, and DB rollback on failure.
- `npm run test:download`: Signed URL expiration, ownership checks, and parameter tampering prevention.
- `npm run test:delete`: Two-tier deletion, RLS enforcement, and orphan avoidance.
- `npm run test:all`: Run all test suites consecutively.
