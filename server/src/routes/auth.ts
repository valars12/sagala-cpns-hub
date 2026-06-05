import { Router, type Request } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../prisma";
import type { User } from "@prisma/client";
import { signToken } from "../utils/jwt";
import { requireAuth } from "../middleware/auth";

const router = Router();

const normalizeUsername = (username: string) => username.trim().toLowerCase();
const buildInternalEmail = (username: string) =>
  `${normalizeUsername(username)}@sagalabimbel.local`;

const usernameField = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter")
  .max(30, "Username maksimal 30 karakter")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Username hanya boleh berisi huruf, angka, titik, underscore, atau strip"
  )
  .transform((value) => normalizeUsername(value));

const sanitizeUser = (user: User) => {
  const {
    passwordHash: _passwordHash,
    activeDeviceId: _activeDeviceId,
    activeDeviceLabel: _activeDeviceLabel,
    activeSessionStartedAt: _activeSessionStartedAt,
    ...rest
  } = user;
  return rest;
};

const sanitizeHeaderValue = (value: string | string[] | undefined) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (typeof normalized !== "string") return null;
  const trimmed = normalized.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveDeviceId = (req: Request) => {
  const raw = sanitizeHeaderValue(req.headers["x-device-id"]);
  if (!raw) return null;
  return raw.slice(0, 120);
};

const resolveDeviceLabel = (
  req: Request
) => {
  const explicitLabel = sanitizeHeaderValue(req.headers["x-device-label"]);
  if (explicitLabel) {
    return explicitLabel.slice(0, 180);
  }
  const userAgent = sanitizeHeaderValue(req.headers["user-agent"]);
  if (!userAgent) return null;
  return userAgent.slice(0, 180);
};

const buildDeviceConflictPayload = (user: User) => ({
  code: "DEVICE_CONFLICT",
  message:
    "Akun sedang aktif di perangkat lain. Pilih 'Tetap di sini' untuk melanjutkan di perangkat ini dan otomatis mengeluarkan perangkat sebelumnya.",
  activeSession: {
    deviceLabel: user.activeDeviceLabel ?? "Perangkat lain",
    startedAt: user.activeSessionStartedAt
  }
});

const registerSchema = z.object({
  username: usernameField,
  password: z.string().min(6)
});

router.post("/register", async (req, res) => {
  try {
    const payload = registerSchema.parse(req.body);
    const normalizedUsername = payload.username;

    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: "insensitive"
        }
      }
    });

    if (existing) {
      return res.status(409).json({ message: "Username sudah terdaftar" });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    const user = await prisma.user.create({
      data: {
        name: normalizedUsername,
        username: normalizedUsername,
        email: buildInternalEmail(normalizedUsername),
        passwordHash,
        provider: "STANDARD",
        registrationSource: "SELF_REGISTERED",
        sessionVersion: 1,
        isValidated: false
      }
    });

    return res.status(201).json({
      requiresValidation: true,
      message:
        "Pendaftaran berhasil. Akun sedang menunggu validasi admin sebelum bisa digunakan.",
      user: sanitizeUser(user)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    console.error("Register error:", error);
    return res.status(500).json({ message: "Gagal mendaftar" });
  }
});

const loginSchema = z.object({
  username: usernameField,
  password: z.string().min(6),
  forceLogin: z.boolean().optional().default(false)
});

router.post("/login", async (req, res) => {
  try {
    const payload = loginSchema.parse(req.body);
    const normalizedUsername = payload.username;
    const deviceId = resolveDeviceId(req);
    const deviceLabel = resolveDeviceLabel(req);

    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: "insensitive"
        }
      }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Username atau password salah" });
    }

    const isValid = await bcrypt.compare(payload.password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ message: "Username atau password salah" });
    }

    if (user.role === "student" && !user.isValidated) {
      return res.status(403).json({
        message:
          "Akun belum divalidasi admin. Silakan hubungi admin untuk aktivasi akun."
      });
    }

    if (
      !payload.forceLogin &&
      deviceId &&
      user.activeDeviceId &&
      user.activeDeviceId !== deviceId
    ) {
      return res.status(409).json(buildDeviceConflictPayload(user));
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        sessionVersion: { increment: 1 },
        activeDeviceId: deviceId,
        activeDeviceLabel: deviceLabel,
        activeSessionStartedAt: new Date()
      }
    });

    const token = signToken({
      userId: updated.id,
      sessionVersion: updated.sessionVersion
    });

    return res.json({
      user: sanitizeUser(updated),
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    console.error("Login error:", error);
    return res.status(500).json({ message: "Gagal masuk" });
  }
});

router.get("/profile", requireAuth, (req, res) => {
  const user = res.locals.user;
  return res.json({ user: sanitizeUser(user) });
});

router.post("/logout", requireAuth, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        sessionVersion: { increment: 1 },
        activeDeviceId: null,
        activeDeviceLabel: null,
        activeSessionStartedAt: null
      }
    });
    return res.json({ message: "Logout berhasil" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Gagal logout" });
  }
});

export default router;
