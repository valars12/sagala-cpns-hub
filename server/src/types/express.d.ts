import type { TokenPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & { exp?: number; iat?: number };
    }
  }
}

export {};
