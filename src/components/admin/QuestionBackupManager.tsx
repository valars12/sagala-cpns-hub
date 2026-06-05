import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import api from "@/lib/api-client";
import type {
  AdminPackage,
  AdminPackagesResponse,
  AdminQuestionBackup,
  AdminQuestionBackupsResponse
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Download, RotateCcw, ShieldCheck } from "lucide-react";

const backupActionLabels: Record<AdminQuestionBackup["action"], string> = {
  CREATE: "Buat Soal",
  UPDATE_BEFORE: "Sebelum Edit",
  DELETE: "Hapus Soal",
  RESTORE: "Restore"
};

const backupActionBadgeClassNames: Record<AdminQuestionBackup["action"], string> = {
  CREATE: "border-emerald-300 bg-emerald-50 text-emerald-700",
  UPDATE_BEFORE: "border-amber-300 bg-amber-50 text-amber-700",
  DELETE: "border-rose-300 bg-rose-50 text-rose-700",
  RESTORE: "border-blue-300 bg-blue-50 text-blue-700"
};

const getErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError(error) ? error.response?.data?.message ?? fallback : fallback;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const QuestionBackupManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [packageFilter, setPackageFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");

  const { data: packages } = useQuery({
    queryKey: ["admin-packages", "question-backup-manager"],
    queryFn: async () => {
      const response = await api.get<AdminPackagesResponse>("/api/admin/packages");
      return response.data.data;
    }
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["question-backups", packageFilter, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (packageFilter !== "ALL") {
        params.set("packageId", packageFilter);
      }
      if (actionFilter !== "ALL") {
        params.set("action", actionFilter);
      }
      const response = await api.get<AdminQuestionBackupsResponse>(
        `/api/admin/question-backups?${params.toString()}`
      );
      return response.data.data;
    }
  });

  const rows = data ?? [];
  const packageMap = useMemo(
    () => new Map((packages ?? []).map((pkg: AdminPackage) => [pkg.id, pkg.title])),
    [packages]
  );

  const refreshBackups = async () => {
    await queryClient.invalidateQueries({ queryKey: ["question-backups"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
  };

  const handleRestore = async (backupId: string) => {
    const confirmed = window.confirm(
      "Restore backup ini sebagai soal baru? Soal hasil restore akan ditambahkan ke sesi terkait."
    );
    if (!confirmed) return;

    try {
      const response = await api.post(`/api/admin/question-backups/${backupId}/restore`);
      toast({
        title: "Backup dipulihkan",
        description:
          response.data?.message ?? "Soal berhasil dipulihkan dari backup sebagai soal baru."
      });
      await refreshBackups();
    } catch (error) {
      toast({
        title: "Gagal restore backup",
        description: getErrorMessage(error, "Terjadi kesalahan saat memulihkan backup soal."),
        variant: "destructive"
      });
    }
  };

  const handleExportAll = async () => {
    try {
      const response = await api.get("/api/admin/question-backups/export", {
        responseType: "blob"
      });
      const disposition = response.headers["content-disposition"] as string | undefined;
      const fileNameMatch = disposition?.match(/filename="?([^";]+)"?/i);
      const fileName = fileNameMatch?.[1] ?? `question-backup-${Date.now()}.json`;

      const url = window.URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export backup berhasil",
        description: "File JSON backup seluruh bank soal berhasil diunduh."
      });
    } catch (error) {
      toast({
        title: "Gagal export backup",
        description: getErrorMessage(error, "Terjadi kesalahan saat mengekspor backup soal."),
        variant: "destructive"
      });
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
              <ShieldCheck className="h-5 w-5" />
              Backup Bank Soal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Semua aksi buat/edit/hapus soal otomatis dicatat. Admin dapat restore cepat
              untuk meminimalkan risiko human error atau sabotase.
            </p>
          </div>
          <Button className="gap-2" onClick={() => void handleExportAll()}>
            <Download className="h-4 w-4" /> Export JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <span className="text-sm font-medium text-primary">Filter Paket</span>
          <Select value={packageFilter} onValueChange={setPackageFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Semua Paket" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Paket</SelectItem>
              {(packages ?? []).map((pkg) => (
                <SelectItem key={pkg.id} value={pkg.id}>
                  {pkg.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-primary">Filter Aksi</span>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Semua Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Aksi</SelectItem>
              <SelectItem value="CREATE">Buat Soal</SelectItem>
              <SelectItem value="UPDATE_BEFORE">Sebelum Edit</SelectItem>
              <SelectItem value="DELETE">Hapus Soal</SelectItem>
              <SelectItem value="RESTORE">Restore</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-card shadow-md">
        <table className="w-full min-w-[1140px] text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Waktu</th>
              <th className="px-4 py-3 font-semibold">Aksi</th>
              <th className="px-4 py-3 font-semibold">Paket</th>
              <th className="px-4 py-3 font-semibold">Sesi</th>
              <th className="px-4 py-3 font-semibold">Ringkasan</th>
              <th className="px-4 py-3 font-semibold">Pelaku</th>
              <th className="px-4 py-3 font-semibold">Restore</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-8" colSpan={7}>
                  Memuat data backup soal...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td className="px-4 py-8" colSpan={7}>
                  Gagal memuat data backup soal.
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8" colSpan={7}>
                  Belum ada riwayat backup soal.
                </td>
              </tr>
            ) : (
              rows.map((backup) => {
                const canRestore = backup.action === "DELETE" || backup.action === "UPDATE_BEFORE";
                const packageTitle =
                  backup.packageTitle ||
                  (backup.packageId ? packageMap.get(backup.packageId) : undefined) ||
                  "-";

                return (
                  <tr
                    key={backup.id}
                    className="border-b border-border/40 align-top transition-colors hover:bg-muted/25"
                  >
                    <td className="px-4 py-3">{formatDateTime(backup.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={backupActionBadgeClassNames[backup.action]}
                      >
                        {backupActionLabels[backup.action]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{packageTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {backup.category ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{backup.sessionTitle ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {backup.sessionCode ?? "-"} | {backup.sessionType ?? "-"} {backup.sessionOrder ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[320px] line-clamp-2 text-sm text-muted-foreground">
                        {backup.promptExcerpt || backup.subtestTitle || "Tanpa ringkasan"}
                      </p>
                      {backup.restoredAt && (
                        <p className="mt-1 text-xs text-emerald-700">
                          Sudah direstore {formatDateTime(backup.restoredAt)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{backup.actorName ?? "-"}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {backup.actorRole ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={!canRestore}
                        onClick={() => void handleRestore(backup.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default QuestionBackupManager;
