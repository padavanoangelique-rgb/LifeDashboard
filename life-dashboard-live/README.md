# My Life Dashboard

A private, single-login household dashboard: Guardian Permits, Majestic Permits, Nutrition
(+ meal planner + grocery list), Bills, Finance (accounts/budget/debts), Portfolio, Personal
Goals (+ color-coded weekly time blocking), and an Overview with a week-view calendar for
Appointments & To-dos. Built with Next.js + Supabase (Postgres/Auth) + Vercel, with an
optional daily stock-price refresh via Finnhub.

Since you already have GitHub, Supabase, and Vercel accounts, these steps skip the signup
walkthroughs and go straight to the project-specific setup.

**Already ran `schema.sql` once before?** It's safe to run the current version again as-is —
every statement is written to be re-runnable and it will only add the new `time_blocks` table
without touching your existing data. If you'd rather not re-run the whole file, paste
`supabase/migration_time_blocks.sql` into the SQL Editor instead — it adds just that one table.

## 1. Create the Supabase project

- supabase.com → New project → name it (e.g. "life-dashboard") → set a DB password (save it
  somewhere) → pick a nearby region.
- SQL Editor → New query → paste the **entire contents** of `supabase/schema.sql` → Run.
  This creates all 16 tables, indexes, triggers, and row-level security policies in one go.
- Project Settings → API (or "Data API" in newer UI) → copy the **Project URL**.
- Project Settings → API Keys → copy the `anon` / `public` key (the publishable one — never
  copy the `service_role` / `secret` key into anything client-facing).
- Project Settings → API Keys → also copy the `service_role` **secret** key — you'll need it
  for the price-update cron in step 3, and only there.
- Authentication → Users → Add user → create your login (email + password). There's no public
  sign-up page by design — this is how you create every account that can log in.

## 2. Push the code to GitHub

- Create a new repo, copy every file from this project into it preserving the folder
  structure exactly, commit, and push.

## 3. Set environment variables in Vercel

- Import the repo into Vercel (New Project → pick the repo → Framework Preset should
  auto-detect Next.js).
- Project → Settings → Environment Variables → add, for **Production** (and Preview if you
  want preview deploys to work too):
  - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL from step 1
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon/public key from step 1
  - `FINNHUB_API_KEY` = a free API key from finnhub.io (only needed if you want automatic
    daily price updates — skip if you'd rather update Portfolio prices manually)
  - `SUPABASE_SERVICE_ROLE_KEY` = the service_role secret key from step 1 (only needed
    alongside `FINNHUB_API_KEY` for the cron)
  - `CRON_SECRET` = any long random string you make up (e.g. run
    `openssl rand -hex 32` locally) — this is what stops random internet traffic from
    hitting your price-update endpoint. Vercel automatically sends this as a bearer token
    when it triggers the cron, as long as the env var is set.
- Deploy. Vercel runs `npm install` and `npm run build` automatically — you don't need to
  run either locally, though you're welcome to run `npm install && npm run build` on your
  own machine first if you want to sanity-check it before pushing.
- The daily price-refresh schedule is already configured in `vercel.json` (weekdays at
  9pm UTC — edit the cron expression there and redeploy if you want a different time). If
  you skip the Finnhub/service-role env vars, the cron endpoint just returns an error each
  day and everything else in the app keeps working normally — prices simply stay at
  whatever you last entered by hand.

## 4. Connect a custom domain (optional)

- Vercel → your project → Settings → Domains → add the domain.
- Vercel shows the exact DNS records to add (usually an A record on `@`, CNAME on `www`).
- Add those at your registrar's DNS page. Propagation takes minutes to a few hours; the
  Domains page shows a green "Valid Configuration" check per record when it's done.

## 5. Verify end-to-end

- Visit the deployed URL → should land on the login page.
- Log in with the account you created in step 1.
- Add one test record in a couple of sections, run a CSV upload with a tiny test file (see
  the "Uploading your own data" section below), log a nutrition entry, and confirm the tab
  you care about most looks right. Delete the test records once you're satisfied.

## Uploading your own data

Guardian Permits, Majestic Permits, Accounts, Monthly Budget, Debts, Bills, Portfolio
Holdings, and Appointments & To-dos all have an "⇪ Upload spreadsheet" button that accepts a
CSV file or pasted CSV text with a header row. Column names are flexible (common variations
are recognized automatically), and a row whose match-key value already exists updates that
record instead of duplicating it. If you saved the accompanying data-import skill earlier in
this project, it documents the exact canonical headers, valid dropdown values, and match key
for every section — hand it to Claude along with your raw data (bank exports, screenshots,
spreadsheets) and it'll produce a ready-to-paste CSV for you.

Personal Goals, Nutrition logs/targets/saved meals, the weekly Meal Planner, Water intake,
and the Grocery List are meant to be built up through the app's own "+ Add" buttons rather
than bulk-imported.

## Notes

- No public sign-up — accounts are created only via the Supabase dashboard, by design. Add
  one login per household member who needs access the same way.
- Every table's row-level security policy grants full read/write to any logged-in user —
  there's no per-person data separation. That's intentional for a single-household tool; if
  you ever need to restrict who can see what, that would require a schema change.
- If a Vercel build fails, check the build logs first — the most common causes are a missing
  environment variable, the Framework Preset being set to something other than Next.js, or a
  typo in the Supabase URL/key.
- If Supabase ever reports "Could not find the column in the schema cache" right after you
  add a new column, double-check you're editing the same Supabase project whose URL/key are
  set in Vercel — that's a project mismatch almost every time, not an actual caching bug.
- To add a column later, run a small `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` as its
  own snippet in the SQL Editor rather than re-running the whole schema file.
