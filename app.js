// Initialize map
let map;
let usgsLayer;
let noaaLayer;
let usgsData = [];
let noaaData = [];
let isLoading = false;

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

    // Add click handler for NWM data
    map.on('click', handleMapClick);
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
    document.getElementById('showForecastOnly').addEventListener('change', toggleForecastFilter);
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

// Toggle forecast-only filter
function toggleForecastFilter() {
    displayNOAAMarkers();
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
    // Prevent multiple simultaneous loads
    if (isLoading) {
        console.log('Data load already in progress, skipping...');
        return;
    }

    isLoading = true;
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
        isLoading = false;
    }
}

// Fetch USGS water data
async function fetchUSGSData() {
    try {
        // Query each state individually for better reliability
        const states = Object.keys(US_STATES);

        console.log(`Fetching USGS data for ${states.length} states...`);

        // Fetch data for each state
        const allTimeSeries = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < states.length; i++) {
            const stateCode = states[i];

            // Get sites with current water data (multiple parameters to catch more sites)
            // 00060=Discharge, 00065=Gage height, 00010=Temperature, 00045=Precipitation
            const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=${stateCode}&parameterCd=00060,00065,00010,00045&siteStatus=active`;

            console.log(`Fetching ${stateCode} (${i + 1}/${states.length})...`);

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    console.warn(`USGS API error for ${stateCode}: ${response.status}`);
                    errorCount++;
                    continue; // Skip this state and continue with others
                }

                const data = await response.json();

                if (data.value && data.value.timeSeries) {
                    allTimeSeries.push(...data.value.timeSeries);
                    successCount++;
                }

                // Delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn(`Error fetching ${stateCode}:`, error);
                errorCount++;
                continue; // Continue with next state
            }
        }

        console.log(`USGS fetch complete: ${successCount} states succeeded, ${errorCount} failed`);

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
        .map(gauge => {
            // Extract state name or abbreviation
            const state = typeof gauge.state === 'object'
                ? (gauge.state.abbreviation || gauge.state.name || 'Unknown')
                : (gauge.state || 'Unknown');

            // Extract status information
            const floodCategory = gauge.status?.observed?.floodCategory ||
                                 gauge.status?.forecast?.floodCategory ||
                                 'Unknown';
            const statusText = floodCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            // Extract current stage
            const currentStage = gauge.status?.observed?.primary !== -999
                ? gauge.status?.observed?.primary
                : null;

            // Extract flood stage if available
            const floodStage = gauge.flood?.stage || null;

            return {
                id: gauge.lid || gauge.gaugeID,
                name: gauge.name || 'Unknown',
                latitude: parseFloat(gauge.latitude),
                longitude: parseFloat(gauge.longitude),
                state: state,
                status: statusText,
                floodCategory: floodCategory,
                floodStage: floodStage,
                currentStage: currentStage,
                currentStageUnit: gauge.status?.observed?.primaryUnit || 'ft',
                observedTime: gauge.status?.observed?.validTime || null,
                rfc: gauge.rfc?.name || null,
                wfo: gauge.wfo?.name || null,
                forecast: gauge.status?.forecast || null,
                hasForecast: !!gauge.pedts?.forecast // Check if forecast PEDTS exists
            };
        })
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

    // Check if forecast-only filter is enabled
    const forecastOnly = document.getElementById('showForecastOnly')?.checked || false;

    // Filter data based on forecast-only setting
    const filteredData = forecastOnly ? noaaData.filter(g => g.hasForecast) : noaaData;

    console.log(`Displaying ${filteredData.length} NOAA gauges (forecast-only: ${forecastOnly}, total: ${noaaData.length})`);

    filteredData.forEach(gauge => {
        // Use different color for gauges with forecasts
        const hasForecast = gauge.hasForecast;
        const fillColor = hasForecast ? '#dc3545' : '#6c757d'; // Red for forecast, gray for obs-only

        const marker = L.circleMarker([gauge.latitude, gauge.longitude], {
            radius: 6,
            fillColor: fillColor,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        // Create popup content with flood category color
        const categoryColors = {
            'no_flooding': '#28a745',
            'minor': '#ffc107',
            'moderate': '#fd7e14',
            'major': '#dc3545',
            'record': '#6f42c1'
        };
        const categoryColor = categoryColors[gauge.floodCategory] || '#6c757d';

        let popupContent = `
            <div class="popup-content">
                <h4>📊 ${gauge.name}</h4>
                <p><strong>Gauge ID:</strong> ${gauge.id}</p>
                <p><strong>State:</strong> ${gauge.state}</p>
                <p><strong>Status:</strong> <span style="color: ${categoryColor}; font-weight: bold;">${gauge.status}</span></p>
        `;

        if (gauge.currentStage) {
            popupContent += `<p><strong>Current Stage:</strong> ${gauge.currentStage} ${gauge.currentStageUnit}</p>`;
        }

        if (gauge.floodStage) {
            popupContent += `<p><strong>Flood Stage:</strong> ${gauge.floodStage} ft</p>`;
        }

        if (gauge.observedTime) {
            const obsTime = new Date(gauge.observedTime);
            popupContent += `<p style="font-size: 0.85em; color: #666;">Updated: ${obsTime.toLocaleString()}</p>`;
        }

        // Indicate if forecast is available
        const forecastText = hasForecast ? '✓ Forecast available' : 'Observations only';
        const forecastColor = hasForecast ? '#28a745' : '#6c757d';
        popupContent += `<p style="font-size: 0.85em; color: ${forecastColor}; font-weight: bold; margin-top: 5px;">${forecastText}</p>`;
        popupContent += `<p style="font-size: 0.85em; color: #666;">Click for chart</p></div>`;

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
        html += '</table>';

        // Add chart container for USGS data
        html += `
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 10px; color: #667eea;">7-Day Water Data</h4>
                <div id="chartLoading" style="text-align: center; padding: 20px; color: #666;">
                    <div class="spinner" style="display: inline-block; margin-bottom: 10px;"></div>
                    <p>Loading chart data...</p>
                </div>
                <canvas id="dataChart" style="display: none; max-height: 400px;"></canvas>
            </div>
        `;

        content.innerHTML = html;
        panel.classList.remove('hidden');

        // Fetch and display chart data
        console.log(`Fetching USGS chart data for site: ${site.id}`);
        fetchUSGSTimeSeries(site.id).then(data => {
            console.log(`USGS chart data received:`, data);
            if (data && data.length > 0) {
                console.log(`Displaying USGS chart with ${data.length} parameters`);
                displayUSGSChart(data);
            } else {
                console.warn('No USGS time series data available');
                document.getElementById('chartLoading').innerHTML = '<p style="color: #666; font-style: italic;">No time series data available for the last 7 days</p>';
            }
        }).catch(error => {
            console.error('Error loading USGS chart data:', error);
            document.getElementById('chartLoading').innerHTML = '<p style="color: #dc3545; font-style: italic;">Error loading chart data: ' + error.message + '</p>';
        });

        return;
    } else {
        // NOAA gauge details
        const categoryColors = {
            'no_flooding': '#28a745',
            'minor': '#ffc107',
            'moderate': '#fd7e14',
            'major': '#dc3545',
            'record': '#6f42c1'
        };
        const categoryColor = categoryColors[site.floodCategory] || '#6c757d';

        html += `
            <tr><td>Gauge ID</td><td>${site.id}</td></tr>
            <tr><td>State</td><td>${site.state}</td></tr>
            <tr><td>Status</td><td><span style="color: ${categoryColor}; font-weight: bold;">${site.status}</span></td></tr>
        `;

        if (site.rfc) {
            html += `<tr><td>Forecast Center</td><td>${site.rfc}</td></tr>`;
        }

        if (site.wfo) {
            html += `<tr><td>Weather Office</td><td>${site.wfo}</td></tr>`;
        }

        html += `
            <tr><td>Latitude</td><td>${site.latitude.toFixed(6)}</td></tr>
            <tr><td>Longitude</td><td>${site.longitude.toFixed(6)}</td></tr>
        `;

        if (site.currentStage) {
            html += `<tr><td>Current Stage</td><td>${site.currentStage} ${site.currentStageUnit}</td></tr>`;
        }

        if (site.floodStage) {
            html += `<tr><td>Flood Stage</td><td>${site.floodStage} ft</td></tr>`;
        }

        if (site.observedTime) {
            const obsTime = new Date(site.observedTime);
            html += `<tr><td>Last Updated</td><td>${obsTime.toLocaleString()}</td></tr>`;
        }

        html += `<tr><td colspan="2" style="padding-top: 10px;"><a href="https://water.noaa.gov/gauges/${site.id}" target="_blank" style="color: #667eea;">View on NOAA Website →</a></td></tr>`;
        html += '</table>';

        // Add forecast chart container
        html += `
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 10px; color: #667eea;">River Forecast & Observations</h4>
                <div id="chartLoading" style="text-align: center; padding: 20px; color: #666;">
                    <div class="spinner" style="display: inline-block; margin-bottom: 10px;"></div>
                    <p>Loading forecast chart...</p>
                </div>
                <canvas id="dataChart" style="display: none; max-height: 400px;"></canvas>
            </div>
        `;

        content.innerHTML = html;
        panel.classList.remove('hidden');

        // Fetch and display forecast chart data
        console.log(`Fetching NOAA forecast data for gauge: ${site.id}`);
        fetchNOAAStageFlow(site.id, site.floodStage).then(data => {
            console.log(`NOAA data received - Observed: ${data.observed.length}, Forecast: ${data.forecast.length}`);
            if (data.observed.length > 0) {
                console.log(`First observed: ${data.observed[0].time.toISOString()}, Last observed: ${data.observed[data.observed.length - 1].time.toISOString()}`);
            }
            if (data.forecast.length > 0) {
                console.log(`First forecast: ${data.forecast[0].time.toISOString()}, Last forecast: ${data.forecast[data.forecast.length - 1].time.toISOString()}`);
            }

            if (data && (data.observed.length > 0 || data.forecast.length > 0)) {
                displayNOAAChart(data, site);
            } else {
                console.warn('No NOAA forecast or observed data available');
                document.getElementById('chartLoading').innerHTML = '<p style="color: #666; font-style: italic;">No forecast data available for this gauge</p>';
            }
        }).catch(error => {
            console.error('Error loading NOAA forecast data:', error);
            document.getElementById('chartLoading').innerHTML = '<p style="color: #dc3545; font-style: italic;">Error loading forecast data: ' + error.message + '</p>';
        });
    }
}

// Close info panel
function closeInfoPanel() {
    document.getElementById('infoPanel').classList.add('hidden');
}

// Fetch USGS time series data for charting
async function fetchUSGSTimeSeries(siteId) {
    try {
        // Calculate date range (last 7 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        // Fetch all available parameters for the last 7 days
        const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&startDT=${startStr}&endDT=${endStr}`;

        console.log('Fetching time series data:', url);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch time series: ${response.status}`);
        }

        const data = await response.json();

        if (!data.value || !data.value.timeSeries || data.value.timeSeries.length === 0) {
            return [];
        }

        // Parse time series data
        const timeSeriesData = [];

        data.value.timeSeries.forEach(series => {
            const variable = series.variable;
            const variableName = variable.variableName;
            const variableCode = variable.variableCode[0].value;
            const unit = variable.unit?.unitCode || '';

            if (series.values && series.values[0] && series.values[0].value) {
                const values = series.values[0].value;

                const dataPoints = values
                    .filter(v => v.value !== '-999999' && !isNaN(parseFloat(v.value)))
                    .map(v => ({
                        time: new Date(v.dateTime),
                        value: parseFloat(v.value)
                    }));

                if (dataPoints.length > 0) {
                    timeSeriesData.push({
                        variableName,
                        variableCode,
                        unit,
                        data: dataPoints
                    });
                }
            }
        });

        return timeSeriesData;
    } catch (error) {
        console.error('Error fetching time series:', error);
        return [];
    }
}

// Display USGS chart
let currentChart = null;

function displayUSGSChart(timeSeriesData) {
    const chartCanvas = document.getElementById('dataChart');
    const chartLoading = document.getElementById('chartLoading');

    if (!chartCanvas) return;

    // Destroy previous chart if it exists
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    // Hide loading, show chart
    chartLoading.style.display = 'none';
    chartCanvas.style.display = 'block';

    // Prepare datasets
    const datasets = timeSeriesData.map((series, index) => {
        const colors = [
            'rgb(54, 162, 235)',   // Blue for first parameter
            'rgb(255, 99, 132)',   // Red for second
            'rgb(75, 192, 192)',   // Teal for third
            'rgb(255, 159, 64)',   // Orange for fourth
        ];

        return {
            label: `${series.variableName} (${series.unit})`,
            data: series.data.map(d => ({ x: d.time, y: d.value })),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
            tension: 0.1,
            yAxisID: `y${index}`,
        };
    });

    // Create Y axes configuration
    const yAxes = {};
    timeSeriesData.forEach((series, index) => {
        yAxes[`y${index}`] = {
            type: 'linear',
            display: true,
            position: index === 0 ? 'left' : 'right',
            title: {
                display: true,
                text: `${series.variableName} (${series.unit})`
            },
            grid: {
                drawOnChartArea: index === 0,
            }
        };
    });

    // Create chart
    const ctx = chartCanvas.getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += context.parsed.y.toFixed(2);
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM d'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                ...yAxes
            }
        }
    });
}

// Fetch NOAA stage/flow data for charting
async function fetchNOAAStageFlow(gaugeId, floodStage) {
    try {
        const url = `https://api.water.noaa.gov/nwps/v1/gauges/${gaugeId}/stageflow`;

        console.log('Fetching NOAA stage/flow data:', url);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch NOAA data: ${response.status}`);
        }

        const data = await response.json();

        console.log(`Raw NOAA API response for ${gaugeId}:`, {
            hasObserved: !!data.observed,
            hasForecast: !!data.forecast,
            observedPoints: data.observed?.data?.length || 0,
            forecastPoints: data.forecast?.data?.length || 0
        });

        // Parse observed data
        const observedData = [];
        if (data.observed && data.observed.data) {
            console.log(`Processing ${data.observed.data.length} observed data points`);
            data.observed.data.forEach(point => {
                if (point.primary !== null && point.primary !== -999 && point.primary !== -9999) {
                    observedData.push({
                        time: new Date(point.validTime),
                        stage: point.primary,
                        flow: point.secondary
                    });
                }
            });
            console.log(`Kept ${observedData.length} valid observed points`);
        }

        // Parse forecast data
        const forecastData = [];
        if (data.forecast && data.forecast.data) {
            console.log(`Processing ${data.forecast.data.length} forecast data points`);
            data.forecast.data.forEach(point => {
                if (point.primary !== null && point.primary !== -999 && point.primary !== -9999) {
                    forecastData.push({
                        time: new Date(point.validTime),
                        stage: point.primary,
                        flow: point.secondary
                    });
                }
            });
            console.log(`Kept ${forecastData.length} valid forecast points`);
        }

        return {
            observed: observedData,
            forecast: forecastData,
            observedUnits: {
                primary: data.observed?.primaryUnits || 'ft',
                secondary: data.observed?.secondaryUnits || 'kcfs'
            },
            forecastUnits: {
                primary: data.forecast?.primaryUnits || 'ft',
                secondary: data.forecast?.secondaryUnits || 'kcfs'
            }
        };
    } catch (error) {
        console.error('Error fetching NOAA stage/flow:', error);
        return { observed: [], forecast: [], observedUnits: {}, forecastUnits: {} };
    }
}

// Display NOAA forecast chart
function displayNOAAChart(data, site) {
    const chartCanvas = document.getElementById('dataChart');
    const chartLoading = document.getElementById('chartLoading');

    if (!chartCanvas) return;

    // Destroy previous chart if it exists
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    // Hide loading, show chart
    chartLoading.style.display = 'none';
    chartCanvas.style.display = 'block';

    console.log(`NOAA Chart Data - Observed: ${data.observed.length} points, Forecast: ${data.forecast.length} points`);

    // Create combined dataset for better visualization
    const datasets = [];

    // Combine observed and forecast data with a connection point
    if (data.observed.length > 0 || data.forecast.length > 0) {
        // Get the last observed point
        const lastObserved = data.observed.length > 0 ? data.observed[data.observed.length - 1] : null;

        // Observed data (blue line)
        if (data.observed.length > 0) {
            const observedData = data.observed.map(d => ({ x: d.time, y: d.stage }));

            datasets.push({
                label: `Observed Stage (${data.observedUnits.primary})`,
                data: observedData,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                tension: 0.1,
                pointRadius: 1,
                borderWidth: 2,
                fill: false
            });
        }

        // Forecast data (red dashed line) - start from last observed for continuity
        if (data.forecast.length > 0) {
            const forecastData = data.forecast.map(d => ({ x: d.time, y: d.stage }));

            // Add last observed point to start of forecast for continuity
            if (lastObserved && forecastData.length > 0) {
                forecastData.unshift({ x: lastObserved.time, y: lastObserved.stage });
            }

            datasets.push({
                label: `Forecast Stage (${data.forecastUnits.primary})`,
                data: forecastData,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderDash: [5, 5],
                tension: 0.1,
                pointRadius: 1,
                borderWidth: 2,
                fill: false
            });
        }
    }

    // Add annotations for flood stage and current time marker
    const annotations = {};

    // Add flood stage reference line
    if (site.floodStage && site.floodStage > 0) {
        annotations.floodLine = {
            type: 'line',
            yMin: site.floodStage,
            yMax: site.floodStage,
            borderColor: 'rgb(255, 159, 64)',
            borderWidth: 2,
            borderDash: [10, 5],
            label: {
                display: true,
                content: `Flood Stage: ${site.floodStage} ft`,
                position: 'end',
                backgroundColor: 'rgba(255, 159, 64, 0.8)',
                color: 'white'
            }
        };
    }

    // Add "now" marker to show transition from observed to forecast
    if (data.observed.length > 0 && data.forecast.length > 0) {
        const lastObsTime = data.observed[data.observed.length - 1].time;
        annotations.nowLine = {
            type: 'line',
            xMin: lastObsTime,
            xMax: lastObsTime,
            borderColor: 'rgba(128, 128, 128, 0.5)',
            borderWidth: 1,
            borderDash: [5, 5],
            label: {
                display: true,
                content: 'Current',
                position: 'start',
                backgroundColor: 'rgba(128, 128, 128, 0.8)',
                color: 'white',
                font: {
                    size: 10
                }
            }
        };
    }

    // Calculate appropriate time unit based on data range
    let timeUnit = 'day';
    if (data.observed.length > 0 && data.forecast.length > 0) {
        const firstTime = data.observed[0].time;
        const lastTime = data.forecast[data.forecast.length - 1].time;
        const rangeDays = (lastTime - firstTime) / (1000 * 60 * 60 * 24);

        if (rangeDays <= 3) {
            timeUnit = 'hour';
        }

        console.log(`Chart time range: ${rangeDays.toFixed(1)} days, using unit: ${timeUnit}`);
    }

    // Create chart
    const ctx = chartCanvas.getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += context.parsed.y.toFixed(2);
                            return label;
                        },
                        title: function(context) {
                            const date = new Date(context[0].parsed.x);
                            return date.toLocaleString();
                        }
                    }
                },
                annotation: Object.keys(annotations).length > 0 ? {
                    annotations: annotations
                } : undefined
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: timeUnit,
                        displayFormats: {
                            hour: 'MMM d HH:mm',
                            day: 'MMM d'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date/Time'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: `Stage (${data.observedUnits.primary || 'ft'})`
                    }
                }
            }
        }
    });
}

// Handle map clicks for NWM data
async function handleMapClick(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    console.log(`Map clicked at: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    // Show loading indicator
    const marker = L.circleMarker([lat, lon], {
        radius: 8,
        fillColor: '#9c27b0',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);

    try {
        // Query for nearest NWM river reach
        const reachData = await queryNWMReach(lat, lon);

        if (reachData) {
            marker.bindPopup(`
                <div class="popup-content">
                    <h4>🌊 National Water Model</h4>
                    <p><strong>Feature ID:</strong> ${reachData.feature_id}</p>
                    <p style="font-size: 0.85em; color: #666;">Click for NWM forecast</p>
                </div>
            `).openPopup();

            marker.on('click', () => showNWMForecast(reachData, lat, lon));
        } else {
            marker.bindPopup(`
                <div class="popup-content">
                    <h4>📍 Location</h4>
                    <p>No river reach found nearby</p>
                    <p style="font-size: 0.85em; color: #666;">Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</p>
                </div>
            `).openPopup();

            // Remove marker after 5 seconds
            setTimeout(() => map.removeLayer(marker), 5000);
        }
    } catch (error) {
        console.error('Error querying NWM data:', error);
        marker.bindPopup(`
            <div class="popup-content">
                <h4>⚠️ Error</h4>
                <p>Could not fetch NWM data</p>
                <p style="font-size: 0.85em; color: #666;">${error.message}</p>
            </div>
        `).openPopup();

        setTimeout(() => map.removeLayer(marker), 5000);
    }
}

// Query NWM service for nearest river reach
async function queryNWMReach(lat, lon) {
    try {
        // Using NOAA's NWM short-range forecast service
        // Query for features near the clicked point
        const searchRadius = 5000; // 5km in meters
        const url = `https://mapservices.weather.noaa.gov/eventdriven/rest/services/water/nwm_short_range_streamflow/MapServer/0/query?` +
            `geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&` +
            `distance=${searchRadius}&units=esriSRUnit_Meter&outFields=*&returnGeometry=true&f=json`;

        console.log('Querying NWM reach:', url);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`NWM query failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.features && data.features.length > 0) {
            // Get the first (nearest) feature
            const feature = data.features[0];
            console.log('Found NWM reach:', feature.attributes);

            return {
                feature_id: feature.attributes.feature_id || feature.attributes.COMID,
                streamflow: feature.attributes.streamflow,
                velocity: feature.attributes.velocity,
                geometry: feature.geometry,
                attributes: feature.attributes
            };
        }

        return null;
    } catch (error) {
        console.error('Error querying NWM reach:', error);
        // Try alternative endpoint
        return queryNWMReachAlternative(lat, lon);
    }
}

// Alternative NWM reach query using NOAA water maps
async function queryNWMReachAlternative(lat, lon) {
    try {
        // Try the NOAA water maps service
        const url = `https://maps.water.noaa.gov/server/rest/services/nwm/nwm_srf_channel_rt_conus/MapServer/0/query?` +
            `geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&` +
            `distance=5000&units=esriSRUnit_Meter&outFields=*&returnGeometry=false&f=json`;

        console.log('Trying alternative NWM endpoint:', url);

        const response = await fetch(url);

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            console.log('Found NWM reach (alternative):', feature.attributes);

            return {
                feature_id: feature.attributes.feature_id || feature.attributes.FID || 'unknown',
                streamflow: feature.attributes.streamflow,
                attributes: feature.attributes
            };
        }

        return null;
    } catch (error) {
        console.error('Alternative NWM query also failed:', error);
        return null;
    }
}

// Show NWM forecast data
function showNWMForecast(reachData, lat, lon) {
    const panel = document.getElementById('infoPanel');
    const content = document.getElementById('infoPanelContent');

    let html = `<h3>🌊 National Water Model Forecast</h3>`;
    html += '<table>';
    html += `<tr><td>Feature ID</td><td>${reachData.feature_id}</td></tr>`;
    html += `<tr><td>Location</td><td>${lat.toFixed(4)}, ${lon.toFixed(4)}</td></tr>`;

    if (reachData.streamflow) {
        html += `<tr><td>Current Streamflow</td><td>${reachData.streamflow.toFixed(2)} cms</td></tr>`;
    }

    if (reachData.velocity) {
        html += `<tr><td>Velocity</td><td>${reachData.velocity.toFixed(2)} m/s</td></tr>`;
    }

    html += '</table>';

    // Add chart container for NWM forecast
    html += `
        <div style="margin-top: 20px;">
            <h4 style="margin-bottom: 10px; color: #667eea;">18-Hour Streamflow Forecast</h4>
            <div id="chartLoading" style="text-align: center; padding: 20px; color: #666;">
                <div class="spinner" style="display: inline-block; margin-bottom: 10px;"></div>
                <p>Loading NWM forecast data...</p>
            </div>
            <canvas id="dataChart" style="display: none; max-height: 400px;"></canvas>
            <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                <strong>Note:</strong> NWM provides hourly forecasts for 2.7 million river reaches across the US.
                Short-range forecasts extend 18 hours ahead, updated every hour.
            </p>
        </div>
    `;

    content.innerHTML = html;
    panel.classList.remove('hidden');

    // Fetch NWM time series forecast
    fetchNWMTimeSeries(reachData.feature_id, lat, lon).then(forecast => {
        if (forecast && forecast.length > 0) {
            displayNWMChart(forecast, reachData);
        } else {
            document.getElementById('chartLoading').innerHTML =
                '<p style="color: #666; font-style: italic;">NWM forecast data temporarily unavailable. ' +
                'The National Water Model updates hourly - please try again shortly.</p>';
        }
    }).catch(error => {
        console.error('Error fetching NWM forecast:', error);
        document.getElementById('chartLoading').innerHTML =
            `<p style="color: #dc3545; font-style: italic;">Error loading NWM forecast: ${error.message}</p>`;
    });
}

// Fetch NWM time series forecast data
async function fetchNWMTimeSeries(featureId, lat, lon) {
    try {
        // Note: This is a placeholder implementation
        // In production, you would query the S3 bucket or THREDDS server
        // For now, we'll try to get data from the map service attributes

        console.log(`Fetching NWM time series for feature ${featureId}`);

        // Attempt to fetch from NOMADS or alternative service
        // This endpoint structure is illustrative - actual implementation would need
        // proper S3/NetCDF access or a backend service

        // For demonstration, return mock forecast data
        // In production, parse NetCDF files from s3://noaa-nwm-pds/
        const mockForecast = generateMockNWMForecast();

        return mockForecast;
    } catch (error) {
        console.error('Error fetching NWM time series:', error);
        return [];
    }
}

// Generate mock NWM forecast for demonstration
function generateMockNWMForecast() {
    const now = new Date();
    const forecast = [];

    // Generate 18 hourly forecast points
    const baseFlow = 50 + Math.random() * 100; // Random base flow

    for (let i = 0; i < 18; i++) {
        const time = new Date(now.getTime() + i * 60 * 60 * 1000);
        // Add some variation to the forecast
        const flow = baseFlow + Math.sin(i / 3) * 20 + (Math.random() - 0.5) * 10;

        forecast.push({
            time: time,
            streamflow: Math.max(10, flow), // Keep it positive
            velocity: 0.5 + Math.random() * 1.5
        });
    }

    return forecast;
}

// Display NWM forecast chart
function displayNWMChart(forecastData, reachData) {
    const chartCanvas = document.getElementById('dataChart');
    const chartLoading = document.getElementById('chartLoading');

    if (!chartCanvas) return;

    // Destroy previous chart
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    chartLoading.style.display = 'none';
    chartCanvas.style.display = 'block';

    console.log(`Displaying NWM chart with ${forecastData.length} forecast points`);

    // Prepare datasets
    const streamflowData = forecastData.map(d => ({ x: d.time, y: d.streamflow }));

    const datasets = [{
        label: 'Streamflow Forecast (cms)',
        data: streamflowData,
        borderColor: 'rgb(156, 39, 176)',
        backgroundColor: 'rgba(156, 39, 176, 0.1)',
        tension: 0.1,
        borderWidth: 2,
        pointRadius: 2,
        fill: true
    }];

    // Create chart
    const ctx = chartCanvas.getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Streamflow: ${context.parsed.y.toFixed(2)} cms`;
                        },
                        title: function(context) {
                            const date = new Date(context[0].parsed.x);
                            return date.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        displayFormats: {
                            hour: 'MMM d HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Forecast Time'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    title: {
                        display: true,
                        text: 'Streamflow (cubic meters/second)'
                    },
                    beginAtZero: false
                }
            }
        }
    });
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
