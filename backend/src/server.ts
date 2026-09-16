import "dotenv/config";
import { app } from "./app";
import { logger } from "./utils/logger";
import { PORT as port } from "./config/app";

const server = app.listen(port, () => {
  logger.info({ port, healthCheck: `http://localhost:${port}/health` }, "Backend listo");
});

server.on("error", (error) => {
  logger.error({ errorName: error.name, errorCode: (error as NodeJS.ErrnoException).code }, "Error del servidor");
});