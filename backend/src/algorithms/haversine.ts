export type Coordinates = { latitude: number; longitude: number };

export const EARTH_RADIUS_KM = 6371;

export function haversineKm(_from: Coordinates, _to: Coordinates): number {
  throw new Error("not implemented");
}
