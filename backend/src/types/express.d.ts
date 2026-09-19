import type { RoleName } from "../utils/roles";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        roles: RoleName[];
      };
    }
  }
}

export {};
