DROP INDEX "idx_orders_created_at";--> statement-breakpoint
DROP INDEX "idx_products_created_at";--> statement-breakpoint
CREATE INDEX "idx_orders_created_at" ON "orders" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_products_created_at" ON "products" USING btree ("created_at","id");