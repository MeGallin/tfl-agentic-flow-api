const fetch = require('node-fetch');

class PiccadillyLineTools {
  constructor() {
    this.tflApiUrl = process.env.TFL_API_BASE_URL || 'https://api.tfl.gov.uk';
    this.lineId = 'piccadilly';
    this.lineName = 'Piccadilly';
  }

  async getLineInfo(query = '') {
    try {
      console.log('[PiccadillyTools] Starting TFL API calls...');

      const fetchWithTimeout = (url, timeout = 5000) => {
        return Promise.race([
          fetch(url),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout),
          ),
        ]);
      };

      const lineResponse = await fetchWithTimeout(`${this.tflApiUrl}/Line/${this.lineId}`);
      const lineData = await lineResponse.json();

      const statusResponse = await fetchWithTimeout(`${this.tflApiUrl}/Line/${this.lineId}/Status`);
      const statusData = await statusResponse.json();

      const stationsResponse = await fetchWithTimeout(`${this.tflApiUrl}/Line/${this.lineId}/StopPoints`);
      const stationsData = await stationsResponse.json();

      const filteredStations =
        stationsData?.slice(0, 20)?.map((station) => ({
          id: station.id,
          naptanId: station.naptanId,
          commonName: station.commonName,
          lat: station.lat,
          lon: station.lon,
          zone: station.zone,
          modes: station.modes,
        })) || [];

      return {
        line: lineData?.[0] || { name: this.lineName, id: this.lineId },
        status: statusData || [],
        stations: filteredStations,
        stationCount: stationsData?.length || 0,
        lastUpdated: new Date().toISOString(),
        queryContext: query,
      };
    } catch (error) {
      console.error('[PiccadillyTools] Error fetching TFL data:', error);
      return {
        line: { name: this.lineName, id: this.lineId },
        status: [{ statusSeverityDescription: 'Service information unavailable' }],
        stations: [],
        stationCount: 0,
        lastUpdated: new Date().toISOString(),
        error: error.message,
        queryContext: query,
      };
    }
  }

  async getStationInfo(stationName) {
    try {
      const fetchWithTimeout = (url, timeout = 5000) => {
        return Promise.race([
          fetch(url),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout),
          ),
        ]);
      };

      const searchResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/StopPoint/Search/${encodeURIComponent(stationName)}`,
      );
      const searchData = await searchResponse.json();

      if (!searchData.matches || searchData.matches.length === 0) {
        return { station: null, arrivals: [] };
      }

      const station = searchData.matches.find(
        (match) =>
          match.modes && 
          match.modes.includes('tube') &&
          match.lines &&
          match.lines.some(line => line.id === this.lineId)
      ) || searchData.matches[0];

      if (!station) {
        return { station: null, arrivals: [] };
      }

      try {
        const arrivalsResponse = await fetchWithTimeout(
          `${this.tflApiUrl}/StopPoint/${station.id}/Arrivals`,
        );
        const arrivalsData = await arrivalsResponse.json();

        const piccadillyArrivals = arrivalsData
          .filter(arrival => arrival.lineId === this.lineId)
          .sort((a, b) => a.timeToStation - b.timeToStation)
          .slice(0, 5);

        return {
          station: {
            id: station.id,
            commonName: station.name,
            lat: station.lat,
            lon: station.lon,
          },
          arrivals: piccadillyArrivals,
        };
      } catch (arrivalError) {
        return {
          station: {
            id: station.id,
            commonName: station.name,
            lat: station.lat,
            lon: station.lon,
          },
          arrivals: [],
        };
      }
    } catch (error) {
      console.error('[PiccadillyTools] Error in getStationInfo:', error);
      return { station: null, arrivals: [] };
    }
  }

  async getServiceStatus() {
    try {
      const response = await fetch(`${this.tflApiUrl}/Line/${this.lineId}/Status`);
      return await response.json();
    } catch (error) {
      console.error('[PiccadillyTools] Error fetching service status:', error);
      return [];
    }
  }

  async getArrivals(stationId) {
    try {
      const response = await fetch(`${this.tflApiUrl}/StopPoint/${stationId}/Arrivals`);
      const arrivals = await response.json();
      return arrivals.filter(arrival => arrival.lineId === this.lineId);
    } catch (error) {
      console.error('[PiccadillyTools] Error fetching arrivals:', error);
      return [];
    }
  }
}

module.exports = { PiccadillyLineTools };