// Supabase client for donation storage
// Provides persistent storage across serverless function restarts

const { createClient } = require('@supabase/supabase-js');

let supabase = null;

// Initialize Supabase client (singleton)
function getSupabaseClient() {
    if (supabase) return supabase;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.warn('Supabase credentials not configured, using fallback storage');
        return null;
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    return supabase;
}

/**
 * Save a donation to Supabase
 * Table schema:
 * - id: uuid (auto-generated)
 * - donor_name: text
 * - donor_email: text
 * - donor_greeting: text (optional)
 * - squares: jsonb (array of square keys)
 * - amount: numeric
 * - timestamp: timestamptz
 * - session_id: text
 * - payment_status: text
 */
async function saveDonation(donationData) {
    const client = getSupabaseClient();

    if (!client) {
        console.error('Supabase not configured, donation not saved');
        return null;
    }

    const { data, error } = await client
        .from('donations')
        .insert([{
            donor_name: donationData.donorName,
            donor_email: donationData.donorEmail,
            donor_greeting: donationData.donorGreeting || null,
            squares: donationData.squares,
            amount: donationData.amount,
            timestamp: donationData.timestamp,
            session_id: donationData.sessionId,
            payment_status: donationData.paymentStatus
        }])
        .select();

    if (error) {
        console.error('Error saving donation to Supabase:', error);
        throw error;
    }

    console.log('Donation saved to Supabase:', data[0].id);
    return data[0];
}

/**
 * Get all donations from Supabase
 * Returns array of donation objects
 */
async function getAllDonations() {
    const client = getSupabaseClient();

    if (!client) {
        console.error('Supabase not configured, returning empty donations');
        return [];
    }

    const { data, error } = await client
        .from('donations')
        .select('*')
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching donations from Supabase:', error);
        throw error;
    }

    return data || [];
}

/**
 * Transform donations into square data format for the map
 * Returns object with square keys as keys and donor info as values
 */
function transformToSquareData(donations) {
    const squareData = {};

    donations.forEach(donation => {
        donation.squares.forEach(squareKey => {
            squareData[squareKey] = {
                donor: donation.donor_name,
                email: donation.donor_email,
                greeting: donation.donor_greeting,
                timestamp: donation.timestamp,
            };
        });
    });

    return squareData;
}

module.exports = {
    getSupabaseClient,
    saveDonation,
    getAllDonations,
    transformToSquareData
};
