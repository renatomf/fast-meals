-- updated_at reflete qualquer UPDATE, venha da API, do seed ou de um psql manual.
-- O WHEN evita mexer no timestamp quando o UPDATE não muda nada.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_delivery_persons_updated_at BEFORE UPDATE ON delivery_persons
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION set_updated_at();
