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
    // Set to false when ready for production
    testMode: true
};
