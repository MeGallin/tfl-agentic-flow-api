const fetch = require('node-fetch');

class CircleLineTools {
  constructor() {
    this.tflApiUrl = process.env.TFL_API_BASE_URL || 'https://api.tfl.gov.uk';
    this.lineId = 'circle';
    this.lineName = 'Circle';
  }
  async getLineInfo(query = '') {
    try {
      console.log('[CircleTools] Starting TFL API calls...');

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
      console.log('[CircleTools] Fetching line information...');
      const lineResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}`,
      );
      const lineData = await lineResponse.json();

      // Get service status
      console.log('[CircleTools] Fetching service status...');
      const statusResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/Status`,
      );
      const statusData = await statusResponse.json(); // Get stations (limit to reduce payload size)
      console.log('[CircleTools] Fetching stations...');
      const stationsResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/StopPoints`,
      );
      const stationsData = await stationsResponse.json();

      console.log('[CircleTools] TFL API calls completed successfully');

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
          name: lineData[0]?.name || 'Circle Line',
          id: lineData[0]?.id || 'circle',
          disruptions: lineData[0]?.disruptions?.slice(0, 3) || [],
        },
        status: statusData[0]?.lineStatuses?.slice(0, 2) || [],
        stations: filteredStations,
        stationCount: stationsData?.length || 0,
        queryProcessed: query,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[CircleTools] Circle Line API Error:', error);
      return {
        line: { name: 'Circle Line', id: 'circle' },
        status: [
          {
            statusSeverityDescription:
              'Unable to fetch live data - using fallback',
          },
        ],
        stations: [],
        stationCount: 36, // Approximate Circle Line station count
        error: error.message,
        lastUpdated: new Date().toISOString(),
        fallbackUsed: true,
      };
    }
  }

  async getStationInfo(stationName) {
    try {
      console.log(`[CircleTools] Searching for station: ${stationName}`);

      // Search for the station
      const searchResponse = await fetch(
        `${this.tflApiUrl}/StopPoint/Search/${encodeURIComponent(stationName)}`,
      );
      const searchData = await searchResponse.json();

      console.log(
        `[CircleTools] Found ${searchData.matches?.length || 0} station matches`,
      );

      // Look for stations that include tube mode and have Circle line
      let targetStation = null;

      for (const match of searchData.matches || []) {
        // Check if this is a tube station
        if (match.modes?.includes('tube')) {
          console.log(
            `[CircleTools] Checking tube station: ${match.name} (${match.id})`,
          );

          // Get detailed info to check for Circle line
          try {
            const detailResponse = await fetch(
              `${this.tflApiUrl}/StopPoint/${match.id}`,
            );
            const detailData = await detailResponse.json();

            // Check if this station serves the Circle line
            const hasCircleLine =
              detailData.lines?.some((line) => line.id === 'circle') ||
              detailData.children?.some((child) =>
                child.lines?.some((line) => line.id === 'circle'),
              );

            if (hasCircleLine) {
              console.log(
                `[CircleTools] Found Circle line station: ${detailData.commonName}`,
              );

              // If this is a hub station, find the specific Underground station
              if (detailData.children) {
                const undergroundStation = detailData.children.find(
                  (child) =>
                    child.modes?.includes('tube') &&
                    child.lines?.some((line) => line.id === 'circle'),
                );

                if (undergroundStation) {
                  // Use the parent station ID for arrivals API, not the child platform ID
                  targetStation = {
                    ...undergroundStation,
                    id: detailData.id, // Use parent station ID for arrivals
                    arrivalsId: detailData.id, // Keep track of the correct arrivals ID
                  };
                  console.log(
                    `[CircleTools] Using Underground station: ${detailData.id} (parent station for arrivals)`,
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
              `[CircleTools] Error checking station ${match.id}:`,
              detailError.message,
            );
            continue;
          }
        }
      }

      if (!targetStation) {
        console.log(
          `[CircleTools] No Circle Line station found for: ${stationName}`,
        );
        return {
          station: null,
          message: `No Circle Line station found matching "${stationName}"`,
          suggestions: [],
        };
      }

      console.log(
        `[CircleTools] Selected station: ${targetStation.commonName} (${targetStation.id})`,
      );

      // Get live arrivals for this station
      console.log(
        `[CircleTools] Fetching arrivals for station: ${targetStation.id}`,
      );
      const arrivalsResponse = await fetch(
        `${this.tflApiUrl}/StopPoint/${targetStation.id}/Arrivals`,
      );
      const arrivalsData = await arrivalsResponse.json();

      // Filter arrivals for Circle Line
      const circleArrivals =
        arrivalsData?.filter((arrival) => arrival.lineId === 'circle') || [];

      console.log(
        `[CircleTools] Found ${circleArrivals.length} Circle Line arrivals`,
      );

      // Log the first few arrivals for debugging
      if (circleArrivals.length > 0) {
        console.log(
          `[CircleTools] Next Circle Line arrival: ${Math.round(circleArrivals[0].timeToStation / 60)} minutes`,
        );
      }

      const result = {
        station: targetStation,
        arrivals: circleArrivals,
        message: `Found Circle Line station: ${targetStation.commonName}`,
      };

      console.log(
        `[CircleTools] Returning result with station ID: ${result.station.id}`,
      );
      return result;
    } catch (error) {
      console.error('[CircleTools] Station Info Error:', error);
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
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Service Status Error:', error);
      return {
        line: this.lineName,
        status: [
          { statusSeverityDescription: 'Service information unavailable' },
        ],
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  async getArrivals(stationId) {
    try {
      const response = await fetch(
        `${this.tflApiUrl}/StopPoint/${stationId}/Arrivals`,
      );
      const data = await response.json();

      // Filter arrivals for Circle Line only
      const circleArrivals =
        data?.filter((arrival) => arrival.lineId === 'circle') || [];

      // Sort by expected arrival time
      circleArrivals.sort((a, b) => a.timeToStation - b.timeToStation);

      return {
        stationId,
        line: this.lineName,
        arrivals: circleArrivals,
        count: circleArrivals.length,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Arrivals Error:', error);
      return {
        stationId,
        line: this.lineName,
        arrivals: [],
        count: 0,
        error: error.message,
        lastUpdated: new Date().toISOString(),
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
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Disruptions Error:', error);
      return {
        line: this.lineName,
        disruptions: [],
        count: 0,
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  async getJourneyPlanner(from, to) {
    try {
      const response = await fetch(
        `${this.tflApiUrl}/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}?mode=tube`,
      );
      const data = await response.json();

      // Filter journeys that use Circle Line
      const circleJourneys =
        data.journeys?.filter((journey) =>
          journey.legs?.some(
            (leg) =>
              leg.mode?.id === 'tube' &&
              leg.routeOptions?.some((route) => route.lineId === 'circle'),
          ),
        ) || [];

      return {
        from,
        to,
        journeys: circleJourneys,
        allJourneys: data.journeys || [],
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Journey Planner Error:', error);
      return {
        from,
        to,
        journeys: [],
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}

module.exports = { CircleLineTools };
