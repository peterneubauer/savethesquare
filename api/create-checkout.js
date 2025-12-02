// Serverless function to create Stripe Checkout session
// Compatible with Vercel/Netlify

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { squares, donorName, donorEmail } = req.body;

        if (!squares || !Array.isArray(squares) || squares.length === 0) {
            return res.status(400).json({ error: 'Invalid squares data' });
        }

        if (!donorName || !donorEmail) {
            return res.status(400).json({ error: 'Donor name and email required' });
        }

        const squareCount = squares.length;
        const amount = squareCount * 20; // 20 SEK per square

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'sek',
                        product_data: {
                            name: 'Save The Square - Ustorp 1:6',
                            description: `Donation för ${squareCount} kvadratmeter`,
                            images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Nature_landscape.jpg/640px-Nature_landscape.jpg'],
                        },
                        unit_amount: 2000, // 20.00 SEK in öre
                    },
                    quantity: squareCount,
                },
            ],
            mode: 'payment',
            success_url: `${req.headers.origin || 'http://localhost:8000'}/?success=true`,
            cancel_url: `${req.headers.origin || 'http://localhost:8000'}/?canceled=true`,
            customer_email: donorEmail,
            metadata: {
                donorName: donorName,
                squareCount: squareCount.toString(),
                squares: JSON.stringify(squares),
            },
        });

        res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: error.message });
    }
};
