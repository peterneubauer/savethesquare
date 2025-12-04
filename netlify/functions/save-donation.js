// API endpoint to manually save a donation (for test mode)
// In production, donations are saved via Stripe webhook
// Netlify Function format

const { saveDonation } = require('./lib/supabase');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
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

    try {
        const { donorName, donorEmail, donorGreeting, squares, amount } = JSON.parse(event.body);

        if (!donorName || !donorEmail || !squares || !amount) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Save donation to Supabase
        const donationData = {
            donorName,
            donorEmail,
            squares,
            amount,
            timestamp: new Date().toISOString(),
            sessionId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate fake session ID for test mode
            paymentStatus: 'test_mode_simulated'
        };

        const savedDonation = await saveDonation(donationData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                donation: savedDonation
            })
        };
    } catch (error) {
        console.error('Error saving donation:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
