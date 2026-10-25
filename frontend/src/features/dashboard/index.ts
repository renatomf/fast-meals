// A página entra por import dinâmico: o Recharts (o maior pedaço do bundle) só baixa
// quando alguém abre o dashboard, e não atrasa o login.
export const loadDashboardPage = () => import("./pages/dashboard-page");
export { dashboardSearchSchema } from "./search-params";
