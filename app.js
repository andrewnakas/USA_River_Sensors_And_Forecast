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

            // Get sites with current water data (multiple parameters to catch more sites)
            // 00060=Discharge, 00065=Gage height, 00010=Temperature, 00045=Precipitation
            const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=${stateParam}&parameterCd=00060,00065,00010,00045&siteStatus=active`;

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
                forecast: gauge.status?.forecast || null
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

    noaaData.forEach(gauge => {
        const marker = L.circleMarker([gauge.latitude, gauge.longitude], {
            radius: 6,
            fillColor: '#F4511E',
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

        popupContent += `<p style="font-size: 0.85em; color: #666; margin-top: 5px;">Click for forecast chart</p></div>`;

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
        fetchUSGSTimeSeries(site.id).then(data => {
            if (data && data.length > 0) {
                displayUSGSChart(data);
            } else {
                document.getElementById('chartLoading').innerHTML = '<p style="color: #666; font-style: italic;">No time series data available for the last 7 days</p>';
            }
        }).catch(error => {
            console.error('Error loading chart data:', error);
            document.getElementById('chartLoading').innerHTML = '<p style="color: #dc3545; font-style: italic;">Error loading chart data</p>';
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

        // Add forecast hydrograph chart
        html += `
            <div style="margin-top: 15px;">
                <h4 style="margin-bottom: 10px; color: #667eea;">River Forecast</h4>
                <img src="https://water.noaa.gov/resources/hydrographs/${site.id}_hg.png"
                     alt="Forecast hydrograph for ${site.name}"
                     style="width: 100%; border-radius: 5px; border: 1px solid #ddd;"
                     onerror="this.onerror=null; this.src=''; this.style.display='none'; this.nextElementSibling.style.display='block';">
                <p style="display: none; color: #666; font-style: italic; margin-top: 10px;">Forecast chart not available for this gauge</p>
            </div>
        `;
    }

    content.innerHTML = html;
    panel.classList.remove('hidden');
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
