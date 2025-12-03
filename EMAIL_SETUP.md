# Email Confirmation Setup Guide

## Overview

After a successful donation, donors receive a beautiful confirmation email with:
- Personal greeting message they wrote
- Details of their donation (squares, amount, date)
- **PDF attachment** with a map showing their purchased land
- **Personalized link** to view their squares highlighted on the website

## Required Services

### 1. SendGrid (Email Service)

1. Sign up at [https://sendgrid.com](https://sendgrid.com)
2. Create an API key:
   - Go to Settings → API Keys
   - Click "Create API Key"
   - Give it "Full Access" permissions
   - Copy the key (starts with `SG.`)
3. Verify a sender email address:
   - Go to Settings → Sender Authentication
   - Verify your domain or single sender email

### 2. Environment Variables

Add these to your Vercel project:

```bash
SENDGRID_API_KEY=SG.your_api_key_here
FROM_EMAIL=noreply@yourdomain.com
SITE_URL=https://peterneubauer.github.io/savethesquare
```

## How It Works

### 1. **Checkout Form**
Donor enters:
- Name (shown on map)
- Email (for confirmation)
- Greeting message (optional, shown in email)

### 2. **Payment Confirmation**
After successful Stripe payment:
- Stripe webhook triggers donation save
- Server calls `/api/send-confirmation-email`

### 3. **Email Generation**
The system:
- Creates a personalized email with donor's greeting
- Generates a unique URL: `?highlight=square1,square2,square3`
- Uses Puppeteer to screenshot the map with highlighted squares
- Creates PDF from the screenshot
- Sends email via SendGrid with PDF attached

### 4. **Personalized Link**
When donor clicks the link:
- Website loads with their squares highlighted in gold
- Map automatically zooms to their donated area
- Special markers show "Din donerade kvadrat!"

## Testing Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Add your SendGrid API key
   ```

3. **Run Vercel dev server:**
   ```bash
   vercel dev
   ```

4. **Test email endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/send-confirmation-email \
     -H "Content-Type: application/json" \
     -d '{
       "donorName": "Test User",
       "donorEmail": "test@example.com",
       "donorGreeting": "For a greener future!",
       "squares": ["5736000_1864000", "5736001_1864001"],
       "amount": 40
     }'
   ```

## Email Template

The email includes:
- **Header**: Green gradient with Save The Square logo
- **Greeting**: Personal message from donor (if provided)
- **Details Card**: Square count, amount, date
- **CTA Button**: "Visa mina kvadratmeter" (View my squares)
- **PDF Attachment**: Map showing purchased land
- **Footer**: Project branding

## PDF Generation

The PDF contains:
- Full website view with highlighted squares
- Satellite imagery of Visne Ängar
- Gold markers showing donor's exact squares
- Automatically zoomed to donor's area
- Format: A4, with margins

## URL Highlight Feature

Format: `?highlight=square1,square2,square3`

Example:
```
https://peterneubauer.github.io/savethesquare?highlight=5736000_1864000,5736001_1864001
```

When accessed:
- Highlighted squares appear in gold with orange border
- Map automatically pans to first square
- Popup opens: "Din donerade kvadrat!"
- Other donated squares remain green
- Available squares remain normal

## Customization

### Change Email Style
Edit `/api/send-confirmation-email.js`:
- Modify `createEmailHTML()` function
- Update CSS in the `<style>` tag

### Change PDF Format
Edit `/api/send-confirmation-email.js`:
- Modify `generateMapPDF()` function
- Change `format`, `margin`, or add custom HTML

### Change Highlight Color
Edit `/app-simplified.js`:
- Find `checkHighlightParameter()` function
- Modify `fillColor` and `color` properties

## Troubleshooting

### Email not sending
- Check SendGrid API key is correct
- Verify sender email is authenticated
- Check Vercel logs for errors

### PDF generation fails
- Ensure Chromium is installed (`@sparticuz/chromium`)
- Check Puppeteer timeout settings
- Verify site is accessible from server

### Highlight not working
- Check URL format is correct
- Ensure squares IDs match saved data
- Verify JavaScript console for errors

## Production Checklist

- [ ] SendGrid account created
- [ ] Sender email verified
- [ ] Environment variables set in Vercel
- [ ] Test email sent successfully
- [ ] PDF generates correctly
- [ ] Highlight link works
- [ ] Update `FROM_EMAIL` to your domain
- [ ] Add custom email branding

## Cost Estimates

**SendGrid:**
- Free tier: 100 emails/day forever
- Essentials: $19.95/month (50,000 emails)

**Vercel:**
- Hobby: Free (100GB bandwidth)
- Pro: $20/month (1TB bandwidth)

**Puppeteer/Chromium:**
- Included in serverless function runtime
- No additional cost

---

Questions? Check the main README.md or open an issue.
