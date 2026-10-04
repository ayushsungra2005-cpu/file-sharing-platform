# Access-Control Decisions & Security Architecture

**Project Title:** CloudVault — Secure File-Sharing Platform  
**Target Submission:** College Mini-Project / Final Year Project  
**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (Auth, PostgreSQL, Storage)

---

## 1. Project Overview & Security Mission

In a multi-user file-sharing platform, data privacy is the primary concern. The core requirement of this project is:

> **Strict Tenant Isolation:** One user must **never** be able to view, download, modify, or delete another user's files under any circumstance.

To achieve this without compromising code simplicity, we implemented a **Defense-in-Depth** access-control architecture. This document explains the five key design decisions behind our security strategy.

---

## 2. Key Access-Control Decisions

### Decision 1: Why Files Are Stored in a Private Supabase Storage Bucket

In cloud object storage, buckets can be either **Public** or **Private**:

- **The Problem with Public Buckets:** If a bucket is public, every uploaded file gets a permanent, predictable URL (e.g., `https://.../storage/v1/object/public/user-files/report.pdf`). Anyone who has the link, guesses the filename, or inspects browser network traffic can download the file without logging in.
- **Why We Chose a Private Bucket:**
  1. Our bucket (`user-files`) is explicitly configured with `public = false`.
  2. Direct internet access to raw file URLs is completely blocked.
  3. To download a file, the application must generate a temporary **Signed URL** with a strict 60-second expiration.
  4. Supabase Storage verifies the user's cryptographic login token before issuing the signed link. After 60 seconds, the link expires and cannot be reused.

---

### Decision 2: Why Every File Record Contains `user_id`

In our PostgreSQL database table (`public.files`), every record includes a `user_id` column:

```sql
CREATE TABLE public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- **Cryptographic Ownership Anchor:** The `user_id` binds the file directly to the unique ID of the student who uploaded it (`auth.users(id)`).
- **Enables Database-Level Isolation:** Without `user_id` on the record, the database engine would have no way to distinguish who owns which file.
- **Automatic Cleanup (`ON DELETE CASCADE`):** If a student account is removed from the system, PostgreSQL automatically purges all of their file records, preventing orphaned or inaccessible data.
- **Secure Default (`DEFAULT auth.uid()`):** PostgreSQL automatically defaults `user_id` to the currently logged-in user's identity extracted directly from their secure authentication token.

---

### Decision 3: How Row Level Security (RLS) Prevents Users from Accessing Other Users' Database Records

In standard databases without RLS, if a user sends a query like `SELECT * FROM files`, the database returns every row in the entire table unless the developer remembers to write `WHERE user_id = ...` in every backend query. If a developer forgets that `WHERE` clause even once, all users' files are exposed.

**Row Level Security (RLS) solves this problem at the database engine level:**

```sql
-- 1. Enable RLS on the table (Default Deny: All access is blocked by default)
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- 2. Only allow users to view their own rows
CREATE POLICY "Users can view only their own files"
    ON public.files FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
```

#### How it works behind the scenes:
1. When a user requests their files, Supabase passes their verified JSON Web Token (JWT) to PostgreSQL.
2. PostgreSQL extracts the caller's ID via `auth.uid()`.
3. PostgreSQL automatically and invisibly rewrites every query to evaluate `USING (auth.uid() = user_id)`.
4. **Result:** If Student A attempts to query the database using Student B's file ID, PostgreSQL evaluates `auth.uid() = user_id`, finds no match, and returns **`0` rows**. The attacker cannot even detect whether Student B's file exists.

Similarly, strict policies are enforced for all database actions:
- **`INSERT`:** `WITH CHECK (auth.uid() = user_id)` blocks inserting files under someone else's ID.
- **`UPDATE`:** `USING (auth.uid() = user_id)` blocks updating other users' files.
- **`DELETE`:** `USING (auth.uid() = user_id)` blocks deleting other users' files.

---

### Decision 4: How Storage Policies Prevent Unauthorized File Access

Securing the database table is not enough if someone can access the storage bucket directly. We enforced **Storage Row-Level Security** directly on the storage objects:

#### Storage Path Convention
Every file is placed inside an isolated folder named after the user's UUID:
$$\text{Storage Path: } \texttt{\{user\_id\}/\{timestamp\}-\{filename\}}$$

#### Storage RLS Policy
```sql
CREATE POLICY "Users can view only their own storage objects"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'user-files'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
```

#### How it protects files:
- When a user tries to download or read an object from storage, Supabase extracts the first folder name from the path: `(storage.foldername(name))[1]`.
- It compares that folder name to the caller's verified `auth.uid()`.
- If Student A (`user_id: 1111`) tries to access `user-files/2222/exam_answers.pdf`, the folder segment (`2222`) does not match their login ID (`1111`).
- The storage engine immediately blocks the request with an **Access Denied** error.

---

### Decision 5: Why Authorization Must Be Checked Server-Side Rather Than Trusting the Frontend

A fundamental rule of secure software engineering is:

> **"Never Trust the Client."**

#### Why frontend checks alone fail:
- The frontend (React / Next.js running in the user's browser) is completely under the user's control.
- Any student with basic technical knowledge can:
  1. Open **Chrome Developer Tools** (Press F12).
  2. Modify JavaScript variables or override functions in the Console.
  3. Edit DOM elements or button attributes.
  4. Use tools like **Postman** or **cURL** to send custom HTTP requests directly to API endpoints, completely bypassing the UI.

#### How our server-side architecture protects against client tampering:
In our implementation, all sensitive actions (downloading and deleting) go through dedicated server-side route handlers:
- **Download:** `GET /api/files/[id]/download`
- **Delete:** `DELETE /api/files/[id]`

On every server request:
1. **The server verifies identity:** The server reads the HTTP-only session cookies and calls `supabase.auth.getUser()`. A user cannot fake this token.
2. **The server ignores client-supplied paths:** When deleting or downloading, the client only passes a `fileId`. The server looks up the actual storage path from PostgreSQL under RLS. The user cannot supply a malicious storage path.
3. **The server validates ownership:** The server checks `file.user_id === user.id` and verifies that the storage path starts with `user.id + '/'`.
4. **Only then does the action execute:** If any check fails, the server responds with `401 Unauthorized`, `403 Forbidden`, or `404 Not Found`.

---

## 3. Summary of Security Layers (Defense-in-Depth)

| Layer | Component | How It Protects the User |
| :--- | :--- | :--- |
| **Layer 1: Routing & UI** | Next.js `middleware.ts` & Dashboard | Prevents unauthenticated users from seeing the dashboard or upload forms. |
| **Layer 2: Server API** | Next.js API Routes (`/api/files/*`) | Validates authentication and ownership server-side before issuing signed URLs or deleting objects. |
| **Layer 3: Database** | PostgreSQL Row-Level Security (`public.files`) | Invisible row filtering ensuring users can only `SELECT`, `INSERT`, `UPDATE`, or `DELETE` their own rows. |
| **Layer 4: Storage** | Supabase Private Storage & Storage RLS | Prevents public URL access and restricts folder operations strictly to `{user_id}/*`. |

---

## 4. Conclusion

By combining a **private storage bucket**, **database RLS**, **storage folder policies**, and **server-side verification**, the application ensures that user data is isolated at every level of the stack. Even if a user attempts to tamper with browser code, modify network payloads, or guess file IDs, the platform guarantees that **one user can never access another user's files**.
