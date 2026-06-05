import { PrismaClient } from "@prisma/client";
import { defaultPackages, baseQuestions } from "../src/data/defaultPackages";

const prisma = new PrismaClient();

async function main() {
  console.info("Seeding database...");

  for (const pkg of defaultPackages) {
    const upserted = await prisma.package.upsert({
      where: { slug: pkg.slug },
      update: {
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
        highlights: JSON.stringify(pkg.highlights ?? [])
      },
      create: {
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
        highlights: JSON.stringify(pkg.highlights ?? [])
      }
    });

    await prisma.question.deleteMany({ where: { packageId: upserted.id } });

    await prisma.question.createMany({
      data: baseQuestions.map((question) => ({
        packageId: upserted.id,
        category: question.category,
        subtestTitle: question.subtestTitle,
        prompt: question.prompt,
        options: JSON.stringify(question.options),
        answer: question.answer,
        explanation: question.explanation,
        promptImageUrl: question.promptImageUrl ?? null,
        explanationImageUrl: question.explanationImageUrl ?? null
      }))
    });
  }

  console.info("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
