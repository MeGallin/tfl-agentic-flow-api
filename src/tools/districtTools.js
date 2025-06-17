const fetch = require('node-fetch');
const { DateTimeTools } = require('./dateTimeTools');

class DistrictLineTools {
  constructor() {
    this.tflApiUrl = process.env.TFL_API_BASE_URL || 'https://api.tfl.gov.uk';
    this.lineId = 'district';
    this.lineName = 'District';
  }
  async getLineInfo(query = '') {
    try {
      console.log('[DistrictTools] Starting TFL API calls...');

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
      console.log('[DistrictTools] Fetching line information...');
      const lineResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}`,
      );
      const lineData = await lineResponse.json();

      // Get service status
      console.log('[DistrictTools] Fetching service status...');
      const statusResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/Status`,
      );
      const statusData = await statusResponse.json();

      // Get stations (limit to reduce payload size)
      console.log('[DistrictTools] Fetching stations...');
      const stationsResponse = await fetchWithTimeout(
        `${this.tflApiUrl}/Line/${this.lineId}/StopPoints`,
      );
      const stationsData = await stationsResponse.json();

      console.log('[DistrictTools] TFL API calls completed successfully');

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
          name: lineData[0]?.name || 'District Line',
          id: lineData[0]?.id || 'district',
          disruptions: lineData[0]?.disruptions?.slice(0, 3) || [],
        },
        status: statusData[0]?.lineStatuses?.slice(0, 2) || [],
        stations: filteredStations,
        stationCount: stationsData?.length || 0,
        queryProcessed: query,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('[DistrictTools] District Line API Error:', error);
      return {
        line: { name: 'District Line', id: 'district' },
        status: [
          {
            statusSeverityDescription:
              'Unable to fetch live data - using fallback',
          },
        ],
        stations: [],
        stationCount: 60, // Approximate District Line station count
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
        fallbackUsed: true,
      };
    }
  }

  async getStationInfo(stationName) {
    try {
      console.log(`[DistrictTools] Searching for station: ${stationName}`);

      // Search for the station
      const searchResponse = await fetch(
        `${this.tflApiUrl}/StopPoint/Search/${encodeURIComponent(stationName)}`,
      );
      const searchData = await searchResponse.json();

      console.log(
        `[DistrictTools] Found ${searchData.matches?.length || 0} station matches`,
      );

      // Look for stations that include tube mode and have District line
      let targetStation = null;

      for (const match of searchData.matches || []) {
        // Check if this is a tube station
        if (match.modes?.includes('tube')) {
          console.log(
            `[DistrictTools] Checking tube station: ${match.name} (${match.id})`,
          );

          // Get detailed info to check for District line
          try {
            const detailResponse = await fetch(
              `${this.tflApiUrl}/StopPoint/${match.id}`,
            );
            const detailData = await detailResponse.json();

            // Check if this station serves the District line
            const hasDistrictLine =
              detailData.lines?.some((line) => line.id === 'district') ||
              detailData.children?.some((child) =>
                child.lines?.some((line) => line.id === 'district'),
              );

            if (hasDistrictLine) {
              console.log(
                `[DistrictTools] Found District line station: ${detailData.commonName}`,
              );

              // If this is a hub station, find the specific Underground station
              if (detailData.children) {
                const undergroundStation = detailData.children.find(
                  (child) =>
                    child.modes?.includes('tube') &&
                    child.lines?.some((line) => line.id === 'district'),
                );

                if (undergroundStation) {
                  targetStation = undergroundStation;
                  console.log(
                    `[DistrictTools] Using Underground station: ${undergroundStation.id}`,
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
              `[DistrictTools] Error checking station ${match.id}:`,
              detailError.message,
            );
            continue;
          }
        }
      }

      if (!targetStation) {
        console.log(
          `[DistrictTools] No District Line station found for: ${stationName}`,
        );
        return {
          station: null,
          message: `No District Line station found matching "${stationName}"`,
          suggestions: [],
        };
      }

      console.log(
        `[DistrictTools] Selected station: ${targetStation.commonName} (${targetStation.id})`,
      );

      // Get live arrivals for this station
      console.log(
        `[DistrictTools] Fetching arrivals for station: ${targetStation.id}`,
      );
      const arrivalsResponse = await fetch(
        `${this.tflApiUrl}/StopPoint/${targetStation.id}/Arrivals`,
      );
      const arrivalsData = await arrivalsResponse.json();

      // Filter arrivals for District Line
      const districtArrivals =
        arrivalsData?.filter((arrival) => arrival.lineId === 'district') || [];

      console.log(
        `[DistrictTools] Found ${districtArrivals.length} District Line arrivals`,
      );

      // Log the first few arrivals for debugging
      if (districtArrivals.length > 0) {
        console.log(
          `[DistrictTools] Next District Line arrival: ${Math.round(districtArrivals[0].timeToStation / 60)} minutes`,
        );
      }

      const result = {
        station: targetStation,
        arrivals: districtArrivals,
        message: `Found District Line station: ${targetStation.commonName}`,
      };

      console.log(
        `[DistrictTools] Returning result with station ID: ${result.station.id}`,
      );
      return result;
    } catch (error) {
      console.error('[DistrictTools] Station Info Error:', error);
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

      // Filter arrivals for District Line only
      const districtArrivals =
        data?.filter((arrival) => arrival.lineId === 'district') || [];

      // Sort by expected arrival time
      districtArrivals.sort((a, b) => a.timeToStation - b.timeToStation);

      return {
        stationId,
        line: this.lineName,
        arrivals: districtArrivals,
        count: districtArrivals.length,
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

      // Filter journeys that use District Line
      const districtJourneys =
        data.journeys?.filter((journey) =>
          journey.legs?.some(
            (leg) =>
              leg.mode?.id === 'tube' &&
              leg.routeOptions?.some((route) => route.lineId === 'district'),
          ),
        ) || [];

      return {
        from,
        to,
        journeys: districtJourneys,
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

  async getBranchInfo() {
    // District Line specific branch information
    return {
      branches: {
        main: {
          name: "Earl's Court to Upminster",
          stations: [
            "Earl's Court",
            'Monument',
            'Tower Hill',
            'Whitechapel',
            'Mile End',
            'Bow Road',
            'West Ham',
            'Barking',
            'Upminster',
          ],
          description: 'Main eastern branch serving East London and Essex',
        },
        ealing: {
          name: 'Ealing Broadway branch',
          stations: [
            'Paddington',
            'Edgware Road',
            'Notting Hill Gate',
            'High Street Kensington',
            "Earl's Court",
            'Ealing Broadway',
          ],
          description: 'Western branch serving West London',
        },
        richmond: {
          name: 'Richmond branch',
          stations: [
            "Earl's Court",
            'Putney Bridge',
            'East Putney',
            'Southfields',
            'Wimbledon Park',
            'Richmond',
          ],
          description: 'South-western branch serving Richmond upon Thames',
        },
        wimbledon: {
          name: 'Wimbledon branch',
          stations: [
            "Earl's Court",
            'Putney Bridge',
            'East Putney',
            'Southfields',
            'Wimbledon Park',
            'Wimbledon',
          ],
          description: 'South-western branch serving Wimbledon',
        },
        olympia: {
          name: 'Kensington (Olympia) branch',
          stations: ["Earl's Court", 'West Kensington', 'Kensington (Olympia)'],
          description: 'Limited service branch for events and exhibitions',
        },
      },
      keyInterchanges: [
        "Earl's Court - Major interchange for all District Line branches",
        'Paddington - National Rail and other Underground lines',
        'Victoria - National Rail and other Underground lines',
        'Westminster - Jubilee and Circle lines',
        'Monument - Circle and Northern lines',
        'Tower Hill - Circle line',
        'Mile End - Central and Hammersmith & City lines',
      ],
      lastUpdated: DateTimeTools.getTFLTimestamp(),
    };
  }

  async getStationsByBranch(branch) {
    const branchInfo = await this.getBranchInfo();
    const requestedBranch = branchInfo.branches[branch?.toLowerCase()];

    if (!requestedBranch) {
      return {
        error: `Branch "${branch}" not found`,
        availableBranches: Object.keys(branchInfo.branches),
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    }

    return {
      branch: requestedBranch.name,
      stations: requestedBranch.stations,
      description: requestedBranch.description,
      lastUpdated: DateTimeTools.getTFLTimestamp(),
    };
  }
}

module.exports = { DistrictLineTools };
