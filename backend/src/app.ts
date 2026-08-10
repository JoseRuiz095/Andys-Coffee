import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import { logger } from "./utils/logger";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth", authRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    logger.warn({ err }, "Solicitud inválida");
    return res.status(400).json({ message: "Solicitud inválida." });
  }

  logger.error({ err }, "Error interno del servidor");
  return res.status(500).json({ message: "Error interno del servidor." });
});

export { app };