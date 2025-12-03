# Client-Side Configuration Setup

## Important: Stripe Publishable Key

The Stripe **publishable key** needs to be added to `config.js` - this is different from the secret key!

### What's the difference?

| Key Type | Starts With | Where It Goes | Public/Secret |
|----------|-------------|---------------|---------------|
| **Publishable Key** | `pk_live_` or `pk_test_` | `config.js` (client-side) | ✅ **SAFE to expose** |
| **Secret Key** | `sk_live_` or `sk_test_` | Netlify Environment Variables | ❌ **MUST stay secret** |

### Step 1: Add Your Stripe Publishable Key

1. Open `config.js`
2. Replace `YOUR_STRIPE_PUBLISHABLE_KEY_HERE` with your actual publishable key
3. This key is **safe to commit to GitHub** - it's designed to be public!

Example:
```javascript
const CONFIG = {
    stripePublicKey: 'pk_live_51SaFi2DuBOMMIdznviA2Wpul5mv4b3WUqgTbr2dWCXmZXl1lHDLS3nDOngR9vsJyfmjgZy03kRMZE1zEBXBhvNNs00i8WgTDBs',
    apiUrl: window.location.origin,
    testMode: false
};
```

### Step 2: Verify Your Keys Match

Make sure both keys are from the same mode:
- **Testing**: Use `pk_test_...` AND `sk_test_...`
- **Production**: Use `pk_live_...` AND `sk_live_...`

### Where to Find Your Keys

1. Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
2. You'll see both:
   - **Publishable key** → Goes in `config.js`
   - **Secret key** → Goes in Netlify Environment Variables

### Test Mode vs Production

The `testMode` setting controls both payments AND email behavior:

#### When `testMode: true` (Development/Testing)
- ✅ Shows payment simulation alert (no real Stripe charge)
- ✅ Generates email HTML and displays it in a popup preview window
- ✅ **Does NOT** send actual emails via SendGrid
- ✅ **Does NOT** generate PDFs (skips expensive Puppeteer operation)
- ✅ Perfect for testing the email template and donation flow

#### When `testMode: false` (Production)
- ✅ Opens real Stripe Checkout for payment
- ✅ Sends actual confirmation emails via SendGrid
- ✅ Generates PDF maps with Puppeteer
- ✅ Full production behavior

### How to Use Test Mode

1. **During Development:**
   ```javascript
   testMode: true  // Shows email preview, no real emails/payments
   ```

2. **Before Going Live:**
   - Test the entire flow with `testMode: true`
   - Review the email preview that pops up
   - Verify the HTML email looks correct
   - Check that all donation details are accurate

3. **Production:**
   ```javascript
   testMode: false  // Real payments and emails
   ```

### Email Preview in Test Mode

When you complete a donation in test mode:
1. A popup window opens showing the email preview
2. You can switch between HTML and Plain Text tabs
3. See all email metadata (To, From, Subject)
4. View the highlight URL that would be included
5. Note about PDF generation being skipped

This lets you verify email content without:
- Using SendGrid API credits
- Waiting for Puppeteer to generate PDFs
- Actually sending emails to test addresses

---

**Remember**: Publishable keys are meant to be public. Only secret keys must be kept secret!
