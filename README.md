# Save The Square - Ustorp 1:6

A donation platform for preserving Ustorp 1:6 property in Halland, Sweden. Donors can "adopt" individual square meters of land for 20 SEK each.

## Features

- **Interactive Map**: Visual representation of the actual property boundaries from GeoJSON
- **Pixel-based Donations**: Each pixel represents 1 square meter of land
- **Stripe Integration**: Secure payment processing
- **Real-time Updates**: See donated squares in real-time
- **Donor Recognition**: Donor names displayed on their adopted squares

## Project Structure

```
savethesquare/
├── index.html              # Main website
├── style.css               # Styles
├── app.js                  # Frontend logic
├── config.js               # Configuration (API keys, etc.)
├── ustorp_property_borders.json  # GeoJSON property data
├── api/                    # Serverless functions
│   ├── create-checkout.js  # Create Stripe checkout session
│   ├── webhook.js          # Handle Stripe webhooks
│   └── get-donations.js    # Retrieve donation data
├── package.json
├── vercel.json             # Vercel deployment config
└── .env.example            # Environment variables template

```

## Local Development

### Quick Start (Test Mode)

1. **Clone and navigate to the project:**
   ```bash
   cd savethesquare
   ```

2. **Start the web server:**
   ```bash
   npm run dev
   # or
   python3 -m http.server 8000
   ```

3. **Open in browser:**
   ```
   http://localhost:8000
   ```

The site runs in test mode by default - no Stripe keys needed for testing!

### Production Setup with Stripe

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get Stripe API keys:**
   - Sign up at [https://stripe.com](https://stripe.com)
   - Get your test keys from [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)

3. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Add your Stripe keys:
     ```
     STRIPE_PUBLIC_KEY=pk_test_...
     STRIPE_SECRET_KEY=sk_test_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     ```

4. **Update config.js:**
   ```javascript
   stripePublicKey: 'pk_test_YOUR_ACTUAL_KEY',
   testMode: false  // Enable real payments
   ```

5. **Run with Vercel CLI (for serverless functions):**
   ```bash
   npm install -g vercel
   vercel dev
   ```

   Access at: `http://localhost:3000`

## Deployment to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Add environment variables in Vercel dashboard:**
   - Go to your project settings
   - Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`

4. **Set up Stripe webhook:**
   - In Stripe dashboard, add webhook endpoint: `https://your-domain.vercel.app/api/webhook`
   - Select events: `checkout.session.completed`
   - Copy webhook secret to Vercel environment variables

## How It Works

### Frontend Flow

1. User clicks on available squares on the map
2. Selected squares turn yellow
3. User clicks "Donera" button
4. Modal opens with donation details
5. User enters name and email
6. In test mode: Simulated payment
7. In production: Redirects to Stripe Checkout
8. After payment: Squares marked as donated with donor's name

### Backend Flow (Production)

1. Frontend calls `/api/create-checkout` with selected squares
2. Serverless function creates Stripe Checkout session
3. User redirected to Stripe payment page
4. After payment, Stripe sends webhook to `/api/webhook`
5. Webhook handler saves donation data
6. User redirected back to site with success message

### Technical Details

- **Property Boundaries**: Uses point-in-polygon algorithm to validate squares are within actual property
- **Area Calculation**: Converts lat/lon coordinates to approximate meters for canvas rendering
- **Data Storage**:
  - Test mode: localStorage
  - Production: JSON file (can be replaced with database)
- **Payment**: Stripe Checkout for secure card processing

## Customization

### Change Property Data

Replace `ustorp_property_borders.json` with your own GeoJSON file. The code automatically:
- Calculates property bounds
- Determines valid squares within boundaries
- Renders the exact shape on canvas

### Change Price

Edit `app.js`:
```javascript
const SQUARE_PRICE = 20; // Change to your price in SEK
```

### Styling

All colors and styles in `style.css`:
```css
:root {
    --primary-green: #2d5016;
    --donated-color: #4a7c2c;
    --available-color: #a8d5a8;
    --selected-color: #ffd54f;
}
```

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Canvas API support required
- JavaScript ES6+ required

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

---

**Note**: This is a donation platform for land conservation. Make sure to consult with legal advisors about land ownership and donation regulations in your jurisdiction.
