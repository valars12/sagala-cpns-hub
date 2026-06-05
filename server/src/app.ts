import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import authRoutes from "./routes/auth";
import packagesRoutes from "./routes/packages";
import ordersRoutes from "./routes/orders";
import userRoutes from "./routes/user";
import practiceRoutes from "./routes/practice";
import adminRoutes from "./routes/admin";

const app = express();

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, "");
const allowedOrigins = new Set(
  [env.CORS_ORIGIN, env.FRONTEND_URL]
    .flatMap((value) => value.split(","))
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true
  })
);

app.use(express.json({ limit: "200mb" }));
app.use(helmet());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/packages", packagesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/user", userRoutes);
app.use("/api/practice", practiceRoutes);
app.use("/api/admin", adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan" });
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server" });
  }
);

export default app;
