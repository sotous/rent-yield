import type { FastifyInstance } from "fastify";

import { getExplorerArea } from "../../../application/explorer/getExplorerArea.js";
import { getExplorerBootstrap } from "../../../application/explorer/getExplorerBootstrap.js";
import type { AreaRepository } from "../../../application/ports/areaRepository.js";
import type { PropertyRepository } from "../../../application/ports/propertyRepository.js";
import { mapErrorToResponse } from "../errors.js";
import {
  explorerAreaResponseSchema,
  explorerAreaParamsSchema,
  explorerBootstrapQuerySchema,
  explorerBootstrapResponseSchema,
} from "../schemas/explorerSchemas.js";

export type ExplorerRouteDependencies = {
  areaRepository: AreaRepository;
  propertyRepository: PropertyRepository;
};

export async function registerExplorerRoutes(
  app: FastifyInstance,
  dependencies: ExplorerRouteDependencies,
) {
  app.get("/api/v1/explorer/bootstrap", async (request, reply) => {
    try {
      const query = explorerBootstrapQuerySchema.parse(request.query);
      const response = await getExplorerBootstrap(query, dependencies);
      return explorerBootstrapResponseSchema.parse(response);
    } catch (error) {
      const response = mapErrorToResponse(error);
      return reply.status(response.statusCode).send(response.body);
    }
  });

  app.get("/api/v1/explorer/areas/:area_id", async (request, reply) => {
    try {
      const params = explorerAreaParamsSchema.parse(request.params);
      const response = await getExplorerArea(params.area_id, dependencies);
      return explorerAreaResponseSchema.parse(response);
    } catch (error) {
      const response = mapErrorToResponse(error);
      return reply.status(response.statusCode).send(response.body);
    }
  });
}
