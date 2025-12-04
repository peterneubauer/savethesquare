// API endpoint to retrieve a specific donation by ID
// Returns the donation with all its squares for highlighting
// Netlify Function format

const { getSupabaseClient } = require('./lib/supabase');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const donationId = event.queryStringParameters?.id;

        if (!donationId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing donation ID parameter' })
            };
        }

        const client = getSupabaseClient();
        if (!client) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Database not configured' })
            };
        }

        // Fetch donation by ID
        const { data, error } = await client
            .from('donations')
            .select('*')
            .eq('id', donationId)
            .single();

        if (error) {
            console.error('Error fetching donation:', error);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Donation not found' })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                donation: data,
                squares: data.squares
            })
        };
    } catch (error) {
        console.error('Error reading donation:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
