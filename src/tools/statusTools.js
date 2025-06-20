const fetch = require('node-fetch');
const { DateTimeTools } = require('./dateTimeTools');

class StatusTools {
  constructor() {
    this.tflApiUrl = process.env.TFL_API_BASE_URL || 'https://api.tfl.gov.uk';
  }

  async getAllLinesStatus(query = '') {
    try {
      console.log('[StatusTools] Fetching all tube lines status...');

      const fetchWithTimeout = (url, timeout = 5000) => {
        return Promise.race([
          fetch(url),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout),
          ),
        ]);
      };

      const response = await fetchWithTimeout(
        `${this.tflApiUrl}/line/mode/tube/status`,
      );
      const data = await response.json();

      console.log('[StatusTools] Status API call completed successfully');

      // Process and organize the status data
      const organizedStatus = data.map((line) => ({
        id: line.id,
        name: line.name,
        modeName: line.modeName,
        status: line.lineStatuses?.map((status) => ({
          statusSeverity: status.statusSeverity,
          statusSeverityDescription: status.statusSeverityDescription,
          reason: status.reason,
          disruption: status.disruption,
        })) || [],
        disruptions: line.disruptions?.slice(0, 2) || [],
      }));

      return {
        lines: organizedStatus,
        lineCount: organizedStatus.length,
        queryProcessed: query,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('[StatusTools] Status API Error:', error);
      return {
        lines: [],
        lineCount: 0,
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
        fallbackUsed: true,
      };
    }
  }

  async getDisruptedLines() {
    try {
      console.log('[StatusTools] Fetching disrupted lines...');
      
      const allStatus = await this.getAllLinesStatus();
      
      const disruptedLines = allStatus.lines.filter(line => 
        line.status.some(status => 
          status.statusSeverity > 10 || 
          status.statusSeverityDescription !== 'Good Service'
        )
      );

      return {
        disruptedLines,
        totalLines: allStatus.lineCount,
        disruptionCount: disruptedLines.length,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('[StatusTools] Disrupted Lines Error:', error);
      return {
        disruptedLines: [],
        totalLines: 0,
        disruptionCount: 0,
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    }
  }

  async getGoodServiceLines() {
    try {
      console.log('[StatusTools] Fetching good service lines...');
      
      const allStatus = await this.getAllLinesStatus();
      
      const goodServiceLines = allStatus.lines.filter(line => 
        line.status.every(status => 
          status.statusSeverity <= 10 && 
          status.statusSeverityDescription === 'Good Service'
        )
      );

      return {
        goodServiceLines,
        totalLines: allStatus.lineCount,
        goodServiceCount: goodServiceLines.length,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('[StatusTools] Good Service Lines Error:', error);
      return {
        goodServiceLines: [],
        totalLines: 0,
        goodServiceCount: 0,
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    }
  }

  async getOverallNetworkStatus() {
    try {
      console.log('[StatusTools] Getting overall network status...');
      
      const allStatus = await this.getAllLinesStatus();
      const disruptedStatus = await this.getDisruptedLines();
      
      const totalLines = allStatus.lineCount;
      const disruptedCount = disruptedStatus.disruptionCount;
      const goodServiceCount = totalLines - disruptedCount;
      
      let overallStatus = 'Good Service';
      if (disruptedCount > totalLines * 0.5) {
        overallStatus = 'Severe Disruptions';
      } else if (disruptedCount > totalLines * 0.25) {
        overallStatus = 'Minor Disruptions';
      }

      return {
        overallStatus,
        totalLines,
        goodServiceCount,
        disruptedCount,
        percentage: Math.round((goodServiceCount / totalLines) * 100),
        lines: allStatus.lines,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    } catch (error) {
      console.error('[StatusTools] Overall Network Status Error:', error);
      return {
        overallStatus: 'Service information unavailable',
        totalLines: 0,
        goodServiceCount: 0,
        disruptedCount: 0,
        percentage: 0,
        lines: [],
        error: error.message,
        lastUpdated: DateTimeTools.getTFLTimestamp(),
      };
    }
  }
}

module.exports = { StatusTools };