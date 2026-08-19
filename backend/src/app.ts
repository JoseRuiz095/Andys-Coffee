import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import menuRoutes from "./routes/menu.routes";
import productRoutes from "./routes/product.routes";
// Por ejemplo, para activar las rutas de pedidos:
// import orderRoutes from "./routes/order.routes";
import { logger } from "./utils/logger";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/products", productRoutes);
// Y luego registrarías el enrutador:
// app.use("/api/orders", orderRoutes);

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