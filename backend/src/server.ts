import "dotenv/config";
import { app } from "./app";
import { logger } from "./utils/logger";

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  logger.info({ port, healthCheck: `http://localhost:${port}/health` }, "Backend listo");
});

app.on("error", (error) => {
  logger.error({ err: error }, "Error del servidor");
});