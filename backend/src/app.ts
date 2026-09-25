import "./config/env";
import express, { type CookieOptions } from "express";
import cors, { type CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import csrf from "tiny-csrf";
import authRoutes from "./routes/auth.routes";
import menuRoutes from "./routes/menu.routes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import notificationRoutes from "./routes/notification.routes";
import cashRoutes from "./routes/cash.routes";
import inventoryRoutes from "./routes/inventory.routes";
import purchaseRoutes from "./routes/purchase.routes";
import inventoryCountRoutes from "./routes/inventory-count.routes";
import supplierRoutes from "./routes/supplier.routes";
import userRoutes from "./routes/user.routes";
import roleRoutes from "./routes/role.routes";
import permissionRoutes from "./routes/permission.routes";
import preferenceRoutes from "./routes/preference.routes";
import expenseRoutes from "./routes/expense.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import incomeStatementRoutes from "./routes/income-statement.routes";
import categoryRoutes from "./routes/category.routes";
import { CSRF_SECRET } from "./config/csrf";
import { CORS_ORIGINS, isProduction, TRUST_PROXY } from "./config/app";
import { errorHandler } from "./middleware/errorHandler";
import { randomUUID } from "node:crypto";

// BigInt values (e.g. orderNumber) are serialized as strings in JSON responses.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
BigInt.prototype.toJSON = function (this: bigint) {
  return this.toString();
};

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", TRUST_PROXY);
// JSON-only API: the default helmet headers (CSP, nosniff, frame-ancestors, HSTS, ...) are safe here.
app.use(helmet());

app.use((req, res, next) => {
  const suppliedRequestId = req.get("X-Request-ID");
  req.id = suppliedRequestId && /^[0-9a-f-]{36}$/i.test(suppliedRequestId)
    ? suppliedRequestId
    : randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
});

// --- Security Configuration ---

// 1. CORS Whitelist
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || CORS_ORIGINS.includes(origin)) {
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
  res.cookie = ((name: string, value: unknown, options: CookieOptions = {}) => {
    if (name === "csrfToken") {
      options = {
        ...options,
        path: "/",
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
  if (csrfHeader) {
    req.body = {
      ...(req.body && typeof req.body === "object" ? req.body : {}),
      _csrf: csrfHeader,
    };
  }
  next();
});
app.use(csrf(CSRF_SECRET, ["POST", "PUT", "PATCH", "DELETE"]));

// CSRF ya validó este campo; no debe contaminar los DTO estrictos de las rutas.
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    delete req.body._csrf;
  }
  next();
});


// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/cash-register", cashRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/inventory-counts", inventoryCountRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/preferences", preferenceRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/income-statement", incomeStatementRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

export { app };