import { useMemo, useState, type ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePackages } from "@/hooks/use-packages";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  BookOpen,
  Target,
  Users,
  Clock,
  Trophy,
  Sparkles,
  Search,
  ImageOff,
} from "lucide-react";
import type { SagalaPackage } from "@/types";
import { cn } from "@/lib/utils";
import {
  getRecommendedDiscountPercent,
  getOriginalPriceFromDiscount,
  getPackageDisplayImage,
  normalizeDiscountPercent,
} from "@/lib/package-display";

const iconMap: Record<string, typeof GraduationCap> = {
  "CPNS S1/S2": GraduationCap,
  "CPNS SMA/D3": BookOpen,
  "Sekolah Kedinasan": Target,
  "Kedinasan & CPNS": GraduationCap,
  Kedinasan: Target,
  CPNS: BookOpen,
};

const categoryPriority: Record<string, number> = {
  "CPNS S1/S2": 0,
  "CPNS SMA/D3": 1,
  "Sekolah Kedinasan": 2,
};

const badgePriority: Record<string, number> = {
  Hemat: 0,
  Basic: 1,
  Reguler: 2,
  "Pre Exclusive": 3,
  Exclusive: 4,
  Platinum: 5,
  Ultimate: 6,
};

const ProgramsPage = () => {
  const { data: packages, isLoading, isError } = usePackages();
  const categories = useMemo(() => {
    const list = packages ? Array.from(new Set(packages.map((pkg) => pkg.category))) : [];
    return ["Semua Paket", ...list];
  }, [packages]);
  const [activeCategory, setActiveCategory] = useState("Semua Paket");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPackages = useMemo(() => {
    if (!packages) return [];
    const term = searchTerm.trim().toLowerCase();

    const matchesTerm = (pkg: SagalaPackage) => {
      if (!term) return true;
      const searchable = [
        pkg.title,
        pkg.subtitle ?? "",
        pkg.badge ?? "",
        pkg.category,
        pkg.slug,
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(term);
    };

    return packages
      .filter((pkg) =>
        activeCategory === "Semua Paket" ? true : pkg.category === activeCategory
      )
      .filter(matchesTerm)
      .sort((a, b) => {
        const categoryWeightA = categoryPriority[a.category] ?? Number.MAX_SAFE_INTEGER;
        const categoryWeightB = categoryPriority[b.category] ?? Number.MAX_SAFE_INTEGER;
        if (categoryWeightA !== categoryWeightB) {
          return categoryWeightA - categoryWeightB;
        }

        const badgeWeightA = a.badge ? badgePriority[a.badge] ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        const badgeWeightB = b.badge ? badgePriority[b.badge] ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        if (badgeWeightA !== badgeWeightB) {
          return badgeWeightA - badgeWeightB;
        }

        return a.price - b.price;
      });
  }, [packages, activeCategory, searchTerm]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/80 to-muted/30">
      <Navbar />
      <main className="flex flex-col">
        <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center" data-reveal>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Program Unggulan Sagala Bimbel</span>
              </div>
              <h1 className="mt-6 text-5xl font-bold leading-tight text-primary">
                Pilih Paket yang Tepat untuk Target Belajarmu
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Semua paket dirancang oleh instruktur berpengalaman untuk memastikan kamu lolos seleksi kedinasan dan CPNS.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button size="lg" asChild>
                  <a href="#packages">Jelajahi Paket</a>
                </Button>
                <Button
                  size="lg"
                  className="border border-primary/20 bg-white text-primary shadow-md transition hover:bg-white/90"
                  asChild
                >
                  <a href="https://wa.me/6282137233397" target="_blank" rel="noopener noreferrer">
                    Konsultasi Gratis
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="packages" className="py-20">
          <div className="container mx-auto max-w-7xl px-4">
            <div className="mb-10 text-center" data-reveal>
              <h2 className="text-3xl font-bold text-primary">Daftar Paket Belajar</h2>
              <p className="mt-2 text-muted-foreground">
                {isLoading
                  ? "Memuat paket terbaik untukmu..."
                  : "Pilih paket sesuai kebutuhan dan mulai belajar hari ini."}
              </p>
            </div>

            <div className="mb-12 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between" data-reveal data-reveal-delay="120ms">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <FilterChip
                    key={category}
                    active={activeCategory === category}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </FilterChip>
                ))}
              </div>
              <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cari paket..."
                  className="h-12 rounded-full pl-10"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:gap-6">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[340px] animate-pulse rounded-2xl bg-card shadow-xl"
                  />
                ))
              ) : isError ? (
                <Card className="col-span-full border-dashed border-primary/40 bg-card/80">
                  <CardContent className="space-y-3 p-8 text-center text-muted-foreground">
                    <p className="text-base font-semibold text-primary">
                      Paket belum bisa dimuat.
                    </p>
                    <p className="text-sm">
                      Pastikan `VITE_API_URL` mengarah ke backend aktif dan CORS backend mengizinkan domain ini.
                    </p>
                    <Button asChild variant="secondary">
                      <Link to="/contact">Hubungi Admin</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : filteredPackages.length > 0 ? (
                filteredPackages.map((pkg) => <ProgramCard key={pkg.id} program={pkg} />)
              ) : (
                <Card className="col-span-full border-dashed border-primary/40 bg-card/80">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Tidak menemukan paket yang sesuai. Coba ubah kategori atau kata kunci pencarian.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>

        <section className="bg-muted/40 py-20">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center" data-reveal>
              <h2 className="text-3xl font-bold text-primary">Kenapa Harus Sagala Bimbel?</h2>
              <p className="text-muted-foreground">
                Pendekatan belajar adaptif dengan monitoring progres real-time.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-4">
              <AdvantageCard icon={GraduationCap} title="Instruktur Expert" description="Tim mentor berpengalaman yang siap mendampingi." />
              <AdvantageCard icon={Clock} title="Jadwal Fleksibel" description="Belajar online kapan pun dengan materi lengkap." />
              <AdvantageCard icon={Trophy} title="Latihan Terstruktur" description="Simulasi ujian berkala lengkap dengan analisis skor." />
              <AdvantageCard icon={Users} title="Komunitas Supportif" description="Diskusi, konsultasi, dan pendampingan 24/7." />
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4">
            <Card className="bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-xl" data-reveal>
              <CardContent className="flex flex-col items-center gap-6 p-10 text-center md:flex-row md:justify-between md:text-left">
                <div className="max-w-xl space-y-2">
                  <h3 className="text-3xl font-bold">Siap Mulai Perjalanan Belajarmu?</h3>
                  <p className="text-primary-foreground/80">
                    Hubungi admin untuk konsultasi paket atau langsung daftar dan nikmati akses materi premium.
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row">
                  <Button size="lg" variant="secondary" asChild>
                    <Link to="/register">Daftar Sekarang</Link>
                  </Button>
                  <Button
                    size="lg"
                    className="bg-white text-primary shadow-lg transition hover:bg-white/90"
                    asChild
                  >
                    <a href="https://wa.me/6282137233397" target="_blank" rel="noopener noreferrer">
                      Hubungi Admin
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const ProgramCard = ({ program }: { program: SagalaPackage }) => {
  const Icon = iconMap[program.category] ?? GraduationCap;
  const isPopular = program.badge?.toLowerCase().includes("populer");
  const discountPercent = normalizeDiscountPercent(
    program.discountPercent,
    getRecommendedDiscountPercent(program)
  );
  const originalPrice = getOriginalPriceFromDiscount(program.price, discountPercent);
  const coverImage = getPackageDisplayImage(program);

  return (
    <Card
      data-reveal
      className={cn(
        "flex h-full flex-col justify-between rounded-2xl border-2 bg-card shadow-xl transition hover:-translate-y-1.5 hover:shadow-2xl",
        isPopular ? "border-secondary/60 ring-2 ring-secondary/40" : "border-transparent hover:border-primary/40"
      )}
    >
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

      <CardHeader className="space-y-2 pb-0 pt-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="rounded-full border-primary/20 px-3 text-xs text-primary">
                  {program.category}
                </Badge>
              </div>
              {program.badge && (
                <Badge
                  className={cn(
                    "w-max rounded-full px-3 py-1 text-xs font-semibold",
                    isPopular ? "bg-secondary text-primary" : "bg-primary/10 text-primary"
                  )}
                >
                  {program.badge}
                </Badge>
              )}
              <CardTitle className="text-[1.45rem] leading-tight text-primary">{program.title}</CardTitle>
              {program.subtitle ? (
                <CardDescription className="line-clamp-2 text-sm text-muted-foreground">
                  {program.subtitle}
                </CardDescription>
              ) : (
                <CardDescription className="line-clamp-2 text-sm text-muted-foreground">
                  {program.description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Harga Setelah Diskon
            </p>
            <p className="text-2xl font-bold text-primary">
              Rp {program.price.toLocaleString("id-ID")}
            </p>
            <p className="text-sm text-muted-foreground line-through">
              Rp {originalPrice.toLocaleString("id-ID")}
            </p>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
              <p>Akses {program.durationDays} hari</p>
              <p>
                Tryout {program.tryoutAccessStart}-{program.tryoutAccessEnd ?? "Semua"}
              </p>
              <p>
                Latihan {program.latihanAccessStart}-{program.latihanAccessEnd ?? "Semua"}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <Button className="h-10 flex-1 shadow-md" asChild>
            <Link to={`/packages/${program.slug}`}>Daftar Sekarang</Link>
          </Button>
          <Button variant="outline" className="h-10 flex-1 border-primary/40 text-primary hover:bg-primary/10" asChild>
            <Link to={`/packages/${program.slug}`}>Info Lengkap</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded-full px-5 py-2 text-sm font-semibold transition",
      active
        ? "bg-primary text-primary-foreground shadow-lg"
        : "bg-white text-muted-foreground shadow hover:bg-primary/10"
    )}
  >
    {children}
  </button>
);

const AdvantageCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof GraduationCap;
  title: string;
  description: string;
}) => (
  <Card className="rounded-3xl border-0 bg-card p-6 text-center shadow-lg transition hover:-translate-y-1 hover:shadow-xl" data-reveal>
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      <Icon className="h-7 w-7" />
    </div>
    <h3 className="text-lg font-semibold text-primary">{title}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
  </Card>
);

export default ProgramsPage;

