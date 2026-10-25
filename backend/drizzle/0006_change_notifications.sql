-- Cada mudança em pedidos, produtos e entregadores vira um NOTIFY, venha da API, do seed,
-- do simulador ou de um psql manual. A API escuta o canal e repassa por WebSocket.
-- O NOTIFY só é entregue no COMMIT: um rollback não avisa ninguém de algo que não houve.
-- O payload leva só identificadores: quem recebe busca os dados pela API, com as
-- permissões de sempre.
CREATE FUNCTION notify_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  changed record := COALESCE(NEW, OLD);
BEGIN
  PERFORM pg_notify(
    'fastmeals_changes',
    json_build_object(
      'entity', TG_TABLE_NAME,
      'op', lower(TG_OP),
      'id', changed.id,
      'status', CASE WHEN TG_TABLE_NAME = 'orders' THEN to_jsonb(changed) ->> 'status' END
    )::text
  );
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_orders_notify AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_change();
--> statement-breakpoint
CREATE TRIGGER trg_products_notify AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION notify_change();
--> statement-breakpoint
CREATE TRIGGER trg_delivery_persons_notify AFTER INSERT OR UPDATE OR DELETE ON delivery_persons
  FOR EACH ROW EXECUTE FUNCTION notify_change();
