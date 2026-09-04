import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import cors, { type CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import csrf from "tiny-csrf";
import authRoutes from "./routes/auth.routes";
import menuRoutes from "./routes/menu.routes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import notificationRoutes from "./routes/notification.routes";
import { logger } from "./utils/logger";
import { CSRF_SECRET } from "./config/csrf";

// Monkey-patch BigInt to allow JSON serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// --- Security Configuration ---

// 1. CORS Whitelist
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && !process.env.CORS_ORIGINS) {
  throw new Error("CORS_ORIGINS must be configured in production.");
}

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

// 2. Standard Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(CSRF_SECRET));

// 3. CSRF Protection
// tiny-csrf validates req.body._csrf and stores the encrypted token in a signed cookie.
app.use((_req, res, next) => {
  const setCookie = res.cookie.bind(res);
  res.cookie = ((name: string, value: any, options: any) => {
    if (name === "csrfToken") {
      options = {
        ...options,
        secure: isProduction,
        httpOnly: true,
        sameSite: "strict",
      };
    }
    return setCookie(name, value, options);
  }) as typeof res.cookie;
  next();
});
app.use((req, _res, next) => {
  const csrfHeader = req.get("X-CSRF-TOKEN");
  if (csrfHeader && req.body && typeof req.body === "object") {
    req.body._csrf = csrfHeader;
  }
  next();
});
app.use(csrf(CSRF_SECRET, ["POST", "PUT", "PATCH", "DELETE"]));


// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- Error Handling ---
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Handle CSRF errors
  if (
    err.code === "EBADCSRFTOKEN" ||
    (typeof err.message === "string" &&
      err.message.startsWith("Did not get a valid CSRF token"))
  ) {
    logger.warn({ err }, "CSRF token validation failed");
    return res.status(403).json({ message: 'CSRF token is invalid.' });
  }

  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    logger.warn({ err }, "CORS origin blocked");
    return res.status(403).json({ message: 'This origin is not allowed.' });
  }

  if (err.name === 'AuthorizationError') {
    return res.status(403).json({ message: err.message });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({ message: err.message });
  }

  if (err.name === 'StateTransitionError') {
    return res.status(409).json({ message: err.message });
  }

  if (err.name === 'BusinessRuleError') {
    return res.status(409).json({ message: err.message });
  }

  if (err instanceof SyntaxError && "body" in err) {
    logger.warn({ err }, "Invalid JSON in request body");
    return res.status(400).json({ message: "Invalid JSON format in request body." });
  }

  logger.error({ err }, "An unexpected internal server error occurred");
  return res.status(500).json({ message: "Internal Server Error." });
});

export { app };