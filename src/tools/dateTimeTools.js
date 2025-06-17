const { getLondonTime, formatLondonTime, calculateArrivalTime } = require('../utils/dateUtils');

/**
 * Date and time tools for TFL agents
 * Provides London timezone-aware date/time functions
 */
class DateTimeTools {
  /**
   * Get current London date and time
   * This is the todays_date_time tool referenced in prompts
   */
  static getCurrentLondonTime() {
    const londonTime = getLondonTime();
    
    return {
      currentTime: londonTime.formatted,
      time24: londonTime.time24,
      time12: londonTime.time12,
      date: londonTime.date,
      timestamp: londonTime.timestamp,
      iso: londonTime.londonISO,
      timezone: 'Europe/London'
    };
  }

  /**
   * Format a TFL API timestamp to London time
   */
  static formatTFLTimestamp(timestamp, format = 'full') {
    return formatLondonTime(timestamp, format);
  }

  /**
   * Calculate arrival time for TFL predictions
   */
  static calculateArrival(timeToStationSeconds) {
    return calculateArrivalTime(timeToStationSeconds);
  }

  /**
   * Get formatted timestamp for TFL data responses
   */
  static getFormattedTimestamp() {
    const londonTime = getLondonTime();
    return londonTime.formatted;
  }

  /**
   * Get current time for TFL API consistency
   */
  static getTFLTimestamp() {
    const londonTime = getLondonTime();
    return londonTime.londonISO;
  }
}

// Export for use in agents
const todays_date_time = () => DateTimeTools.getCurrentLondonTime();

module.exports = {
  DateTimeTools,
  todays_date_time
};