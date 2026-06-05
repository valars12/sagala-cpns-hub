import { Router } from "express";
import prisma from "../prisma";
import type { Package } from "@prisma/client";
import {
  parsePackageSourceIds,
  parseSessionSourceKeys
} from "../utils/package-session";

const router = Router();

const parseJsonArray = (value?: string | null) => {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse JSON field", value, error);
    return [];
  }
};

const serializePackage = (pkg: Package) => ({
  id: pkg.id,
  slug: pkg.slug,
  title: pkg.title,
  subtitle: pkg.subtitle,
  description: pkg.description,
  category: pkg.category,
  level: pkg.level,
  imageUrl: pkg.imageUrl,
  price: pkg.price,
  discountPercent: pkg.discountPercent,
  durationDays: pkg.durationDays,
  tryoutDurationMinutes: pkg.tryoutDurationMinutes,
  latihanDurationMinutes: pkg.latihanDurationMinutes,
  tryoutAccessStart: pkg.tryoutAccessStart,
  tryoutAccessEnd: pkg.tryoutAccessEnd,
  latihanAccessStart: pkg.latihanAccessStart,
  latihanAccessEnd: pkg.latihanAccessEnd,
  sessionSourcePackageIds: parsePackageSourceIds(pkg.sessionSourcePackageIds),
  sessionSourceSessionKeys: parseSessionSourceKeys(pkg.sessionSourcePackageIds),
  badge: pkg.badge,
  features: parseJsonArray(pkg.features),
  whatsIncluded: parseJsonArray(pkg.whatsIncluded),
  highlights: parseJsonArray(pkg.highlights),
  createdAt: pkg.createdAt,
  updatedAt: pkg.updatedAt
});

router.get("/", async (_req, res) => {
  const packages = await prisma.package.findMany({
    orderBy: { price: "asc" }
  });

  return res.json({
    data: packages.map(serializePackage)
  });
});

router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  const pkg = await prisma.package.findUnique({
    where: { slug }
  });

  if (!pkg) {
    return res.status(404).json({ message: "Paket tidak ditemukan" });
  }

  return res.json({ data: serializePackage(pkg) });
});

export default router;
