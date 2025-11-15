// Script to fetch all USGS and NOAA station data and save to JSON files
// Run with: node fetch-stations.js

const fs = require('fs');
const https = require('https');

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

// Fetch JSON from URL
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch all USGS stations
async function fetchUSGSStations() {
    console.log('Fetching USGS stations...');
    const states = Object.keys(US_STATES);
    const allTimeSeries = [];
    let successCount = 0;

    for (let i = 0; i < states.length; i++) {
        const stateCode = states[i];
        const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=${stateCode}&parameterCd=00060,00065,00010,00045&siteStatus=active`;

        console.log(`  Fetching ${stateCode} (${i + 1}/${states.length})...`);

        try {
            const data = await fetchJSON(url);

            if (data.value && data.value.timeSeries) {
                allTimeSeries.push(...data.value.timeSeries);
                successCount++;
            }

            await sleep(100); // Rate limiting
        } catch (error) {
            console.warn(`  Error fetching ${stateCode}:`, error.message);
        }
    }

    console.log(`USGS fetch complete: ${successCount}/${states.length} states`);

    // Parse sites
    const sitesMap = new Map();

    allTimeSeries.forEach(series => {
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

// Fetch all NOAA stations
async function fetchNOAAStations() {
    console.log('Fetching NOAA stations...');
    const url = 'https://api.water.noaa.gov/nwps/v1/gauges?status=active';

    try {
        const data = await fetchJSON(url);

        if (data.gauges && Array.isArray(data.gauges)) {
            const parsed = data.gauges
                .filter(gauge => gauge.latitude && gauge.longitude)
                .map(gauge => {
                    const state = typeof gauge.state === 'object'
                        ? (gauge.state.abbreviation || gauge.state.name || 'Unknown')
                        : (gauge.state || 'Unknown');

                    const floodCategory = gauge.status?.observed?.floodCategory ||
                                         gauge.status?.forecast?.floodCategory ||
                                         'Unknown';
                    const statusText = floodCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                    return {
                        id: gauge.id,
                        name: gauge.name || 'Unknown',
                        latitude: gauge.latitude,
                        longitude: gauge.longitude,
                        state: state,
                        status: statusText,
                        floodCategory: floodCategory,
                        floodStage: gauge.floodStage || null,
                        currentStage: gauge.status?.observed?.primary || null,
                        currentStageUnit: gauge.status?.observed?.primaryUnits || 'ft',
                        hasForecast: gauge.status?.forecast?.primary !== null && gauge.status?.forecast?.primary !== undefined,
                        rfc: gauge.rfc || null,
                        wfo: gauge.wfo || null,
                        observedTime: gauge.status?.observed?.validTime || null
                    };
                });

            console.log(`NOAA fetch complete: ${parsed.length} gauges`);
            return parsed;
        }
    } catch (error) {
        console.error('Error fetching NOAA stations:', error.message);
    }

    return [];
}

// Main function
async function main() {
    try {
        console.log('Starting station data fetch...\n');

        const usgsStations = await fetchUSGSStations();
        console.log(`\nTotal USGS stations: ${usgsStations.length}`);

        fs.writeFileSync('usgs-stations.json', JSON.stringify(usgsStations, null, 2));
        console.log('Saved to usgs-stations.json\n');

        const noaaStations = await fetchNOAAStations();
        console.log(`\nTotal NOAA stations: ${noaaStations.length}`);

        fs.writeFileSync('noaa-stations.json', JSON.stringify(noaaStations, null, 2));
        console.log('Saved to noaa-stations.json\n');

        console.log('Done!');
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
