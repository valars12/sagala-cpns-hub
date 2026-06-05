import type { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { verifyToken } from "../utils/jwt";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = header.split(" ")[1];
  const headerDeviceIdRaw = req.headers["x-device-id"];
  const headerDeviceId =
    typeof headerDeviceIdRaw === "string"
      ? headerDeviceIdRaw.trim().slice(0, 120)
      : Array.isArray(headerDeviceIdRaw)
        ? (headerDeviceIdRaw[0]?.trim().slice(0, 120) ?? "")
        : "";

  try {
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (
      typeof decoded.sessionVersion !== "number" ||
      decoded.sessionVersion !== user.sessionVersion
    ) {
      return res.status(401).json({
        message:
          "Sesi kamu sudah digantikan dari perangkat lain. Silakan login ulang."
      });
    }

    if (user.role === "student" && !user.isValidated) {
      return res.status(401).json({
        message:
          "Akun belum divalidasi admin. Silakan login kembali setelah akun diaktifkan."
      });
    }

    if (
      user.activeDeviceId &&
      headerDeviceId &&
      user.activeDeviceId !== headerDeviceId
    ) {
      return res.status(401).json({
        message:
          "Sesi kamu sudah dipindahkan ke perangkat lain. Silakan login ulang."
      });
    }

    req.user = { userId: user.id, sessionVersion: user.sessionVersion };
    res.locals.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireAdmin = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = res.locals.user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Akses admin diperlukan" });
  }
  return next();
};

export const requireStaff = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = res.locals.user;
  if (!user || (user.role !== "admin" && user.role !== "teacher")) {
    return res.status(403).json({ message: "Akses staff diperlukan" });
  }
  return next();
};
