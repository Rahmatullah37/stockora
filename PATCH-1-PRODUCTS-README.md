# Stockora patch 1 — Products, QR labels, CSV import/export, Categories & Brands

## What it adds
- /products (search, filters, low-stock filter, pagination), /products/new, /products/[id], /products/[id]/edit
- /products/import (CSV, checked in the browser first, then by the server), /products/export (CSV download)
- /products/labels (printable QR labels), /categories (categories and brands)

## How to install (3 steps)
1. Unzip this file INTO your stockora project folder. Say "yes" to merge folders.
   Only NEW files are added, plus ONE existing file is replaced:
   `src/lib/i18n/messages/products.en.ts` (it only holds the Products texts).
2. No new database migration and no new packages are needed. Migrations 4-7 must already be applied.
3. Run `npm run dev`, log in, click "Products" in the sidebar.

## Needs
- Storage bucket `product-images` (created by migration 4 when Storage exists in your Supabase project).
- Products need the permission `products.manage` to add/edit; costs need `finance.view`.

## What was actually checked
- `npx tsc --noEmit`: no errors. `npx eslint` on these files: no errors.
- `npm run build` passes (run with the Google font download replaced, because the build sandbox has no internet).
- NOT tested: against your real Supabase project, in a browser, on a phone, or with the camera.
  Please try: add a product, edit it, print a label, import the template CSV, export CSV.
