// SIMPLIFIED VERSION - Use Leaflet canvas overlay instead of separate systems
// This ensures the donation map looks exactly like the location map

const SQUARE_PRICE = 20;

let squareData = {};
let selectedSquares = new Set();
let donationMap = null;
let propertyData = null;
let canvasOverlay = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPropertyData();
    checkPaymentStatus();
});

async function loadPropertyData() {
    try {
        const response = await fetch('ustorp_property_borders.json');
        propertyData = await response.json();

        initDonationMap();
        initLocationMap();
        loadSquareData();
        setupEventListeners();
        updateStats();
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

    const centerLat = 57.5398;
    const centerLon = 15.1820;

    // Create map
    try {
        donationMap = L.map('donation-map-leaflet', {
            center: [centerLat, centerLon],
            zoom: 17,
            zoomControl: false,
            attributionControl: true
        });

        console.log('Leaflet map created successfully');
    } catch (error) {
        console.error('Error creating map:', error);
        return;
    }

    // Add satellite imagery
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri',
        maxZoom: 20
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
                fillOpacity: 0.4,  // Darken/blur effect
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
    // Clear existing markers
    donationMap.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) {
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
}

// Initialize location map (same as before)
function initLocationMap() {
    const map = L.map('location-map').setView([57.5398, 15.1820], 13);

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
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(`<b>${feature.properties.name}</b><br>Ustorp 1:6`);
            }
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
    const squares = Array.from(selectedSquares);
    const amount = squares.length * SQUARE_PRICE;

    if (CONFIG.testMode) {
        alert(`TEST MODE\n\nBetalning: ${amount} SEK\nDonor: ${donorName}\nE-post: ${donorEmail}\nKvadrater: ${squares.length}\n\nI produktion skulle detta öppna Stripe Checkout.`);
        const confirmed = confirm('Simulera lyckad betalning?');
        if (confirmed) {
            completeDonation(squares, donorName, donorEmail);
        }
    }
}

function completeDonation(squares, donorName, donorEmail) {
    const timestamp = new Date().toISOString();
    squares.forEach(key => {
        squareData[key] = { donor: donorName, email: donorEmail, timestamp };
    });
    saveSquareData();
    selectedSquares.clear();
    updateSelectionUI();
    renderDonations();
    updateStats();
    closeDonationModal();
    alert('Tack för din donation! Dina kvadratmeter är nu markerade på kartan. ✅');
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
            const { squares, donorName, donorEmail } = JSON.parse(pending);
            completeDonation(squares, donorName, donorEmail);
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
