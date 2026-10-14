/**
 * External-service port for delivery mode settings. Blind mode decides whether
 * the server-side discrepancy-approval gate applies at commit (FR-23/24), so it
 * must be resolved from app_settings on the server — never trusted from the client.
 */
export interface DeliverySettings {
  isBlindDeliveryEnabled(): Promise<boolean>;
}
