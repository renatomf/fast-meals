import type { OptimizeAssignmentQuery, OptimizeAssignmentResponse } from "@fastmeals/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { DispatchService } from "./dispatch.service.ts";

export function createDispatchController(dispatchService: DispatchService) {
  return {
    async optimize(
      request: FastifyRequest<{ Querystring: OptimizeAssignmentQuery }>,
      reply: FastifyReply,
    ): Promise<OptimizeAssignmentResponse> {
      const { response, timings } = await dispatchService.optimize({
        includeMatrix: request.query.includeMatrix,
      });
      // Server-Timing aparece na aba Network do navegador, ao lado do tempo da requisição.
      reply.header(
        "server-timing",
        `hungarian;dur=${timings.hungarianMs.toFixed(2)}, greedy;dur=${timings.greedyMs.toFixed(2)}`,
      );
      request.log.info(
        {
          orders: response.assignments.length + response.unassigned.length,
          assigned: response.assignments.length,
          executionTimeMs: response.executionTimeMs,
          totalDistanceKm: response.totalDistanceKm,
          greedyTotalDistanceKm: response.baseline.totalDistanceKm,
        },
        "assignment optimized",
      );
      return response;
    },
  };
}
