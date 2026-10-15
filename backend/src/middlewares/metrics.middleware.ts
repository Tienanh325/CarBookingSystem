import type { RequestHandler } from "express";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";
export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "goride_" });
const requests = new Counter({
  name: "goride_http_requests_total",
  help: "HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [metricsRegistry]
});
const duration = new Histogram({
  name: "goride_http_request_duration_seconds",
  help: "HTTP duration",
  labelNames: ["method", "route", "status"],
  registers: [metricsRegistry]
});
export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const end = duration.startTimer();
  res.on("finish", () => {
    const labels = { method: req.method, route: req.route?.path ?? req.path, status: String(res.statusCode) };
    requests.inc(labels);
    end(labels);
  });
  next();
};
