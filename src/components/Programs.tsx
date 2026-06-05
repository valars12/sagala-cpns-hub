import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { usePackages } from "@/hooks/use-packages";
import { Clock, Users, Target, GraduationCap, ImageOff } from "lucide-react";
import type { SagalaPackage } from "@/types";
import {
  getRecommendedDiscountPercent,
  getOriginalPriceFromDiscount,
  getPackageDisplayImage,
  normalizeDiscountPercent,
} from "@/lib/package-display";

const iconMap: Record<string, typeof GraduationCap> = {
  "CPNS S1/S2": GraduationCap,
  "CPNS SMA/D3": Users,
  "Sekolah Kedinasan": Target,
  "Kedinasan & CPNS": GraduationCap,
  Kedinasan: Target,
  CPNS: Users,
};

const prioritizedCategories = ["CPNS S1/S2", "CPNS SMA/D3", "Sekolah Kedinasan"];

const Programs = () => {
  const { data: packages, isLoading, isError } = usePackages();
  const featured = useMemo(() => {
    if (!packages) return [];

    const selection = prioritizedCategories
      .map((category) =>
        packages.find((pkg) => pkg.category === category && pkg.badge === "Reguler")
      )
      .filter(Boolean) as SagalaPackage[];

    if (selection.length >= 4) {
      return selection.slice(0, 4);
    }

    const fallback = packages.filter((pkg) => !selection.some((picked) => picked.id === pkg.id));
    return [...selection, ...fallback.slice(0, 4 - selection.length)];
  }, [packages]);

  return (
    <section className="bg-muted/30 py-20" id="programs">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-16 text-center" data-reveal>
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <GraduationCap className="h-4 w-4" />
            <span className="text-sm font-medium">Program Unggulan</span>
          </div>
          <h2 className="text-4xl font-bold text-primary">
            Program Pilihan untuk Setiap Target Belajar
          </h2>
          <p className="mt-2 text-lg text-muted-foreground">
            {isLoading
              ? "Menyiapkan daftar paket terbaik untukmu..."
              : "Dapatkan akses materi premium, latihan berkala, dan pendampingan mentor expert."}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[330px] animate-pulse rounded-2xl bg-card shadow-xl" />
            ))
          ) : isError ? (
            <Card className="col-span-full border-dashed border-primary/40 bg-card/80">
              <CardContent className="p-8 text-center text-muted-foreground">
                Paket belum dapat dimuat. Pastikan backend aktif, `VITE_API_URL` mengarah ke URL backend yang benar, dan CORS backend mengizinkan domain ini.
              </CardContent>
            </Card>
          ) : (
            featured.map((program) => (
              <ProgramHighlight key={program.id} program={program} />
            ))
          )}
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <InfoCard icon={Clock} title="Jadwal Fleksibel" description="Belajar online kapan saja dengan akses 24/7." />
          <InfoCard icon={Users} title="Pendampingan Intensif" description="Diskusi dan konsultasi mentor setiap hari." />
          <InfoCard icon={Target} title="Monitoring Progres" description="Analisis latihan otomatis dan rekomendasi belajar." />
        </div>
      </div>
    </section>
  );
};

const ProgramHighlight = ({ program }: { program: SagalaPackage }) => {
  const Icon = iconMap[program.category] ?? GraduationCap;
  const discountPercent = normalizeDiscountPercent(
    program.discountPercent,
    getRecommendedDiscountPercent(program)
  );
  const originalPrice = getOriginalPriceFromDiscount(program.price, discountPercent);
  const coverImage = getPackageDisplayImage(program);

  return (
    <Card className="group flex h-full flex-col justify-between rounded-2xl border-2 border-transparent bg-card shadow-xl transition hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-2xl" data-reveal>
      <div className="relative h-44 overflow-hidden rounded-t-2xl bg-muted/30 sm:h-48 md:h-52">
        <img
          src={coverImage}
          alt={`Ilustrasi ${program.title}`}
          className="h-full w-full object-cover object-top"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            const fallback = event.currentTarget.nextElementSibling as HTMLDivElement | null;
            if (fallback) fallback.classList.remove("hidden");
          }}
        />
        <div className="hidden h-full w-full items-center justify-center bg-muted text-muted-foreground flex">
          <ImageOff className="h-6 w-6" />
        </div>
        <Badge className="absolute left-4 top-4 rounded-full bg-rose-600/95 text-white">
          Disc {discountPercent}%
        </Badge>
      </div>

      <CardHeader className="space-y-2 pt-4">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-2 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <Badge variant="outline" className="rounded-full">
            {program.category}
          </Badge>
        </div>
        <CardTitle className="text-[1.35rem] leading-tight text-primary">{program.title}</CardTitle>
        <CardDescription className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {program.subtitle || program.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="rounded-2xl border border-primary/10 bg-primary/5 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Harga Promo
          </p>
          <p className="text-2xl font-bold text-primary">
            Rp {program.price.toLocaleString("id-ID")}
          </p>
          <p className="text-sm text-muted-foreground line-through">
            Rp {originalPrice.toLocaleString("id-ID")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Akses {program.durationDays} hari
          </p>
        </div>
        <Button asChild className="h-10 w-full">
          <Link to={`/packages/${program.slug}`}>Lihat Paket</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

const InfoCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Clock;
  title: string;
  description: string;
}) => (
  <Card className="rounded-3xl bg-card p-6 text-center shadow-lg transition hover:-translate-y-1 hover:shadow-xl" data-reveal>
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      <Icon className="h-6 w-6" />
    </div>
    <h3 className="text-lg font-semibold text-primary">{title}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
  </Card>
);

export default Programs;
