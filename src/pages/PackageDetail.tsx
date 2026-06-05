import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  ImageOff,
  ShieldCheck,
  PhoneCall,
} from "lucide-react";
import api from "@/lib/api-client";
import type {
  SagalaPackage,
  OrderResponse,
  PackageDetailResponse,
} from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  getRecommendedDiscountPercent,
  getOriginalPriceFromDiscount,
  getPackageDisplayImage,
  normalizeDiscountPercent
} from "@/lib/package-display";

const SNAP_SCRIPT_ID = "midtrans-snap-script";

const loadSnapScript = () => {
  const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
  const snapUrl =
    import.meta.env.VITE_MIDTRANS_SNAP_URL ??
    "https://app.sandbox.midtrans.com/snap/snap.js";

  if (!clientKey || document.getElementById(SNAP_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement("script");
  script.src = snapUrl;
  script.id = SNAP_SCRIPT_ID;
  script.async = true;
  script.setAttribute("data-client-key", clientKey);
  document.body.appendChild(script);
};

const PackageDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadSnapScript();
  }, []);

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["package", slug],
    queryFn: async () => {
      const { data } = await api.get<PackageDetailResponse>(
        `/api/packages/${slug}`
      );
      return data.data;
    },
    enabled: Boolean(slug),
  });

  const sagalaPackage = useMemo(() => data, [data]);

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (!sagalaPackage) throw new Error("Paket tidak ditemukan");
      const { data } = await api.post<OrderResponse>("/api/orders", {
        packageId: sagalaPackage.id,
      });
      return data;
    },
    onSuccess: async (response) => {
      toast({
        title: "Pesanan berhasil dibuat",
        description: response.payment.message,
      });

      if (response.payment.isSimulation) {
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        navigate("/dashboard");
        return;
      }

      if (response.payment.snapToken && window.snap) {
        window.snap.pay(response.payment.snapToken, {
          onSuccess: async (result: Record<string, unknown>) => {
            toast({
              title: "Pembayaran berhasil",
              description:
                "Paket aktif dan siap digunakan. Selamat belajar!",
            });

            await api.post(`/api/orders/${response.data.orderCode}/confirm`, {
              transactionStatus: result.transaction_status,
              paymentType: result.payment_type,
              paidAt: new Date().toISOString(),
            });

            await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            navigate("/dashboard");
          },
          onPending: () => {
            toast({
              title: "Menunggu pembayaran",
              description:
                "Selesaikan pembayaran Anda. Paket akan aktif otomatis setelah pembayaran berhasil.",
            });
          },
          onError: (snapError: unknown) => {
            console.error("Midtrans error:", snapError);
            toast({
              title: "Pembayaran gagal",
              description:
                "Terjadi kendala saat memproses pembayaran. Silakan coba lagi atau hubungi admin.",
              variant: "destructive",
            });
          },
          onClose: () => {
            toast({
              title: "Pembayaran dibatalkan",
              description:
                "Anda menutup jendela pembayaran sebelum selesai. Pesanan tetap tersimpan di dashboard.",
            });
          },
        });
        return;
      }

      if (response.payment.snapRedirectUrl) {
        window.location.href = response.payment.snapRedirectUrl;
        return;
      }

      toast({
        title: "Instruksi pembayaran",
        description:
          "Tidak dapat membuka Midtrans otomatis. Silakan cek dashboard atau hubungi admin untuk bantuan.",
      });
    },
    onError: (err: unknown) => {
      const message = isAxiosError(err)
        ? err.response?.data?.message ?? "Terjadi kesalahan ketika memproses pesanan."
        : "Terjadi kesalahan ketika memproses pesanan.";
      toast({
        title: "Gagal membuat pesanan",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handlePurchase = () => {
    if (!sagalaPackage) return;
    if (!user) {
      navigate("/login", {
        state: { from: location, message: "Silakan masuk untuk melanjutkan pembelian." },
        replace: false,
      });
      return;
    }
    orderMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <Navbar />
        <div className="container mx-auto mt-24 px-4">
          <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
            <div className="animate-pulse space-y-6 rounded-3xl bg-card p-8 shadow-xl" />
            <div className="animate-pulse space-y-6 rounded-3xl bg-card p-8 shadow-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !sagalaPackage) {
    return (
      <div className="min-h-screen bg-muted/20">
        <Navbar />
        <div className="container mx-auto mt-32 px-4 text-center">
          <div className="mx-auto max-w-xl rounded-3xl bg-card p-10 shadow-xl">
            <GraduationCap className="mx-auto mb-6 h-12 w-12 text-primary" />
            <h1 className="mb-3 text-3xl font-bold">
              Paket belum tersedia
            </h1>
            <p className="mb-8 text-muted-foreground">
              {isAxiosError(error)
                ? error.response?.data?.message ??
                  "Kami tidak menemukan paket yang Anda cari."
                : "Kami tidak menemukan paket yang Anda cari."}
            </p>
            <Button asChild>
              <Link to="/programs">Kembali ke Program</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const discountPercent = normalizeDiscountPercent(
    sagalaPackage.discountPercent,
    getRecommendedDiscountPercent(sagalaPackage)
  );
  const originalPrice = getOriginalPriceFromDiscount(
    sagalaPackage.price,
    discountPercent
  );
  const packageImage = getPackageDisplayImage(sagalaPackage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/80 to-muted/40">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-24">
        <Button
          variant="ghost"
          className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-primary"
          asChild
        >
          <Link to="/programs">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Program
          </Link>
        </Button>

        <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
          <section className="space-y-6 rounded-3xl bg-card p-8 shadow-xl">
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-muted/30">
              <img
                src={packageImage}
                alt={`Ilustrasi ${sagalaPackage.title}`}
                className="h-64 w-full object-cover"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  const fallback = event.currentTarget
                    .nextElementSibling as HTMLDivElement | null;
                  if (fallback) fallback.classList.remove("hidden");
                }}
              />
              <div className="hidden h-64 w-full flex items-center justify-center bg-muted text-muted-foreground">
                <ImageOff className="h-6 w-6" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {sagalaPackage.badge && (
                <Badge className="rounded-full bg-secondary/15 text-secondary">
                  {sagalaPackage.badge}
                </Badge>
              )}
              <Badge variant="outline" className="rounded-full">
                {sagalaPackage.category}
              </Badge>
            </div>
            <h1 className="text-4xl font-bold leading-tight text-primary">
              {sagalaPackage.title}
            </h1>
            {sagalaPackage.subtitle && (
              <p className="text-lg text-muted-foreground">
                {sagalaPackage.subtitle}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2">
                <Clock className="h-4 w-4 text-primary" />
                Akses {sagalaPackage.durationDays} Hari
              </span>
              {sagalaPackage.level && (
                <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Level {sagalaPackage.level}
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Tryout {sagalaPackage.tryoutAccessStart} -{" "}
                {sagalaPackage.tryoutAccessEnd ?? "Semua"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Latihan {sagalaPackage.latihanAccessStart} -{" "}
                {sagalaPackage.latihanAccessEnd ?? "Semua"}
              </span>
            </div>

            <p className="leading-relaxed text-muted-foreground">
              {sagalaPackage.description}
            </p>

            <div className="rounded-3xl bg-muted/40 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold">
                <GraduationCap className="h-6 w-6 text-primary" />
                Yang Kamu Dapatkan
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {sagalaPackage.features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 rounded-2xl bg-background/80 p-4 shadow-sm"
                  >
                    <CheckCircle2 className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                    <span className="text-sm leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl bg-primary/5 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold">
                <BookOpen className="h-6 w-6 text-primary" />
                Fasilitas Lengkap
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {sagalaPackage.whatsIncluded.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-background/60 p-4"
                  >
                    <ShieldCheck className="h-5 w-5 flex-shrink-0 text-secondary" />
                    <span className="text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {sagalaPackage.highlights.length > 0 && (
              <div className="rounded-3xl bg-background p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-primary">
                  Highlight Program
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  {sagalaPackage.highlights.map((highlight, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-dashed border-primary/30 p-4 text-center"
                    >
                      <p className="text-sm text-muted-foreground">
                        {highlight.title}
                      </p>
                      <p className="text-lg font-semibold text-primary">
                        {highlight.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-6 rounded-3xl bg-card p-6 shadow-xl lg:sticky lg:top-28">
            <Card className="border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-2xl">
              <CardContent className="space-y-6 p-6">
                <div>
                  <p className="text-sm uppercase tracking-wide opacity-80">
                    Investasi Belajar
                  </p>
                  <Badge className="mb-2 mt-2 rounded-full bg-rose-600/90 text-white">
                    Disc {discountPercent}%
                  </Badge>
                  <p className="text-4xl font-bold">
                    Rp {sagalaPackage.price.toLocaleString("id-ID")}
                  </p>
                  <p className="text-sm opacity-80 line-through">
                    Rp {originalPrice.toLocaleString("id-ID")}
                  </p>
                  <p className="text-sm opacity-80">
                    Akses penuh selama {sagalaPackage.durationDays} hari
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    Pembayaran via Midtrans
                  </p>
                  <p className="mt-2 text-xs leading-relaxed opacity-90">
                    Metode pembayaran tidak dipilih manual di halaman ini.
                    Midtrans akan menampilkan opsi pembayaran yang tersedia
                    sesuai status aktivasi akun bisnis Anda.
                  </p>
                </div>

                <Button
                  size="lg"
                  onClick={handlePurchase}
                  disabled={orderMutation.isPending}
                  className="h-14 w-full text-lg shadow-xl hover:scale-[1.01] transition-transform"
                >
                  {orderMutation.isPending ? "Memproses..." : "Daftar Sekarang"}
                </Button>

                {!user && (
                  <p className="text-sm opacity-80">
                    Sudah punya akun?{" "}
                    <Link
                      to="/login"
                      className="font-semibold underline underline-offset-4"
                    >
                      Masuk untuk melanjutkan
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border border-primary/10">
              <CardContent className="space-y-4 p-5">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <PhoneCall className="h-5 w-5 text-primary" />
                  Bantuan Cepat
                </h3>
                <p className="text-sm text-muted-foreground">
                  Tim admin kami siap membantu proses pendaftaran dan
                  pembayaran 24/7.
                </p>
                <div className="grid gap-2 text-sm">
                  <a
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl bg-primary/5 px-4 py-2 font-semibold text-primary shadow-sm transition hover:bg-primary/10"
                    )}
                    href="https://wa.me/6282137233397"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp: +62 821-3723-3397
                  </a>
                  <a
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl bg-primary/5 px-4 py-2 font-semibold text-primary shadow-sm transition hover:bg-primary/10"
                    )}
                    href="tel:+6282137233397"
                  >
                    Telepon: +62 821-3723-3397
                  </a>
                  <a
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl bg-primary/5 px-4 py-2 font-semibold text-primary shadow-sm transition hover:bg-primary/10"
                    )}
                    href="mailto:sagala18@gmail.com"
                  >
                    Email: sagala18@gmail.com
                  </a>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PackageDetail;

