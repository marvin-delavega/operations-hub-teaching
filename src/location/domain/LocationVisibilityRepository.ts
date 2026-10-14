export interface LocationVisibilityRepository {
  setHidden(module: string, locationId: number, hidden: boolean): Promise<void>;
}
