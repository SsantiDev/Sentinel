/**
 * @typedef {Object} Service
 * @property {number} id
 * @property {string} name
 * @property {string} url
 * @property {boolean} is_active
 * @property {number} check_interval_seconds
 * @property {'up'|'down'|'unknown'} status
 * @property {number|null} response_time_ms
 * @property {string|null} last_checked_at
 */

/**
 * @typedef {Object} CheckResult
 * @property {number} id
 * @property {'up'|'down'} status
 * @property {number|null} response_time_ms
 * @property {number|null} status_code
 * @property {string|null} error_message
 * @property {string} checked_at
 */
