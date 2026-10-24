import { defineConfig } from "drizzle-kit";

// Só para gerar migrations (npm run db:generate); aplicar é com o migrator em src/db/migrate.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/models/index.ts",
  out: "./drizzle",
});
