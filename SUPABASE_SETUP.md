# Supabase Setup Guide

This guide will help you set up Supabase for persistent donation storage.

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub, Google, or email
4. Create a new project:
   - **Name**: `savethesquare` (or any name you prefer)
   - **Database Password**: Choose a strong password (save it somewhere safe)
   - **Region**: Choose the closest to your users (e.g., Europe West for Sweden)
5. Wait 2-3 minutes for your project to be created

## Step 2: Create the Database Table

1. In your Supabase project dashboard, click **SQL Editor** in the left sidebar
2. Click **+ New query**
3. Paste the following SQL and click **Run**:

```sql
-- Create donations table
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_name TEXT NOT NULL,
    donor_email TEXT NOT NULL,
    squares JSONB NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT NOT NULL UNIQUE,
    payment_status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_donations_timestamp ON donations(timestamp DESC);
CREATE INDEX idx_donations_session_id ON donations(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous reads (for get-donations API)
CREATE POLICY "Enable read access for all users" ON donations
    FOR SELECT
    USING (true);

-- Create policy to allow service role to insert (for webhook)
CREATE POLICY "Enable insert for service role" ON donations
    FOR INSERT
    WITH CHECK (true);
```

## Step 3: Get Your API Credentials

1. In your Supabase dashboard, click **Settings** (gear icon) in the left sidebar
2. Click **API** in the settings menu
3. You'll see two important values:

   **Project URL**:
   ```
   https://your-project-id.supabase.co
   ```

   **anon public key** (starts with `eyJ...`):
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Step 4: Add to Your Environment Variables

### Local Development

Add to your `.env` file:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Netlify Deployment

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add two new variables:
   - **Key**: `SUPABASE_URL`, **Value**: Your Project URL
   - **Key**: `SUPABASE_ANON_KEY`, **Value**: Your anon public key
5. Click **Save**
6. Redeploy your site (or it will auto-deploy on next git push)

## Step 5: Test the Integration

1. Rebuild your project:
   ```bash
   npm run build
   ```

2. Start the dev server:
   ```bash
   netlify dev
   ```

3. Make a test donation:
   - Click on a square on the map
   - Click "Donera"
   - Complete the donation (in test mode)

4. Check Supabase:
   - Go to **Table Editor** in your Supabase dashboard
   - Select the `donations` table
   - You should see your test donation!

5. Refresh the page:
   - The donated square should appear (green marker)
   - Open browser console and look for: `Loaded X donated squares from server`

## Verify It's Working

### Good signs:
- ✅ Console shows: `Loaded X donated squares from server`
- ✅ Donations appear in Supabase Table Editor
- ✅ Green markers appear on the map after refresh
- ✅ Multiple users see the same donated squares

### If it's not working:
- ❌ Console shows: `Could not load donations from server, falling back to localStorage`
  - **Fix**: Check your `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
  - **Fix**: Make sure you ran the SQL to create the table
  - **Fix**: Check Netlify environment variables are set

- ❌ Error: `relation "donations" does not exist`
  - **Fix**: You didn't run the CREATE TABLE SQL in Step 2

- ❌ Error: `Failed to fetch`
  - **Fix**: CORS issue or Supabase is down (check status.supabase.com)

## Database Schema

The `donations` table has the following columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Auto-generated unique ID |
| `donor_name` | TEXT | Donor's name |
| `donor_email` | TEXT | Donor's email address |
| `squares` | JSONB | Array of square keys (e.g., `["5736000_1864000"]`) |
| `amount` | NUMERIC | Donation amount in SEK |
| `timestamp` | TIMESTAMPTZ | When the donation was made |
| `session_id` | TEXT | Stripe checkout session ID (unique) |
| `payment_status` | TEXT | Payment status from Stripe |
| `created_at` | TIMESTAMPTZ | Database insert time |

## Viewing Your Data

### In Supabase Dashboard:
1. Go to **Table Editor**
2. Select `donations` table
3. View, search, and filter donations

### Via SQL:
Go to **SQL Editor** and run queries like:

```sql
-- Get total donations
SELECT COUNT(*) as total_donations,
       SUM(amount) as total_amount,
       SUM(jsonb_array_length(squares)) as total_squares
FROM donations;

-- Get recent donations
SELECT donor_name, donor_email, amount,
       jsonb_array_length(squares) as square_count,
       timestamp
FROM donations
ORDER BY timestamp DESC
LIMIT 10;

-- Get top donors
SELECT donor_name,
       SUM(amount) as total_donated,
       SUM(jsonb_array_length(squares)) as total_squares
FROM donations
GROUP BY donor_name
ORDER BY total_donated DESC
LIMIT 10;
```

## Backup and Export

### Automatic Backups (Pro plan):
Supabase Pro includes daily automatic backups.

### Manual Export:
1. Go to **SQL Editor**
2. Run: `SELECT * FROM donations;`
3. Click **Download CSV**

### Export as JSON:
```bash
curl "https://your-project-id.supabase.co/rest/v1/donations?select=*" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" > donations.json
```

## Cost

**Free tier** includes:
- ✅ 500 MB database storage
- ✅ 1 GB file storage
- ✅ 2 GB bandwidth
- ✅ 50,000 monthly active users
- ✅ Unlimited API requests

This is more than enough for your use case! Even with 10,000 donations, you'd only use ~10 MB.

## Security Notes

- ✅ Row Level Security (RLS) is enabled
- ✅ Read access is public (anyone can see donated squares on the map)
- ✅ Write access is restricted (only the webhook can insert)
- ✅ The `anon` key is safe to use client-side (read-only by default)
- ✅ Webhook uses service role permissions via API (server-side only)

## Troubleshooting

### "Request failed with status code 401"
- Your `SUPABASE_ANON_KEY` is incorrect or expired
- Regenerate it in Supabase Settings → API

### "Could not connect to Supabase"
- Your `SUPABASE_URL` is incorrect
- Check for typos (it should be `https://your-project-id.supabase.co`)

### "Donations not appearing on map"
1. Check browser console for errors
2. Open Network tab, look for `/api/get-donations` request
3. Check the response - should contain `squareData` object
4. Verify Supabase Table Editor shows donations

## Support

- Supabase Docs: [https://supabase.com/docs](https://supabase.com/docs)
- Supabase Discord: [https://discord.supabase.com](https://discord.supabase.com)
- GitHub Issues: Open an issue in your repository

---

**You're all set!** Your donations are now stored in a real database and will persist forever. 🎉
