// API pública da feature. StatusBadge e statusMeta são a exceção controlada da spec (7.1.1):
// dashboard e despacho mostram status de pedido com a mesma cor e rótulo.
export { StatusBadge, statusMeta } from "./components/status-badge";
export { useOrders } from "./hooks/use-orders";
// Página por import dinâmico, como a do dashboard: o formulário e o drawer só baixam ao abrir.
export const loadOrdersPage = () => import("./pages/orders-page");
export { ordersSearchSchema, type OrdersSearch } from "./search-params";
