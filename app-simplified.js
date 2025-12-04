// SIMPLIFIED VERSION - Use Leaflet canvas overlay instead of separate systems
// This ensures the donation map looks exactly like the location map

const SQUARE_PRICE = 20;

let squareData = {};
let selectedSquares = new Set();
let donationMap = null;
let propertyData = null;
let canvasOverlay = null;
let highlightedSquares = []; // Store highlighted square keys for re-rendering

// Text mode variables
let currentMode = 'click'; // 'click' or 'text'
let textModeData = {
    text: '',
    color: '#FFD700',
    fontSize: 40,
    pixelDensity: 3,
    pixelRadius: 8,
    zoom: 17,
    squares: new Set(),
    conflictSquares: new Set()
};
let textPreviewLayers = []; // Store text preview polygon layers

// Load saved settings from localStorage
function loadTextSettings() {
    const saved = localStorage.getItem('textModeSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            if (settings.color) textModeData.color = settings.color;
            if (settings.fontSize) textModeData.fontSize = settings.fontSize;
            if (settings.pixelDensity) textModeData.pixelDensity = settings.pixelDensity;
            if (settings.pixelRadius) textModeData.pixelRadius = settings.pixelRadius;
        } catch (e) {
            console.error('Error loading text settings:', e);
        }
    }
}

// Save settings to localStorage
function saveTextSettings() {
    const settings = {
        color: textModeData.color,
        fontSize: textModeData.fontSize,
        pixelDensity: textModeData.pixelDensity,
        pixelRadius: textModeData.pixelRadius
    };
    localStorage.setItem('textModeSettings', JSON.stringify(settings));
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTextSettings(); // Load saved settings
    loadPropertyData();
    checkPaymentStatus();
    // checkHighlightParameter will be called after map is initialized
});

async function loadPropertyData() {
    try {
        const response = await fetch('visne_property_borders.json');
        propertyData = await response.json();

        initDonationMap();
        initLocationMap();
        loadSquareData(); // This will call updateStats() after loading data
        setupEventListeners();

        // Check for highlight parameter after map is initialized
        checkHighlightParameter();
    } catch (error) {
        console.error('Error loading property data:', error);
    }
}

// Create donation map using Leaflet with canvas overlay
function initDonationMap() {
    console.log('Initializing donation map...');

    const mapDiv = document.getElementById('donation-map-leaflet');
    if (!mapDiv) {
        console.error('Map div not found!');
        return;
    }

    console.log('Map div found:', mapDiv);

    const centerLat = 57.36;
    const centerLon = 18.64;

    // Create map
    try {
        donationMap = L.map('donation-map-leaflet', {
            center: [centerLat, centerLon],
            zoom: 17,
            maxZoom: 19,  // Prevent zooming beyond level 19 to ensure satellite tiles are available
            zoomControl: false,
            attributionControl: true
        });

        console.log('Leaflet map created successfully');
    } catch (error) {
        console.error('Error creating map:', error);
        return;
    }

    // Add satellite imagery with multiple sources for better coverage
    // Using Google Satellite as primary (better high-zoom coverage)
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: 'Google',
        maxZoom: 20,
        maxNativeZoom: 20
    }).addTo(donationMap);

    // First, add an inverse mask to blur/darken everything outside the property
    // Create an outer bounding box that covers everything
    const outerBounds = [
        [90, -180],   // Top-left (north-west)
        [90, 180],    // Top-right (north-east)
        [-90, 180],   // Bottom-right (south-east)
        [-90, -180],  // Bottom-left (south-west)
        [90, -180]    // Close the polygon
    ];

    // For each property feature, we'll create an inverse polygon (outer box with property as a hole)
    propertyData.features.forEach(feature => {
        const propertyCoords = feature.geometry.coordinates[0]; // Outer ring

        // Create a polygon with the outer bounds and the property as a hole
        const inversePolygon = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [outerBounds, propertyCoords]
            }
        };

        // Add the inverse polygon as a semi-transparent overlay
        L.geoJSON(inversePolygon, {
            style: {
                color: 'transparent',
                fillColor: '#000000',
                fillOpacity: 0.15,  // Lighter darken effect
                weight: 0,
                className: 'inverse-mask'
            }
        }).addTo(donationMap);
    });

    // Add property boundaries on top
    const geoLayer = L.geoJSON(propertyData, {
        style: {
            color: '#4caf50',  // Bright green
            weight: 5,         // Thicker line
            fillColor: 'transparent',
            fillOpacity: 0,
            className: 'property-boundary',
            opacity: 1
        }
    }).addTo(donationMap);

    // Fit to property
    donationMap.fitBounds(geoLayer.getBounds());

    // Add custom zoom controls
    addCustomZoomControls();

    // Add click handler for donations
    donationMap.on('click', handleMapClick);

    // Add zoom/pan handlers for text mode preview updates
    donationMap.on('zoomend', () => {
        if (currentMode === 'text' && textModeData.text.trim()) {
            updateTextPreview();
        }
    });

    donationMap.on('moveend', () => {
        if (currentMode === 'text' && textModeData.text.trim()) {
            updateTextPreview();
        }
    });
}

function addCustomZoomControls() {
    const zoomControl = L.control({ position: 'topright' });

    zoomControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'custom-zoom-control');
        div.innerHTML = `
            <button id="zoom-in-btn" class="zoom-btn">+</button>
            <button id="zoom-out-btn" class="zoom-btn">−</button>
            <button id="zoom-reset-btn" class="zoom-btn">⟲</button>
        `;
        return div;
    };

    zoomControl.addTo(donationMap);

    setTimeout(() => {
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');

        if (zoomInBtn) {
            L.DomEvent.disableClickPropagation(zoomInBtn);
            zoomInBtn.onclick = (e) => {
                e.stopPropagation();
                donationMap.zoomIn();
            };
        }

        if (zoomOutBtn) {
            L.DomEvent.disableClickPropagation(zoomOutBtn);
            zoomOutBtn.onclick = (e) => {
                e.stopPropagation();
                donationMap.zoomOut();
            };
        }

        if (zoomResetBtn) {
            L.DomEvent.disableClickPropagation(zoomResetBtn);
            zoomResetBtn.onclick = (e) => {
                e.stopPropagation();
                const geoLayer = L.geoJSON(propertyData);
                donationMap.fitBounds(geoLayer.getBounds());
            };
        }
    }, 100);
}

function handleMapClick(e) {
    const latlng = e.latlng;

    // Check if click is within property
    if (!isPointInProperty(latlng.lng, latlng.lat)) {
        alert('Denna position ligger utanför fastigheten');
        return;
    }

    // Create a square key (simplified - use lat/lng * 10000 for unique IDs)
    const key = `${Math.floor(latlng.lat * 100000)}_${Math.floor(latlng.lng * 100000)}`;

    if (squareData[key]) {
        alert(`Denna kvadrat är redan donerad av ${squareData[key].donor}`);
        return;
    }

    // Toggle selection
    if (selectedSquares.has(key)) {
        selectedSquares.delete(key);
    } else {
        selectedSquares.add(key);
    }

    updateSelectionUI();
    renderDonations();
}

// Same point-in-polygon check
function isPointInProperty(lon, lat) {
    for (const feature of propertyData.features) {
        if (isPointInPolygon(lon, lat, feature.geometry.coordinates)) {
            return true;
        }
    }
    return false;
}

function isPointInPolygon(lon, lat, polygonCoords) {
    const outerRing = polygonCoords[0];
    if (!pointInRing(lon, lat, outerRing)) return false;
    for (let i = 1; i < polygonCoords.length; i++) {
        if (pointInRing(lon, lat, polygonCoords[i])) return false;
    }
    return true;
}

function pointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > lat) !== (yj > lat))
            && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function renderDonations() {
    // Check if map is initialized
    if (!donationMap) {
        console.warn('Donation map not initialized yet');
        return;
    }

    // Clear existing markers EXCEPT highlighted ones, text previews, and property boundaries
    donationMap.eachLayer(layer => {
        if ((layer instanceof L.CircleMarker || layer instanceof L.Polygon) &&
            !layer.options.className?.includes('highlighted') &&
            !layer.options.className?.includes('text-preview') &&
            !layer.options.className?.includes('text-conflict') &&
            !layer.options.className?.includes('property-boundary') &&
            !layer.options.className?.includes('inverse-mask')) {
            donationMap.removeLayer(layer);
        }
    });

    // Calculate meter-to-degree conversion at current latitude
    const centerLat = donationMap.getCenter().lat;
    const meterInDegLat = 0.000009;
    const meterInDegLng = 0.000009 / Math.cos(centerLat * Math.PI / 180);

    // Draw donated squares
    for (const [key, data] of Object.entries(squareData)) {
        const [lat, lng] = key.split('_').map(n => n / 100000);

        // Check if this is a text-mode donation
        if (data.mode === 'text') {
            // Render as colored square polygon
            const squareBounds = [
                [lat - meterInDegLat/2, lng - meterInDegLng/2],
                [lat - meterInDegLat/2, lng + meterInDegLng/2],
                [lat + meterInDegLat/2, lng + meterInDegLng/2],
                [lat + meterInDegLat/2, lng - meterInDegLng/2],
                [lat - meterInDegLat/2, lng - meterInDegLng/2]
            ];

            L.polygon(squareBounds, {
                color: data.color || '#FFD700',
                weight: 1,
                fillColor: data.color || '#FFD700',
                fillOpacity: 0.8,
                className: 'donated-text-square'
            }).addTo(donationMap).bindPopup(`Donerad av: ${data.donor}<br><small>Text: "${data.text}"</small>`);
        } else {
            // Render as green circle marker (click mode)
            L.circleMarker([lat, lng], {
                radius: 6,
                fillColor: '#27ae60',
                fillOpacity: 0.95,
                stroke: true,
                color: '#1e8449',
                weight: 2,
                opacity: 1,
                className: 'donated-click-square'
            }).addTo(donationMap).bindPopup(`Donerad av: ${data.donor}`);
        }
    }

    // Draw selected squares (click mode only)
    if (currentMode === 'click') {
        selectedSquares.forEach(key => {
            const [lat, lng] = key.split('_').map(n => n / 100000);
            L.circleMarker([lat, lng], {
                radius: 3,
                fillColor: '#ffd54f',
                fillOpacity: 0.8,
                stroke: false
            }).addTo(donationMap);
        });
    }

    // Re-render highlighted squares if they exist (to keep them on top)
    rehighlightSquares();
}

// Initialize location map (same as before)
function initLocationMap() {
    const map = L.map('location-map').setView([57.36, 18.64], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const geoLayer = L.geoJSON(propertyData, {
        style: {
            color: '#2d5016',
            weight: 3,
            fillColor: '#7cb342',
            fillOpacity: 0.5
        },
        onEachFeature: (feature, layer) => {
            layer.bindPopup(`<b>Visne Ängar</b><br>Naturområde på Gotland`);
        }
    }).addTo(map);

    map.fitBounds(geoLayer.getBounds());
}

// Rest of the functions remain the same
function setupEventListeners() {
    document.getElementById('donate-btn').addEventListener('click', openDonationModal);
    document.getElementById('clear-selection-btn').addEventListener('click', clearSelection);
    document.querySelector('.close').addEventListener('click', closeDonationModal);
    document.getElementById('donation-form').addEventListener('submit', handleDonationSubmit);
    document.getElementById('donation-modal').addEventListener('click', (e) => {
        if (e.target.id === 'donation-modal') closeDonationModal();
    });

    // Mode toggle buttons
    document.getElementById('click-mode-btn').addEventListener('click', () => switchMode('click'));
    document.getElementById('text-mode-btn').addEventListener('click', () => switchMode('text'));

    // Text mode controls
    document.getElementById('text-input').addEventListener('input', handleTextInput);
    document.getElementById('text-color').addEventListener('input', handleColorChange);
    document.getElementById('font-size').addEventListener('input', handleFontSizeChange);
    document.getElementById('pixel-density').addEventListener('input', handlePixelDensityChange);
    document.getElementById('pixel-radius').addEventListener('input', handlePixelRadiusChange);

    // Update displays
    document.getElementById('font-size').addEventListener('input', (e) => {
        document.getElementById('font-size-display').textContent = e.target.value + 'px';
    });
    document.getElementById('pixel-density').addEventListener('input', (e) => {
        document.getElementById('pixel-density-display').textContent = e.target.value;
    });
    document.getElementById('pixel-radius').addEventListener('input', (e) => {
        document.getElementById('pixel-radius-display').textContent = e.target.value;
    });

    // Load saved settings into UI
    document.getElementById('text-color').value = textModeData.color;
    document.getElementById('font-size').value = textModeData.fontSize;
    document.getElementById('font-size-display').textContent = textModeData.fontSize + 'px';
    document.getElementById('pixel-density').value = textModeData.pixelDensity;
    document.getElementById('pixel-density-display').textContent = textModeData.pixelDensity;
    document.getElementById('pixel-radius').value = textModeData.pixelRadius;
    document.getElementById('pixel-radius-display').textContent = textModeData.pixelRadius;
}

function updateSelectionUI() {
    const count = currentMode === 'text' ? textModeData.squares.size : selectedSquares.size;
    const total = count * SQUARE_PRICE;

    document.getElementById('selected-count').textContent = count;
    document.getElementById('total-amount').textContent = total;
    document.getElementById('donate-btn').disabled = count === 0;
    document.getElementById('clear-selection-btn').disabled = count === 0;
}

function clearSelection() {
    if (currentMode === 'text') {
        textModeData.squares.clear();
        textModeData.conflictSquares.clear();
        clearTextPreview();
        updateTextStats();
        // Clear the text input
        document.getElementById('text-input').value = '';
        textModeData.text = '';
    } else {
        selectedSquares.clear();
    }
    updateSelectionUI();
    renderDonations();
}

function openDonationModal() {
    const count = currentMode === 'text' ? textModeData.squares.size : selectedSquares.size;
    if (count === 0) return;
    const total = count * SQUARE_PRICE;
    document.getElementById('modal-square-count').textContent = count;
    document.getElementById('modal-total').textContent = total;
    document.getElementById('donation-modal').classList.remove('hidden');
}

function closeDonationModal() {
    document.getElementById('donation-modal').classList.add('hidden');
    document.getElementById('donation-form').reset();
}

async function handleDonationSubmit(e) {
    e.preventDefault();
    const donorName = document.getElementById('donor-name').value;
    const donorEmail = document.getElementById('donor-email').value;
    const donorGreeting = document.getElementById('donor-greeting').value;

    // Get squares based on current mode
    let squares, amount;
    let modeData = { mode: currentMode };

    if (currentMode === 'text') {
        squares = Array.from(textModeData.squares);
        amount = squares.length * SQUARE_PRICE;
        modeData = {
            mode: 'text',
            text: textModeData.text,
            color: textModeData.color,
            fontSize: textModeData.fontSize,
            pixelDensity: textModeData.pixelDensity,
            pixelRadius: textModeData.pixelRadius,
            zoom: textModeData.zoom
        };
    } else {
        squares = Array.from(selectedSquares);
        amount = squares.length * SQUARE_PRICE;
        modeData = { mode: 'click' };
    }

    if (CONFIG.testMode) {
        const modeInfo = currentMode === 'text' ? `\nLäge: Text-läge\nText: "${modeData.text}"\nFärg: ${modeData.color}` : '\nLäge: Klick-läge';
        alert(`TEST MODE\n\nBetalning: ${amount} SEK\nDonor: ${donorName}\nE-post: ${donorEmail}\nKvadrater: ${squares.length}\nHälsning: ${donorGreeting || '(ingen)'}${modeInfo}\n\nI produktion skulle detta öppna Stripe Checkout och skicka bekräftelsemail med PDF.`);
        const confirmed = confirm('Simulera lyckad betalning och email?');
        if (confirmed) {
            completeDonation(squares, donorName, donorEmail, donorGreeting, modeData);
        }
    } else {
        // Production mode - use real Stripe Checkout
        try {
            // Store donation details for after payment
            localStorage.setItem('pendingDonation', JSON.stringify({
                squares,
                donorName,
                donorEmail,
                donorGreeting,
                modeData
            }));

            // Create Stripe Checkout Session
            const response = await fetch(`${CONFIG.apiUrl}/api/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    squares,
                    donorName,
                    donorEmail,
                    donorGreeting,
                    modeData
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }

            const { url } = await response.json();

            // Redirect to Stripe Checkout
            window.location.href = url;
        } catch (error) {
            console.error('Stripe checkout error:', error);
            alert('Ett fel uppstod vid betalningen. Försök igen senare.');
        }
    }
}

async function completeDonation(squares, donorName, donorEmail, donorGreeting = '', modeData = { mode: 'click' }) {
    const timestamp = new Date().toISOString();
    const amount = squares.length * SQUARE_PRICE;

    // Save to Supabase (works in both test and production mode)
    try {
        const saveResponse = await fetch(`${CONFIG.apiUrl}/api/save-donation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                donorName,
                donorEmail,
                donorGreeting,
                squares,
                amount,
                modeData
            })
        });

        if (saveResponse.ok) {
            console.log('✅ Donation saved to Supabase');
        } else {
            console.warn('⚠️ Failed to save donation to Supabase, using localStorage fallback');
        }
    } catch (error) {
        console.error('Error saving to Supabase:', error);
    }

    // Also update local state for immediate UI feedback
    squares.forEach(key => {
        squareData[key] = {
            donor: donorName,
            email: donorEmail,
            greeting: donorGreeting,
            timestamp,
            ...modeData  // Include mode, text, color, fontSize, zoom if text mode
        };
    });
    saveSquareData();
    selectedSquares.clear();
    textModeData.squares.clear();
    textModeData.conflictSquares.clear();
    clearTextPreview();
    updateSelectionUI();
    renderDonations();
    updateStats();
    closeDonationModal();

    // Show success with link to highlight purchased squares
    const highlightUrl = `${window.location.origin}${window.location.pathname}?highlight=${squares.join(',')}`;

    // Send confirmation email (with test mode if enabled)
    try {
        const response = await fetch(`${CONFIG.apiUrl}/api/send-confirmation-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                donorName,
                donorEmail,
                donorGreeting,
                squares,
                amount,
                testMode: CONFIG.emailTestMode !== undefined ? CONFIG.emailTestMode : CONFIG.testMode
            })
        });

        const result = await response.json();

        if (result.testMode) {
            // Display email preview in test mode
            displayEmailPreview(result.preview);
        } else if (result.success) {
            alert(`Tack för din donation! Dina kvadratmeter är nu markerade på kartan. ✅\n\nEtt bekräftelsemail med PDF-karta har skickats till ${donorEmail}\n\nDin personliga länk:\n${highlightUrl}`);
        } else {
            console.error('Email error:', result);
            alert(`Tack för din donation! Dina kvadratmeter är nu markerade på kartan. ✅\n\nOBS: Bekräftelseemailet kunde inte skickas. Kontakta oss om du behöver ett kvitto.\n\nDin personliga länk:\n${highlightUrl}`);
        }
    } catch (error) {
        console.error('Error sending email:', error);
        alert(`Tack för din donation! Dina kvadratmeter är nu markerade på kartan. ✅\n\nDin personliga länk:\n${highlightUrl}`);
    }
}

// Display email preview in a modal window for test mode
function displayEmailPreview(preview) {
    // Create a new window to display the email preview
    const previewWindow = window.open('', 'Email Preview', 'width=800,height=900');

    if (!previewWindow) {
        // Fallback if popup blocked
        console.log('Email Preview:', preview);
        alert(`TEST MODE - Email Preview\n\nTo: ${preview.to}\nFrom: ${preview.from}\nSubject: ${preview.subject}\n\nHTML email har skapats (öppna konsolen för detaljer)\n\nHighlight URL: ${preview.highlightUrl}\n\n${preview.pdfInfo}`);
        return;
    }

    previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Email Preview - Test Mode</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: #f5f5f5;
                }
                .preview-header {
                    background: #ff9800;
                    color: white;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }
                .preview-header h1 {
                    margin: 0;
                    font-size: 20px;
                }
                .email-meta {
                    background: white;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                    border: 1px solid #ddd;
                }
                .email-meta p {
                    margin: 5px 0;
                    font-size: 14px;
                }
                .email-meta strong {
                    color: #333;
                }
                .email-meta a {
                    color: #4caf50;
                    text-decoration: none;
                }
                .email-meta a:hover {
                    text-decoration: underline;
                }
                .email-content {
                    background: white;
                    border-radius: 5px;
                    border: 1px solid #ddd;
                    overflow: hidden;
                    margin-bottom: 20px;
                }
                .tabs {
                    display: flex;
                    background: #f0f0f0;
                    border-bottom: 1px solid #ddd;
                }
                .tab {
                    padding: 12px 24px;
                    cursor: pointer;
                    border: none;
                    background: transparent;
                    font-size: 14px;
                }
                .tab.active {
                    background: white;
                    border-bottom: 2px solid #4caf50;
                }
                .tab-content {
                    display: none;
                    padding: 20px;
                }
                .tab-content.active {
                    display: block;
                }
                .text-preview {
                    white-space: pre-wrap;
                    font-family: monospace;
                    font-size: 13px;
                }
                .pdf-preview {
                    background: white;
                    border-radius: 5px;
                    border: 1px solid #ddd;
                    overflow: hidden;
                }
                .pdf-preview-header {
                    background: #f0f0f0;
                    padding: 12px 20px;
                    border-bottom: 1px solid #ddd;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .pdf-preview-header h3 {
                    margin: 0;
                    font-size: 16px;
                    color: #333;
                }
                .pdf-preview-header a {
                    color: #4caf50;
                    text-decoration: none;
                    font-size: 14px;
                }
                .pdf-preview-header a:hover {
                    text-decoration: underline;
                }
                .pdf-iframe {
                    width: 100%;
                    height: 600px;
                    border: none;
                    background: white;
                }
                .pdf-note {
                    background: #fff9e6;
                    border: 1px solid #ffd700;
                    padding: 12px;
                    margin: 15px 20px;
                    border-radius: 5px;
                    font-size: 13px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="preview-header">
                <h1>🧪 TEST MODE - Email Preview (Not Sent)</h1>
                <p>This email was generated but not sent. Below is a preview of what would be sent.</p>
            </div>

            <div class="email-meta">
                <p><strong>To:</strong> ${preview.to}</p>
                <p><strong>From:</strong> ${preview.from}</p>
                <p><strong>Subject:</strong> ${preview.subject}</p>
                <p><strong>Highlight URL:</strong> <a href="${preview.highlightUrl}" target="_blank" rel="noopener">${preview.highlightUrl}</a></p>
            </div>

            <div class="email-content">
                <div class="tabs">
                    <button class="tab active" onclick="showTab('html')">HTML Email</button>
                    <button class="tab" onclick="showTab('text')">Plain Text</button>
                </div>

                <div id="html-tab" class="tab-content active">
                    ${preview.html}
                </div>

                <div id="text-tab" class="tab-content">
                    <div class="text-preview">${preview.text}</div>
                </div>
            </div>

            <div class="pdf-preview">
                <div class="pdf-preview-header">
                    <h3>📄 PDF Attachment Preview</h3>
                    <a href="${preview.pdfPreviewUrl}" target="_blank" rel="noopener">Open in New Tab ↗</a>
                </div>
                <div class="pdf-note">
                    ℹ️ In test mode, PDF generation is skipped for speed. This shows the page that would be captured as a PDF and attached to the email. In production, this would be a properly formatted A4 PDF document.
                </div>
                <iframe class="pdf-iframe" src="${preview.pdfPreviewUrl}" title="PDF Preview"></iframe>
            </div>

            <script>
                function showTab(tab) {
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                    if (tab === 'html') {
                        document.querySelector('.tab:nth-child(1)').classList.add('active');
                        document.getElementById('html-tab').classList.add('active');
                    } else {
                        document.querySelector('.tab:nth-child(2)').classList.add('active');
                        document.getElementById('text-tab').classList.add('active');
                    }
                }
            </script>
        </body>
        </html>
    `);

    previewWindow.document.close();
}

async function loadSquareData() {
    // Try to load from API first (shows donations from all users)
    try {
        const response = await fetch(`${CONFIG.apiUrl}/api/get-donations`);
        if (response.ok) {
            const data = await response.json();
            // Always use server data, even if empty (it's the source of truth)
            squareData = data.squareData || {};
            console.log(`✅ Loaded ${Object.keys(squareData).length} donated squares from server (Supabase)`);
            renderDonations();
            updateStats(false); // Update stats after loading data
            return;
        } else {
            console.warn('Server returned error:', response.status);
        }
    } catch (error) {
        console.warn('⚠️ Could not connect to server, falling back to localStorage:', error);
    }

    // Fallback to localStorage only if API call failed
    const saved = localStorage.getItem('squareData');
    if (saved) {
        squareData = JSON.parse(saved);
        console.log(`📦 Loaded ${Object.keys(squareData).length} donated squares from localStorage (offline mode)`);
        renderDonations();
        updateStats(false); // Update stats after loading data
    }
}

function saveSquareData() {
    localStorage.setItem('squareData', JSON.stringify(squareData));
}

function updateStats(animated = true) {
    const donatedCount = Object.keys(squareData).length;
    const totalRaised = donatedCount * SQUARE_PRICE;

    if (animated) {
        animateCounter('donated-squares', donatedCount);
        animateCounter('total-raised', totalRaised);
    } else {
        document.getElementById('donated-squares').textContent = donatedCount.toLocaleString('sv-SE');
        document.getElementById('total-raised').textContent = totalRaised.toLocaleString('sv-SE');
    }
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const currentText = element.textContent.replace(/\s/g, ''); // Remove spaces
    const currentValue = parseInt(currentText) || 0;

    if (currentValue === targetValue) return;

    // Add pulse animation class
    element.classList.add('updating');

    const duration = 1000; // 1 second animation
    const steps = 30;
    const increment = (targetValue - currentValue) / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;

    const timer = setInterval(() => {
        currentStep++;
        const newValue = Math.round(currentValue + (increment * currentStep));

        if (currentStep >= steps) {
            element.textContent = targetValue.toLocaleString('sv-SE');
            clearInterval(timer);
            // Remove animation class after a delay to let it complete
            setTimeout(() => element.classList.remove('updating'), 500);
        } else {
            element.textContent = newValue.toLocaleString('sv-SE');
        }
    }, stepDuration);
}

function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
        const pending = localStorage.getItem('pendingDonation');
        if (pending) {
            const { squares, donorName, donorEmail, donorGreeting, modeData } = JSON.parse(pending);
            completeDonation(squares, donorName, donorEmail, donorGreeting, modeData || { mode: 'click' });
            localStorage.removeItem('pendingDonation');
        } else {
            alert('Betalning genomförd! Tack för ditt stöd! ✅');
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('canceled') === 'true') {
        alert('Betalningen avbröts. Dina valda kvadratmeter är fortfarande tillgängliga.');
        localStorage.removeItem('pendingDonation');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ============ TEXT MODE FUNCTIONS ============

function switchMode(mode) {
    currentMode = mode;

    // Update button states
    document.getElementById('click-mode-btn').classList.toggle('active', mode === 'click');
    document.getElementById('text-mode-btn').classList.toggle('active', mode === 'text');

    // Show/hide text overlay
    document.getElementById('text-overlay').classList.toggle('hidden', mode === 'click');

    // Clear selections when switching modes
    if (mode === 'click') {
        clearTextPreview();
        textModeData.squares.clear();
        textModeData.conflictSquares.clear();
    } else {
        selectedSquares.clear();
    }

    updateSelectionUI();
    renderDonations();
}

function handleTextInput(e) {
    textModeData.text = e.target.value;
    updateTextPreview();
}

function handleColorChange(e) {
    textModeData.color = e.target.value;
    saveTextSettings();
    updateTextPreview();
}

function handleFontSizeChange(e) {
    textModeData.fontSize = parseInt(e.target.value);
    saveTextSettings();
    updateTextPreview();
}

function handlePixelDensityChange(e) {
    textModeData.pixelDensity = parseInt(e.target.value);
    saveTextSettings();
    updateTextPreview();
}

function handlePixelRadiusChange(e) {
    textModeData.pixelRadius = parseInt(e.target.value);
    saveTextSettings();
    updateTextPreview();
}

function updateTextPreview() {
    if (!textModeData.text.trim()) {
        clearTextPreview();
        textModeData.squares.clear();
        textModeData.conflictSquares.clear();
        updateTextStats();
        return;
    }

    // Get current zoom level
    textModeData.zoom = donationMap.getZoom();

    // Convert text to squares
    const squares = textToSquares(textModeData.text, textModeData.fontSize, textModeData.color);

    // Check for conflicts with donated squares
    textModeData.squares.clear();
    textModeData.conflictSquares.clear();

    squares.forEach(squareKey => {
        if (squareData[squareKey]) {
            textModeData.conflictSquares.add(squareKey);
        } else {
            textModeData.squares.add(squareKey);
        }
    });

    // Render preview
    renderTextPreview();
    updateTextStats();
}

function textToSquares(text, fontSize, color) {
    if (!donationMap) return [];

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size (make it large enough for text)
    canvas.width = 2000;
    canvas.height = 500;

    // Set font and style
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Draw text on canvas
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Get map center (where text is positioned)
    const mapCenter = donationMap.getCenter();
    const mapBounds = donationMap.getBounds();
    const mapPixelBounds = donationMap.getSize();

    // Calculate pixels per degree at current zoom
    const latRange = mapBounds.getNorth() - mapBounds.getSouth();
    const lngRange = mapBounds.getEast() - mapBounds.getWest();
    const pixelsPerDegreeLat = mapPixelBounds.y / latRange;
    const pixelsPerDegreeLng = mapPixelBounds.x / lngRange;

    // Sample pixels to find text - use pixelDensity to control sampling
    // Higher density = more samples = more detailed text = more squares
    const sampleRate = Math.max(1, Math.floor(fontSize / (textModeData.pixelDensity * 3)));
    const squares = new Set();

    for (let y = 0; y < canvas.height; y += sampleRate) {
        for (let x = 0; x < canvas.width; x += sampleRate) {
            const index = (y * canvas.width + x) * 4;
            const alpha = pixels[index + 3];

            // If pixel is not transparent (text is present)
            if (alpha > 128) {
                // Convert canvas coordinates to map offset from center
                const offsetX = x - canvas.width / 2;
                const offsetY = canvas.height / 2 - y; // Invert Y axis

                // Convert pixel offset to lat/lng offset
                const latOffset = offsetY / pixelsPerDegreeLat;
                const lngOffset = offsetX / pixelsPerDegreeLng;

                // Calculate actual lat/lng
                const lat = mapCenter.lat + latOffset;
                const lng = mapCenter.lng + lngOffset;

                // Check if within property bounds
                if (isPointInProperty(lng, lat)) {
                    const key = `${Math.floor(lat * 100000)}_${Math.floor(lng * 100000)}`;
                    squares.add(key);
                }
            }
        }
    }

    return Array.from(squares);
}

function renderTextPreview() {
    // Clear existing preview
    clearTextPreview();

    if (textModeData.squares.size === 0 && textModeData.conflictSquares.size === 0) {
        return;
    }

    // Calculate meter-to-degree conversion at current latitude
    const centerLat = donationMap.getCenter().lat;
    const meterInDegLat = 0.000009;
    const meterInDegLng = 0.000009 / Math.cos(centerLat * Math.PI / 180);

    // Render available squares in selected color (same style as highlight view)
    textModeData.squares.forEach(key => {
        const [lat, lng] = key.split('_').map(n => n / 100000);

        const squareBounds = [
            [lat - meterInDegLat/2, lng - meterInDegLng/2],  // Southwest
            [lat - meterInDegLat/2, lng + meterInDegLng/2],  // Southeast
            [lat + meterInDegLat/2, lng + meterInDegLng/2],  // Northeast
            [lat + meterInDegLat/2, lng - meterInDegLng/2],  // Northwest
            [lat - meterInDegLat/2, lng - meterInDegLng/2]   // Close
        ];

        // Draw square polygon outline
        const polygon = L.polygon(squareBounds, {
            color: textModeData.color,
            weight: 2,
            fillColor: textModeData.color,
            fillOpacity: 0.4,
            className: 'text-preview-square-polygon'
        }).addTo(donationMap);

        // Draw circular marker at center (like highlight view)
        const marker = L.circleMarker([lat, lng], {
            radius: textModeData.pixelRadius,
            fillColor: textModeData.color,
            fillOpacity: 0.8,
            color: textModeData.color,
            weight: 2,
            className: 'text-preview-square-marker'
        }).addTo(donationMap);

        textPreviewLayers.push(polygon, marker);
    });

    // Render conflict squares in red (same style as highlight view)
    textModeData.conflictSquares.forEach(key => {
        const [lat, lng] = key.split('_').map(n => n / 100000);

        const squareBounds = [
            [lat - meterInDegLat/2, lng - meterInDegLng/2],
            [lat - meterInDegLat/2, lng + meterInDegLng/2],
            [lat + meterInDegLat/2, lng + meterInDegLng/2],
            [lat + meterInDegLat/2, lng - meterInDegLng/2],
            [lat - meterInDegLat/2, lng - meterInDegLng/2]
        ];

        // Draw square polygon outline
        const polygon = L.polygon(squareBounds, {
            color: '#dc3545',
            weight: 2,
            fillColor: '#dc3545',
            fillOpacity: 0.3,
            className: 'text-conflict-square-polygon'
        }).addTo(donationMap);

        // Draw circular marker at center
        const marker = L.circleMarker([lat, lng], {
            radius: textModeData.pixelRadius,
            fillColor: '#dc3545',
            fillOpacity: 0.8,
            color: '#dc3545',
            weight: 2,
            className: 'text-conflict-square-marker'
        }).addTo(donationMap);

        textPreviewLayers.push(polygon, marker);
    });
}

function clearTextPreview() {
    textPreviewLayers.forEach(layer => {
        donationMap.removeLayer(layer);
    });
    textPreviewLayers = [];
}

function updateTextStats() {
    const validCount = textModeData.squares.size;
    const conflictCount = textModeData.conflictSquares.size;
    const total = validCount * SQUARE_PRICE;

    // Show/hide conflict warning (but don't block donation)
    const conflictWarning = document.getElementById('text-conflicts');
    if (conflictCount > 0) {
        conflictWarning.classList.remove('hidden');
        conflictWarning.textContent = `ℹ️ ${conflictCount} pixel hoppar över (redan donerade, visas röda) - inget problem!`;
    } else {
        conflictWarning.classList.add('hidden');
    }

    // Update donate button (allow donation even with conflicts)
    document.getElementById('donate-btn').disabled = validCount === 0;
    document.getElementById('selected-count').textContent = validCount;
    document.getElementById('total-amount').textContent = total;
}

// Re-render highlighted squares (called after renderDonations to keep them on top)
function rehighlightSquares() {
    if (highlightedSquares.length === 0 || !donationMap) return;

    console.log('rehighlightSquares called with', highlightedSquares.length, 'squares');

    highlightedSquares.forEach((key, index) => {
        const [lat, lng] = key.split('_').map(n => n / 100000);
        console.log(`Highlighting square ${index + 1}:`, key, '→', lat, lng);

        // Get square data to check if it's a text-mode donation with custom color
        const squareInfo = squareData[key];
        const isTextMode = squareInfo && squareInfo.mode === 'text';
        const customColor = isTextMode ? squareInfo.color : '#FFD700';
        const borderColor = isTextMode ? squareInfo.color : '#FF4500';

        // Calculate square boundaries (approximately 1 meter square)
        // At this latitude, 1 meter ≈ 0.000009 degrees latitude
        // For longitude, we need to account for latitude: 1 meter ≈ 0.000009 / cos(lat)
        const meterInDegLat = 0.000009;
        const meterInDegLng = 0.000009 / Math.cos(lat * Math.PI / 180);

        const squareBounds = [
            [lat - meterInDegLat/2, lng - meterInDegLng/2],  // Southwest
            [lat - meterInDegLat/2, lng + meterInDegLng/2],  // Southeast
            [lat + meterInDegLat/2, lng + meterInDegLng/2],  // Northeast
            [lat + meterInDegLat/2, lng - meterInDegLng/2],  // Northwest
            [lat - meterInDegLat/2, lng - meterInDegLng/2]   // Close the square
        ];

        // Draw the actual square meter outline (larger and interactive)
        const squarePolygon = L.polygon(squareBounds, {
            color: borderColor,       // Custom color for text mode, orange-red otherwise
            weight: 4,
            fillColor: customColor,   // Custom color for text mode, gold otherwise
            fillOpacity: 0.6,
            className: 'highlighted-square-polygon',
            pane: 'markerPane',
            interactive: true       // Make clickable
        }).addTo(donationMap);

        // Create large clickable marker at center
        const highlightMarker = L.circleMarker([lat, lng], {
            radius: 12,            // Larger radius for easier clicking
            fillColor: customColor,  // Custom color for text mode, gold otherwise
            fillOpacity: 0.9,
            color: borderColor,      // Custom color for text mode, orange-red otherwise
            weight: 4,
            className: 'highlighted-square-marker',
            pane: 'markerPane'
        }).addTo(donationMap);

        // Add popup with donor info if available
        let popupContent;

        if (squareInfo) {
            const donorName = squareInfo.donor || squareInfo.donorName || 'Anonym';
            const greeting = squareInfo.greeting || squareInfo.donorGreeting;

            popupContent = `<div style="text-align: center; padding: 12px; max-width: 250px;">
                <b style="color: #1a5d1a; font-size: 16px;">✨ Din Kvadrat! ✨</b><br>
                <span style="color: #666; font-size: 14px; margin-top: 4px; display: block;">Donerad av: <strong>${donorName}</strong></span>`;

            if (greeting) {
                popupContent += `<div style="margin-top: 8px; padding: 8px; background: #f0f7f0; border-radius: 4px; font-style: italic; color: #2d5016; font-size: 13px;">
                    "${greeting}"
                </div>`;
            }

            popupContent += `<span style="font-size: 12px; color: #999; margin-top: 8px; display: block;">Tack för ditt bidrag! 💚</span>
              </div>`;
        } else {
            popupContent = `<div style="text-align: center; padding: 8px;">
                 <b style="color: #1a5d1a; font-size: 16px;">✨ Din Donerade Kvadrat! ✨</b><br>
                 <span style="font-size: 12px; color: #999;">Tack för ditt bidrag! 💚</span>
               </div>`;
        }

        // Bind popup to both the marker and the polygon
        highlightMarker.bindPopup(popupContent);
        squarePolygon.bindPopup(popupContent);

        // Open popup automatically for the first highlighted square
        if (index === 0) {
            setTimeout(() => {
                highlightMarker.openPopup();
            }, 800); // Small delay to let the map settle
        }
    });
}

// Check if URL has highlight parameter to show specific donated squares
async function checkHighlightParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightParam = urlParams.get('highlight');
    const donationId = urlParams.get('donation_id');

    console.log('=== HIGHLIGHT CHECK ===');
    console.log('URL params:', window.location.search);
    console.log('Highlight param:', highlightParam);
    console.log('Donation ID param:', donationId);
    console.log('Donation map exists:', !!donationMap);

    if (!donationMap) return;

    // If donation_id is provided, fetch squares from API
    if (donationId) {
        try {
            console.log('Fetching donation by ID:', donationId);
            const response = await fetch(`${CONFIG.apiUrl}/api/get-donation-by-id?id=${donationId}`);
            if (response.ok) {
                const data = await response.json();
                highlightedSquares = data.squares || [];
                console.log('Loaded squares from donation:', highlightedSquares);
            } else {
                console.error('Failed to fetch donation:', response.status);
                return;
            }
        } catch (error) {
            console.error('Error fetching donation by ID:', error);
            return;
        }
    }
    // Otherwise, use comma-separated highlight parameter
    else if (highlightParam) {
        highlightedSquares = highlightParam.split(',');
        console.log('Highlighted squares from URL:', highlightedSquares);
    } else {
        return; // No highlight parameter
    }

    // Wait a bit for map to fully render
    setTimeout(() => {
        console.log('=== RENDERING HIGHLIGHTS ===');
        // Clear existing highlighted markers
        donationMap.eachLayer(layer => {
            if ((layer instanceof L.CircleMarker || layer instanceof L.Polygon) &&
                layer.options.className?.includes('highlighted')) {
                donationMap.removeLayer(layer);
            }
        });

        // Render highlighted squares
        rehighlightSquares();

        // Pan to first highlighted square with smooth animation
        if (highlightedSquares.length > 0) {
            const [lat, lng] = highlightedSquares[0].split('_').map(n => n / 100000);
            donationMap.flyTo([lat, lng], 18, {
                duration: 1.5,
                easeLinearity: 0.25
            });

            // Don't auto-open popup - let user click to see details
            // This prevents animation restarts
        }
    }, 500); // Short delay to let map finish rendering tiles
}
