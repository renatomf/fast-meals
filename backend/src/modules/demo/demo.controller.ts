import type { FastifyReply, FastifyRequest } from "fastify";
import type { DemoService } from "./demo.service.ts";

export function createDemoController(demoService: DemoService) {
  return {
    async createScenario(request: FastifyRequest, reply: FastifyReply) {
      if (!request.user) throw new Error("demo routes must run after authenticate");
      const created = await demoService.createScenario(request.user.id);
      reply.status(201);
      return created;
    },
  };
}
