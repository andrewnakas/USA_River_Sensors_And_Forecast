# USA River Sensors & Forecast

A web-based application that fetches and visualizes real-time river sensor data and river forecast information across the United States on an interactive Leaflet map.

![River Sensors Map](https://img.shields.io/badge/Status-Active-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **Real-time USGS Water Data**: Displays thousands of active river gauges and sensors from the United States Geological Survey
- **NOAA River Forecasts**: Shows river forecast points and flood information from the National Weather Service
- **Interactive Map**: Powered by Leaflet with marker clustering for better performance
- **State Filtering**: Filter sensors and forecasts by any US state
- **Detailed Information**: Click on markers to view detailed sensor readings and forecast data
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Live Updates**: Refresh data on demand to get the latest measurements

## Data Sources

### USGS Water Services API
- **Endpoint**: `https://waterservices.usgs.gov/`
- **Data**: Real-time instantaneous values for streamflow, gage height, water temperature, and more
- **Coverage**: Thousands of monitoring locations across all 50 states
- **Update Frequency**: Typically 15-60 minutes

### NOAA National Water Prediction Service (NWPS) API
- **Endpoint**: `https://api.water.noaa.gov/nwps/v1/`
- **Data**: River forecasts, flood stages, current observations
- **Coverage**: Major rivers and flood-prone areas
- **Update Frequency**: Multiple times daily

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/USA_River_Sensors_And_Forecast.git
cd USA_River_Sensors_And_Forecast
```

2. Open `index.html` in your web browser:
```bash
# On macOS
open index.html

# On Linux
xdg-open index.html

# On Windows
start index.html
```

Or simply drag and drop `index.html` into your browser.

## Usage

### Basic Controls

- **USGS Sensors Checkbox**: Toggle visibility of USGS water sensors
- **NOAA Forecasts Checkbox**: Toggle visibility of NOAA forecast points
- **Filter by State**: Select a state from the dropdown to show only sensors in that state
- **Refresh Data**: Click to reload the latest data from both APIs
- **Clear Map**: Remove all markers from the map

### Interacting with the Map

1. **Zoom**: Use mouse wheel or the +/- buttons to zoom in/out
2. **Pan**: Click and drag to move around the map
3. **Click Markers**: Click on any marker to see detailed information
4. **Cluster Navigation**: Click on numbered clusters to zoom in and see individual sensors

### Understanding the Data

#### USGS Sensors (Blue Markers)
- **Streamflow (00060)**: Water discharge in cubic feet per second (cfs)
- **Gage Height (00065)**: Water level in feet
- Additional parameters may include temperature, pH, dissolved oxygen, etc.

#### NOAA Forecasts (Red Markers)
- **Current Stage**: Current water level in feet
- **Flood Stage**: Water level at which flooding begins
- **Status**: Active, inactive, or out of service

## Project Structure

```
USA_River_Sensors_And_Forecast/
├── index.html          # Main HTML file
├── style.css           # Styling and responsive design
├── app.js              # Application logic and API integration
├── README.md           # This file
└── LICENSE             # MIT License
```

## Technologies Used

- **HTML5**: Structure and semantic markup
- **CSS3**: Styling, animations, and responsive design
- **JavaScript (ES6+)**: Application logic and API integration
- **Leaflet.js**: Interactive mapping library
- **Leaflet.markercluster**: Marker clustering for better performance
- **OpenStreetMap**: Base map tiles

## API Rate Limits

### USGS
- No strict rate limits for reasonable use
- Recommended: Cache data and avoid excessive requests
- Large queries may take several seconds to complete

### NOAA NWPS
- No published rate limits for public use
- Best practice: Implement client-side caching
- Avoid rapid successive requests

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Opera: ✅ Full support
- Internet Explorer: ❌ Not supported (use modern browser)

## Development

### Local Development

No build process is required. Simply edit the files and refresh your browser.

### Serving with a Local Server

For development with CORS-enabled features:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (with http-server)
npx http-server

# PHP
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

## Customization

### Changing Map Center and Zoom

Edit `app.js` line 35:
```javascript
map = L.map('map').setView([39.8283, -98.5795], 4);
// [latitude, longitude], zoom level
```

### Modifying Marker Colors

Edit `style.css` or the marker creation code in `app.js`:
```javascript
fillColor: '#1E88E5',  // USGS blue
fillColor: '#F4511E',  // NOAA red
```

### Adding More Parameters

USGS supports many parameter codes. Edit the `fetchUSGSData()` function:
```javascript
// Common parameter codes:
// 00060 - Discharge (streamflow)
// 00065 - Gage height
// 00010 - Water temperature
// 00095 - Specific conductance
// 00300 - Dissolved oxygen
const url = `...&parameterCd=00060,00065,00010...`;
```

## Troubleshooting

### No Data Appears
- Check browser console for errors (F12)
- Verify internet connection
- APIs may be temporarily unavailable
- Try reducing the number of states queried

### Map Doesn't Load
- Ensure internet connection is active (required for map tiles)
- Check if browser blocks mixed content (HTTP/HTTPS)
- Clear browser cache and reload

### Markers Don't Cluster
- Ensure Leaflet.markercluster library loaded correctly
- Check browser console for JavaScript errors
- Try refreshing the page

### CORS Errors
- APIs should support CORS, but check browser console
- Try serving from a local web server instead of file://
- Some browser extensions may block API requests

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Future Enhancements

- [ ] Historical data visualization with charts
- [ ] Flood alerts and warnings
- [ ] Weather overlay integration
- [ ] Export data to CSV/JSON
- [ ] Save favorite locations
- [ ] Mobile app version
- [ ] Real-time websocket updates
- [ ] Precipitation and snow data
- [ ] River network visualization

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **USGS** for providing comprehensive water data APIs
- **NOAA/NWS** for river forecast and flood information
- **OpenStreetMap** contributors for map tiles
- **Leaflet** team for the excellent mapping library

## Resources

- [USGS Water Services Documentation](https://waterservices.usgs.gov/)
- [NOAA NWPS API Documentation](https://api.water.noaa.gov/nwps/v1/docs/)
- [Leaflet Documentation](https://leafletjs.com/)
- [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)

## Contact

For questions or support, please open an issue on GitHub.

---

Made with 💙 for water data enthusiasts
