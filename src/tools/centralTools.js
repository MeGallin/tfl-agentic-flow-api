const fetch = require('node-fetch');
const { DateTimeTools } = require('./dateTimeTools');

class CentralLineTools {
  constructor() {
    this.tflApiUrl = process.env.TFL_API_BASE_URL || 'https://api.tfl.gov.uk';
    this.lineId = 'central';
    this.lineName = 'Central';
  }

  async getLineInfo(query = '') {
    try {
      console.log('[CentralTools] Starting TFL API calls...');

      // Add timeout to fetch requests
      const fetchWithTimeout = (url, timeout = 5000) => {
        return Promise.race([
          fetch(url),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout),
          ),
        ]);
      };

      // Get general line information
      console.log('[CentralTools] Fetching line information...');
      const lineResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}`,
      );
      const lineData = await lineResponse.json();

      // Get service status
      console.log('[CentralTools] Fetching service status...');
      const statusResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/Status`,
      );
      const statusData = await statusResponse.json();

      // Get stations (limit to reduce payload size)
      console.log('[CentralTools] Fetching stations...');
      const stationsResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/StopPoints`,
      );
      const stationsData = await stationsResponse.json();

      console.log('[CentralTools] TFL API calls completed successfully');

      // Filter stations to only essential data to prevent token overflow
      const filteredStations =
        stationsData?.slice(0, 20)?.map((station) => ({
          id: station.id,
          name: station.commonName || station.name,
          lat: station.lat,
          lon: station.lon,
          zone: station.zone,
        })) || [];

      return {
        line: {
          name: lineData[0]?.name || 'Central Line',
          id: lineData[0]?.id || 'central',
          disruptions: lineData[0]?.disruptions?.slice(0, 3) || [],
        },
        status: statusData[0]?.lineStatuses?.slice(0, 2) || [],
        stations: filteredStations,
        stationCount: stationsData?.length || 0,
        queryProcessed: query,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('[CentralTools] Central Line API Error:', error);
      return {
        line: { name: 'Central Line', id: 'central' },
        status: [
          {
            statusSeverityDescription:
              'Unable to fetch live data - using fallback',
          },
        ],
        stations: [],
        stationCount: 49, // Approximate Central Line station count
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
        fallbackUsed: true,
      };
    }
  }

  async getStationInfo(stationName) {
    try {
      console.log(`[CentralTools] Searching for station: ${stationName}`);

      // Search for the station
      const searchResponse = await fetch(
        `${this.tflApiUrl}/StopPoint/Search/${encodeURIComponent(stationName)}`,
      );
      const searchData = await searchResponse.json();

      console.log(
        `[CentralTools] Found ${searchData.matches?.length || 0} station matches`,
      );

      // Look for stations that include tube mode and have Central line
      let targetStation = null;

      for (const match of searchData.matches || []) {
        // Check if this is a tube station
        if (match.modes?.includes('tube')) {
          console.log(
            `[CentralTools] Checking tube station: ${match.name} (${match.id})`,
          );

          // Get detailed info to check for Central line
          try {
            const detailResponse = await fetch(
              `${this.tflApiUrl}/StopPoint/${match.id}`,
            );
            const detailData = await detailResponse.json();

            // Check if this station serves the Central line
            const hasCentralLine =
              detailData.lines?.some((line) => line.id === 'central') ||
              detailData.children?.some((child) =>
                child.lines?.some((line) => line.id === 'central'),
              );

            if (hasCentralLine) {
              console.log(
                `[CentralTools] Found Central line station: ${detailData.commonName}`,
              );

              // If this is a hub station, find the specific Underground station
              if (detailData.children) {
                const undergroundStation = detailData.children.find(
                  (child) =>
                    child.modes?.includes('tube') &&
                    child.lines?.some((line) => line.id === 'central'),
                );

                if (undergroundStation) {
                  // Use the parent station ID for arrivals API, not the child platform ID
                  targetStation = {
                    ...undergroundStation,
                    id: detailData.id, // Use parent station ID for arrivals
                    arrivalsId: detailData.id, // Keep track of the correct arrivals ID
                  };
                  console.log(
                    `[CentralTools] Using Underground station: ${detailData.id} (parent station for arrivals)`,
                  );
                  break;
                }
              } else {
                targetStation = detailData;
                break;
              }
            }
          } catch (detailError) {
            console.log(
              `[CentralTools] Error checking station ${match.id}:`,
              detailError.message,
            );
            continue;
          }
        }
      }

      if (!targetStation) {
        console.log(
          `[CentralTools] No Central Line station found for: ${stationName}`,
        );
        return {
          station: null,
          message: `No Central Line station found matching "${stationName}"`,
          suggestions: [],
        };
      }

      console.log(
        `[CentralTools] Selected station: ${targetStation.commonName} (${targetStation.id})`,
      );

      // Get live arrivals for this station
      console.log(
        `[CentralTools] Fetching arrivals for station: ${targetStation.id}`,
      );
      const arrivalsResponse = await fetch(
        `${this.tflApiUrl}/StopPoint/${targetStation.id}/Arrivals`,
      );
      const arrivalsData = await arrivalsResponse.json();

      // Filter arrivals for Central Line
      const centralArrivals =
        arrivalsData?.filter((arrival) => arrival.lineId === 'central') || [];

      console.log(
        `[CentralTools] Found ${centralArrivals.length} Central Line arrivals`,
      );

      // Log the first few arrivals for debugging
      if (centralArrivals.length > 0) {
        console.log(
          `[CentralTools] Next Central Line arrival: ${Math.round(centralArrivals[0].timeToStation / 60)} minutes`,
        );
      }

      const result = {
        station: targetStation,
        arrivals: centralArrivals,
        message: `Found Central Line station: ${targetStation.commonName}`,
      };

      console.log(
        `[CentralTools] Returning result with station ID: ${result.station.id}`,
      );
      return result;
    } catch (error) {
      console.error('[CentralTools] Station Info Error:', error);
      return {
        station: null,
        error: error.message,
        message: 'Unable to fetch station information',
      };
    }
  }

  async getServiceStatus() {
    try {
      const response = await fetch(
        `${this.tflApiUrl}/Line/${this.lineId}/Status`,
      );
      const data = await response.json();

      return {
        line: this.lineName,
        status: data[0]?.lineStatuses || [],
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('Service Status Error:', error);
      return {
        line: this.lineName,
        status: [
          { statusSeverityDescription: 'Service information unavailable' },
        ],
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    }
  }

  async getArrivals(stationId) {
    try {
      const response = await fetch(
        `${this.tflApiUrl}/StopPoint/${stationId}/Arrivals`,
      );
      const data = await response.json();

      // Filter arrivals for Central Line only
      const centralArrivals =
        data?.filter((arrival) => arrival.lineId === 'central') || [];

      // Sort by expected arrival time
      centralArrivals.sort((a, b) => a.timeToStation - b.timeToStation);

      return {
        stationId,
        line: this.lineName,
        arrivals: centralArrivals,
        count: centralArrivals.length,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('Arrivals Error:', error);
      return {
        stationId,
        line: this.lineName,
        arrivals: [],
        count: 0,
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    }
  }

  async getDisruptions() {
    try {
      const response = await fetch(
        `${this.tflApiUrl}/Line/${this.lineId}/Disruption`,
      );
      const data = await response.json();

      return {
        line: this.lineName,
        disruptions: data || [],
        count: data?.length || 0,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('Disruptions Error:', error);
      return {
        line: this.lineName,
        disruptions: [],
        count: 0,
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    }
  }

  async getJourneyPlanner(from, to) {
    try {
      const response = await fetch(
        `${this.tflApiUrl}/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}?mode=tube`,
      );
      const data = await response.json();

      // Filter journeys that use Central Line
      const centralJourneys =
        data.journeys?.filter((journey) =>
          journey.legs?.some(
            (leg) =>
              leg.mode?.id === 'tube' &&
              leg.routeOptions?.some((route) => route.lineId === 'central'),
          ),
        ) || [];

      return {
        from,
        to,
        journeys: centralJourneys,
        allJourneys: data.journeys || [],
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('Journey Planner Error:', error);
      return {
        from,
        to,
        journeys: [],
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    }
  }
}

module.exports = { CentralLineTools };
