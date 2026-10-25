import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { ErrorState } from "@/design-system/components/error-state";

// Erro inesperado numa rota vira esta tela, com o resto do app (barra, menu) de pé.
// "Tentar novamente" limpa os erros de consulta e recarrega só a rota.
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const queryReset = useQueryErrorResetBoundary();

  useEffect(() => {
    queryReset.reset();
  }, [queryReset]);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Algo deu errado nesta tela"
      message="O erro foi registrado. Você pode tentar de novo sem perder o resto do painel."
      onRetry={() => void router.invalidate()}
    />
  );
}
