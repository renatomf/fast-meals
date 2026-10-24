import type {
  CreateDeliveryPersonInput,
  ListDeliveryPersonsQuery,
  UpdateDeliveryPersonInput,
} from "@fastmeals/contracts";
import type { Database } from "../../db/client.ts";
import { AppError } from "../../utils/app-error.ts";
import type { DeliveryPersonsRepository } from "./delivery-persons.repository.ts";

type DeliveryPersonsServiceOptions = {
  db: Database;
  repository: DeliveryPersonsRepository;
};

const deliveryPersonNotFound = () =>
  new AppError(404, "DELIVERY_PERSON_NOT_FOUND", "Entregador não encontrado");

export function createDeliveryPersonsService({ db, repository }: DeliveryPersonsServiceOptions) {
  async function get(id: string) {
    const deliveryPerson = await repository.findById(db, id);
    if (!deliveryPerson) throw deliveryPersonNotFound();
    return deliveryPerson;
  }

  async function create(input: CreateDeliveryPersonInput) {
    return get(await repository.insert(db, input));
  }

  async function update(id: string, input: UpdateDeliveryPersonInput) {
    const updatedId = await repository.update(db, id, input);
    if (!updatedId) throw deliveryPersonNotFound();
    return get(updatedId);
  }

  // Ocupado = pedido ready ou delivering (premissas 6 e 10 do DECISIONS.md).
  async function remove(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const deletedId = await repository.softDelete(tx, id);
      if (!deletedId) throw deliveryPersonNotFound();
      if (await repository.hasActiveOrder(tx, id)) {
        throw new AppError(
          409,
          "DELIVERY_PERSON_IN_USE",
          "Não é possível remover este entregador: ele está atribuído a um pedido em andamento",
        );
      }
    });
  }

  return {
    list: (query: ListDeliveryPersonsQuery) => repository.list(db, query),
    get,
    create,
    update,
    remove,
  };
}

export type DeliveryPersonsService = ReturnType<typeof createDeliveryPersonsService>;
export type DeliveryPersonRecord = Awaited<ReturnType<DeliveryPersonsService["get"]>>;
