const fetch = require('node-fetch');
const { DateTimeTools } = require('./dateTimeTools');

class NorthernLineTools {
  constructor() {
    this.tflApiUrl = process.env.TFL_API_BASE_URL || 'https://api.tfl.gov.uk';
    this.lineId = 'northern';
    this.lineName = 'Northern';
  }

  async getLineInfo(query = '') {
    try {
      console.log('[NorthernTools] Starting TFL API calls...');

      const fetchWithTimeout = (url, timeout = 5000) => {
        return Promise.race([
          fetch(url),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout),
          ),
        ]);
      };

      console.log('[NorthernTools] Fetching line information...');
      const lineResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}`,
      );
      const lineData = await lineResponse.json();

      console.log('[NorthernTools] Fetching service status...');
      const statusResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/Status`,
      );
      const statusData = await statusResponse.json();

      console.log('[NorthernTools] Fetching stations...');
      const stationsResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/StopPoints`,
      );
      const stationsData = await stationsResponse.json();

      console.log('[NorthernTools] TFL API calls completed successfully');

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
        lastUpdated: DateTimeTools.getTFLTimestamp(),
        queryContext: query,
      };
    } catch (error) {
      console.error('[NorthernTools] Error fetching TFL data:', error);
      return {
        line: { name: this.lineName, id: this.lineId },
        status: [{ statusSeverityDescription: 'Service information unavailable' }],
        stations: [],
        stationCount: 0,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
        error: error.message,
        queryContext: query,
      };
    }
  }

  async getStationInfo(stationName) {
    try {
      console.log(`[NorthernTools] Searching for station: ${stationName}`);

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
        console.log(`[NorthernTools] No stations found for: ${stationName}`);
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
        console.log(`[NorthernTools] No Northern Line station found for: ${stationName}`);
        return { station: null, arrivals: [] };
      }

      console.log(`[NorthernTools] Found station: ${station.name}`);

      try {
        const arrivalsResponse = await fetchWithTimeout(
          `${this.tflApiUrl}/StopPoint/${station.id}/Arrivals`,
        );
        const arrivalsData = await arrivalsResponse.json();

        const northernArrivals = arrivalsData
          .filter(arrival => arrival.lineId === this.lineId)
          .sort((a, b) => a.timeToStation - b.timeToStation)
          .slice(0, 5);

        console.log(`[NorthernTools] Found ${northernArrivals.length} Northern Line arrivals`);

        return {
          station: {
            id: station.id,
            commonName: station.name,
            lat: station.lat,
            lon: station.lon,
          },
          arrivals: northernArrivals,
        };
      } catch (arrivalError) {
        console.error('[NorthernTools] Error fetching arrivals:', arrivalError);
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
      console.error('[NorthernTools] Error in getStationInfo:', error);
      return { station: null, arrivals: [] };
    }
  }

  async getServiceStatus() {
    try {
      const response = await fetch(`${this.tflApiUrl}/Line/${this.lineId}/Status`);
      return await response.json();
    } catch (error) {
      console.error('[NorthernTools] Error fetching service status:', error);
      return [];
    }
  }

  async getArrivals(stationId) {
    try {
      const response = await fetch(`${this.tflApiUrl}/StopPoint/${stationId}/Arrivals`);
      const arrivals = await response.json();
      return arrivals.filter(arrival => arrival.lineId === this.lineId);
    } catch (error) {
      console.error('[NorthernTools] Error fetching arrivals:', error);
      return [];
    }
  }
}

module.exports = { NorthernLineTools };