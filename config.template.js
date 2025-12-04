// Configuration file for Stripe and API endpoints
const CONFIG = {
    // Stripe publishable key - this is safe to expose in client-side code
    // Replace with your actual Stripe publishable key from https://dashboard.stripe.com/apikeys
    // Note: pk_live_ for production, pk_test_ for testing
    stripePublicKey: 'pk_live_51SaFi2DuBOMMIdznviA2Wpul5mv4b3WUqgTbr2dWCXmZXl1lHDLS3nDOngR9vsJyfmjgZy03kRMZE1zEBXBhvNNs00i8WgTDBs',

    // API endpoint for Netlify Functions
    // Automatically uses the same domain for API calls
    apiUrl: window.location.origin,

    // Enable test mode (shows alerts instead of real payments)
    // Controlled by STRIPE_TEST_MODE environment variable (defaults to false for production)
    // Set STRIPE_TEST_MODE=true in Netlify to enable test mode
    testMode: __STRIPE_TEST_MODE__,

    // Enable email test mode (shows email preview instead of sending)
    // Controlled by EMAIL_TEST_MODE environment variable (defaults to same as testMode)
    // Set EMAIL_TEST_MODE=false to send real emails even when Stripe is in test mode
    emailTestMode: __EMAIL_TEST_MODE__
};
