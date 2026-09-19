import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type SchemaMap = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

export function validate(schemas: SchemaMap): RequestHandler {
  return (req, _res, next) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) Object.defineProperty(req, "query", { value: schemas.query.parse(req.query), configurable: true });
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    next();
  };
}
