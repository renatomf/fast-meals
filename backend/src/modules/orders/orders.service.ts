import type { CreateOrderInput, ListOrdersQuery, OrderStatus } from "@fastmeals/contracts";
import type { Database, Executor } from "../../db/client.ts";
import { isUniqueViolation } from "../../db/errors.ts";
import { AppError } from "../../utils/app-error.ts";
import { centsToDecimal, toCents } from "../../utils/money.ts";
import { checkTransition } from "./domain/order-state-machine.ts";
import type { OrdersRepository } from "./orders.repository.ts";

type OrdersServiceOptions = {
  db: Database;
  repository: OrdersRepository;
};

type OrderRow = NonNullable<Awaited<ReturnType<OrdersRepository["findById"]>>>;
type ItemRow = Awaited<ReturnType<OrdersRepository["itemsOf"]>>[number];
export type OrderRecord = OrderRow & { items: ItemRow[] };

const orderNotFound = () => new AppError(404, "ORDER_NOT_FOUND", "Pedido não encontrado");
const orderChangedMeanwhile = () =>
  new AppError(
    409,
    "ORDER_CONFLICT",
    "O pedido foi alterado por outra operação. Recarregue e tente de novo.",
  );

export function createOrdersService({ db, repository }: OrdersServiceOptions) {
  async function withItems(executor: Executor, rows: OrderRow[]): Promise<OrderRecord[]> {
    const items = await repository.itemsOf(
      executor,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({ ...row, items: items.filter((item) => item.orderId === row.id) }));
  }

  async function list(query: ListOrdersQuery) {
    const { rows, total } = await repository.list(db, query);
    return { orders: await withItems(db, rows), total };
  }

  async function get(id: string): Promise<OrderRecord> {
    const row = await repository.findById(db, id);
    if (!row) throw orderNotFound();
    return { ...row, items: await repository.itemsOf(db, [row.id]) };
  }

  async function history(id: string) {
    if (!(await repository.findState(db, id))) throw orderNotFound();
    return repository.historyOf(db, id);
  }

  async function create(input: CreateOrderInput, userId: string): Promise<OrderRecord> {
    const orderId = await db.transaction(async (tx) => {
      const productIds = input.items.map((item) => item.productId);
      const found = new Map(
        (await repository.lockProductsForOrder(tx, productIds)).map((product) => [
          product.id,
          product,
        ]),
      );

      const problems: { productId: string; productName: string | null; reason: string }[] = [];
      const lines: { productId: string; quantity: number; unitPrice: string }[] = [];
      for (const { productId, quantity } of input.items) {
        const product = found.get(productId);
        if (!product) {
          problems.push({ productId, productName: null, reason: "Produto não encontrado" });
        } else if (!product.isAvailable) {
          problems.push({ productId, productName: product.name, reason: "Produto indisponível" });
        } else {
          // Preço de agora, gravado no item: mudar o produto depois não altera este pedido.
          lines.push({ productId, quantity, unitPrice: product.price });
        }
      }
      if (problems.length > 0) {
        throw new AppError(
          422,
          "UNAVAILABLE_PRODUCT",
          "Um ou mais produtos não estão disponíveis",
          problems,
        );
      }

      const totalCents = lines.reduce(
        (sum, line) => sum + toCents(line.unitPrice) * line.quantity,
        0,
      );
      const id = await repository.insertOrder(tx, {
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryAddress: input.deliveryAddress,
        latitude: input.latitude,
        longitude: input.longitude,
        status: "pending",
        totalAmount: centsToDecimal(totalCents),
      });
      await repository.insertItems(
        tx,
        lines.map((line) => ({ orderId: id, ...line })),
      );
      await repository.recordTransition(tx, {
        orderId: id,
        fromStatus: null,
        toStatus: "pending",
        changedBy: userId,
      });
      return id;
    });
    return get(orderId);
  }

  async function changeStatus(id: string, to: OrderStatus, userId: string): Promise<OrderRecord> {
    await db.transaction(async (tx) => {
      const order = await repository.findState(tx, id);
      if (!order) throw orderNotFound();

      const check = checkTransition(order, to);
      if (!check.ok) {
        throw new AppError(
          422,
          "INVALID_STATUS_TRANSITION",
          check.reason === "missing-delivery-person"
            ? "Não é possível alterar o status de 'ready' para 'delivering' sem um entregador atribuído"
            : `Não é possível alterar o status de '${order.status}' para '${to}'`,
        );
      }

      if (!(await repository.updateStatus(tx, id, order.status, to))) {
        throw orderChangedMeanwhile();
      }
      // Na mesma transação: não existe mudança de status sem registro no histórico.
      await repository.recordTransition(tx, {
        orderId: id,
        fromStatus: order.status,
        toStatus: to,
        changedBy: userId,
      });
    });
    return get(id);
  }

  async function assign(id: string, deliveryPersonId: string): Promise<OrderRecord> {
    await db.transaction(async (tx) => {
      const order = await repository.findState(tx, id);
      if (!order) throw orderNotFound();
      // Só pedidos prontos: num pedido preparing o índice único parcial não vale, e o
      // entregador poderia acumular pedidos (premissa 13 do DECISIONS.md).
      if (order.status !== "ready") {
        throw new AppError(
          422,
          "ORDER_NOT_ASSIGNABLE",
          `Só pedidos com status 'ready' podem receber entregador; este está '${order.status}'`,
        );
      }

      const deliveryPerson = await repository.lockDeliveryPerson(tx, deliveryPersonId);
      if (!deliveryPerson) {
        throw new AppError(404, "DELIVERY_PERSON_NOT_FOUND", "Entregador não encontrado");
      }
      if (!deliveryPerson.isActive) {
        throw new AppError(422, "DELIVERY_PERSON_UNAVAILABLE", "Este entregador está inativo");
      }

      let assigned: boolean;
      try {
        assigned = await repository.assignDeliveryPerson(tx, id, deliveryPersonId);
      } catch (error) {
        // Quem garante "um pedido ativo por entregador" é o índice único parcial, não uma
        // consulta prévia: duas atribuições simultâneas passariam juntas por uma consulta.
        if (isUniqueViolation(error, "uq_orders_active_delivery_person")) {
          throw new AppError(
            422,
            "DELIVERY_PERSON_UNAVAILABLE",
            "Este entregador já está atribuído a outro pedido em andamento",
          );
        }
        throw error;
      }
      if (!assigned) throw orderChangedMeanwhile();
    });
    return get(id);
  }

  return { list, get, history, create, changeStatus, assign };
}

export type OrdersService = ReturnType<typeof createOrdersService>;
