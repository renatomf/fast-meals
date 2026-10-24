import type {
  CreateProductInput,
  ListProductsQuery,
  Product,
  ProductList,
  UpdateProductInput,
} from "@fastmeals/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { paginationMeta } from "../../utils/pagination.ts";
import type { ProductRecord, ProductsService } from "./products.service.ts";

type ById = { Params: { id: string } };

export function toProductResponse(product: ProductRecord): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    category: product.category,
    imageUrl: product.imageUrl,
    isAvailable: product.isAvailable,
    preparationTime: product.preparationTime,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function createProductsController(productsService: ProductsService) {
  return {
    async list(request: FastifyRequest<{ Querystring: ListProductsQuery }>): Promise<ProductList> {
      const { rows, total } = await productsService.list(request.query);
      return {
        data: rows.map(toProductResponse),
        pagination: paginationMeta(request.query, total),
      };
    },

    async get(request: FastifyRequest<ById>): Promise<Product> {
      return toProductResponse(await productsService.get(request.params.id));
    },

    async create(
      request: FastifyRequest<{ Body: CreateProductInput }>,
      reply: FastifyReply,
    ): Promise<Product> {
      const product = await productsService.create(request.body);
      reply.status(201);
      return toProductResponse(product);
    },

    async update(request: FastifyRequest<ById & { Body: UpdateProductInput }>): Promise<Product> {
      return toProductResponse(await productsService.update(request.params.id, request.body));
    },

    async remove(request: FastifyRequest<ById>, reply: FastifyReply): Promise<void> {
      await productsService.remove(request.params.id);
      await reply.status(204).send();
    },
  };
}
