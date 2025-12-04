// SIMPLIFIED VERSION - Use Leaflet canvas overlay instead of separate systems
// This ensures the donation map looks exactly like the location map

const SQUARE_PRICE = 20;

let squareData = {};
let selectedSquares = new Set();
let donationMap = null;
let propertyData = null;
let canvasOverlay = null;
let highlightedSquares = []; // Store highlighted square keys for re-rendering

// Initialize
document.addEventListener('DOMContentLoaded', () => {
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
        loadSquareData();
        setupEventListeners();
        updateStats();

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
                weight: 0
            }
        }).addTo(donationMap);
    });

    // Add property boundaries on top
    const geoLayer = L.geoJSON(propertyData, {
        style: {
            color: '#2d5016',
            weight: 3,
            fillColor: 'transparent',
            fillOpacity: 0
        }
    }).addTo(donationMap);

    // Fit to property
    donationMap.fitBounds(geoLayer.getBounds());

    // Add custom zoom controls
    addCustomZoomControls();

    // Add click handler for donations
    donationMap.on('click', handleMapClick);
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

    // Clear existing markers EXCEPT highlighted ones
    donationMap.eachLayer(layer => {
        if ((layer instanceof L.CircleMarker || layer instanceof L.Polygon) &&
            !layer.options.className?.includes('highlighted')) {
            donationMap.removeLayer(layer);
        }
    });

    // Draw donated squares
    for (const [key, data] of Object.entries(squareData)) {
        const [lat, lng] = key.split('_').map(n => n / 100000);
        L.circleMarker([lat, lng], {
            radius: 3,
            fillColor: '#4a7c2c',
            fillOpacity: 0.8,
            stroke: false
        }).addTo(donationMap).bindPopup(`Donerad av: ${data.donor}`);
    }

    // Draw selected squares
    selectedSquares.forEach(key => {
        const [lat, lng] = key.split('_').map(n => n / 100000);
        L.circleMarker([lat, lng], {
            radius: 3,
            fillColor: '#ffd54f',
            fillOpacity: 0.8,
            stroke: false
        }).addTo(donationMap);
    });

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
}

function updateSelectionUI() {
    const count = selectedSquares.size;
    const total = count * SQUARE_PRICE;
    document.getElementById('selected-count').textContent = count;
    document.getElementById('total-amount').textContent = total;
    document.getElementById('donate-btn').disabled = count === 0;
    document.getElementById('clear-selection-btn').disabled = count === 0;
}

function clearSelection() {
    selectedSquares.clear();
    updateSelectionUI();
    renderDonations();
}

function openDonationModal() {
    if (selectedSquares.size === 0) return;
    const count = selectedSquares.size;
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
    const squares = Array.from(selectedSquares);
    const amount = squares.length * SQUARE_PRICE;

    if (CONFIG.testMode) {
        alert(`TEST MODE\n\nBetalning: ${amount} SEK\nDonor: ${donorName}\nE-post: ${donorEmail}\nKvadrater: ${squares.length}\nHälsning: ${donorGreeting || '(ingen)'}\n\nI produktion skulle detta öppna Stripe Checkout och skicka bekräftelsemail med PDF.`);
        const confirmed = confirm('Simulera lyckad betalning och email?');
        if (confirmed) {
            completeDonation(squares, donorName, donorEmail, donorGreeting);
        }
    } else {
        // Production mode - use real Stripe Checkout
        try {
            // Store donation details for after payment
            localStorage.setItem('pendingDonation', JSON.stringify({
                squares,
                donorName,
                donorEmail,
                donorGreeting
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
                    donorGreeting
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

async function completeDonation(squares, donorName, donorEmail, donorGreeting = '') {
    const timestamp = new Date().toISOString();
    const amount = squares.length * SQUARE_PRICE;

    squares.forEach(key => {
        squareData[key] = {
            donor: donorName,
            email: donorEmail,
            greeting: donorGreeting,
            timestamp
        };
    });
    saveSquareData();
    selectedSquares.clear();
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

function loadSquareData() {
    const saved = localStorage.getItem('squareData');
    if (saved) {
        squareData = JSON.parse(saved);
        renderDonations();
    }
}

function saveSquareData() {
    localStorage.setItem('squareData', JSON.stringify(squareData));
}

function updateStats() {
    const donatedCount = Object.keys(squareData).length;
    const totalRaised = donatedCount * SQUARE_PRICE;
    document.getElementById('donated-squares').textContent = donatedCount.toLocaleString('sv-SE');
    document.getElementById('total-raised').textContent = totalRaised.toLocaleString('sv-SE');
}

function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
        const pending = localStorage.getItem('pendingDonation');
        if (pending) {
            const { squares, donorName, donorEmail, donorGreeting } = JSON.parse(pending);
            completeDonation(squares, donorName, donorEmail, donorGreeting);
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

// Re-render highlighted squares (called after renderDonations to keep them on top)
function rehighlightSquares() {
    if (highlightedSquares.length === 0 || !donationMap) return;

    console.log('rehighlightSquares called with', highlightedSquares.length, 'squares');

    highlightedSquares.forEach((key, index) => {
        const [lat, lng] = key.split('_').map(n => n / 100000);
        console.log(`Highlighting square ${index + 1}:`, key, '→', lat, lng);

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

        // Draw the actual square meter outline
        L.polygon(squareBounds, {
            color: '#FF4500',       // Orange-red border
            weight: 3,
            fillColor: '#FFD700',   // Gold fill
            fillOpacity: 0.4,
            className: 'highlighted-square-polygon',
            pane: 'markerPane',
            interactive: false      // Disable interactions to prevent clicks
        }).addTo(donationMap);

        // Create outer glow (larger circle for emphasis)
        L.circleMarker([lat, lng], {
            radius: 15,
            fillColor: '#FFD700',
            fillOpacity: 0.2,
            color: '#FFD700',
            weight: 2,
            opacity: 0.6,
            className: 'highlighted-glow',
            pane: 'markerPane',
            interactive: false      // Disable interactions to prevent clicks
        }).addTo(donationMap);

        // Create main pulsing highlighted marker (center point)
        const highlightMarker = L.circleMarker([lat, lng], {
            radius: 6,
            fillColor: '#FFD700',  // Bright gold
            fillOpacity: 1,
            color: '#FF4500',  // Orange-red border
            weight: 3,
            className: 'highlighted-square pulsing-marker',
            pane: 'markerPane'
        }).addTo(donationMap);

        // Add popup with donor info if available
        const squareInfo = squareData[key];
        const popupContent = squareInfo
            ? `<div style="text-align: center; padding: 8px;">
                 <b style="color: #1a5d1a; font-size: 16px;">✨ Din Kvadrat! ✨</b><br>
                 <span style="color: #666; font-size: 14px;">Donerad av: ${squareInfo.donor || squareInfo.donorName}</span><br>
                 <span style="font-size: 12px; color: #999;">Tack för ditt bidrag! 💚</span>
               </div>`
            : `<div style="text-align: center; padding: 8px;">
                 <b style="color: #1a5d1a; font-size: 16px;">✨ Din Donerade Kvadrat! ✨</b><br>
                 <span style="font-size: 12px; color: #999;">Tack för ditt bidrag! 💚</span>
               </div>`;

        highlightMarker.bindPopup(popupContent);
    });
}

// Check if URL has highlight parameter to show specific donated squares
function checkHighlightParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightParam = urlParams.get('highlight');

    console.log('=== HIGHLIGHT CHECK ===');
    console.log('URL params:', window.location.search);
    console.log('Highlight param:', highlightParam);
    console.log('Donation map exists:', !!donationMap);

    if (highlightParam && donationMap) {
        highlightedSquares = highlightParam.split(',');
        console.log('Highlighted squares:', highlightedSquares);

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
}
