// Stripe webhook handler for payment confirmations
// Netlify Function format

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { saveDonation } = require('./lib/supabase');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;

    try {
        // Verify webhook signature
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
        };
    }

    // Handle the event
    switch (stripeEvent.type) {
        case 'checkout.session.completed':
            const session = stripeEvent.data.object;

            // Extract metadata
            const donorName = session.metadata.donorName;
            const donorGreeting = session.metadata.donorGreeting || null;
            const squares = JSON.parse(session.metadata.squares);
            const modeData = session.metadata.modeData ? JSON.parse(session.metadata.modeData) : { mode: 'click' };
            const timestamp = new Date().toISOString();

            // Save donation data
            try {
                await saveDonation({
                    donorName,
                    donorEmail: session.customer_email,
                    donorGreeting,
                    squares,
                    amount: session.amount_total / 100, // Convert from öre to SEK
                    modeData,
                    timestamp,
                    sessionId: session.id,
                    paymentStatus: session.payment_status,
                });

                console.log('Donation saved:', { donorName, squareCount: squares.length, mode: modeData.mode });
            } catch (error) {
                console.error('Error saving donation:', error);
            }
            break;

        default:
            console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true })
    };
};

