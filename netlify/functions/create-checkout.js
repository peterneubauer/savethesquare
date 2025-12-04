// Netlify Function to create Stripe Checkout session

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { squares, donorName, donorEmail, donorGreeting } = JSON.parse(event.body);

        if (!squares || !Array.isArray(squares) || squares.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid squares data' })
            };
        }

        if (!donorName || !donorEmail) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Donor name and email required' })
            };
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
                            name: 'Save The Square - Visne Ängar',
                            description: `Donation för ${squareCount} kvadratmeter`,
                        },
                        unit_amount: 2000, // 20.00 SEK in öre
                    },
                    quantity: squareCount,
                },
            ],
            mode: 'payment',
            success_url: `${event.headers.origin || event.headers.referer || 'http://localhost:8888'}?success=true`,
            cancel_url: `${event.headers.origin || event.headers.referer || 'http://localhost:8888'}?canceled=true`,
            customer_email: donorEmail,
            metadata: {
                donorName: donorName,
                donorGreeting: donorGreeting || '',
                squareCount: squareCount.toString(),
                squares: JSON.stringify(squares),
            },
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ sessionId: session.id, url: session.url })
        };
    } catch (error) {
        console.error('Stripe error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
