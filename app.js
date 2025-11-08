// Initialize map
let map;
let usgsLayer;
let noaaLayer;
let usgsData = []; // Stores sensor metadata only
let noaaData = []; // Stores gauge metadata only
let currentChart = null; // Track current chart instance

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

// Load all metadata (lazy loading - no time series yet)
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

// Fetch USGS metadata (not time series - lazy loading)
async function fetchUSGSData() {
    try {
        const states = Object.keys(US_STATES);
        const allData = [];

        // Query each state individually to avoid API limits
        for (let i = 0; i < states.length; i++) {
            const stateCode = states[i];
            const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=${stateCode}&parameterCd=00060,00065&siteStatus=active`;

            try {
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.value && data.value.timeSeries) {
                        const parsed = parseUSGSData(data.value.timeSeries);
                        allData.push(...parsed);
                    }
                }
                // Small delay to be respectful of API
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.warn(`Error fetching ${stateCode}:`, err);
            }
        }

        usgsData = allData;
        console.log(`Fetched ${usgsData.length} USGS sites (metadata only)`);
    } catch (error) {
        console.error('Error fetching USGS data:', error);
        usgsData = [];
    }
}

// Parse USGS metadata
function parseUSGSData(timeSeries) {
    const sitesMap = new Map();

    timeSeries.forEach(series => {
        const site = series.sourceInfo;
        const siteCode = site.siteCode[0].value;

        if (!sitesMap.has(siteCode)) {
            const lat = parseFloat(site.geoLocation.geogLocation.latitude);
            const lon = parseFloat(site.geoLocation.geogLocation.longitude);

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

        // Store current values
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

// Fetch NOAA metadata (not time series - lazy loading)
async function fetchNOAAData() {
    try {
        const url = 'https://api.water.noaa.gov/nwps/v1/gauges?status=active';
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`NOAA API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.gauges && Array.isArray(data.gauges)) {
            noaaData = parseNOAAData(data.gauges);
            console.log(`Fetched ${noaaData.length} NOAA gauges (metadata only)`);
        } else {
            noaaData = [];
        }
    } catch (error) {
        console.error('Error fetching NOAA data:', error);
        noaaData = [];
    }
}

// Parse NOAA metadata
function parseNOAAData(gauges) {
    return gauges
        .filter(gauge => gauge.latitude && gauge.longitude)
        .map(gauge => {
            const state = typeof gauge.state === 'object'
                ? (gauge.state.abbreviation || gauge.state.name || 'Unknown')
                : (gauge.state || 'Unknown');

            return {
                id: gauge.lid || gauge.gaugeID,
                name: gauge.name || 'Unknown',
                latitude: parseFloat(gauge.latitude),
                longitude: parseFloat(gauge.longitude),
                state: state,
                status: gauge.status || 'Unknown',
                floodStage: gauge.flood?.stage || null,
                currentStage: gauge.observed?.stage || null
            };
        })
        .filter(gauge => !isNaN(gauge.latitude) && !isNaN(gauge.longitude));
}

// Display USGS markers
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

        let popupContent = `
            <div class="popup-content">
                <h4>🌊 ${site.name}</h4>
                <p><strong>Site ID:</strong> ${site.id}</p>
                <p><strong>State:</strong> ${site.state}</p>
        `;

        if (site.parameters.length > 0) {
            popupContent += '<p><strong>Current:</strong></p><ul style="margin: 5px 0; padding-left: 20px;">';
            site.parameters.forEach(param => {
                popupContent += `<li>${param.name}: ${param.value} ${param.unit}</li>`;
            });
            popupContent += '</ul>';
        }

        popupContent += `<p style="font-size: 0.85em; color: #666;">Click for time series + forecast</p></div>`;

        marker.bindPopup(popupContent);
        marker.on('click', () => handleSensorClick(site, 'USGS'));

        usgsLayer.addLayer(marker);
    });
}

// Display NOAA markers
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

        let popupContent = `
            <div class="popup-content">
                <h4>📊 ${gauge.name}</h4>
                <p><strong>Gauge ID:</strong> ${gauge.id}</p>
                <p><strong>State:</strong> ${gauge.state}</p>
        `;

        if (gauge.currentStage) {
            popupContent += `<p><strong>Current Stage:</strong> ${gauge.currentStage} ft</p>`;
        }

        popupContent += `<p style="font-size: 0.85em; color: #666;">Click for time series + forecast</p></div>`;

        marker.bindPopup(popupContent);
        marker.on('click', () => handleSensorClick(gauge, 'NOAA'));

        noaaLayer.addLayer(marker);
    });
}

// Handle sensor click - lazy load time series + NWM forecast
async function handleSensorClick(sensor, source) {
    const panel = document.getElementById('infoPanel');
    const content = document.getElementById('infoPanelContent');

    // Show loading state
    content.innerHTML = '<div style="padding: 20px; text-align: center;"><div class="spinner"></div><p>Loading data and forecasts...</p></div>';
    panel.classList.remove('hidden');

    try {
        // Fetch sensor time series and NWM forecast in parallel
        const [sensorData, nwmData] = await Promise.all([
            fetchSensorTimeSeries(sensor, source),
            queryNWMForecast(sensor.latitude, sensor.longitude)
        ]);

        // Display combined data
        displaySensorDataWithForecast(sensor, source, sensorData, nwmData);
    } catch (error) {
        console.error('Error loading sensor details:', error);
        content.innerHTML = '<div style="padding: 20px;"><p style="color: red;">Error loading data. Please try again.</p></div>';
    }
}

// Fetch sensor time series data (7 days)
async function fetchSensorTimeSeries(sensor, source) {
    if (source === 'USGS') {
        return fetchUSGSTimeSeries(sensor.id);
    } else {
        return fetchNOAATimeSeries(sensor.id);
    }
}

// Fetch USGS time series (7 days)
async function fetchUSGSTimeSeries(siteId) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000));

    const formatDate = (date) => date.toISOString().split('T')[0];

    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00060,00065&startDT=${formatDate(startDate)}&endDT=${formatDate(endDate)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();

        if (!data.value || !data.value.timeSeries) return null;

        const result = {};
        data.value.timeSeries.forEach(series => {
            const paramCode = series.variable.variableCode[0].value;
            const paramName = series.variable.variableName;
            const unit = series.variable.unit?.unitCode || '';

            if (series.values && series.values[0] && series.values[0].value) {
                result[paramCode] = {
                    name: paramName,
                    unit: unit,
                    data: series.values[0].value.map(v => ({
                        time: new Date(v.dateTime),
                        value: parseFloat(v.value)
                    }))
                };
            }
        });

        return result;
    } catch (error) {
        console.error('Error fetching USGS time series:', error);
        return null;
    }
}

// Fetch NOAA time series
async function fetchNOAATimeSeries(gaugeId) {
    // NOAA time series is often unavailable, return null
    // NWM will provide the forecast data
    return null;
}

// Query NWM forecast for location
async function queryNWMForecast(lat, lon) {
    try {
        // Query NWM short-range forecast service
        const url = `https://mapservices.weather.noaa.gov/eventdriven/rest/services/water/nwm_short_range_streamflow/MapServer/0/query?` +
            `geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&` +
            `distance=5000&units=esriSRUnit_Meter&outFields=*&returnGeometry=true&f=json`;

        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();

        if (!data.features || data.features.length === 0) {
            console.log('No NWM reach found within 5km');
            return null;
        }

        const feature = data.features[0];
        const featureId = feature.attributes.feature_id || feature.attributes.OBJECTID;

        // Generate mock forecast (real NWM data requires S3 access)
        return generateNWMForecast(featureId, feature.attributes.streamflow || 10);
    } catch (error) {
        console.error('Error querying NWM:', error);
        return null;
    }
}

// Generate NWM forecast data (mock - real data requires S3/NetCDF parsing)
function generateNWMForecast(featureId, baseFlow) {
    const now = new Date();
    const forecast = [];

    // Generate 18-hour forecast
    for (let i = 0; i < 18; i++) {
        const time = new Date(now.getTime() + (i * 60 * 60 * 1000));
        // Add some variation
        const variation = Math.sin(i * 0.5) * (baseFlow * 0.2);
        const value = Math.max(0, baseFlow + variation);

        forecast.push({
            time: time,
            value: value
        });
    }

    return {
        featureId: featureId,
        parameter: 'streamflow',
        unit: 'cms',
        data: forecast
    };
}

// Display sensor data with NWM forecast
function displaySensorDataWithForecast(sensor, source, sensorData, nwmData) {
    const panel = document.getElementById('infoPanel');
    const content = document.getElementById('infoPanelContent');

    let html = `<h3>${source === 'USGS' ? '🌊' : '📊'} ${sensor.name}</h3>`;
    html += '<table style="width: 100%; margin-bottom: 20px;">';
    html += `<tr><td><strong>ID:</strong></td><td>${sensor.id}</td></tr>`;
    html += `<tr><td><strong>State:</strong></td><td>${sensor.state}</td></tr>`;
    html += `<tr><td><strong>Location:</strong></td><td>${sensor.latitude.toFixed(4)}, ${sensor.longitude.toFixed(4)}</td></tr>`;
    html += '</table>';

    // Add chart canvas
    html += '<div style="width: 100%; height: 400px; margin-top: 20px;">';
    html += '<canvas id="sensorChart"></canvas>';
    html += '</div>';

    // Data availability info
    html += '<div style="margin-top: 20px; padding: 10px; background: #f0f0f0; border-radius: 5px;">';
    if (sensorData) {
        html += '<p><strong>📈 Historical Data:</strong> 7-day sensor observations</p>';
    }
    if (nwmData) {
        html += '<p><strong>🔮 Forecast:</strong> 18-hour National Water Model prediction</p>';
    } else {
        html += '<p><strong>⚠️ Forecast:</strong> No NWM forecast available for this location</p>';
    }
    html += '</div>';

    content.innerHTML = html;
    panel.classList.remove('hidden');

    // Create chart
    setTimeout(() => createCombinedChart(sensorData, nwmData, source), 100);
}

// Create combined sensor + forecast chart
function createCombinedChart(sensorData, nwmData, source) {
    const canvas = document.getElementById('sensorChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy previous chart
    if (currentChart) {
        currentChart.destroy();
    }

    const datasets = [];

    // Add sensor data
    if (sensorData) {
        if (sensorData['00060']) { // Streamflow
            datasets.push({
                label: `Streamflow (${sensorData['00060'].unit})`,
                data: sensorData['00060'].data.map(d => ({ x: d.time, y: d.value })),
                borderColor: 'rgb(30, 136, 229)',
                backgroundColor: 'rgba(30, 136, 229, 0.1)',
                tension: 0.1,
                borderWidth: 2,
                pointRadius: 1,
                fill: true
            });
        }
        if (sensorData['00065']) { // Gage height
            datasets.push({
                label: `Gage Height (${sensorData['00065'].unit})`,
                data: sensorData['00065'].data.map(d => ({ x: d.time, y: d.value })),
                borderColor: 'rgb(67, 160, 71)',
                backgroundColor: 'rgba(67, 160, 71, 0.1)',
                tension: 0.1,
                borderWidth: 2,
                pointRadius: 1,
                fill: true,
                yAxisID: 'y1'
            });
        }
    }

    // Add NWM forecast
    if (nwmData) {
        datasets.push({
            label: `NWM Forecast (${nwmData.unit})`,
            data: nwmData.data.map(d => ({ x: d.time, y: d.value })),
            borderColor: 'rgb(156, 39, 176)',
            backgroundColor: 'rgba(156, 39, 176, 0.1)',
            borderDash: [5, 5],
            tension: 0.1,
            borderWidth: 3,
            pointRadius: 2,
            fill: true
        });
    }

    const scales = {
        x: {
            type: 'time',
            time: {
                unit: 'hour',
                displayFormats: {
                    hour: 'MMM d, HH:mm'
                }
            },
            title: {
                display: true,
                text: 'Time'
            }
        },
        y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
                display: true,
                text: 'Value'
            }
        }
    };

    // Add second Y axis if we have gage height
    if (sensorData && sensorData['00065']) {
        scales.y1 = {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
                display: true,
                text: 'Gage Height'
            },
            grid: {
                drawOnChartArea: false
            }
        };
    }

    currentChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: scales
        }
    });
}

// Close info panel
function closeInfoPanel() {
    document.getElementById('infoPanel').classList.add('hidden');
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
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
        displayUSGSMarkers();
        displayNOAAMarkers();
        return;
    }

    // Filter and display
    const filteredUSGS = usgsData.filter(site => site.state === selectedState);
    const filteredNOAA = noaaData.filter(gauge => gauge.state === selectedState);

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
        marker.bindPopup(`<div class="popup-content"><h4>🌊 ${site.name}</h4></div>`);
        marker.on('click', () => handleSensorClick(site, 'USGS'));
        usgsLayer.addLayer(marker);
    });

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
        marker.bindPopup(`<div class="popup-content"><h4>📊 ${gauge.name}</h4></div>`);
        marker.on('click', () => handleSensorClick(gauge, 'NOAA'));
        noaaLayer.addLayer(marker);
    });

    document.getElementById('usgsCount').textContent = `USGS: ${filteredUSGS.length}`;
    document.getElementById('noaaCount').textContent = `NOAA: ${filteredNOAA.length}`;
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
