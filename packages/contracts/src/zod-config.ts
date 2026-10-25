import { z } from "zod";

// Mensagens padrão do Zod em português, para os campos sem mensagem própria nos schemas.
// Campo ausente ganha uma frase que faz sentido para quem lê a resposta da API; o resto
// segue o locale. Vale para front e back, que importam os contratos.
z.config(z.locales.pt());
z.config({
  customError: (issue) =>
    issue.code === "invalid_type" && issue.input === undefined ? "Campo obrigatório" : undefined,
});
