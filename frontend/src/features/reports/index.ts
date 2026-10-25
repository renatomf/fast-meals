// Página por import dinâmico: os gráficos só baixam quando alguém abre os relatórios.
export const loadReportsPage = () => import("./pages/reports-page");
export { reportsSearchSchema } from "./search-params";
