# Deployment (GitHub → Vercel + Supabase)

_Status: NOT deployed. Nothing below has been performed yet._

## Checklist
1. [ ] Create a Supabase project and apply all migrations (see DATABASE.md).
2. [ ] Push the code to a private GitHub repo. Check `.env.local` is NOT committed (it is in `.gitignore`).
3. [ ] Vercel → Add New Project → import the repo (Framework: Next.js, defaults are fine).
4. [ ] Vercel → Settings → Environment Variables: add `NEXT_PUBLIC_SUPABASE_URL`,
       `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (your https production URL),
       and later `SUPABASE_SERVICE_ROLE_KEY` (server only).
5. [ ] Supabase → Authentication → URL Configuration: set *Site URL* to the production URL and add
       `https://<your-domain>/auth/callback` to *Redirect URLs*.
6. [ ] Redeploy, then test: register, verify email, log in, reset password.
7. [ ] Before real customers: configure custom SMTP in Supabase (the built-in email is heavily rate-limited).
8. [ ] Confirm RLS isolation with two test shops.
