# Test Mode - Email Preview Feature

## Overview

Test mode now includes a **complete email preview system** that lets you see exactly what donors will receive - without sending actual emails or generating PDFs.

## How It Works

### 1. Enable Test Mode

In `config.js`:
```javascript
const CONFIG = {
    testMode: true  // Enable test mode
};
```

### 2. Make a Test Donation

1. Select squares on the map
2. Click "Donera"
3. Fill in donor information
4. Click "Betala med Stripe"
5. Confirm the test payment simulation

### 3. Email Preview Opens

A popup window will display:

```
┌─────────────────────────────────────────┐
│ 🧪 TEST MODE - Email Preview (Not Sent) │
├─────────────────────────────────────────┤
│                                          │
│ To: donor@example.com                    │
│ From: noreply@savethesquare.se           │
│ Subject: Tack för din donation...        │
│ PDF Attachment: Skipped in test mode     │
│ Highlight URL: [clickable link]          │
│                                          │
│ [HTML Preview] [Plain Text]              │
│ ┌────────────────────────────────────┐  │
│ │                                     │  │
│ │  🌿 SAVE THE SQUARE                 │  │
│ │  Tack för din donation!             │  │
│ │                                     │  │
│ │  Hej [Donor Name]!                  │  │
│ │  ... [full email content] ...       │  │
│ │                                     │  │
│ └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 4. Review the Email

- Switch between **HTML Preview** and **Plain Text** tabs
- See the complete email as donors would receive it
- Check personalization (name, greeting, squares)
- Verify formatting and styling
- Test the highlight URL link

## What Gets Skipped in Test Mode

✅ **Generated (Fast)**:
- Email HTML template
- Email plain text version
- Donation metadata
- Highlight URL

❌ **Skipped (To Save Time & Resources)**:
- SendGrid API call (no email sent)
- Puppeteer PDF generation (expensive operation)
- Stripe payment processing

## Benefits

### Fast Testing
- No waiting for PDF generation (can take 5-10 seconds)
- Instant preview in popup window
- Test multiple iterations quickly

### No Resource Usage
- Doesn't consume SendGrid API credits
- No Chromium/Puppeteer overhead
- No actual email deliveries

### Accurate Preview
- See exactly what the email will look like
- Test with real donation data
- Verify all personalization fields
- Check HTML rendering

## Production Mode

When ready to go live:

```javascript
const CONFIG = {
    testMode: false  // Disable test mode
};
```

Now donations will:
- Process real Stripe payments
- Generate PDF maps with Puppeteer
- Send actual emails via SendGrid

## Popup Blocked?

If your browser blocks the preview popup:

1. **Allow popups** for your site
2. Or check the **browser console** - the preview data is logged there
3. An alert will show basic email info as fallback

## Testing Checklist

Before going to production:

- [ ] Test donation flow in test mode
- [ ] Review email preview for formatting
- [ ] Verify donor name appears correctly
- [ ] Check greeting message displays (if provided)
- [ ] Confirm square count and amount are accurate
- [ ] Test highlight URL link
- [ ] Verify both HTML and plain text versions look good
- [ ] Test with different donor names and greetings
- [ ] Check Swedish date formatting
- [ ] Switch to `testMode: false` for production

## Example Test Flow

```javascript
// 1. Developer selects 3 squares
// 2. Fills in:
//    Name: "Test User"
//    Email: "test@example.com"
//    Greeting: "För en grönare framtid!"
// 3. Clicks donate
// 4. Preview window opens showing:
//    - Email to test@example.com
//    - 3 m² donation for 60 SEK
//    - Greeting included in email
//    - Highlight URL for those 3 squares
//    - Full styled HTML email
```

## Troubleshooting

### Preview window doesn't open
- Check browser popup blocker settings
- Look in browser console for logged preview data
- Use the fallback alert for basic info

### Email looks wrong
- Review HTML in the preview
- Check CSS in `netlify/functions/send-confirmation-email.js`
- Test with different content lengths

### Want to test PDF generation
- Temporarily set `testMode: false`
- Use a test email address
- Note: This will actually send the email and generate PDF

---

**Pro Tip**: Keep `testMode: true` until you've fully tested the donation flow and are ready to accept real payments!
