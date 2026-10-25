import type { VehicleType } from "@fastmeals/contracts";

// Rótulos de domínio usados em mais de uma tela.
export const vehicleLabels = {
  bicycle: "Bicicleta",
  motorcycle: "Moto",
  car: "Carro",
} satisfies Record<VehicleType, string>;
