import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from "@fastmeals/contracts";
import type { Database } from "../../db/client.ts";
import { AppError } from "../../utils/app-error.ts";
import { centsToDecimal, toCents } from "../../utils/money.ts";
import type { ProductsRepository, ProductValues } from "./products.repository.ts";

type ProductsServiceOptions = {
  db: Database;
  repository: ProductsRepository;
};

const productNotFound = () => new AppError(404, "PRODUCT_NOT_FOUND", "Produto não encontrado");

function toDecimalPrice(price: number): string {
  return centsToDecimal(toCents(price));
}

export function createProductsService({ db, repository }: ProductsServiceOptions) {
  async function get(id: string) {
    const product = await repository.findById(db, id);
    if (!product) throw productNotFound();
    return product;
  }

  async function create(input: CreateProductInput) {
    return repository.insert(db, { ...input, price: toDecimalPrice(input.price) });
  }

  // Atualização parcial: só os campos enviados mudam (premissa 9 do DECISIONS.md).
  async function update(id: string, input: UpdateProductInput) {
    const { price, ...rest } = input;
    const values: ProductValues =
      price === undefined ? rest : { ...rest, price: toDecimalPrice(price) };
    const product = await repository.update(db, id, values);
    if (!product) throw productNotFound();
    return product;
  }

  // Exclusão lógica (premissa 5): marca primeiro, o que trava a linha, e só então confere os
  // pedidos abertos. Se houver algum, o erro desfaz a marcação junto com a transação.
  async function remove(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const deleted = await repository.softDelete(tx, id);
      if (!deleted) throw productNotFound();
      if (await repository.isInOpenOrders(tx, id)) {
        throw new AppError(
          409,
          "PRODUCT_IN_USE",
          "Não é possível deletar este produto pois ele está vinculado a pedidos com status 'pending' ou 'preparing'",
        );
      }
    });
  }

  return {
    list: (query: ListProductsQuery) => repository.list(db, query),
    get,
    create,
    update,
    remove,
  };
}

export type ProductsService = ReturnType<typeof createProductsService>;
export type ProductRecord = Awaited<ReturnType<ProductsService["get"]>>;
