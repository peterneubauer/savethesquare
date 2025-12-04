# CLAUDE.md - Save The Square Project

## Project Goal

**Save The Square** is a donation platform for preserving Visne Ängar, a nature reserve on Gotland, Sweden. The platform allows donors to "adopt" individual square meters of land for 20 SEK each. Donors can select squares on an interactive map, make secure payments via Stripe, and receive confirmation emails with a PDF map showing their adopted squares.

## Current State

The project is **functional and ready for production deployment** on Netlify. It includes:

- Interactive Leaflet-based map with satellite imagery
- Stripe payment integration (Checkout Sessions)
- SendGrid email notifications with PDF attachments
- Test mode for development without real payments
- Netlify Functions for serverless backend

### What Works

- Map visualization with actual property boundaries from GeoJSON
- Click-to-select donation squares on the map
- Stripe Checkout for payments (production-ready)
- Email confirmations with custom greeting and PDF map attachment
- Test mode simulation (alerts + email preview)
- Highlight URL feature to show purchased squares

### Known Issues

1. **Property Data Mismatch**: Code references `visne_property_borders.json` but git shows `ustorp_property_borders.json` - need to verify which GeoJSON file is correct
2. **Git Status**: Multiple modified files in staging area - may need cleanup
3. **Background Processes**: Two `netlify dev` processes running (shells `6ad4a2` and `a1c1f2`) - might need cleanup

## Technology Stack

### Frontend
- **HTML5** - Semantic markup with modal overlay for donations
- **CSS3** - Custom styling with CSS variables for theming
- **JavaScript (ES6+)** - Vanilla JS, no frameworks
- **Leaflet 1.9.4** - Interactive map library
- **Stripe.js v3** - Payment integration

### Backend (Netlify Functions)
- **Node.js** - Serverless functions runtime
- **Stripe SDK** (v14.0.0) - Payment processing
- **SendGrid** (@sendgrid/mail v8.1.0) - Email delivery
- **Puppeteer + Chromium** - PDF generation from map screenshots

### Infrastructure
- **Netlify** - Hosting, serverless functions, CI/CD
- **Netlify Dev** - Local development server
- **Environment Variables** - Config management

## Project Structure

```
savethesquare/
├── index.html                      # Main HTML page
├── style.css                       # All styling
├── app-simplified.js               # Frontend logic (Leaflet + donation flow)
├── config.template.js              # Config template with placeholders
├── config.js                       # Generated config (gitignored)
├── build.js                        # Build script (injects env vars into config.js)
│
├── visne_property_borders.json     # GeoJSON with property boundaries
│
├── netlify/functions/              # Serverless backend
│   ├── create-checkout.js          # Create Stripe Checkout Session
│   ├── webhook.js                  # Handle Stripe payment confirmations
│   ├── send-confirmation-email.js  # Send email + generate PDF
│   └── get-donations.js            # API to retrieve donations (optional)
│
├── netlify.toml                    # Netlify configuration
├── package.json                    # Dependencies
├── .env.example                    # Environment variables template
└── README.md                       # User documentation
```

## Environment Variables

Required for production (set in Netlify Dashboard):

```bash
# Stripe
STRIPE_PUBLIC_KEY=pk_live_...       # Public key (also in config.template.js)
STRIPE_SECRET_KEY=sk_live_...       # Secret key (server-side only)
STRIPE_WEBHOOK_SECRET=whsec_...     # Webhook signing secret

# SendGrid
SENDGRID_API_KEY=SG.your_api_key    # Email API key
FROM_EMAIL=noreply@savethesquare.se # Sender email

# Site
SITE_URL=https://savethesquare.netlify.app  # Production URL

# Test Modes (optional, default: false)
STRIPE_TEST_MODE=true               # Simulates payments with alerts
EMAIL_TEST_MODE=false               # Send real emails even in test mode
```

## Key Features & Implementation

### 1. Interactive Map (`app-simplified.js`)

- Uses **Leaflet** with satellite tile layer from ArcGIS
- Renders property boundaries from GeoJSON
- Inverse mask darkens areas outside property
- Click handler checks if click is inside property boundaries
- Generates unique square keys: `${lat*100000}_${lng*100000}`
- Circle markers show donated/selected squares
- Custom zoom controls (zoom in/out/reset)

### 2. Donation Flow

**User Journey:**
1. Click on available squares → turns yellow (selected)
2. Click "Donera" button → modal opens
3. Enter name, email, optional greeting
4. Submit form:
   - **Test mode**: Shows alert with preview, simulates payment
   - **Production**: Redirects to Stripe Checkout

**After Payment:**
5. Stripe redirects back with `?success=true`
6. Frontend calls `send-confirmation-email` function
7. Squares marked as donated, stats updated
8. Email sent with PDF attachment

### 3. Payment Processing (Stripe)

**Create Checkout (`create-checkout.js`):**
- Creates Stripe Checkout Session
- Line item: 20 SEK × number of squares
- Metadata includes: `donorName`, `donorGreeting`, `squares[]`
- Success URL: `/?success=true`
- Cancel URL: `/?canceled=true`

**Webhook Handler (`webhook.js`):**
- Verifies Stripe signature
- Listens for `checkout.session.completed`
- Saves donation data to `/tmp/donations.json`
- (Note: Production should use a real database)

### 4. Email Confirmation (`send-confirmation-email.js`)

**Test Mode:**
- Returns preview in JSON (not sent)
- Opens new window with email HTML preview
- Shows tabs for HTML/Text versions
- Displays PDF preview (iframe of highlight URL)

**Production Mode:**
- Generates PDF using Puppeteer + Chromium
- Screenshots the highlight URL page
- Attaches PDF to email
- Sends via SendGrid

**Email Contents:**
- Plain text + HTML versions
- Donor name, greeting, square count, amount
- Link to highlight URL (`?highlight=square1,square2,...`)
- PDF attachment with map

### 5. Test Mode System

Controlled by environment variables:

- `STRIPE_TEST_MODE=true` → Shows alerts instead of Stripe Checkout
- `EMAIL_TEST_MODE=true` → Shows email preview instead of sending
- Default: both `false` (production behavior)

Build script (`build.js`) injects these into `config.js`:
```javascript
testMode: __STRIPE_TEST_MODE__       // replaced at build time
emailTestMode: __EMAIL_TEST_MODE__   // replaced at build time
```

### 6. Data Storage

**Current Implementation:**
- **Frontend**: `localStorage` for square data (dev/test)
- **Backend**: `/tmp/donations.json` (temporary, lost on restart)

**Production TODO:**
- Replace with persistent database (PostgreSQL, MongoDB, etc.)
- Add API endpoint to sync frontend with backend data
- Use `get-donations.js` to fetch all donations on page load

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your keys

# Run build script (injects env vars into config.js)
npm run build

# Start Netlify Dev server (functions + site)
npm run dev
# or
netlify dev

# Opens at http://localhost:8888
```

### Test Mode Development

```bash
# Enable test mode in .env
STRIPE_TEST_MODE=true
EMAIL_TEST_MODE=true

# Run build and dev server
npm run build
npm run dev

# Now donations will show alerts and email previews
```

### Production Deployment

```bash
# Deploy to Netlify
netlify deploy --prod

# Or use Git-based deploys:
git push origin main
# Netlify auto-deploys from GitHub/GitLab
```

**Netlify Dashboard Configuration:**
1. Set all environment variables (see `.env.example`)
2. Build command: `npm run build`
3. Publish directory: `.` (root)
4. Functions directory: `netlify/functions`

**Stripe Webhook Setup:**
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-site.netlify.app/.netlify/functions/webhook`
3. Select event: `checkout.session.completed`
4. Copy webhook secret → add to Netlify env as `STRIPE_WEBHOOK_SECRET`

## Code Architecture Decisions

### Why Leaflet Instead of Canvas?

The simplified version (`app-simplified.js`) uses Leaflet with circle markers instead of a custom canvas system because:
- Easier to maintain
- Built-in zoom/pan controls
- Satellite imagery integration
- Popup support for donor names
- Better mobile experience

### Why No Framework?

Vanilla JavaScript chosen for:
- Simplicity (no build complexity)
- Fast loading
- Easy to understand for future maintainers
- Small bundle size

### Why Netlify Functions?

Serverless approach provides:
- No server management
- Auto-scaling
- Pay-per-use pricing
- Easy environment variable management
- Integrated with Git deploys

### Why localStorage for Frontend Data?

Current solution is temporary:
- Simple for MVP/testing
- No database setup needed initially
- Works offline for demo purposes

**Limitation**: Data doesn't sync between users. Production needs backend database.

## Common Tasks

### Change Property Data

Replace `visne_property_borders.json` with new GeoJSON:
```javascript
// In app-simplified.js, line 21
const response = await fetch('your_new_property.json');
```

Update property center coordinates in line 46-47.

### Change Square Price

Edit `app-simplified.js` line 4:
```javascript
const SQUARE_PRICE = 20; // Change to new price
```

Also update `create-checkout.js` line 50 and 63.

### Change Styling

Edit CSS variables in `style.css`:
```css
:root {
    --primary-green: #2d5016;
    --donated-color: #4a7c2c;
    --available-color: #a8d5a8;
    --selected-color: #ffd54f;
}
```

### Add Database Integration

1. Choose database (Supabase, Fauna, MongoDB Atlas, etc.)
2. Update `webhook.js` to save donations to database
3. Implement `get-donations.js` to fetch all donations
4. Update `app-simplified.js` `loadSquareData()` to fetch from API
5. Remove localStorage usage

### Debug Email Issues

Check SendGrid:
```bash
# Verify API key
curl -X GET "https://api.sendgrid.com/v3/scopes" \
  -H "Authorization: Bearer $SENDGRID_API_KEY"

# Check sender email is verified in SendGrid dashboard
```

Use test mode to preview emails without sending:
```bash
EMAIL_TEST_MODE=true
npm run build && npm run dev
```

## Troubleshooting

### Map Not Loading

- Check browser console for errors
- Verify GeoJSON file exists and is valid
- Check Leaflet CDN is accessible
- Ensure `donation-map-leaflet` div exists in HTML

### Stripe Checkout Fails

- Verify `STRIPE_PUBLIC_KEY` is set correctly
- Check `STRIPE_SECRET_KEY` in Netlify environment variables
- Test with Stripe test keys first (`pk_test_...`, `sk_test_...`)
- Check network tab for API errors

### Email Not Sending

- Verify `SENDGRID_API_KEY` is valid
- Check `FROM_EMAIL` is verified in SendGrid
- Enable test mode to see email preview
- Check Netlify function logs for errors

### PDF Generation Fails

- PDF generation only works on Netlify (not local)
- Puppeteer requires `@sparticuz/chromium` layer
- Check function timeout (increase if needed in `netlify.toml`)
- Local dev skips PDF generation by design

### Webhook Not Receiving Events

- Verify webhook URL in Stripe dashboard
- Check `STRIPE_WEBHOOK_SECRET` is correct
- Test webhook with Stripe CLI:
  ```bash
  stripe listen --forward-to localhost:8888/.netlify/functions/webhook
  ```

## Next Steps / TODOs

1. **Fix property data inconsistency** - Verify correct GeoJSON file
2. **Add database integration** - Replace localStorage/tmp files
3. **Implement admin dashboard** - View all donations, stats
4. **Add authentication** - Protect admin routes
5. **Optimize map rendering** - For large number of donated squares
6. **Add analytics** - Track conversions, popular squares
7. **Mobile optimization** - Test touch interactions on map
8. **Add tests** - Unit tests for payment flow, email generation
9. **Error handling** - Better user feedback on failures
10. **Monitoring** - Set up error tracking (Sentry, LogRocket)

## Git Status (Current)

Modified files in staging area:
- `.claude/settings.local.json` (MM)
- `app-simplified.js` (MM)
- `build.js` (M)
- `netlify/functions/create-checkout.js` (AM)
- `netlify/functions/send-confirmation-email.js` (M)

New files:
- `netlify/functions/get-donations.js` (A)
- `netlify/functions/webhook.js` (A)
- `deno.lock`
- `package-lock.json`

**Action needed**: Review changes and create commit if ready.

## Quick Start After Fresh Clone

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your keys (or leave empty for test mode)

# 3. Build config
npm run build

# 4. Start dev server
npm run dev

# 5. Open browser
# http://localhost:8888

# 6. Test donation flow in test mode
# Click squares, donate, see email preview
```

## Resources

- **Stripe Docs**: https://stripe.com/docs/checkout/quickstart
- **SendGrid Docs**: https://docs.sendgrid.com/
- **Netlify Functions**: https://docs.netlify.com/functions/overview/
- **Leaflet Docs**: https://leafletjs.com/reference.html
- **GeoJSON Spec**: https://geojson.org/

---

**Last Updated**: 2025-12-04
**Current Branch**: main
**Production URL**: https://savethesquare.netlify.app (if deployed)
