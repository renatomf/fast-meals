import {
  createProductSchema,
  errorResponseSchema,
  idParamsSchema,
  listProductsQuerySchema,
  productListSchema,
  productSchema,
  updateProductSchema,
} from "@fastmeals/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authorize } from "../../middlewares/auth.ts";
import {
  bearerSecurity as security,
  readErrorResponses as readErrors,
  writeErrorResponses as writeErrors,
} from "../../utils/openapi.ts";
import { createProductsController } from "./products.controller.ts";
import type { ProductsService } from "./products.service.ts";

type ProductsRoutesOptions = { productsService: ProductsService };

export const productsRoutes: FastifyPluginAsyncZod<ProductsRoutesOptions> = async (
  app,
  { productsService },
) => {
  const controller = createProductsController(productsService);
  const adminOnly = authorize("admin");

  app.get(
    "/products",
    {
      schema: {
        tags: ["products"],
        summary: "Lista produtos com paginação, busca por nome e filtros",
        description: "Produtos excluídos não aparecem. Indisponíveis aparecem para o painel.",
        security,
        querystring: listProductsQuerySchema,
        response: { 200: productListSchema, ...readErrors },
      },
    },
    (request) => controller.list(request),
  );

  app.get(
    "/products/:id",
    {
      schema: {
        tags: ["products"],
        summary: "Detalhe de um produto",
        security,
        params: idParamsSchema,
        response: { 200: productSchema, 404: errorResponseSchema, ...readErrors },
      },
    },
    (request) => controller.get(request),
  );

  app.post(
    "/products",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["products"],
        summary: "Cria um produto (admin)",
        security,
        body: createProductSchema,
        response: { 201: productSchema, ...writeErrors },
      },
    },
    (request, reply) => controller.create(request, reply),
  );

  app.put(
    "/products/:id",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["products"],
        summary: "Atualiza um produto (admin); só os campos enviados mudam",
        security,
        params: idParamsSchema,
        body: updateProductSchema,
        response: { 200: productSchema, 404: errorResponseSchema, ...writeErrors },
      },
    },
    (request) => controller.update(request),
  );

  app.delete(
    "/products/:id",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["products"],
        summary: "Exclui um produto (admin)",
        description:
          "Recusado com 409 PRODUCT_IN_USE se o produto estiver em pedido pending ou preparing. " +
          "A exclusão é lógica: pedidos antigos continuam mostrando o produto.",
        security,
        params: idParamsSchema,
        response: { 404: errorResponseSchema, 409: errorResponseSchema, ...writeErrors },
      },
    },
    (request, reply) => controller.remove(request, reply),
  );
};
