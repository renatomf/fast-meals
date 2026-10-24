import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EARTH_RADIUS_KM, haversineKm } from "../src/algorithms/haversine.ts";

const point = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
});

// Os valores esperados vêm da geometria da esfera, não da implementação.
describe("haversine", () => {
  it("is zero between a point and itself", () => {
    expect(
      haversineKm(
        { latitude: -23.5505, longitude: -46.6333 },
        { latitude: -23.5505, longitude: -46.6333 },
      ),
    ).toBe(0);
  });

  it("measures a quarter meridian as πR/2", () => {
    const equator = { latitude: 0, longitude: 0 };
    const northPole = { latitude: 90, longitude: 0 };

    expect(haversineKm(equator, northPole)).toBeCloseTo((Math.PI * EARTH_RADIUS_KM) / 2, 6);
  });

  it("measures antipodes on the equator as half the circumference", () => {
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })).toBeCloseTo(
      Math.PI * EARTH_RADIUS_KM,
      6,
    );
  });

  it("gives about 1 km for 0.009° of latitude, the scale of a delivery", () => {
    expect(
      haversineKm(
        { latitude: -23.55, longitude: -46.63 },
        { latitude: -23.559, longitude: -46.63 },
      ),
    ).toBeCloseTo((0.009 * Math.PI * EARTH_RADIUS_KM) / 180, 6);
  });

  it("matches the published Paris–London distance (~343.5 km)", () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const london = { latitude: 51.5074, longitude: -0.1278 };

    expect(Math.abs(haversineKm(paris, london) - 343.5)).toBeLessThan(1);
  });

  it("is symmetric, never negative and never more than half the circumference", () => {
    fc.assert(
      fc.property(point, point, (a, b) => {
        const distance = haversineKm(a, b);
        expect(distance).toBeCloseTo(haversineKm(b, a), 9);
        expect(distance).toBeGreaterThanOrEqual(0);
        expect(distance).toBeLessThanOrEqual(Math.PI * EARTH_RADIUS_KM + 1e-9);
      }),
    );
  });

  it("respects the triangle inequality", () => {
    fc.assert(
      fc.property(point, point, point, (a, b, c) => {
        expect(haversineKm(a, c)).toBeLessThanOrEqual(haversineKm(a, b) + haversineKm(b, c) + 1e-6);
      }),
    );
  });
});
