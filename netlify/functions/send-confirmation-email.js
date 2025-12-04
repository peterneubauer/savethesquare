// Netlify Function to send confirmation email
// Uses SendGrid for email delivery

const sgMail = require('@sendgrid/mail');

// Only initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

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
        const { donorName, donorEmail, donorGreeting, squares, amount, testMode } = JSON.parse(event.body);

        if (!donorEmail || !squares || !Array.isArray(squares)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Create highlight URL
        const highlightUrl = `${process.env.SITE_URL || 'http://localhost:8888'}?highlight=${squares.join(',')}`;

        // Generate email content
        const emailText = createEmailText(donorName, donorGreeting, squares.length, amount, highlightUrl);
        const emailHTML = createEmailHTML(donorName, donorGreeting, squares.length, amount, highlightUrl);

        // Test mode: Return preview with basic PDF simulation
        if (testMode) {
            const pdfPreviewUrl = highlightUrl;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    testMode: true,
                    message: 'Test mode - email preview generated (not sent)',
                    preview: {
                        to: donorEmail,
                        from: process.env.FROM_EMAIL || 'noreply@savethesquare.se',
                        subject: 'Tack för din donation till Visne Ängar! 🌿',
                        text: emailText,
                        html: emailHTML,
                        highlightUrl: highlightUrl,
                        pdfPreviewUrl: pdfPreviewUrl,
                        pdfInfo: 'PDF generation skipped in test mode - preview shows the page that would be captured'
                    }
                })
            };
        }

        // Production mode: Send email without PDF
        // (PDF generation removed due to Chromium dependency issues on Netlify)
        // Users can view their squares via the highlight URL link

        const msg = {
            to: donorEmail,
            from: process.env.FROM_EMAIL || 'noreply@savethesquare.se',
            subject: 'Tack för din donation till Visne Ängar! 🌿',
            text: emailText,
            html: emailHTML,
        };

        await sgMail.send(msg);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Email sent successfully' })
        };
    } catch (error) {
        console.error('Email error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};


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

Klicka på länken ovan för att se en interaktiv karta som visar exakt var dina kvadratmeter finns, med pulsande markeringar!

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

        <p>Klicka på knappen ovan för att se en interaktiv karta som visar exakt var dina kvadratmeter finns på Visne Ängar, med pulsande markeringar!</p>

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
