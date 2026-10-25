import { z } from "zod";

export const dashboardPeriods = ["7d", "30d", "90d"] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

export const periodDays = { "7d": 7, "30d": 30, "90d": 90 } satisfies Record<
  DashboardPeriod,
  number
>;

// O período escolhido fica na URL: recarregar ou compartilhar o link mantém a visão.
export const dashboardSearchSchema = z.object({
  period: z.enum(dashboardPeriods).optional().catch(undefined),
});
