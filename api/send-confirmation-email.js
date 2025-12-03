// Serverless function to send confirmation email with PDF
// Uses SendGrid for email and Puppeteer for PDF generation

const sgMail = require('@sendgrid/mail');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { donorName, donorEmail, donorGreeting, squares, amount } = req.body;

        if (!donorEmail || !squares || !Array.isArray(squares)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create highlight URL
        const highlightUrl = `${process.env.SITE_URL || 'https://peterneubauer.github.io/savethesquare'}?highlight=${squares.join(',')}`;

        // Generate PDF with map screenshot
        const pdfBuffer = await generateMapPDF(highlightUrl, donorName, squares.length);

        // Send email
        const msg = {
            to: donorEmail,
            from: process.env.FROM_EMAIL || 'noreply@savethesquare.se',
            subject: 'Tack för din donation till Visne Ängar! 🌿',
            text: createEmailText(donorName, donorGreeting, squares.length, amount, highlightUrl),
            html: createEmailHTML(donorName, donorGreeting, squares.length, amount, highlightUrl),
            attachments: [
                {
                    content: pdfBuffer.toString('base64'),
                    filename: `visne-angar-donation-${donorName.replace(/\s+/g, '-')}.pdf`,
                    type: 'application/pdf',
                    disposition: 'attachment'
                }
            ]
        };

        await sgMail.send(msg);

        res.status(200).json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Generate PDF with map screenshot
async function generateMapPDF(highlightUrl, donorName, squareCount) {
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Navigate to the highlight URL
    await page.goto(highlightUrl, { waitUntil: 'networkidle0' });

    // Wait for map to load
    await page.waitForTimeout(3000);

    // Generate PDF
    const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
        }
    });

    await browser.close();

    return Buffer.from(pdf);
}

// Create plain text email
function createEmailText(donorName, greeting, squareCount, amount, highlightUrl) {
    return `
Hej ${donorName}!

Tack för din generösa donation till Visne Ängar!

${greeting ? `Din hälsning: "${greeting}"\n` : ''}

DONATION DETALJER:
- Antal kvadratmeter: ${squareCount}
- Totalt belopp: ${amount} SEK
- Datum: ${new Date().toLocaleDateString('sv-SE')}

Se dina donerade kvadratmeter på kartan:
${highlightUrl}

Bifogat hittar du en PDF med en karta som visar exakt var dina kvadratmeter finns.

Ditt bidrag går direkt till bevarande och skötsel av Visne Ängar på Gotland.

Med vänliga hälsningar,
Save The Square-teamet

---
Save The Square
Rädda Visne Ängar - En kvadratmeter i taget
    `.trim();
}

// Create HTML email
function createEmailHTML(donorName, greeting, squareCount, amount, highlightUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #2d5016, #4a7c2c);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .content {
            background: #f9f9f9;
            padding: 30px;
            border: 2px solid #4a7c2c;
            border-top: none;
            border-radius: 0 0 10px 10px;
        }
        .greeting {
            background: #e8f5e9;
            border-left: 4px solid #4a7c2c;
            padding: 15px;
            margin: 20px 0;
            font-style: italic;
        }
        .details {
            background: white;
            border: 1px solid #ddd;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .details strong {
            color: #2d5016;
        }
        .button {
            display: inline-block;
            background: #7cb342;
            color: white !important;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌿 SAVE THE SQUARE</h1>
        <p>Tack för din donation!</p>
    </div>

    <div class="content">
        <h2>Hej ${donorName}!</h2>
        <p>Stort tack för din generösa donation till Visne Ängar på Gotland!</p>

        ${greeting ? `
        <div class="greeting">
            <strong>Din hälsning:</strong><br>
            "${greeting}"
        </div>
        ` : ''}

        <div class="details">
            <h3>📋 Donationsdetaljer</h3>
            <p><strong>Antal kvadratmeter:</strong> ${squareCount} m²</p>
            <p><strong>Totalt belopp:</strong> ${amount} SEK</p>
            <p><strong>Datum:</strong> ${new Date().toLocaleDateString('sv-SE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}</p>
        </div>

        <p>Se dina donerade kvadratmeter på kartan:</p>
        <center>
            <a href="${highlightUrl}" class="button">
                🗺️ Visa mina kvadratmeter
            </a>
        </center>

        <p>Bifogat i detta email hittar du en PDF med en karta som visar exakt var dina kvadratmeter finns på Visne Ängar.</p>

        <p>Ditt bidrag går direkt till bevarande och skötsel av detta unika naturområde.</p>

        <p>Med vänliga hälsningar,<br>
        <strong>Save The Square-teamet</strong></p>
    </div>

    <div class="footer">
        <p>Save The Square - Rädda Visne Ängar</p>
        <p>En kvadratmeter i taget 🌿</p>
    </div>
</body>
</html>
    `.trim();
}
