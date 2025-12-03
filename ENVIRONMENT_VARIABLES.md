# Environment Variables Setup - Quick Reference

## Add These in Netlify Dashboard

**Location**: Site Settings → Environment Variables → Add a variable

### Required Variables:

```
Variable Name: SENDGRID_API_KEY
Value: SG.your_actual_sendgrid_api_key_here
Description: SendGrid API key for sending confirmation emails
```

```
Variable Name: STRIPE_SECRET_KEY
Value: sk_live_YOUR_ACTUAL_SECRET_KEY_HERE
Description: Stripe secret key for processing payments (starts with sk_live_ or sk_test_)
```

```
Variable Name: FROM_EMAIL
Value: noreply@savethesquare.se
Description: Email address for sending confirmation emails (must be verified in SendGrid)
```

```
Variable Name: SITE_URL
Value: https://your-site-name.netlify.app
Description: Your Netlify site URL (update after deployment)
```

## Step-by-Step in Netlify:

1. **Login** to [app.netlify.com](https://app.netlify.com)
2. **Select your site** from the dashboard
3. Click **Site settings** (top navigation)
4. Click **Environment variables** (left sidebar)
5. Click **Add a variable**
6. For each variable above:
   - Enter the **Variable Name** exactly as shown
   - Paste your actual **Value**
   - Click **Create variable**
7. **Redeploy** your site after adding all variables

## Where to Get Your API Keys:

### SendGrid API Key:
1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Settings → API Keys
3. Click "Create API Key"
4. Choose "Full Access" or "Restricted Access" (with Mail Send permissions)
5. Copy the key immediately (you won't see it again!)

### Stripe Secret Key:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Your secret key starts with `sk_live_` (production) or `sk_test_` (testing)
3. Copy the secret key
4. **Note**: Make sure it matches your publishable key mode (both live or both test)

### Verify FROM_EMAIL in SendGrid:
1. SendGrid Dashboard → Settings → Sender Authentication
2. Verify your domain or single sender email
3. Use the verified email as `FROM_EMAIL`

## Testing Locally:

If you want to test locally with Netlify Functions:

```bash
# Create .env file (not committed to git)
cp .env.example .env

# Edit .env with your actual keys
nano .env

# Install Netlify CLI
npm install -g netlify-cli

# Run local dev server
netlify dev
```

Your site will run at `http://localhost:8888` with functions working!

## Security Checklist:

- ✅ Never commit `.env` file to Git (already in `.gitignore`)
- ✅ Secret keys only in Netlify environment variables (server-side)
- ✅ Public keys can be in `config.js` (client-side) - that's safe!
- ✅ Use different keys for test vs. production
- ✅ Verify sender email in SendGrid before sending

---

**Questions?** Check `NETLIFY_DEPLOYMENT.md` for full deployment guide.
