import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

export type OpenApiDocument = {
  openapi: string;
  paths: Record<string, Record<string, any>>;
  components: {
    schemas: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any;
};

export function loadOpenApiDocument(cwd = process.cwd()): OpenApiDocument {
  const candidates = [
    resolve(cwd, "openapi.yaml"),
    resolve(cwd, "backend", "openapi.yaml"),
    resolve(__dirname, "..", "openapi.yaml")
  ];
  const filename = candidates.find(existsSync);

  if (!filename) {
    throw new Error(`OpenAPI document not found. Checked: ${candidates.join(", ")}`);
  }

  return YAML.parse(readFileSync(filename, "utf8")) as OpenApiDocument;
}

export const openApiDocument = loadOpenApiDocument();
