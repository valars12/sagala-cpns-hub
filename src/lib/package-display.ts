import cpnsBasic from "@/assets/cpns-basic.jpeg";
import cpnsReguler from "@/assets/cpns-reguler.jpeg";
import cpnsExclusive from "@/assets/cpns-exclusive.jpeg";
import cpnsUltimate from "@/assets/cpns-ultimate.jpeg";
import kedinasanBasic from "@/assets/kedinasan-basic.jpeg";
import kedinasanReguler from "@/assets/kedinasan-reguler.jpeg";
import kedinasanExclusive from "@/assets/kedinasan-exclusive.jpeg";
import kedinasanUltimate from "@/assets/kedinasan-ultimate.jpeg";
import paket1 from "@/assets/paket-1.png";
import paket2 from "@/assets/paket-2.png";
import paket3 from "@/assets/paket-3.png";
import paket4 from "@/assets/paket-4.png";
import paket5 from "@/assets/paket-5.png";
import paket6 from "@/assets/paket-6.png";
import paket7 from "@/assets/paket-7.png";
import paket8 from "@/assets/paket-8.png";
import paket9 from "@/assets/paket-9.png";
import paket10 from "@/assets/paket-10.png";
import paket11 from "@/assets/paket-11.png";
import paket12 from "@/assets/paket-12.png";
import paket13 from "@/assets/paket-13.png";
import paket14 from "@/assets/paket-14.png";
import paket15 from "@/assets/paket-15.png";
import paket16 from "@/assets/paket-16.png";
import paket17 from "@/assets/paket-17.png";
import paket18 from "@/assets/paket-18.png";
import paket19 from "@/assets/paket-19.png";
import paket20 from "@/assets/paket-20.png";
import paket21 from "@/assets/paket-21.png";
import type { SagalaPackage } from "@/types";

const fallbackImages = [
  paket1,
  paket2,
  paket3,
  paket4,
  paket5,
  paket6,
  paket7,
  paket8,
  paket9,
  paket10,
  paket11,
  paket12,
  paket13,
  paket14,
  paket15,
  paket16,
  paket17,
  paket18,
  paket19,
  paket20,
  paket21,
];

const directImageBySlug: Record<string, string> = {
  "cpns-basic": cpnsBasic,
  "cpns-reguler": cpnsReguler,
  "cpns-regular": cpnsReguler,
  "cpns-exclusive": cpnsExclusive,
  "cpns-ultimate": cpnsUltimate,
  "sekolah-kedinasan-basic": kedinasanBasic,
  "sekolah-kedinasan-reguler": kedinasanReguler,
  "sekolah-kedinasan-regular": kedinasanReguler,
  "sekolah-kedinasan-exclusive": kedinasanExclusive,
  "sekolah-kedinasan-ultimate": kedinasanUltimate,
};

const normalizedTier = (text: string) => {
  if (text.includes("ultimate")) return "ultimate";
  if (text.includes("exclusive")) return "exclusive";
  if (text.includes("reguler") || text.includes("regular")) return "regular";
  if (text.includes("basic")) return "basic";
  if (text.includes("pre-exclusive")) return "pre-exclusive";
  if (text.includes("platinum")) return "platinum";
  if (text.includes("hemat")) return "hemat";
  return "basic";
};

const getImageByCategoryAndTier = (category: string, tier: string) => {
  const isKedinasan = category.includes("kedinasan");
  if (isKedinasan) {
    if (tier === "ultimate") return kedinasanUltimate;
    if (tier === "exclusive") return kedinasanExclusive;
    if (tier === "regular") return kedinasanReguler;
    return kedinasanBasic;
  }

  if (tier === "ultimate") return cpnsUltimate;
  if (tier === "exclusive") return cpnsExclusive;
  if (tier === "regular") return cpnsReguler;
  return cpnsBasic;
};

const hashText = (value: string) =>
  value
    .split("")
    .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);

const getSuggestedDiscountFromText = (value: string): number | null => {
  const text = value.toLowerCase();
  if (
    text.includes("ultimate") ||
    text.includes("exclusive")
  ) {
    return 50;
  }
  if (text.includes("reguler") || text.includes("regular")) {
    return 40;
  }
  if (text.includes("basic")) {
    return 35;
  }
  return null;
};

export const getRecommendedDiscountPercent = (
  pkg: Pick<SagalaPackage, "slug" | "title" | "badge" | "level">
) => {
  return (
    getSuggestedDiscountFromText(pkg.badge ?? "") ??
    getSuggestedDiscountFromText(pkg.level ?? "") ??
    getSuggestedDiscountFromText(pkg.title) ??
    getSuggestedDiscountFromText(pkg.slug) ??
    50
  );
};

export const normalizeDiscountPercent = (
  value?: number | null,
  fallback = 50
) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return Math.min(100, Math.max(0, Math.round(fallback)));
  }
  return Math.min(100, Math.max(0, Math.round(value)));
};

export const getOriginalPriceFromDiscount = (
  currentPrice: number,
  discountPercent?: number | null
) => {
  const safeDiscount = normalizeDiscountPercent(discountPercent);
  if (safeDiscount <= 0 || safeDiscount >= 100) {
    return currentPrice;
  }
  return Math.round(currentPrice / (1 - safeDiscount / 100));
};

export const getPackageDisplayImage = (
  pkg: Pick<SagalaPackage, "slug" | "title" | "category" | "badge" | "level" | "imageUrl">
) => {
  if (pkg.imageUrl?.trim()) return pkg.imageUrl;

  const slug = pkg.slug.toLowerCase();
  if (directImageBySlug[slug]) return directImageBySlug[slug];

  const category = pkg.category.toLowerCase();
  const tier = normalizedTier(
    `${slug} ${pkg.badge ?? ""} ${pkg.level ?? ""} ${pkg.title}`.toLowerCase()
  );
  const byTier = getImageByCategoryAndTier(category, tier);
  if (byTier) return byTier;

  const index = hashText(pkg.slug) % fallbackImages.length;
  return fallbackImages[index];
};
