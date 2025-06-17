const fetch = require('node-fetch');

class JubileeLineTools {
  constructor() {
    this.tflApiUrl = process.env.TFL_API_BASE_URL || 'https://api.tfl.gov.uk';
    this.lineId = 'jubilee';
    this.lineName = 'Jubilee';
  }

  async getLineInfo(query = '') {
    try {
      const fetchWithTimeout = (url, timeout = 5000) => {
        return Promise.race([
          fetch(url),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout),
          ),
        ]);
      };

      const [lineResponse, statusResponse, stationsResponse] = await Promise.all([
        fetchWithTimeout(`${this.tflApiUrl}/Line/${this.lineId}`),
        fetchWithTimeout(`${this.tflApiUrl}/Line/${this.lineId}/Status`),
        fetchWithTimeout(`${this.tflApiUrl}/Line/${this.lineId}/StopPoints`)
      ]);

      const [lineData, statusData, stationsData] = await Promise.all([
        lineResponse.json(),
        statusResponse.json(),
        stationsResponse.json()
      ]);

      const filteredStations = stationsData?.slice(0, 20)?.map((station) => ({
        id: station.id,
        commonName: station.commonName,
        lat: station.lat,
        lon: station.lon,
        zone: station.zone,
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

      const station = searchData.matches?.find(
        (match) => match.modes?.includes('tube') && match.lines?.some(line => line.id === this.lineId)
      ) || searchData.matches?.[0];

      if (!station) return { station: null, arrivals: [] };

      try {
        const arrivalsResponse = await fetchWithTimeout(
          `${this.tflApiUrl}/StopPoint/${station.id}/Arrivals`,
        );
        const arrivalsData = await arrivalsResponse.json();

        const arrivals = arrivalsData
          .filter(arrival => arrival.lineId === this.lineId)
          .sort((a, b) => a.timeToStation - b.timeToStation)
          .slice(0, 5);

        return {
          station: { id: station.id, commonName: station.name, lat: station.lat, lon: station.lon },
          arrivals,
        };
      } catch {
        return {
          station: { id: station.id, commonName: station.name, lat: station.lat, lon: station.lon },
          arrivals: [],
        };
      }
    } catch (error) {
      return { station: null, arrivals: [] };
    }
  }

  async getServiceStatus() {
    try {
      const response = await fetch(`${this.tflApiUrl}/Line/${this.lineId}/Status`);
      return await response.json();
    } catch (error) {
      return [];
    }
  }

  async getArrivals(stationId) {
    try {
      const response = await fetch(`${this.tflApiUrl}/StopPoint/${stationId}/Arrivals`);
      const arrivals = await response.json();
      return arrivals.filter(arrival => arrival.lineId === this.lineId);
    } catch (error) {
      return [];
    }
  }
}

module.exports = { JubileeLineTools };