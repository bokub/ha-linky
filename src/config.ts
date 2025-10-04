import { readFileSync } from 'node:fs';

/**
 * Configuration for a single meter (device) in the system.
 */
export type MeterConfig = {
  systemId: string; // Unique identifier of the APSystems system
  ecuId: string; // Unique identifier of the ECU device
  name: string; // Optional human-readable name
  action: 'sync' | 'reset'; // Action to perform: 'sync' for data sync, 'reset' to clear statistics
};

/**
 * Configuration for connecting to the OpenAPI.
 */
export type OpenapiConfig = {
  appId: string; // Application ID for authentication
  appSecret: string; // Secret key for authentication
};

/**
 * Complete user configuration containing all meters and API credentials.
 */
export type UserConfig = { meters: MeterConfig[]; api: OpenapiConfig };

/**
 * Reads and parses the user configuration from a JSON file.
 *
 * @returns A structured UserConfig object.
 * @throws Error if the configuration file cannot be read or contains duplicates.
 */
export function getUserConfig(): UserConfig {
  // Initialize a temporary object to store parsed JSON
  let parsed: { meters?: any[]; openapi?: any } = {};

  try {
    // Read and parse configuration JSON from file
    parsed = JSON.parse(readFileSync('/data/options.json', 'utf8'));
  } catch (e) {
    throw new Error('Cannot read user configuration: ' + e.toString());
  }

  // Initialize result with empty meters array and null API credentials
  const result: UserConfig = { meters: [], api: null };

  // Extract OpenAPI configuration if available
  if (parsed.openapi && parsed.openapi.appId && parsed.openapi.appSecret) {
    const resultApi: OpenapiConfig = {
      appId: parsed.openapi.appId,
      appSecret: parsed.openapi.appSecret,
    };
    result.api = resultApi;
  }

  // Extract APSystems meters configuration if available
  if (parsed.meters && Array.isArray(parsed.meters) && parsed.meters.length > 0) {
    for (const meter of parsed.meters) {
      if (meter.systemId && meter.ecuId) {
        const resultMeter: MeterConfig = {
          systemId: meter.systemId,
          ecuId: meter.ecuId,
          name: meter.name || 'APSystems', // Default name if not provided
          action: meter.action === 'reset' ? 'reset' : 'sync', // Default to 'sync'
        };
        result.meters.push(resultMeter);
      }
    }
  }

  // Check for duplicate systemId/ecuId combinations
  for (const m in result.meters) {
    for (const n in result.meters) {
      if (
        m !== n &&
        result.meters[m].systemId === result.meters[n].systemId &&
        result.meters[m].ecuId === result.meters[n].ecuId
      ) {
        throw new Error(
          `SystemId/EcuId ${result.meters[m].systemId}/${result.meters[m].ecuId} ` +
            `is configured multiple times`,
        );
      }
    }
  }

  return result;
}
