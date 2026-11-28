# Supabase + Vercel Setup Guide

Follow these steps one by one to connect **WhereToWatch** to **Supabase** (PostgreSQL) and deploy on **Vercel**.

---

## Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New project**, pick a name (e.g. `wheretowatch`), set a strong database password (save it!), and choose a region close to you (e.g. **Mumbai / ap-south-1**).
3. Wait ~1 minute for the database to finish provisioning.

## Step 2: Copy Your Supabase Connection Strings
1. In your Supabase project, click **Connect** (top bar) or go to **Project Settings → Database**.
2. Under **Connection string → URI**, copy two URLs (replace `[YOUR-PASSWORD]` with your database password):
   - **Transaction pooler (port `6543`)** → use for `DATABASE_URL`:
     ```text
     postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - **Session pooler / Direct connection (port `5432`)** → use for `DIRECT_URL`:
     ```text
     postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
     ```

## Step 3: Push the Schema & Seed Data to Supabase
From your Mac terminal inside this project folder:

1. Temporarily set `DATABASE_URL` and `DIRECT_URL` in your shell (or `.env`) to your Supabase URLs:
   ```bash
   export DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true"
   export DIRECT_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres"
   ```
2. Run Prisma migrations on Supabase:
   ```bash
   npx prisma migrate deploy
   ```
3. *(Optional)* Seed the 6 demo movies (make sure `MEILI_URL` and `MEILI_MASTER_KEY` point to your cloud Meilisearch if seeding for production):
   ```bash
   npm run cli -- seed-demo
   ```

## Step 4: Set Up Cloud Redis & Meilisearch (for Vercel)
Vercel only runs the Next.js web app, so it also needs hosted Redis & Meilisearch:
- **Redis**: Create a free database on [Upstash](https://upstash.com/) and copy the `REDIS_URL` (`rediss://...`).
- **Meilisearch**: Create a project on [Meilisearch Cloud](https://www.meilisearch.com/cloud) (or Railway/Fly.io) and copy `MEILI_URL` and `MEILI_MASTER_KEY`.

## Step 5: Add Environment Variables in Vercel & Deploy
1. Push this repo to GitHub.
2. In your Vercel project, go to **Settings → Environment Variables** and add:
   - `DATABASE_URL` (Supabase port `6543` with `?pgbouncer=true`)
   - `DIRECT_URL` (Supabase port `5432`)
   - `REDIS_URL` (Upstash)
   - `MEILI_URL` (Meilisearch Cloud)
   - `MEILI_MASTER_KEY` (Meilisearch Cloud)
   - `NEXT_PUBLIC_APP_URL` (`https://your-app.vercel.app`)
   - `WATCHMODE_API_KEY` or `TMDB_API_KEY` *(if you have one)*
3. Click **Redeploy** in Vercel.
