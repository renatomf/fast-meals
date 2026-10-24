import type {
  CreateDeliveryPersonInput,
  DeliveryPerson,
  DeliveryPersonList,
  ListDeliveryPersonsQuery,
  UpdateDeliveryPersonInput,
} from "@fastmeals/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { DeliveryPersonRecord, DeliveryPersonsService } from "./delivery-persons.service.ts";

type ById = { Params: { id: string } };

function toDeliveryPersonResponse(deliveryPerson: DeliveryPersonRecord): DeliveryPerson {
  return {
    ...deliveryPerson,
    createdAt: deliveryPerson.createdAt.toISOString(),
    updatedAt: deliveryPerson.updatedAt.toISOString(),
  };
}

export function createDeliveryPersonsController(deliveryPersonsService: DeliveryPersonsService) {
  return {
    async list(
      request: FastifyRequest<{ Querystring: ListDeliveryPersonsQuery }>,
    ): Promise<DeliveryPersonList> {
      const rows = await deliveryPersonsService.list(request.query);
      return { data: rows.map(toDeliveryPersonResponse) };
    },

    async get(request: FastifyRequest<ById>): Promise<DeliveryPerson> {
      return toDeliveryPersonResponse(await deliveryPersonsService.get(request.params.id));
    },

    async create(
      request: FastifyRequest<{ Body: CreateDeliveryPersonInput }>,
      reply: FastifyReply,
    ): Promise<DeliveryPerson> {
      const deliveryPerson = await deliveryPersonsService.create(request.body);
      reply.status(201);
      return toDeliveryPersonResponse(deliveryPerson);
    },

    async update(
      request: FastifyRequest<ById & { Body: UpdateDeliveryPersonInput }>,
    ): Promise<DeliveryPerson> {
      return toDeliveryPersonResponse(
        await deliveryPersonsService.update(request.params.id, request.body),
      );
    },

    async remove(request: FastifyRequest<ById>, reply: FastifyReply): Promise<void> {
      await deliveryPersonsService.remove(request.params.id);
      await reply.status(204).send();
    },
  };
}
