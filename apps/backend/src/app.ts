import Fastify from "fastify";

import { createPrototypeAreaRepository } from "./adapters/persistence/memory/prototypeAreaRepository.js";
import { createPrototypePropertyRepository } from "./adapters/persistence/memory/prototypePropertyRepository.js";
import { registerExplorerRoutes } from "./adapters/http/routes/explorerRoutes.js";
import type { AreaRepository } from "./application/ports/areaRepository.js";
import type { PropertyRepository } from "./application/ports/propertyRepository.js";

export type CreateAppOptions = {
  areaRepository?: AreaRepository;
  propertyRepository?: PropertyRepository;
};

export async function createApp(options: CreateAppOptions = {}) {
  const app = Fastify({
    logger: false,
  });
  const areaRepository =
    options.areaRepository ?? createPrototypeAreaRepository();
  const propertyRepository =
    options.propertyRepository ?? createPrototypePropertyRepository();

  await registerExplorerRoutes(app, {
    areaRepository,
    propertyRepository,
  });

  return app;
}
