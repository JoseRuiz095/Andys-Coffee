import "dotenv/config";
import { app } from "./app";
import { logger } from "./utils/logger";

const port = Number(process.env.PORT || 4000);

const server = app.listen(port, () => {
  logger.info({ port, healthCheck: `http://localhost:${port}/health` }, "Backend listo");
});

server.on("error", (error) => {
  logger.error({ errorName: error.name }, "Error del servidor");
});