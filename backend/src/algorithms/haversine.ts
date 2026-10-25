export type Coordinates = { latitude: number; longitude: number };

export const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// Distância em linha reta sobre a esfera, não o trajeto pelas ruas: serve para comparar
// opções de atribuição, não para prometer tempo de entrega. A fórmula é a de referência
// de docs/evaluation-criteria.md, termo a termo:
//   a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
//   c = 2·atan2(√a, √(1−a))
//   d = R·c, com R = 6371 km
export function haversineKm(from: Coordinates, to: Coordinates): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const raw =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  // Em pontos quase antípodas o arredondamento pode deixar a um fio acima de 1, e √(1−a)
  // viraria NaN.
  const a = Math.min(1, raw);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
