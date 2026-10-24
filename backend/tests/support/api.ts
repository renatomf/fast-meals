import type { UserRole } from "@fastmeals/contracts";
import { eq } from "drizzle-orm";
import { createSigner } from "fast-jwt";
import type { App } from "../../src/app.ts";
import type { Database } from "../../src/db/client.ts";
import { users } from "../../src/models/index.ts";
import { testEnv } from "./app.ts";

const sign = createSigner({ key: testEnv.JWT_SECRET, expiresIn: 15 * 60_000 });

// Token assinado direto com o segredo de teste: o login real (com bcrypt) já é coberto em
// auth.test.ts, e repeti-lo em cada teste só deixaria a suíte lenta.
export async function tokenFor(db: Database, role: UserRole): Promise<string> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.role, role));
  if (!user) throw new Error(`No ${role} user; seed the database first`);
  return sign({ sub: user.id, role });
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function apiClient(app: App, token?: string) {
  const call = (method: Method, url: string, payload?: object) =>
    app.inject({
      method,
      url: `/api${url}`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload && { payload }),
    });
  return {
    get: (url: string) => call("GET", url),
    post: (url: string, payload: object) => call("POST", url, payload),
    put: (url: string, payload: object) => call("PUT", url, payload),
    patch: (url: string, payload: object) => call("PATCH", url, payload),
    delete: (url: string) => call("DELETE", url),
  };
}

export type ApiClient = ReturnType<typeof apiClient>;
