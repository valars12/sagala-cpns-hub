import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type TokenPayload = {
  userId: string;
  sessionVersion: number;
};

export const signToken = (payload: TokenPayload, expiresIn?: string) => {
  const options: jwt.SignOptions = {};
  const expiry = expiresIn ?? env.TOKEN_EXPIRES_IN;
  if (expiry) {
    options.expiresIn = expiry as jwt.SignOptions["expiresIn"];
  }

  return jwt.sign({ ...payload }, env.JWT_SECRET as jwt.Secret, options);
};

export const verifyToken = (token: string): TokenPayload & jwt.JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET as jwt.Secret) as TokenPayload &
    jwt.JwtPayload;
};
