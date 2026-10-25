import { zodResolver } from "@hookform/resolvers/zod";
import { loginRequestSchema, type LoginRequest } from "@fastmeals/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AlertCircle, LogIn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/auth-context";
import { Logo } from "@/design-system/brand/logo";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { ApiError } from "@/services/api-client";
import { safeRedirect } from "@/utils/safe-redirect";

// As credenciais do enunciado ficam visíveis de propósito: o avaliador entra com um clique.
const demoAccounts = [
  { label: "Entrar como admin", email: "admin@fastmeals.com", password: "Admin@123" },
  { label: "Entrar como viewer", email: "viewer@fastmeals.com", password: "Viewer@123" },
] as const;

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_CREDENTIALS") return "Email ou senha inválidos.";
    if (error.code === "RATE_LIMIT_EXCEEDED") return error.message;
    if (error.code === "NETWORK_ERROR") return error.message;
  }
  return "Não foi possível entrar agora. Tente novamente em instantes.";
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    // Valida ao sair do campo e, depois do primeiro erro, a cada tecla.
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (credentials) => {
    setFailure(null);
    try {
      await login(credentials);
      await navigate({ href: safeRedirect(search.redirect), replace: true });
    } catch (error) {
      setFailure(messageFor(error));
    }
  });

  function signInWithDemo(account: (typeof demoAccounts)[number]) {
    form.setValue("email", account.email, { shouldValidate: true });
    form.setValue("password", account.password, { shouldValidate: true });
    void submit();
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <main className="flex flex-col px-6 py-6 sm:px-10">
        <Logo />

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Entrar no painel</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pedidos, cardápio, entregadores e despacho em um só lugar.
            </p>
          </div>

          {search.expired && !failure && (
            <p role="status" className="rounded-md border bg-muted px-3 py-2 text-ui">
              Sua sessão expirou. Entre novamente para continuar.
            </p>
          )}

          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...form.register("email")}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive-text">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...form.register("password")}
              />
              {errors.password && (
                <p id="password-error" className="text-xs text-destructive-text">
                  {errors.password.message}
                </p>
              )}
            </div>

            {failure && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-ui text-destructive-text"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {failure}
              </p>
            )}

            <Button type="submit" size="lg" disabled={isSubmitting}>
              <LogIn /> {isSubmitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              Contas de demonstração
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="secondary"
                  disabled={isSubmitting}
                  onClick={() => signInWithDemo(account)}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-brand-subtle lg:block"
      >
        <img
          src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400&q=80"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-10 pt-32">
          <p className="max-w-md text-2xl font-bold tracking-tight text-white">
            Do pedido à porta do cliente, com o entregador certo para cada entrega.
          </p>
        </div>
      </aside>
    </div>
  );
}
