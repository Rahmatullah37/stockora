import { Database } from "lucide-react";
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Setup required" };

/**
 * Shown automatically (by src/proxy.ts) while the Supabase environment
 * variables are missing, so you get clear instructions instead of an error.
 */
export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Database className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Connect {siteConfig.name} to Supabase</h1>
            <p className="text-sm text-muted-foreground">
              The database connection is not configured yet. It takes about 5 minutes.
            </p>
          </div>
        </div>

        <ol className="list-decimal space-y-4 ps-5 text-sm leading-relaxed">
          <li>
            Create a free project at <strong>supabase.com</strong> (Dashboard → New project).
          </li>
          <li>
            In your project open <strong>Project Settings → API</strong> and copy the{" "}
            <strong>Project URL</strong> and the <strong>anon / publishable key</strong>.
          </li>
          <li>
            In your project folder, copy <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code> to a
            new file named <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code> and paste the two
            values:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs" dir="ltr">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
            </pre>
          </li>
          <li>
            In Supabase open <strong>SQL Editor</strong> and run the two files in{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">supabase/migrations</code>, in order
            (<code className="rounded bg-muted px-1.5 py-0.5">…0001_foundation.sql</code>, then{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">…0002_reference_data.sql</code>, then{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">…0003_regional_settings_function.sql</code>).
          </li>
          <li>
            Stop the dev server (Ctrl + C) and start it again with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">npm run dev</code>.
          </li>
        </ol>

        <p className="text-xs text-muted-foreground">
          Full step-by-step guide: <code>docs/DEPLOYMENT.md</code> and <code>README.md</code>.
        </p>
      </div>
    </div>
  );
}
