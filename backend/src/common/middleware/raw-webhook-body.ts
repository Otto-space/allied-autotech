import express, { type RequestHandler } from "express";

export const rawWebhookBody: RequestHandler = express.raw({
  type: "application/json",
  limit: "256kb",
});
