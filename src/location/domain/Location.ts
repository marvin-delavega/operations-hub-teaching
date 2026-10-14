export interface Location {
  id: number;
  name: string;
  hidden: boolean;
  /** Set only when module = replenishment and this location is a configured selling area. */
  fedByFeederName?: string | null;
}
