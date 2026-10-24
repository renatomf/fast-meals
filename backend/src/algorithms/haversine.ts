export type Coordinates = { latitude: number; longitude: number };

export const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// Distância em linha reta sobre a esfera, não o trajeto pelas ruas: serve para comparar
// opções de atribuição, não para prometer tempo de entrega.
export function haversineKm(from: Coordinates, to: Coordinates): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  // Em pontos quase antípodas o arredondamento pode deixar a um fio acima de 1, e o asin
  // devolveria NaN.
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}
