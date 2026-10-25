import "leaflet/dist/leaflet.css";
import "./dispatch-map.css";
import { latLngBounds, type LatLngTuple } from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

export type MapPoint = { id: string; position: LatLngTuple; label: string };
export type MapRoute = { orderId: string; from: LatLngTuple; to: LatLngTuple; label: string };

type DispatchMapProps = {
  orders: MapPoint[];
  couriers: MapPoint[];
  routes: MapRoute[];
  activeOrderId?: string;
  onActivateOrder?: (orderId: string | undefined) => void;
};

// Centro de São Paulo, de onde vêm os dados do seed, até os pontos chegarem.
const SAO_PAULO: LatLngTuple = [-23.5505, -46.6333];

// Enquadra todos os pontos quando o conjunto muda (não a cada render, para não brigar com
// o zoom que o operador escolheu).
function FitToPoints({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  const key = points.map((point) => point.join(",")).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave resume os pontos
  }, [map, key]);

  return null;
}

// O mapa complementa as listas: tudo o que ele mostra também está em texto ao lado.
export function DispatchMap({
  orders,
  couriers,
  routes,
  activeOrderId,
  onActivateOrder,
}: DispatchMapProps) {
  const points = [...orders, ...couriers].map((point) => point.position);
  const active = routes.find((route) => route.orderId === activeOrderId);

  return (
    <MapContainer
      center={SAO_PAULO}
      zoom={12}
      className="dispatch-map size-full rounded-lg border"
      attributionControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitToPoints points={points} />

      {routes.map((route) => (
        <Polyline
          key={route.orderId}
          positions={[route.from, route.to]}
          className="dispatch-route"
          eventHandlers={{
            mouseover: () => onActivateOrder?.(route.orderId),
            mouseout: () => onActivateOrder?.(undefined),
          }}
        >
          <Tooltip sticky>{route.label}</Tooltip>
        </Polyline>
      ))}
      {/* O Leaflet não troca a classe de um traço existente: o destaque é uma linha à parte. */}
      {active && (
        <Polyline
          key={`active-${active.orderId}`}
          positions={[active.from, active.to]}
          className="dispatch-route-active"
          interactive={false}
        />
      )}

      {couriers.map((courier) => (
        <CircleMarker
          key={courier.id}
          center={courier.position}
          radius={7}
          className="dispatch-courier"
        >
          <Tooltip>{courier.label}</Tooltip>
        </CircleMarker>
      ))}
      {orders.map((order) => (
        <CircleMarker
          key={order.id}
          center={order.position}
          radius={order.id === activeOrderId ? 10 : 7}
          className="dispatch-order"
          eventHandlers={{
            mouseover: () => onActivateOrder?.(order.id),
            mouseout: () => onActivateOrder?.(undefined),
          }}
        >
          <Tooltip>{order.label}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
