// Shared in-memory visibility state for seed repositories.
// Key format: `${module}:${locationId}`, value: true = hidden.
export const visibilityStore = new Map<string, boolean>();
