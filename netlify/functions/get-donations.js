// API endpoint to retrieve all donations
// Returns square donation data for rendering on the map

const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
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

        res.status(200).json({
            squareData,
            totalDonations: donations.length,
            totalSquares: Object.keys(squareData).length,
        });
    } catch (error) {
        console.error('Error reading donations:', error);
        res.status(500).json({ error: error.message });
    }
};
