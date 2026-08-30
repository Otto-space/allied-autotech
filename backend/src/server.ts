const express = require("express") as typeof import("express");
type Express = import("express").Express;
type Request = import("express").Request;
type Response<T = unknown> = import("express").Response<T>;
const cors = require("cors");
const helmet = require("helmet");
require("dotenv/config");

interface HealthResponse {
  success: boolean;
  message: string;
}

const app: Express = express();
const PORT: string | number = process.env["PORT"] || 5000;

app.use(helmet());

app.use(
  cors({
    origin: process.env["FRONTEND_URL"],
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (_req: Request, res: Response<HealthResponse>): void => {
  res.json({
    success: true,
    message: "Allied AutoTech API is running",
  });
});

app.listen(PORT, (): void => {
  console.log(`API running on http://localhost:${PORT}`);
});