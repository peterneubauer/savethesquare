// API endpoint to retrieve all donations
// Returns square donation data for rendering on the map
// Netlify Function format

const fs = require('fs');
const path = require('path');

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
        const donationsFile = path.join('/tmp', 'donations.json');

        let donations = [];

        if (fs.existsSync(donationsFile)) {
            const fileContent = fs.readFileSync(donationsFile, 'utf8');
            donations = JSON.parse(fileContent);
        }

        // Transform donations into square data format
        const squareData = {};

        donations.forEach(donation => {
            donation.squares.forEach(squareKey => {
                squareData[squareKey] = {
                    donor: donation.donorName,
                    timestamp: donation.timestamp,
                };
            });
        });

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
