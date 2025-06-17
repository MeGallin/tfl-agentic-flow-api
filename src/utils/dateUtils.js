/**
 * Date and time utilities for TFL API responses
 * Handles timezone conversion between UTC and London time (GMT/BST)
 */

/**
 * Get current London time
 * Automatically handles GMT (UTC+0) in winter and BST (UTC+1) in summer
 */
function getLondonTime() {
  const now = new Date();
  
  // Format for London timezone
  const londonTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);

  // Convert to object for easy access
  const parts = {};
  londonTime.forEach(part => {
    parts[part.type] = part.value;
  });

  return {
    iso: now.toISOString(),
    londonISO: getLondonISOString(now),
    formatted: `${parts.day} ${getMonthName(parseInt(parts.month))} ${parts.year} - ${parts.hour}:${parts.minute}:${parts.second}`,
    time24: `${parts.hour}:${parts.minute}:${parts.second}`,
    time12: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(now),
    date: `${parts.day}/${parts.month}/${parts.year}`,
    timestamp: now.getTime(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

/**
 * Convert a Date object to London timezone ISO string
 */
function getLondonISOString(date) {
  const londonOffset = getLondonTimezoneOffset(date);
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const londonTime = new Date(utcTime + (londonOffset * 60000));
  return londonTime.toISOString();
}

/**
 * Get London timezone offset in minutes
 * Returns -60 for BST (UTC+1) or 0 for GMT (UTC+0)
 */
function getLondonTimezoneOffset(date) {
  const london = new Date(date.toLocaleString("en-US", {timeZone: "Europe/London"}));
  const utc = new Date(date.toLocaleString("en-US", {timeZone: "UTC"}));
  return (utc.getTime() - london.getTime()) / (1000 * 60);
}

/**
 * Format a timestamp for display in London time
 */
function formatLondonTime(timestamp, format = 'full') {
  const date = new Date(timestamp);
  
  switch (format) {
    case 'time':
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
      
    case 'datetime':
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
      
    case 'full':
    default:
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(date);

      const partsObj = {};
      parts.forEach(part => {
        partsObj[part.type] = part.value;
      });

      return `${partsObj.day} ${getMonthName(parseInt(partsObj.month))} ${partsObj.year} - ${partsObj.hour}:${partsObj.minute}:${partsObj.second}`;
  }
}

/**
 * Calculate arrival time in London timezone
 */
function calculateArrivalTime(timeToStationSeconds) {
  const now = new Date();
  const arrivalTime = new Date(now.getTime() + (timeToStationSeconds * 1000));
  
  return {
    arrivalTime: formatLondonTime(arrivalTime, 'time'),
    arrivalTimestamp: arrivalTime.getTime(),
    minutesToArrival: Math.round(timeToStationSeconds / 60)
  };
}

/**
 * Get month name from number
 */
function getMonthName(monthNumber) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return months[monthNumber - 1] || 'Jan';
}

/**
 * Check if we're currently in British Summer Time
 */
function isBST() {
  const londonOffset = getLondonTimezoneOffset(new Date());
  return londonOffset === -60; // BST is UTC+1, so offset is -60 minutes
}

module.exports = {
  getLondonTime,
  getLondonISOString,
  formatLondonTime,
  calculateArrivalTime,
  isBST,
  getLondonTimezoneOffset
};