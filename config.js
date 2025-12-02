// Configuration file for Stripe and API endpoints
const CONFIG = {
    // Stripe publishable key (replace with your actual key)
    // Get this from https://dashboard.stripe.com/test/apikeys
    stripePublicKey: 'pk_test_YOUR_KEY_HERE',

    // API endpoint (change based on environment)
    // For local development with Vercel CLI: http://localhost:3000
    // For production: your Vercel deployment URL
    apiUrl: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : window.location.origin,

    // Enable test mode (shows alerts instead of real payments)
    testMode: true
};
