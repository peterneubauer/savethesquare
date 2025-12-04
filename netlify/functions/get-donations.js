// API endpoint to retrieve all donations
// Returns square donation data for rendering on the map
// Netlify Function format

const { getAllDonations, transformToSquareData } = require('./lib/supabase');

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
        // Fetch all donations from Supabase
        const donations = await getAllDonations();

        // Transform donations into square data format for the map
        const squareData = transformToSquareData(donations);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                squareData,
                totalDonations: donations.length,
                totalSquares: Object.keys(squareData).length,
            })
        };
    } catch (error) {
        console.error('Error reading donations:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
