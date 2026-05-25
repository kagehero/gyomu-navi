# Vercel Blob setup

Business-report image attachments live in Vercel Blob. The store is **private** —
blobs cannot be fetched directly; every read goes through
`/api/reports/[id]/image`, which checks the same role-scoping rules as the
report itself.

If `BLOB_READ_WRITE_TOKEN` is unset, the report form silently falls back to
submitting without an image (POST `/api/reports/upload-url` returns 503 with
`code: "blob_unconfigured"`).

## One-time setup

1. **Create a Blob store** in the Vercel project that hosts this app.

   - Vercel dashboard → your project → **Storage** → **Create Database** →
     **Blob**.
   - Give it any name (e.g. `gyomu-navi-images`).

2. **Copy the read-write token** that Vercel shows after creation, or grab it
   later from the store's **`.env.local`** tab in the dashboard.

3. **Add it locally** so dev uploads work:

   ```env
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxx
   ```

4. **Add it to the Vercel deployment** under Project → **Settings** →
   **Environment Variables** (Production + Preview). The Storage tab usually
   wires this up for you automatically the first time you bind the store to a
   project.

5. Redeploy if you added it after the latest build.

## What gets uploaded

- Path prefix: `reports/`
- File names: `reports/<uuid>.<ext>`
- Max size: 10 MB
- Allowed content types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`

The constraints live in `src/app/api/reports/upload-url/route.ts`. Bumping the
size cap or adding image formats means editing that file.

## How reads work

- Browser hits `GET /api/reports/<id>/image`.
- The route loads the report, verifies the caller can see it
  (`canAccessStaff`), then streams the blob bytes through Vercel Blob's
  `get()` with the server-side token.
- The image URL stored in `business_reports.image_url` is the canonical Blob
  URL; the proxy reads it via the SDK so the bytes never leave the trust
  boundary without an auth check.

Because the bytes traverse our server, this is not free at large scale —
when image traffic becomes meaningful, switch to short-lived presigned URLs
(see `@vercel/blob` `issueSignedToken` + `presignUrl`).

## Deletes

`DELETE /api/reports/<id>` removes the row first, then best-effort deletes
the blob via `del(image_url)`. A failed blob delete is logged but doesn't
fail the request — the row is already gone and the orphaned blob will sit in
the bucket until manually swept.

## Local dev without Blob

You can work the entire app without a Blob store. The form skips the upload
step on a 503; existing report rows just keep `image_url = NULL`. The proxy
endpoint returns 404 when there's no image to serve.
