// Initialize map
let map;
let usgsLayer;
let noaaLayer;
let usgsData = [];
let noaaData = [];

// US States for filtering
const US_STATES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

// Initialize the application
function initApp() {
    initMap();
    populateStateFilter();
    attachEventListeners();
    loadData();
}

// Initialize Leaflet map
function initMap() {
    map = L.map('map').setView([39.8283, -98.5795], 4); // Center of USA

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    }).addTo(map);

    // Initialize marker cluster groups
    usgsLayer = L.markerClusterGroup({
        iconCreateFunction: function(cluster) {
            return L.divIcon({
                html: '<div style="background-color: #1E88E5; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">' + cluster.getChildCount() + '</div>',
                className: 'marker-cluster-usgs',
                iconSize: L.point(40, 40)
            });
        }
    });

    noaaLayer = L.markerClusterGroup({
        iconCreateFunction: function(cluster) {
            return L.divIcon({
                html: '<div style="background-color: #F4511E; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">' + cluster.getChildCount() + '</div>',
                className: 'marker-cluster-noaa',
                iconSize: L.point(40, 40)
            });
        }
    });

    map.addLayer(usgsLayer);
    map.addLayer(noaaLayer);
}

// Populate state filter dropdown
function populateStateFilter() {
    const select = document.getElementById('stateFilter');
    Object.entries(US_STATES).forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        select.appendChild(option);
    });
}

// Attach event listeners
function attachEventListeners() {
    document.getElementById('showUSGS').addEventListener('change', toggleUSGSLayer);
    document.getElementById('showNOAA').addEventListener('change', toggleNOAALayer);
    document.getElementById('refreshData').addEventListener('click', loadData);
    document.getElementById('clearMap').addEventListener('click', clearMap);
    document.getElementById('stateFilter').addEventListener('change', filterByState);
    document.getElementById('closeInfo').addEventListener('click', closeInfoPanel);
}

// Toggle USGS layer visibility
function toggleUSGSLayer(e) {
    if (e.target.checked) {
        map.addLayer(usgsLayer);
    } else {
        map.removeLayer(usgsLayer);
    }
}

// Toggle NOAA layer visibility
function toggleNOAALayer(e) {
    if (e.target.checked) {
        map.addLayer(noaaLayer);
    } else {
        map.removeLayer(noaaLayer);
    }
}

// Show loading indicator
function showLoading() {
    document.getElementById('loadingIndicator').classList.remove('hidden');
}

// Hide loading indicator
function hideLoading() {
    document.getElementById('loadingIndicator').classList.add('hidden');
}

// Update statistics
function updateStats() {
    document.getElementById('usgsCount').textContent = `USGS: ${usgsData.length}`;
    document.getElementById('noaaCount').textContent = `NOAA: ${noaaData.length}`;
    document.getElementById('stats').classList.remove('hidden');
}

// Load all data
async function loadData() {
    showLoading();
    clearMap();

    try {
        await Promise.all([
            fetchUSGSData(),
            fetchNOAAData()
        ]);

        displayUSGSMarkers();
        displayNOAAMarkers();
        updateStats();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading data. Please check the console for details.');
    } finally {
        hideLoading();
    }
}

// Fetch USGS water data
async function fetchUSGSData() {
    try {
        // Batch states to avoid URL length limits and API restrictions
        const states = Object.keys(US_STATES);
        const batchSize = 10; // Query 10 states at a time
        const batches = [];

        // Create batches of states
        for (let i = 0; i < states.length; i += batchSize) {
            batches.push(states.slice(i, i + batchSize));
        }

        console.log(`Fetching USGS data in ${batches.length} batches...`);

        // Fetch data for each batch
        const allTimeSeries = [];

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const stateParam = batch.join(',');

            // Get sites with current streamflow data
            const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=${stateParam}&parameterCd=00060,00065&siteStatus=active`;

            console.log(`Fetching batch ${i + 1}/${batches.length}: ${batch.join(', ')}`);

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    console.warn(`USGS API error for batch ${i + 1}: ${response.status}`);
                    continue; // Skip this batch and continue with others
                }

                const data = await response.json();

                if (data.value && data.value.timeSeries) {
                    allTimeSeries.push(...data.value.timeSeries);
                }

                // Small delay between requests to be polite to the API
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.warn(`Error fetching batch ${i + 1}:`, error);
                continue; // Continue with next batch
            }
        }

        if (allTimeSeries.length > 0) {
            usgsData = parseUSGSData(allTimeSeries);
            console.log(`Successfully fetched ${usgsData.length} USGS sites from ${allTimeSeries.length} time series`);
        } else {
            console.warn('No USGS data available');
            usgsData = [];
        }
    } catch (error) {
        console.error('Error fetching USGS data:', error);
        usgsData = [];
    }
}

// Parse USGS data
function parseUSGSData(timeSeries) {
    const sitesMap = new Map();

    timeSeries.forEach(series => {
        const site = series.sourceInfo;
        const siteCode = site.siteCode[0].value;

        if (!sitesMap.has(siteCode)) {
            const lat = parseFloat(site.geoLocation.geogLocation.latitude);
            const lon = parseFloat(site.geoLocation.geogLocation.longitude);

            // Only include sites with valid coordinates
            if (!isNaN(lat) && !isNaN(lon)) {
                sitesMap.set(siteCode, {
                    id: siteCode,
                    name: site.siteName,
                    latitude: lat,
                    longitude: lon,
                    state: site.siteProperty?.find(p => p.name === 'stateCd')?.value || 'Unknown',
                    type: site.siteTypeCd || 'Stream',
                    parameters: []
                });
            }
        }

        // Add parameter data
        if (sitesMap.has(siteCode) && series.values && series.values[0] && series.values[0].value.length > 0) {
            const latestValue = series.values[0].value[0];
            const variable = series.variable;

            sitesMap.get(siteCode).parameters.push({
                name: variable.variableName,
                code: variable.variableCode[0].value,
                value: latestValue.value,
                unit: variable.unit?.unitCode || '',
                dateTime: latestValue.dateTime
            });
        }
    });

    return Array.from(sitesMap.values());
}

// Fetch NOAA river forecast data
async function fetchNOAAData() {
    try {
        // NOAA NWPS API endpoint for gauge locations
        const url = 'https://api.water.noaa.gov/nwps/v1/gauges?status=active&limit=1000';

        console.log('Fetching NOAA data from:', url);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`NOAA API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.gauges && Array.isArray(data.gauges)) {
            noaaData = parseNOAAData(data.gauges);
            console.log(`Fetched ${noaaData.length} NOAA gauges`);
        } else {
            console.warn('No NOAA data available');
            noaaData = [];
        }
    } catch (error) {
        console.error('Error fetching NOAA data:', error);
        noaaData = [];
    }
}

// Parse NOAA data
function parseNOAAData(gauges) {
    return gauges
        .filter(gauge => gauge.latitude && gauge.longitude)
        .map(gauge => ({
            id: gauge.lid || gauge.gaugeID,
            name: gauge.name || 'Unknown',
            latitude: parseFloat(gauge.latitude),
            longitude: parseFloat(gauge.longitude),
            state: gauge.state || 'Unknown',
            status: gauge.status || 'Unknown',
            floodStage: gauge.flood?.stage || null,
            currentStage: gauge.observed?.stage || null,
            forecast: gauge.forecast || null
        }))
        .filter(gauge => !isNaN(gauge.latitude) && !isNaN(gauge.longitude));
}

// Display USGS markers on map
function displayUSGSMarkers() {
    usgsLayer.clearLayers();

    usgsData.forEach(site => {
        const marker = L.circleMarker([site.latitude, site.longitude], {
            radius: 6,
            fillColor: '#1E88E5',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        // Create popup content
        let popupContent = `
            <div class="popup-content">
                <h4>🌊 ${site.name}</h4>
                <p><strong>Site ID:</strong> ${site.id}</p>
                <p><strong>State:</strong> ${site.state}</p>
                <p><strong>Type:</strong> ${site.type}</p>
        `;

        if (site.parameters.length > 0) {
            popupContent += '<p><strong>Current Measurements:</strong></p><ul style="margin: 5px 0; padding-left: 20px;">';
            site.parameters.forEach(param => {
                popupContent += `<li>${param.name}: ${param.value} ${param.unit}</li>`;
            });
            popupContent += '</ul>';
        }

        popupContent += `<p style="font-size: 0.85em; color: #666; margin-top: 5px;">Source: USGS</p></div>`;

        marker.bindPopup(popupContent);
        marker.on('click', () => showSiteDetails(site, 'USGS'));

        usgsLayer.addLayer(marker);
    });
}

// Display NOAA markers on map
function displayNOAAMarkers() {
    noaaLayer.clearLayers();

    noaaData.forEach(gauge => {
        const marker = L.circleMarker([gauge.latitude, gauge.longitude], {
            radius: 6,
            fillColor: '#F4511E',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        // Create popup content
        let popupContent = `
            <div class="popup-content">
                <h4>📊 ${gauge.name}</h4>
                <p><strong>Gauge ID:</strong> ${gauge.id}</p>
                <p><strong>State:</strong> ${gauge.state}</p>
                <p><strong>Status:</strong> ${gauge.status}</p>
        `;

        if (gauge.currentStage) {
            popupContent += `<p><strong>Current Stage:</strong> ${gauge.currentStage} ft</p>`;
        }

        if (gauge.floodStage) {
            popupContent += `<p><strong>Flood Stage:</strong> ${gauge.floodStage} ft</p>`;
        }

        popupContent += `<p style="font-size: 0.85em; color: #666; margin-top: 5px;">Source: NOAA NWPS</p></div>`;

        marker.bindPopup(popupContent);
        marker.on('click', () => showSiteDetails(gauge, 'NOAA'));

        noaaLayer.addLayer(marker);
    });
}

// Show detailed site information
function showSiteDetails(site, source) {
    const panel = document.getElementById('infoPanel');
    const content = document.getElementById('infoPanelContent');

    let html = `<h3>${source === 'USGS' ? '🌊' : '📊'} ${site.name}</h3>`;
    html += '<table>';

    if (source === 'USGS') {
        html += `
            <tr><td>Site ID</td><td>${site.id}</td></tr>
            <tr><td>State</td><td>${site.state}</td></tr>
            <tr><td>Type</td><td>${site.type}</td></tr>
            <tr><td>Latitude</td><td>${site.latitude.toFixed(6)}</td></tr>
            <tr><td>Longitude</td><td>${site.longitude.toFixed(6)}</td></tr>
        `;

        if (site.parameters.length > 0) {
            html += '<tr><td colspan="2"><strong>Measurements:</strong></td></tr>';
            site.parameters.forEach(param => {
                html += `<tr><td>${param.name}</td><td>${param.value} ${param.unit}</td></tr>`;
                html += `<tr><td>Last Updated</td><td>${new Date(param.dateTime).toLocaleString()}</td></tr>`;
            });
        }

        html += `<tr><td colspan="2" style="padding-top: 10px;"><a href="https://waterdata.usgs.gov/monitoring-location/${site.id}/" target="_blank" style="color: #667eea;">View on USGS Website →</a></td></tr>`;
    } else {
        html += `
            <tr><td>Gauge ID</td><td>${site.id}</td></tr>
            <tr><td>State</td><td>${site.state}</td></tr>
            <tr><td>Status</td><td>${site.status}</td></tr>
            <tr><td>Latitude</td><td>${site.latitude.toFixed(6)}</td></tr>
            <tr><td>Longitude</td><td>${site.longitude.toFixed(6)}</td></tr>
        `;

        if (site.currentStage) {
            html += `<tr><td>Current Stage</td><td>${site.currentStage} ft</td></tr>`;
        }

        if (site.floodStage) {
            html += `<tr><td>Flood Stage</td><td>${site.floodStage} ft</td></tr>`;
        }

        html += `<tr><td colspan="2" style="padding-top: 10px;"><a href="https://water.noaa.gov/gauges/${site.id}" target="_blank" style="color: #667eea;">View on NOAA Website →</a></td></tr>`;
    }

    html += '</table>';

    content.innerHTML = html;
    panel.classList.remove('hidden');
}

// Close info panel
function closeInfoPanel() {
    document.getElementById('infoPanel').classList.add('hidden');
}

// Clear map markers
function clearMap() {
    usgsLayer.clearLayers();
    noaaLayer.clearLayers();
    usgsData = [];
    noaaData = [];
    updateStats();
}

// Filter by state
function filterByState() {
    const selectedState = document.getElementById('stateFilter').value;

    if (!selectedState) {
        // Show all markers
        displayUSGSMarkers();
        displayNOAAMarkers();
        return;
    }

    // Filter USGS data
    const filteredUSGS = usgsData.filter(site => site.state === selectedState);
    usgsLayer.clearLayers();
    filteredUSGS.forEach(site => {
        const marker = L.circleMarker([site.latitude, site.longitude], {
            radius: 6,
            fillColor: '#1E88E5',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        let popupContent = `
            <div class="popup-content">
                <h4>🌊 ${site.name}</h4>
                <p><strong>Site ID:</strong> ${site.id}</p>
                <p><strong>State:</strong> ${site.state}</p>
        `;

        if (site.parameters.length > 0) {
            popupContent += '<p><strong>Current Measurements:</strong></p><ul style="margin: 5px 0; padding-left: 20px;">';
            site.parameters.forEach(param => {
                popupContent += `<li>${param.name}: ${param.value} ${param.unit}</li>`;
            });
            popupContent += '</ul>';
        }

        popupContent += `<p style="font-size: 0.85em; color: #666;">Source: USGS</p></div>`;

        marker.bindPopup(popupContent);
        marker.on('click', () => showSiteDetails(site, 'USGS'));

        usgsLayer.addLayer(marker);
    });

    // Filter NOAA data
    const filteredNOAA = noaaData.filter(gauge => gauge.state === selectedState);
    noaaLayer.clearLayers();
    filteredNOAA.forEach(gauge => {
        const marker = L.circleMarker([gauge.latitude, gauge.longitude], {
            radius: 6,
            fillColor: '#F4511E',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        let popupContent = `
            <div class="popup-content">
                <h4>📊 ${gauge.name}</h4>
                <p><strong>Gauge ID:</strong> ${gauge.id}</p>
                <p><strong>State:</strong> ${gauge.state}</p>
        `;

        if (gauge.currentStage) {
            popupContent += `<p><strong>Current Stage:</strong> ${gauge.currentStage} ft</p>`;
        }

        if (gauge.floodStage) {
            popupContent += `<p><strong>Flood Stage:</strong> ${gauge.floodStage} ft</p>`;
        }

        popupContent += `<p style="font-size: 0.85em; color: #666;">Source: NOAA NWPS</p></div>`;

        marker.bindPopup(popupContent);
        marker.on('click', () => showSiteDetails(gauge, 'NOAA'));

        noaaLayer.addLayer(marker);
    });

    // Update stats for filtered data
    document.getElementById('usgsCount').textContent = `USGS: ${filteredUSGS.length}`;
    document.getElementById('noaaCount').textContent = `NOAA: ${filteredNOAA.length}`;
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
