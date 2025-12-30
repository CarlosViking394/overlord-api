/**
 * Domain constants
 */

export const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
export const HEALTH_CHECK_TIMEOUT_MS = 5000; // 5 seconds
export const COMMAND_TIMEOUT_MS = 30000; // 30 seconds
export const SERVICE_TTL_MS = 60000; // 60 seconds - service considered stale after this

export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;

export const API_VERSION = '1.0';
export const SERVICE_NAME = 'overlord-api';
