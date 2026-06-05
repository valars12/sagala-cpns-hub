import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import api from "@/lib/api-client";
import type {
  DashboardResponse,
  Purchase,
  QuestionCategory
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  BarChart3,
  BookCopy,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Hourglass,
  Layers,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPen
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import TablePagination from "@/components/admin/TablePagination";
import { openDataUrlInNewTab } from "@/lib/data-url";

const statusVariants: Record<
  Purchase["status"],
  { label: string; className: string }
> = {
  PAID: {
    label: "Aktif",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200"
  },
  PENDING: {
    label: "Menunggu Pembayaran",
    className: "bg-amber-100 text-amber-700 border-amber-200"
  },
  EXPIRED: {
    label: "Berakhir",
    className: "bg-rose-100 text-rose-700 border-rose-200"
  },
  CANCELED: {
    label: "Dibatalkan",
    className: "bg-slate-200 text-slate-600 border-slate-300"
  }
};

const TRYOUT_HISTORY_PAGE_SIZE = 8;
const MODULE_PAGE_SIZE = 10;
const CATEGORY_ORDER: QuestionCategory[] = ["TIU", "TWK", "TKP"];
const TRASH_RETENTION_DAYS = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const Dashboard = () => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await api.get<DashboardResponse>("/api/user/dashboard");
      return data.data;
    }
  });
  const isStaff = user?.role === "admin" || user?.role === "teacher";

  const [profileForm, setProfileForm] = useState({
    name: "",
    username: "",
    phone: ""
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUpdatingTrashId, setIsUpdatingTrashId] = useState<string | null>(null);
  const [isDeletingTrashId, setIsDeletingTrashId] = useState<string | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [modulePage, setModulePage] = useState(1);

  const purchases = data?.purchases ?? [];
  const trashedPurchases = data?.trashedPurchases ?? [];
  const tryoutHistory = data?.tryoutHistory ?? [];
  const modules = data?.accessibleModules ?? [];

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(tryoutHistory.length / TRYOUT_HISTORY_PAGE_SIZE)
  );
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const paginatedTryoutHistory = useMemo(() => {
    const startIndex = (safeHistoryPage - 1) * TRYOUT_HISTORY_PAGE_SIZE;
    return tryoutHistory.slice(startIndex, startIndex + TRYOUT_HISTORY_PAGE_SIZE);
  }, [safeHistoryPage, tryoutHistory]);

  const totalModulePages = Math.max(1, Math.ceil(modules.length / MODULE_PAGE_SIZE));
  const safeModulePage = Math.min(modulePage, totalModulePages);
  const paginatedModules = useMemo(() => {
    const startIndex = (safeModulePage - 1) * MODULE_PAGE_SIZE;
    return modules.slice(startIndex, startIndex + MODULE_PAGE_SIZE);
  }, [modules, safeModulePage]);

  const tryoutCategoryAnalysis = useMemo(() => {
    const categoryMap = new Map<
      QuestionCategory,
      {
        category: QuestionCategory;
        total: number;
        correct: number;
        score: number;
        maxScore: number;
      }
    >(
      CATEGORY_ORDER.map((category) => [
        category,
        {
          category,
          total: 0,
          correct: 0,
          score: 0,
          maxScore: 0
        }
      ])
    );

    for (const attempt of tryoutHistory) {
      for (const item of attempt.perCategory) {
        const current = categoryMap.get(item.category);
        if (!current) continue;
        current.total += item.total;
        current.correct += item.correct;
        current.score += item.score;
        current.maxScore += item.maxScore;
      }
    }

    return CATEGORY_ORDER.map((category) => {
      const item = categoryMap.get(category)!;
      const accuracy = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
      const scoreRate = item.maxScore > 0 ? Math.round((item.score / item.maxScore) * 100) : 0;
      return {
        ...item,
        accuracy,
        scoreRate,
        wrong: Math.max(0, item.total - item.correct)
      };
    });
  }, [tryoutHistory]);

  const weakestCategory = useMemo(() => {
    const hasData = tryoutCategoryAnalysis.filter((item) => item.total > 0);
    if (!hasData.length) return null;
    return hasData.reduce((lowest, current) => {
      if (!lowest) return current;
      if (current.accuracy < lowest.accuracy) return current;
      if (current.accuracy === lowest.accuracy && current.scoreRate < lowest.scoreRate) {
        return current;
      }
      return lowest;
    }, hasData[0]);
  }, [tryoutCategoryAnalysis]);

  const strongestCategory = useMemo(() => {
    const hasData = tryoutCategoryAnalysis.filter((item) => item.total > 0);
    if (!hasData.length) return null;
    return hasData.reduce((highest, current) => {
      if (!highest) return current;
      if (current.accuracy > highest.accuracy) return current;
      if (current.accuracy === highest.accuracy && current.scoreRate > highest.scoreRate) {
        return current;
      }
      return highest;
    }, hasData[0]);
  }, [tryoutCategoryAnalysis]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      name: user.name ?? "",
      username: user.username ?? "",
      phone: user.phone ?? ""
    });
  }, [user]);

  useEffect(() => {
    if (isLoading || isStaff) return;

    const focus = new URLSearchParams(location.search).get("focus");
    if (!focus) return;

    if (focus === "modules") {
      if ((data?.accessibleModules.length ?? 0) > 0) {
        document.getElementById("dashboard-modules")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
        return;
      }

      toast({
        title: "Akses materi belum tersedia",
        description:
          "Akun harus di-ACC admin atau melakukan pembayaran paket terlebih dahulu.",
        variant: "destructive"
      });
      navigate("/programs", { replace: true });
      return;
    }

    if (focus === "tryouts") {
      if ((data?.purchases.length ?? 0) > 0) {
        document.getElementById("dashboard-packages")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
        return;
      }

      toast({
        title: "Akses tryout belum tersedia",
        description:
          "Akun harus di-ACC admin atau melakukan pembayaran paket terlebih dahulu.",
        variant: "destructive"
      });
      navigate("/programs", { replace: true });
    }
  }, [
    isLoading,
    isStaff,
    location.search,
    data?.accessibleModules.length,
    data?.purchases.length,
    navigate,
    toast
  ]);

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyPage, totalHistoryPages]);

  useEffect(() => {
    if (modulePage > totalModulePages) {
      setModulePage(totalModulePages);
    }
  }, [modulePage, totalModulePages]);

  const handleOpenAttachment = async (
    dataUrl?: string | null,
    fileName?: string | null
  ) => {
    if (!dataUrl) return;
    try {
      await openDataUrlInNewTab(dataUrl, fileName);
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal membuka file lampiran."
        : "Gagal membuka file lampiran.";
      toast({
        title: "Gagal membuka lampiran",
        description: message,
        variant: "destructive"
      });
    }
  };


  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await api.patch("/api/user/profile", {
        name: profileForm.name,
        phone: profileForm.phone
      });
      await refreshProfile();
      toast({
        title: "Profil diperbarui",
        description: "Perubahan profil berhasil disimpan."
      });
      setIsProfileDialogOpen(false);
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal memperbarui profil."
        : "Gagal memperbarui profil.";
      toast({
        title: "Gagal memperbarui profil",
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (!passwordForm.newPassword.trim()) {
      toast({
        title: "Password baru wajib diisi",
        description: "Masukkan password baru minimal 6 karakter.",
        variant: "destructive"
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Konfirmasi password tidak sama",
        description: "Pastikan password baru dan konfirmasi sama persis.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      await api.patch("/api/user/password", {
        currentPassword: passwordForm.currentPassword || undefined,
        newPassword: passwordForm.newPassword
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });

      toast({
        title: "Password diperbarui",
        description: "Password akun berhasil diubah."
      });
      setIsPasswordDialogOpen(false);
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal memperbarui password."
        : "Gagal memperbarui password.";
      toast({
        title: "Gagal memperbarui password",
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleToggleTrash = async (purchaseId: string, trashed: boolean) => {
    setIsUpdatingTrashId(purchaseId);
    try {
      const { data } = await api.patch(`/api/user/purchases/${purchaseId}/trash`, {
        trashed
      });
      toast({
        title: trashed ? "Paket dipindahkan ke tong sampah" : "Paket dipulihkan",
        description:
          data?.message ??
          (trashed
            ? "Paket tidak lagi tampil di daftar utama."
            : "Paket kembali muncul di Paket Saya.")
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal memperbarui paket."
        : "Gagal memperbarui paket.";
      toast({
        title: "Aksi tidak berhasil",
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsUpdatingTrashId(null);
    }
  };

  const handleDeleteTrash = async (purchaseId: string) => {
    const confirmed = window.confirm(
      "Hapus permanen paket ini dari tong sampah? Tindakan ini tidak dapat dibatalkan."
    );
    if (!confirmed) return;

    setIsDeletingTrashId(purchaseId);
    try {
      const { data } = await api.delete(`/api/user/purchases/${purchaseId}/trash`);
      toast({
        title: "Paket dihapus permanen",
        description: data?.message ?? "Paket berhasil dihapus dari tong sampah."
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal menghapus paket dari tong sampah."
        : "Gagal menghapus paket dari tong sampah.";
      toast({
        title: "Aksi tidak berhasil",
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsDeletingTrashId(null);
    }
  };

  if (isStaff) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/80 to-muted/40">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-24">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              Selamat Datang Kembali!
            </h1>
            <p className="text-muted-foreground">
              {isStaff
                ? "Kelola profil staff dan keamanan akun dari halaman ini."
                : "Kelola paket belajar, profil, dan keamanan akunmu di sini."}
            </p>
          </div>
          <Button asChild variant="secondary" className="shadow-md">
            <Link to={isStaff ? "/admin" : "/programs"}>
              {isStaff ? "Buka Panel Staff" : "Tambah Paket Baru"}
            </Link>
          </Button>
        </header>

        <section className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            icon={GraduationCap}
            label="Total Paket"
            value={data?.stats.totalPackages ?? 0}
            gradient="from-primary/20 to-primary/10 text-primary"
          />
          <DashboardStatCard
            icon={CheckCircle2}
            label="Aktif"
            value={data?.stats.activePackages ?? 0}
            gradient="from-emerald-200/60 to-emerald-100 text-emerald-700"
          />
          <DashboardStatCard
            icon={Hourglass}
            label="Menunggu Pembayaran"
            value={data?.stats.pendingPackages ?? 0}
            gradient="from-amber-200/60 to-amber-100 text-amber-700"
          />
          <DashboardStatCard
            icon={Layers}
            label="Selesai"
            value={data?.stats.completedPackages ?? 0}
            gradient="from-slate-200/80 to-slate-100 text-slate-700"
          />
        </section>

        <section className="mb-10 grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl bg-card p-5 shadow-md xl:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserPen className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-primary">Profil Akun</h2>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setIsProfileDialogOpen(true)}
              >
                <UserPen className="h-4 w-4" />
                Edit Profil
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/70">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border/60">
                    <td className="w-40 bg-muted/35 px-4 py-3 font-medium text-muted-foreground">
                      Nama Lengkap
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">
                      {profileForm.name || "-"}
                    </td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="bg-muted/35 px-4 py-3 font-medium text-muted-foreground">
                      Username
                    </td>
                    <td className="px-4 py-3">{profileForm.username || "-"}</td>
                  </tr>
                  <tr>
                    <td className="bg-muted/35 px-4 py-3 font-medium text-muted-foreground">
                      Nomor Telepon
                    </td>
                    <td className="px-4 py-3">{profileForm.phone || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-card p-5 shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-primary">Keamanan Akun</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Ubah password kapan pun untuk menjaga keamanan akun belajar Anda.
            </p>
            <Button
              className="mt-5 w-full"
              variant="outline"
              onClick={() => setIsPasswordDialogOpen(true)}
            >
              Ubah Password
            </Button>
          </div>
        </section>

        {isStaff ? (
          <section className="rounded-2xl bg-card p-5 shadow-md">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-primary">Panel Staff</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Fitur paket siswa tidak ditampilkan untuk akun staff.
            </p>
            <Button asChild className="mt-4">
              <Link to="/admin">Masuk ke Panel Staff</Link>
            </Button>
          </section>
        ) : (
          <div className="space-y-10">
            <section id="dashboard-packages" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-primary">Paket Saya</h2>
                <p className="text-sm text-muted-foreground">
                  Paket aktif ada di daftar utama, paket batal/salah input bisa dipindahkan
                  ke tong sampah. Paket di tong sampah akan terhapus otomatis setelah 30 hari.
                </p>
              </div>

              <Tabs defaultValue="active" className="space-y-4">
                <TabsList className="h-auto flex-wrap gap-2 rounded-2xl bg-muted/70 p-1">
                  <TabsTrigger value="active" className="rounded-xl px-3 py-1.5 text-xs sm:text-sm">
                    Paket Saya ({purchases.length})
                  </TabsTrigger>
                  <TabsTrigger value="trash" className="rounded-xl px-3 py-1.5 text-xs sm:text-sm">
                    Tong Sampah ({trashedPurchases.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-0">
                  {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-40 animate-pulse rounded-2xl bg-card shadow-md"
                        />
                      ))}
                    </div>
                  ) : !purchases.length ? (
                    <EmptyState hasTrash={Boolean(trashedPurchases.length)} />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {purchases.map((purchase) => (
                        <DashboardPackageCard
                          key={purchase.id}
                          purchase={purchase}
                          isUpdating={isUpdatingTrashId === purchase.id}
                          onMoveToTrash={() => handleToggleTrash(purchase.id, true)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="trash" className="mt-0">
                  {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-32 animate-pulse rounded-2xl bg-card shadow-md"
                        />
                      ))}
                    </div>
                  ) : !trashedPurchases.length ? (
                    <div className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-md">
                      Tong sampah kosong. Paket yang dibuang akan muncul di sini.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {trashedPurchases.map((purchase) => (
                        <DashboardPackageCard
                          key={purchase.id}
                          purchase={purchase}
                          isTrashView
                          isUpdating={
                            isUpdatingTrashId === purchase.id ||
                            isDeletingTrashId === purchase.id
                          }
                          onRestoreFromTrash={() =>
                            handleToggleTrash(purchase.id, false)
                          }
                          onDeletePermanently={() => handleDeleteTrash(purchase.id)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </section>

            <section id="dashboard-modules" className="space-y-4">
              <div className="flex items-center gap-2">
                <BookCopy className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold text-primary">Modul Materi Saya</h2>
              </div>
              {!data?.accessibleModules.length ? (
                <div className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-md">
                  Belum ada modul materi aktif. Modul akan muncul otomatis dari paket yang Anda beli atau dari akses manual admin.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {paginatedModules.map((module) => {
                      const hasPdf = Boolean(module.pdfDataUrl);
                      const hasPpt = Boolean(module.pptDataUrl);
                      const hasText = Boolean(module.content);

                      return (
                        <article
                          key={module.id}
                          className="flex min-h-[260px] flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                        >
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <Badge variant="outline" className="rounded-full text-[11px]">
                              {module.isPublished ? "Published" : "Draft"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(module.updatedAt).toLocaleDateString("id-ID")}
                            </span>
                          </div>

                          <h3 className="line-clamp-2 text-lg font-semibold text-primary">
                            {module.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {module.bab ? `Bab: ${module.bab}` : "Bab: -"}
                            {module.subBab ? ` | Bagian: ${module.subBab}` : ""}
                          </p>
                          {module.summary && (
                            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                              {module.summary}
                            </p>
                          )}

                          <p className="mt-3 text-xs text-muted-foreground">
                            Dibuat oleh {module.createdBy.name}
                          </p>

                          <div className="mt-auto pt-4">
                            {hasPdf ? (
                              <Button
                                type="button"
                                className="w-full"
                                onClick={() =>
                                  void handleOpenAttachment(
                                    module.pdfDataUrl,
                                    module.pdfFileName
                                  )
                                }
                              >
                                <FileText className="mr-1 h-4 w-4" />
                                Buka Materi
                                <ExternalLink className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            ) : hasPpt ? (
                              <Button
                                type="button"
                                className="w-full"
                                onClick={() =>
                                  void handleOpenAttachment(
                                    module.pptDataUrl,
                                    module.pptFileName
                                  )
                                }
                              >
                                <FileText className="mr-1 h-4 w-4" />
                                Buka Materi
                                <ExternalLink className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                                {hasText
                                  ? "Materi teks tersedia di dalam modul."
                                  : "Materi belum memiliki lampiran file."}
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {modules.length > MODULE_PAGE_SIZE && (
                    <div className="rounded-2xl bg-card shadow-sm">
                      <TablePagination
                        currentPage={safeModulePage}
                        totalPages={totalModulePages}
                        totalItems={modules.length}
                        pageSize={MODULE_PAGE_SIZE}
                        onPageChange={setModulePage}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold text-primary">Riwayat Hasil Tryout</h2>
              </div>
              {!tryoutHistory.length ? (
                <div className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-md">
                  Belum ada riwayat pengerjaan tryout.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {tryoutCategoryAnalysis.map((item) => {
                      const tone = getCategoryTone(item.category);
                      const isWeakest = weakestCategory?.category === item.category;

                      return (
                        <div
                          key={item.category}
                          className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className={cn("text-sm font-semibold", tone.labelClass)}>
                              {item.category}
                            </p>
                            {isWeakest && (
                              <Badge
                                variant="outline"
                                className="rounded-full border-amber-300 bg-amber-50 text-amber-700"
                              >
                                Perlu Fokus
                              </Badge>
                            )}
                          </div>
                          <p className="text-2xl font-bold text-primary">{item.accuracy}%</p>
                          <p className="text-xs text-muted-foreground">
                            Akurasi jawaban benar ({item.correct}/{item.total || 0} soal)
                          </p>
                          <div className="mt-3 h-2 rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full transition-all", tone.barClass)}
                              style={{
                                width: `${item.total > 0 ? Math.max(4, item.accuracy) : 0}%`
                              }}
                            />
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            Salah: {item.wrong} soal | Capaian skor: {item.scoreRate}%
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <p className="font-semibold text-primary">Analisis Otomatis Performa</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {weakestCategory
                        ? `Fokus utama saat ini ada di ${weakestCategory.category}. Tingkat akurasinya baru ${weakestCategory.accuracy}%, jadi prioritaskan latihan kategori ini lebih sering.`
                        : "Belum ada data kategori yang cukup untuk dianalisis. Kerjakan minimal satu sesi terlebih dahulu."}
                    </p>
                    {strongestCategory && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Kategori terkuat Anda:{" "}
                        <span className="font-semibold text-primary">
                          {strongestCategory.category}
                        </span>{" "}
                        ({strongestCategory.accuracy}%).
                      </p>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-2xl bg-card shadow-md">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[920px] text-left text-sm">
                        <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Tanggal</th>
                            <th className="px-5 py-3 font-semibold">Tryout</th>
                            <th className="px-5 py-3 font-semibold">Skor</th>
                            <th className="px-5 py-3 font-semibold">Benar/Salah/Kosong</th>
                            <th className="px-5 py-3 font-semibold">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTryoutHistory.map((item) => (
                            <tr key={item.id} className="border-b border-border/40">
                              <td className="px-5 py-4">
                                {new Date(item.completedAt).toLocaleString("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </td>
                              <td className="px-5 py-4">
                                <p className="font-semibold text-primary">{item.package.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.package.category} -{" "}
                                  {item.sessionTitle ?? item.sessionCode ?? "-"}
                                </p>
                              </td>
                              <td className="px-5 py-4">
                                <p className="font-semibold text-primary">
                                  {item.score}/{item.maxScore} ({item.percentage}%)
                                </p>
                              </td>
                              <td className="px-5 py-4">
                                <p className="text-emerald-700">Benar: {item.correctCount}</p>
                                <p className="text-rose-700">Salah: {item.wrongCount}</p>
                                <p className="text-muted-foreground">Kosong: {item.blankCount}</p>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <Button asChild size="sm" variant="outline">
                                    <Link
                                      to={`/practice/${item.package.slug}?attemptId=${item.id}${
                                        item.sessionCode
                                          ? `&sessionCode=${encodeURIComponent(item.sessionCode)}`
                                          : ""
                                      }`}
                                    >
                                      Lihat Hasil Tryout
                                    </Link>
                                  </Button>
                                  <Button asChild size="sm" variant="outline">
                                    <Link
                                      to={`/practice/${item.package.slug}${
                                        item.sessionCode
                                          ? `?sessionCode=${encodeURIComponent(item.sessionCode)}`
                                          : ""
                                      }`}
                                    >
                                      Kerjakan Lagi
                                    </Link>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      currentPage={safeHistoryPage}
                      totalPages={totalHistoryPages}
                      totalItems={tryoutHistory.length}
                      pageSize={TRYOUT_HISTORY_PAGE_SIZE}
                      onPageChange={setHistoryPage}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profil</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">Nama Lengkap</Label>
              <Input
                id="profile-name"
                value={profileForm.name}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    name: event.target.value
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-phone">Nomor Telepon</Label>
              <Input
                id="profile-phone"
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    phone: event.target.value
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsProfileDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? "Menyimpan..." : "Simpan Profil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Password</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password-current">Password Saat Ini</Label>
              <Input
                id="password-current"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: event.target.value
                  }))
                }
                placeholder="Wajib diisi jika akun sudah punya password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password-new">Password Baru</Label>
              <Input
                id="password-new"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: event.target.value
                  }))
                }
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password-confirm">Konfirmasi Password Baru</Label>
              <Input
                id="password-confirm"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: event.target.value
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPasswordDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSavePassword} disabled={isSavingPassword}>
              {isSavingPassword ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

const getCategoryTone = (category: QuestionCategory) => {
  if (category === "TIU") {
    return {
      labelClass: "text-blue-700",
      barClass: "bg-blue-500"
    };
  }

  if (category === "TWK") {
    return {
      labelClass: "text-violet-700",
      barClass: "bg-violet-500"
    };
  }

  return {
    labelClass: "text-emerald-700",
    barClass: "bg-emerald-500"
  };
};

const DashboardStatCard = ({
  icon: Icon,
  label,
  value,
  gradient
}: {
  icon: typeof GraduationCap;
  label: string;
  value: number;
  gradient: string;
}) => (
  <div
    className={cn(
      "rounded-2xl bg-gradient-to-br p-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg",
      gradient
    )}
  >
    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-background/70">
      <Icon className="h-5 w-5" />
    </div>
    <p className="text-sm font-medium opacity-80">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

const DashboardPackageCard = ({
  purchase,
  isTrashView = false,
  isUpdating = false,
  onMoveToTrash,
  onRestoreFromTrash,
  onDeletePermanently
}: {
  purchase: Purchase;
  isTrashView?: boolean;
  isUpdating?: boolean;
  onMoveToTrash?: () => void;
  onRestoreFromTrash?: () => void;
  onDeletePermanently?: () => void;
}) => {
  const status = statusVariants[purchase.status];
  const isPaid = purchase.status === "PAID";
  const canLearn = isPaid;
  const canMoveToTrash = !isTrashView && purchase.status !== "PAID" && Boolean(onMoveToTrash);
  const durationDays =
    purchase.validityDays ??
    (purchase.startDate && purchase.endDate
      ? Math.max(
          0,
          Math.round(
            (new Date(purchase.endDate).getTime() -
              new Date(purchase.startDate).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : purchase.package.durationDays);

  const expiryText =
    purchase.endDate && isPaid
      ? new Date(purchase.endDate).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric"
        })
      : undefined;
  const trashedAtText = purchase.hiddenAt
    ? new Date(purchase.hiddenAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
    : undefined;
  const trashRemainingDays =
    isTrashView && purchase.hiddenAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(purchase.hiddenAt).getTime() +
              TRASH_RETENTION_DAYS * ONE_DAY_MS -
              Date.now()) /
              ONE_DAY_MS
          )
        )
      : null;
  const packageSpecs = [
    {
      label: "Durasi",
      value: `${durationDays} hari`
    },
    {
      label: "Tryout",
      value: `${purchase.package.tryoutAccessStart}-${purchase.package.tryoutAccessEnd ?? "Semua"}`
    },
    {
      label: "Latihan",
      value: `${purchase.package.latihanAccessStart}-${purchase.package.latihanAccessEnd ?? "Semua"}`
    },
    {
      label: "Harga",
      value: `Rp ${purchase.package.price.toLocaleString("id-ID")}`
    }
  ];
  const compactFeatures = purchase.package.features.filter(Boolean).slice(0, 3);

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl bg-card p-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="rounded-full text-[11px]">
                {purchase.package.category}
              </Badge>
              {purchase.isAdminGranted && purchase.status === "PAID" && (
                <Badge className="rounded-full bg-indigo-100 text-[11px] text-indigo-700 hover:bg-indigo-100">
                  ACC Admin
                </Badge>
              )}
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  status.className
                )}
              >
                {status.label}
              </span>
            </div>
            <h3 className="line-clamp-2 text-lg font-semibold text-primary">
              {purchase.package.title}
            </h3>
            {purchase.package.subtitle && (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {purchase.package.subtitle}
              </p>
            )}
          </div>
          <BookCopy className="h-6 w-6 text-primary/70" />
        </div>

        <div className="grid gap-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Durasi {durationDays} hari
          </div>
          {isPaid && expiryText && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Aktif hingga {expiryText}
            </div>
          )}
          {isTrashView && trashedAtText && (
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              Dibuang pada {trashedAtText}
            </div>
          )}
          {isTrashView && typeof trashRemainingDays === "number" && (
            <div className="text-xs text-muted-foreground">
              Otomatis dihapus dalam {trashRemainingDays} hari.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/35 p-3">
          {packageSpecs.map((spec) => (
            <div key={spec.label} className="rounded-lg border border-border/60 bg-background/90 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {spec.label}
              </p>
              <p className="truncate text-sm font-medium text-primary">{spec.value}</p>
            </div>
          ))}
        </div>

        {compactFeatures.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {compactFeatures.map((feature, index) => (
              <Badge
                key={`${purchase.id}-feature-${index}`}
                variant="outline"
                className="rounded-full text-xs font-normal"
              >
                {feature}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/50 pt-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Order ID
          </p>
          <p className="truncate font-medium text-primary">{purchase.orderCode}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isTrashView &&
            (canLearn ? (
              <Button asChild size="sm" className="shadow-sm">
                <Link to={`/practice/${purchase.package.slug}`}>Pilih Sesi</Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="ghost">
                <Link to={`/packages/${purchase.package.slug}`}>Lihat Detail</Link>
              </Button>
            ))}

          {canMoveToTrash && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={isUpdating}
              onClick={onMoveToTrash}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Buang
            </Button>
          )}

          {isTrashView && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={isUpdating}
                onClick={onRestoreFromTrash}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Pulihkan
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={isUpdating}
                onClick={onDeletePermanently}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus Permanen
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ hasTrash = false }: { hasTrash?: boolean }) => (
  <div className="rounded-2xl bg-card p-8 text-center shadow-md">
    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
      <GraduationCap className="h-8 w-8" />
    </div>
    <h3 className="text-xl font-semibold text-primary">
      Belum ada paket aktif
    </h3>
    <p className="mt-2 text-muted-foreground">
      Yuk mulai perjalanan belajarmu dengan memilih paket terbaik dari All
      Sagala Bimbel.
    </p>
    {hasTrash && (
      <p className="mt-1 text-xs text-muted-foreground">
        Cek tab Tong Sampah jika ingin memulihkan paket yang sudah dibuang.
      </p>
    )}
    <Button asChild className="mt-6">
      <Link to="/programs">Lihat Program</Link>
    </Button>
  </div>
);

export default Dashboard;

