import prisma from "../prisma";
import { baseQuestions, defaultPackages } from "../data/defaultPackages";

type HighlightItem = { title?: string; value?: string };

const normalizePackageTitle = (title: string) => {
  const cleaned = title.replace(/tryout/gi, "").replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : title;
};

const replaceTryout = (value: string) => value.replace(/tryout/gi, "latihan");

const normalizeStringArray = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return value;
    const normalized = parsed.map((item) =>
      typeof item === "string" ? replaceTryout(item) : item
    );
    return JSON.stringify(normalized);
  } catch (error) {
    console.warn("Failed to parse JSON field", error);
    return value;
  }
};

const normalizeHighlights = (value: string | null) => {
  if (!value) return value;
  try {
    const parsed = JSON.parse(value) as HighlightItem[];
    if (!Array.isArray(parsed)) return value;
    const normalized = parsed.map((item) => ({
      ...item,
      title: item.title ? replaceTryout(item.title) : item.title,
      value: item.value ? replaceTryout(item.value) : item.value,
    }));
    return JSON.stringify(normalized);
  } catch (error) {
    console.warn("Failed to parse highlights", error);
    return value;
  }
};

const normalizeExistingPackages = async () => {
  const existingPackages = await prisma.package.findMany({
    select: {
      id: true,
      title: true,
      subtitle: true,
      description: true,
      features: true,
      whatsIncluded: true,
      highlights: true,
      durationDays: true,
      tryoutDurationMinutes: true,
      latihanDurationMinutes: true,
    },
  });

  await prisma.package.updateMany({
    data: {
      durationDays: 365,
      tryoutDurationMinutes: 100,
      latihanDurationMinutes: 20
    },
  });

  await Promise.all(
    existingPackages.map((pkg) => {
      const normalizedTitle = normalizePackageTitle(pkg.title);
      const normalizedSubtitle = pkg.subtitle
        ? replaceTryout(pkg.subtitle)
        : pkg.subtitle;
      const normalizedDescription = replaceTryout(pkg.description);
      const normalizedFeatures = normalizeStringArray(pkg.features);
      const normalizedWhatsIncluded = normalizeStringArray(pkg.whatsIncluded);
      const normalizedHighlights = normalizeHighlights(pkg.highlights);

      const data: Record<string, unknown> = {};
      if (normalizedTitle !== pkg.title) data.title = normalizedTitle;
      if (normalizedSubtitle !== pkg.subtitle) data.subtitle = normalizedSubtitle;
      if (normalizedDescription !== pkg.description) data.description = normalizedDescription;
      if (normalizedFeatures !== pkg.features) data.features = normalizedFeatures;
      if (normalizedWhatsIncluded !== pkg.whatsIncluded) data.whatsIncluded = normalizedWhatsIncluded;
      if (normalizedHighlights !== pkg.highlights) data.highlights = normalizedHighlights;

      if (!Object.keys(data).length) {
        return Promise.resolve();
      }

      return prisma.package.update({
        where: { id: pkg.id },
        data,
      });
    })
  );
};

export const seedDefaultDataIfNeeded = async () => {
  const packageCount = await prisma.package.count();
  if (packageCount > 0) {
    await normalizeExistingPackages();
    return;
  }

  console.info("No packages found, inserting default packages...");
  for (const pkg of defaultPackages) {
    const created = await prisma.package.create({
      data: {
        slug: pkg.slug,
        title: pkg.title,
        subtitle: pkg.subtitle,
        description: pkg.description,
        category: pkg.category,
        level: pkg.level,
        imageUrl: pkg.imageUrl ?? null,
        price: pkg.price,
        discountPercent: pkg.discountPercent,
        durationDays: pkg.durationDays,
        tryoutDurationMinutes: pkg.tryoutDurationMinutes,
        latihanDurationMinutes: pkg.latihanDurationMinutes,
        badge: pkg.badge,
        features: JSON.stringify(pkg.features),
        whatsIncluded: JSON.stringify(pkg.whatsIncluded),
        highlights: JSON.stringify(pkg.highlights ?? []),
      },
    });

    await prisma.question.createMany({
      data: baseQuestions.map((question) => ({
        packageId: created.id,
        category: question.category,
        subtestTitle: question.subtestTitle,
        prompt: question.prompt,
        options: JSON.stringify(question.options),
        answer: question.answer,
        explanation: question.explanation,
        promptImageUrl: question.promptImageUrl ?? null,
        explanationImageUrl: question.explanationImageUrl ?? null
      })),
    });
  }
  console.info("Default packages inserted.");

  await normalizeExistingPackages();
};
