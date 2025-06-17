const fetch = require('node-fetch');

class BakerlooLineTools {
  constructor() {
    this.tflApiUrl = process.env.TFL_API_BASE_URL || 'https://api.tfl.gov.uk';
    this.lineId = 'bakerloo';
    this.lineName = 'Bakerloo';
  }
  async getLineInfo(query = '') {
    try {
      console.log('[BakerlooTools] Starting TFL API calls...');

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
      console.log('[BakerlooTools] Fetching line information...');
      const lineResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}`,
      );
      const lineData = await lineResponse.json();

      // Get service status
      console.log('[BakerlooTools] Fetching service status...');
      const statusResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/Status`,
      );
      const statusData = await statusResponse.json();

      // Get stations (limit to reduce payload size)
      console.log('[BakerlooTools] Fetching stations...');
      const stationsResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/StopPoints`,
      );
      const stationsData = await stationsResponse.json();

      console.log('[BakerlooTools] TFL API calls completed successfully');

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
          name: lineData[0]?.name || 'Bakerloo Line',
          id: lineData[0]?.id || 'bakerloo',
          disruptions: lineData[0]?.disruptions?.slice(0, 3) || [],
        },
        status: statusData[0]?.lineStatuses?.slice(0, 2) || [],
        stations: filteredStations,
        stationCount: stationsData?.length || 0,
        queryProcessed: query,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[BakerlooTools] Bakerloo Line API Error:', error);
      return {
        line: { name: 'Bakerloo Line', id: 'bakerloo' },
        status: [
          {
            statusSeverityDescription:
              'Unable to fetch live data - using fallback',
          },
        ],
        stations: [],
        stationCount: 25, // Approximate Bakerloo Line station count
        error: error.message,
        lastUpdated: new Date().toISOString(),
        fallbackUsed: true,
      };
    }
  }

  async getStationInfo(stationName) {
    try {
      console.log(`[BakerlooTools] Searching for station: ${stationName}`);

      // Search for the station
      const searchResponse = await fetch(
        `${this.tflApiUrl}/StopPoint/Search/${encodeURIComponent(stationName)}`,
      );
      const searchData = await searchResponse.json();

      console.log(
        `[BakerlooTools] Found ${searchData.matches?.length || 0} station matches`,
      );

      // Look for stations that include tube mode and have Bakerloo line
      let targetStation = null;

      for (const match of searchData.matches || []) {
        // Check if this is a tube station
        if (match.modes?.includes('tube')) {
          console.log(
            `[BakerlooTools] Checking tube station: ${match.name} (${match.id})`,
          );

          // Get detailed info to check for Bakerloo line
          try {
            const detailResponse = await fetch(
              `${this.tflApiUrl}/StopPoint/${match.id}`,
            );
            const detailData = await detailResponse.json();

            // Check if this station serves the Bakerloo line
            const hasBakerlooLine =
              detailData.lines?.some((line) => line.id === 'bakerloo') ||
              detailData.children?.some((child) =>
                child.lines?.some((line) => line.id === 'bakerloo'),
              );

            if (hasBakerlooLine) {
              console.log(
                `[BakerlooTools] Found Bakerloo line station: ${detailData.commonName}`,
              );

              // If this is a hub station, find the specific Underground station
              if (detailData.children) {
                const undergroundStation = detailData.children.find(
                  (child) =>
                    child.modes?.includes('tube') &&
                    child.lines?.some((line) => line.id === 'bakerloo'),
                );

                if (undergroundStation) {
                  targetStation = undergroundStation;
                  console.log(
                    `[BakerlooTools] Using Underground station: ${undergroundStation.id}`,
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
              `[BakerlooTools] Error checking station ${match.id}:`,
              detailError.message,
            );
            continue;
          }
        }
      }

      if (!targetStation) {
        console.log(
          `[BakerlooTools] No Bakerloo Line station found for: ${stationName}`,
        );
        return {
          station: null,
          message: `No Bakerloo Line station found matching "${stationName}"`,
          suggestions: [],
        };
      }

      console.log(
        `[BakerlooTools] Selected station: ${targetStation.commonName} (${targetStation.id})`,
      );

      // Get live arrivals for this station
      console.log(
        `[BakerlooTools] Fetching arrivals for station: ${targetStation.id}`,
      );
      const arrivalsResponse = await fetch(
        `${this.tflApiUrl}/StopPoint/${targetStation.id}/Arrivals`,
      );
      const arrivalsData = await arrivalsResponse.json();

      // Filter arrivals for Bakerloo Line
      const bakerlooArrivals =
        arrivalsData?.filter((arrival) => arrival.lineId === 'bakerloo') || [];

      console.log(
        `[BakerlooTools] Found ${bakerlooArrivals.length} Bakerloo Line arrivals`,
      );

      // Log the first few arrivals for debugging
      if (bakerlooArrivals.length > 0) {
        console.log(
          `[BakerlooTools] Next Bakerloo Line arrival: ${Math.round(bakerlooArrivals[0].timeToStation / 60)} minutes`,
        );
      }

      const result = {
        station: targetStation,
        arrivals: bakerlooArrivals,
        message: `Found Bakerloo Line station: ${targetStation.commonName}`,
      };

      console.log(
        `[BakerlooTools] Returning result with station ID: ${result.station.id}`,
      );
      return result;
    } catch (error) {
      console.error('[BakerlooTools] Station Info Error:', error);
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

      // Filter arrivals for Bakerloo Line only
      const bakerlooArrivals =
        data?.filter((arrival) => arrival.lineId === 'bakerloo') || [];

      // Sort by expected arrival time
      bakerlooArrivals.sort((a, b) => a.timeToStation - b.timeToStation);

      return {
        stationId,
        line: this.lineName,
        arrivals: bakerlooArrivals,
        count: bakerlooArrivals.length,
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

      // Filter journeys that use Bakerloo Line
      const bakerlooJourneys =
        data.journeys?.filter((journey) =>
          journey.legs?.some(
            (leg) =>
              leg.mode?.id === 'tube' &&
              leg.routeOptions?.some((route) => route.lineId === 'bakerloo'),
          ),
        ) || [];

      return {
        from,
        to,
        journeys: bakerlooJourneys,
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

  async getHeritageInfo() {
    // Bakerloo Line specific heritage information
    return {
      opened: 1906,
      originalName: 'Baker Street and Waterloo Railway',
      nickname: 'The Brown Line',
      historicalFacts: [
        'One of the oldest deep-level lines on the London Underground',
        'Originally ran from Baker Street to Lambeth North (then called Kennington Road)',
        'Extended to Elephant & Castle in 1906',
        "Northern extension to Queen's Park opened in 1915",
        'Further extended to Watford Junction (now served by London Overground)',
        'Known for its distinctive brown/chocolate color since the 1930s',
      ],
      notableStations: [
        'Baker Street - Named after the famous detective Sherlock Holmes',
        'Oxford Circus - Major shopping destination',
        "Piccadilly Circus - Heart of London's West End",
        'Waterloo - Major railway terminus',
      ],
      lastUpdated: new Date().toISOString(),
    };
  }
}

module.exports = { BakerlooLineTools };
