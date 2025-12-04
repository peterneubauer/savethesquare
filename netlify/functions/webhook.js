// Stripe webhook handler for payment confirmations
// Compatible with Vercel/Netlify

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;

            // Extract metadata
            const donorName = session.metadata.donorName;
            const squares = JSON.parse(session.metadata.squares);
            const timestamp = new Date().toISOString();

            // Save donation data
            try {
                await saveDonation({
                    donorName,
                    donorEmail: session.customer_email,
                    squares,
                    amount: session.amount_total / 100, // Convert from öre to SEK
                    timestamp,
                    sessionId: session.id,
                    paymentStatus: session.payment_status,
                });

                console.log('Donation saved:', { donorName, squareCount: squares.length });
            } catch (error) {
                console.error('Error saving donation:', error);
            }
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
};

// Helper function to save donation
async function saveDonation(donationData) {
    // In production, save to a database (PostgreSQL, MongoDB, etc.)
    // For now, we'll save to a JSON file

    const donationsFile = path.join('/tmp', 'donations.json');

    let donations = [];

    try {
        if (fs.existsSync(donationsFile)) {
            const fileContent = fs.readFileSync(donationsFile, 'utf8');
            donations = JSON.parse(fileContent);
        }
    } catch (error) {
        console.error('Error reading donations file:', error);
    }

    // Add new donation
    donations.push(donationData);

    // Save back to file
    fs.writeFileSync(donationsFile, JSON.stringify(donations, null, 2));

    return donationData;
}
