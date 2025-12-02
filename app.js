// Configuration
const SQUARE_PRICE = 20; // SEK per square meter
const PIXEL_SIZE = 1; // 1 pixel = 1 square meter

// State
let squareData = {}; // Store donated squares {x_y: {donor: "name", timestamp: ""}}
let selectedSquares = new Set(); // Currently selected squares
let canvas, ctx;
let propertyData = null;
let propertyBounds = null;
let validSquares = new Set(); // Squares within property boundaries
let canvasWidth = 800;
let canvasHeight = 800;
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Satellite map and zoom state
let satelliteMap = null;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    loadPropertyData();
    checkPaymentStatus();
});

// Check if returning from Stripe payment
function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('success') === 'true') {
        // Payment successful
        const pending = localStorage.getItem('pendingDonation');

        if (pending) {
            const { squares, donorName, donorEmail } = JSON.parse(pending);
            completeDonation(squares, donorName, donorEmail);
            localStorage.removeItem('pendingDonation');
        } else {
            alert('Betalning genomförd! Tack för ditt stöd! ✅');
        }

        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('canceled') === 'true') {
        // Payment canceled
        alert('Betalningen avbröts. Dina valda kvadratmeter är fortfarande tillgängliga.');
        localStorage.removeItem('pendingDonation');

        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Load property GeoJSON and initialize
async function loadPropertyData() {
    try {
        const response = await fetch('ustorp_property_borders.json');
        propertyData = await response.json();

        calculatePropertyBounds();
        initCanvas();
        initLocationMap();
        loadSquareData();
        setupEventListeners();
        updateStats();
        renderGrid();
    } catch (error) {
        console.error('Error loading property data:', error);
    }
}

// Calculate bounding box and scale for the property
function calculatePropertyBounds() {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    propertyData.features.forEach(feature => {
        const coords = feature.geometry.coordinates;

        function processCoords(coordArray) {
            coordArray.forEach(point => {
                if (Array.isArray(point[0])) {
                    processCoords(point);
                } else {
                    const [lon, lat] = point;
                    minLon = Math.min(minLon, lon);
                    maxLon = Math.max(maxLon, lon);
                    minLat = Math.min(minLat, lat);
                    maxLat = Math.max(maxLat, lat);
                }
            });
        }

        processCoords(coords);
    });

    propertyBounds = { minLat, maxLat, minLon, maxLon };

    // Calculate approximate meters (rough calculation for Sweden latitude)
    const latToMeters = 111320; // meters per degree latitude
    const lonToMeters = 111320 * Math.cos(minLat * Math.PI / 180); // adjusted for latitude

    const widthMeters = (maxLon - minLon) * lonToMeters;
    const heightMeters = (maxLat - minLat) * latToMeters;

    // Set canvas size based on property dimensions
    const maxCanvasSize = 900;
    const aspectRatio = widthMeters / heightMeters;

    if (aspectRatio > 1) {
        canvasWidth = maxCanvasSize;
        canvasHeight = Math.round(maxCanvasSize / aspectRatio);
    } else {
        canvasHeight = maxCanvasSize;
        canvasWidth = Math.round(maxCanvasSize * aspectRatio);
    }

    // Calculate scale to convert lat/lon to canvas pixels
    scale = Math.min(
        canvasWidth / (maxLon - minLon),
        canvasHeight / (maxLat - minLat)
    );

    offsetX = -minLon;
    offsetY = -minLat;

    console.log('Property dimensions:', {
        widthMeters: widthMeters.toFixed(2),
        heightMeters: heightMeters.toFixed(2),
        canvasWidth,
        canvasHeight,
        totalSquareMeters: Math.round(widthMeters * heightMeters),
        bounds: propertyBounds
    });

    // Pre-calculate valid squares within property boundaries
    calculateValidSquares();
}

// Calculate which squares are within the property boundaries
function calculateValidSquares() {
    validSquares.clear();

    // For each pixel in the canvas, check if it's inside any polygon
    for (let x = 0; x < canvasWidth; x++) {
        for (let y = 0; y < canvasHeight; y++) {
            // Convert canvas coords back to lat/lon
            const lon = (x / scale) - offsetX;
            const lat = ((canvasHeight - y) / scale) - offsetY;

            // Check if point is inside any feature
            if (isPointInProperty(lon, lat)) {
                validSquares.add(`${x}_${y}`);
            }
        }
    }

    console.log(`Valid squares: ${validSquares.size} out of ${canvasWidth * canvasHeight}`);

    // Update total squares display
    const totalElement = document.querySelector('.stats .stat:last-child .stat-number');
    if (totalElement) {
        totalElement.textContent = validSquares.size.toLocaleString('sv-SE');
    }
}

// Check if a point (lon, lat) is inside any property polygon
function isPointInProperty(lon, lat) {
    for (const feature of propertyData.features) {
        if (isPointInPolygon(lon, lat, feature.geometry.coordinates)) {
            return true;
        }
    }
    return false;
}

// Point-in-polygon algorithm (ray casting)
function isPointInPolygon(lon, lat, polygonCoords) {
    // Handle both simple polygons and polygons with holes
    const outerRing = polygonCoords[0];

    if (!pointInRing(lon, lat, outerRing)) {
        return false;
    }

    // Check if point is in any holes (if present)
    for (let i = 1; i < polygonCoords.length; i++) {
        if (pointInRing(lon, lat, polygonCoords[i])) {
            return false; // Point is in a hole
        }
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

// Convert lat/lon to canvas coordinates
function latLonToCanvas(lon, lat) {
    const x = (lon + offsetX) * scale;
    const y = canvasHeight - ((lat + offsetY) * scale);
    return { x: Math.floor(x), y: Math.floor(y) };
}

// Initialize main canvas
function initCanvas() {
    canvas = document.getElementById('square-canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx = canvas.getContext('2d');

    // Initialize satellite map underneath
    initSatelliteMap();
}

// Initialize satellite map layer
function initSatelliteMap() {
    if (!propertyData) return;

    // Ensure map container has correct height and width first
    const mapContainer = document.getElementById('map-container');
    mapContainer.style.height = canvasHeight + 'px';

    // Set satellite map div to exact canvas dimensions
    const satelliteMapDiv = document.getElementById('satellite-map');
    satelliteMapDiv.style.width = canvasWidth + 'px';
    satelliteMapDiv.style.height = canvasHeight + 'px';

    const centerLat = (propertyBounds.minLat + propertyBounds.maxLat) / 2;
    const centerLon = (propertyBounds.minLon + propertyBounds.maxLon) / 2;

    // Create Leaflet map for satellite imagery - use same setup as location map
    satelliteMap = L.map('satellite-map', {
        center: [centerLat, centerLon],
        zoom: 17,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false
    });

    // Add satellite tile layer (using Esri World Imagery)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri',
        maxZoom: 20,
        minZoom: 10
    }).addTo(satelliteMap);

    // Add the property overlay with transparency to see the satellite imagery
    const geoLayer = L.geoJSON(propertyData, {
        style: {
            color: '#2d5016',
            weight: 0,
            fillColor: 'transparent',
            fillOpacity: 0
        }
    }).addTo(satelliteMap);

    // Force invalidate and fit to bounds - match location map exactly
    setTimeout(() => {
        satelliteMap.invalidateSize();
        satelliteMap.fitBounds(geoLayer.getBounds(), {
            padding: [0, 0],
            animate: false
        });
    }, 100);
}

// Setup zoom controls
function setupZoomControls() {
    document.getElementById('zoom-in').addEventListener('click', () => {
        zoomLevel = Math.min(zoomLevel + 0.25, 3);
        applyZoom();
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        zoomLevel = Math.max(zoomLevel - 0.25, 0.5);
        applyZoom();
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
        zoomLevel = 1;
        panX = 0;
        panY = 0;
        applyZoom();
    });

    // Pan functionality with mouse drag
    let startX, startY;

    canvas.addEventListener('mousedown', (e) => {
        if (e.shiftKey) {  // Hold shift to pan
            isPanning = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isPanning) {
            panX = e.clientX - startX;
            panY = e.clientY - startY;
            applyZoom();
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'crosshair';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'crosshair';
        }
    });
}

// Apply zoom and pan to canvas and satellite map
function applyZoom() {
    canvas.style.transform = `scale(${zoomLevel}) translate(${panX / zoomLevel}px, ${panY / zoomLevel}px)`;
    canvas.style.transformOrigin = 'center center';

    // Also zoom the satellite map
    const satelliteMapDiv = document.getElementById('satellite-map');
    if (satelliteMapDiv) {
        satelliteMapDiv.style.transform = `translateX(-50%) scale(${zoomLevel}) translate(${panX / zoomLevel}px, ${panY / zoomLevel}px)`;
        satelliteMapDiv.style.transformOrigin = 'center center';
    }
}

// Render the grid of squares
function renderGrid() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw semi-transparent overlay for non-property areas
    ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear property areas to show satellite imagery
    ctx.globalCompositeOperation = 'destination-out';
    propertyData.features.forEach(feature => {
        drawPolygon(feature.geometry.coordinates, 'rgba(0, 0, 0, 1)');
    });
    ctx.globalCompositeOperation = 'source-over';

    // Draw property borders
    ctx.strokeStyle = '#2d5016';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    propertyData.features.forEach(feature => {
        drawPolygonOutline(feature.geometry.coordinates);
    });
    ctx.shadowBlur = 0;

    // Draw donated squares
    ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--donated-color').trim();
    for (const [key, data] of Object.entries(squareData)) {
        if (validSquares.has(key)) {
            const [x, y] = key.split('_').map(Number);
            ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
        }
    }

    // Draw selected squares
    ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--selected-color').trim();
    selectedSquares.forEach(key => {
        if (validSquares.has(key)) {
            const [x, y] = key.split('_').map(Number);
            ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
        }
    });
}

// Draw filled polygon
function drawPolygon(coords, fillStyle) {
    const outerRing = coords[0];

    ctx.fillStyle = fillStyle;
    ctx.beginPath();

    outerRing.forEach((point, idx) => {
        const { x, y } = latLonToCanvas(point[0], point[1]);
        if (idx === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.closePath();
    ctx.fill();
}

// Draw polygon outline
function drawPolygonOutline(coords) {
    coords.forEach(ring => {
        ctx.beginPath();

        ring.forEach((point, idx) => {
            const { x, y } = latLonToCanvas(point[0], point[1]);
            if (idx === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.closePath();
        ctx.stroke();
    });
}

// Initialize location map (Leaflet)
function initLocationMap() {
    const map = L.map('location-map').setView([57.5398, 15.1820], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Display GeoJSON
    const geoLayer = L.geoJSON(propertyData, {
        style: {
            color: '#2d5016',
            weight: 3,
            fillColor: '#7cb342',
            fillOpacity: 0.5
        },
        onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(`<b>${feature.properties.name}</b><br>Ustorp 1:6`);
            }
        }
    }).addTo(map);

    // Fit map to show all features
    map.fitBounds(geoLayer.getBounds());
}

// Setup event listeners
function setupEventListeners() {
    // Setup zoom controls
    setupZoomControls();

    // Canvas click
    canvas.addEventListener('click', handleCanvasClick);

    // Canvas hover
    canvas.addEventListener('mousemove', handleCanvasHover);
    canvas.addEventListener('mouseleave', () => {
        document.getElementById('square-info').classList.add('hidden');
    });

    // Donate button
    document.getElementById('donate-btn').addEventListener('click', openDonationModal);

    // Clear selection button
    document.getElementById('clear-selection-btn').addEventListener('click', clearSelection);

    // Modal close
    document.querySelector('.close').addEventListener('click', closeDonationModal);

    // Modal form submission
    document.getElementById('donation-form').addEventListener('submit', handleDonationSubmit);

    // Close modal on outside click
    document.getElementById('donation-modal').addEventListener('click', (e) => {
        if (e.target.id === 'donation-modal') {
            closeDonationModal();
        }
    });
}

// Handle canvas click - toggle square selection
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const key = `${x}_${y}`;

    // Check if square is within property boundaries
    if (!validSquares.has(key)) {
        alert('Denna position ligger utanför fastigheten');
        return;
    }

    // Check if already donated
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
    renderGrid();
}

// Handle canvas hover - show square info
function handleCanvasHover(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const key = `${x}_${y}`;
    const infoDiv = document.getElementById('square-info');
    const coordsSpan = document.getElementById('square-coords');
    const statusSpan = document.getElementById('square-status');

    coordsSpan.textContent = `Position: ${x}, ${y}`;

    if (!validSquares.has(key)) {
        statusSpan.textContent = 'Utanför fastigheten';
        statusSpan.style.color = '#999';
    } else if (squareData[key]) {
        statusSpan.textContent = `Donerad av: ${squareData[key].donor}`;
        statusSpan.style.color = '#4a7c2c';
    } else if (selectedSquares.has(key)) {
        statusSpan.textContent = 'Vald för donation';
        statusSpan.style.color = '#ff9800';
    } else {
        statusSpan.textContent = 'Tillgänglig';
        statusSpan.style.color = '#7cb342';
    }

    infoDiv.classList.remove('hidden');
}

// Update selection UI
function updateSelectionUI() {
    const count = selectedSquares.size;
    const total = count * SQUARE_PRICE;

    document.getElementById('selected-count').textContent = count;
    document.getElementById('total-amount').textContent = total;

    const donateBtn = document.getElementById('donate-btn');
    const clearBtn = document.getElementById('clear-selection-btn');

    if (count > 0) {
        donateBtn.disabled = false;
        clearBtn.disabled = false;
    } else {
        donateBtn.disabled = true;
        clearBtn.disabled = true;
    }
}

// Clear selection
function clearSelection() {
    selectedSquares.clear();
    updateSelectionUI();
    renderGrid();
}

// Open donation modal
function openDonationModal() {
    if (selectedSquares.size === 0) return;

    const count = selectedSquares.size;
    const total = count * SQUARE_PRICE;

    document.getElementById('modal-square-count').textContent = count;
    document.getElementById('modal-total').textContent = total;

    document.getElementById('donation-modal').classList.remove('hidden');
}

// Close donation modal
function closeDonationModal() {
    document.getElementById('donation-modal').classList.add('hidden');
    document.getElementById('donation-form').reset();
}

// Handle donation form submission
async function handleDonationSubmit(e) {
    e.preventDefault();

    const donorName = document.getElementById('donor-name').value;
    const donorEmail = document.getElementById('donor-email').value;
    const squares = Array.from(selectedSquares);
    const amount = squares.length * SQUARE_PRICE;

    // Check if test mode or production
    if (CONFIG.testMode) {
        // Test mode - simulate payment
        alert(`TEST MODE\n\nBetalning: ${amount} SEK\nDonor: ${donorName}\nE-post: ${donorEmail}\nKvadrater: ${squares.length}\n\nI produktion skulle detta öppna Stripe Checkout.`);

        const confirmed = confirm('Simulera lyckad betalning?');

        if (confirmed) {
            completeDonation(squares, donorName, donorEmail);
        }
    } else {
        // Production mode - use Stripe
        try {
            // Disable submit button
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Laddar...';

            // Create Stripe Checkout session
            const response = await fetch(`${CONFIG.apiUrl}/api/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    squares,
                    donorName,
                    donorEmail,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }

            const { sessionId, url } = await response.json();

            // Redirect to Stripe Checkout
            if (url) {
                // Save pending donation to localStorage
                localStorage.setItem('pendingDonation', JSON.stringify({
                    squares,
                    donorName,
                    donorEmail,
                    timestamp: new Date().toISOString()
                }));

                // Redirect to Stripe
                window.location.href = url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (error) {
            console.error('Stripe error:', error);
            alert('Ett fel uppstod vid betalningen. Försök igen.');

            // Re-enable submit button
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Betala med Stripe';
        }
    }
}

// Complete donation after successful payment
function completeDonation(squares, donorName, donorEmail) {
    const timestamp = new Date().toISOString();

    squares.forEach(key => {
        squareData[key] = {
            donor: donorName,
            email: donorEmail,
            timestamp: timestamp
        };
    });

    // Save to localStorage
    saveSquareData();

    // Clear selection
    selectedSquares.clear();
    updateSelectionUI();
    renderGrid();
    updateStats();

    // Close modal
    closeDonationModal();

    // Show success message
    alert('Tack för din donation! Dina kvadratmeter är nu markerade på kartan. ✅');
}

// Load square data from localStorage
function loadSquareData() {
    const saved = localStorage.getItem('squareData');
    if (saved) {
        squareData = JSON.parse(saved);
    }
}

// Save square data to localStorage
function saveSquareData() {
    localStorage.setItem('squareData', JSON.stringify(squareData));
}

// Update statistics
function updateStats() {
    const donatedCount = Object.keys(squareData).length;
    const totalRaised = donatedCount * SQUARE_PRICE;

    document.getElementById('donated-squares').textContent = donatedCount.toLocaleString('sv-SE');
    document.getElementById('total-raised').textContent = totalRaised.toLocaleString('sv-SE');
}
