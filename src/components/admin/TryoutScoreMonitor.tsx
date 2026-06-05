import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";
import type {
  AdminStudentAttemptHistoryResponse,
  AdminTryoutScoreResponse,
  QuestionSessionType
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { BarChart3, Eye, FileBarChart2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import TablePagination from "@/components/admin/TablePagination";

const SCORE_PAGE_SIZE = 10;

const getAccountIdentifier = (user: { username?: string | null; email?: string }) =>
  user.username?.trim() || user.email || "-";

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

const formatDurationText = (durationMinutes?: number | null) => {
  if (!durationMinutes || durationMinutes <= 0) {
    return "Durasi tidak tersedia";
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (!hours) {
    return `${minutes} menit`;
  }
  if (!minutes) {
    return `${hours} jam`;
  }
  return `${hours} jam ${minutes} menit`;
};

const buildCategorySummary = (scores: {
  TWK: number;
  TIU: number;
  TKP: number;
}) => {
  const orderedEntries: Array<[keyof typeof scores, number]> = [
    ["TWK", scores.TWK],
    ["TIU", scores.TIU],
    ["TKP", scores.TKP]
  ];
  const nonZeroEntries = orderedEntries.filter(([, value]) => value > 0);
  const source = nonZeroEntries.length ? nonZeroEntries : orderedEntries;
  return source.map(([label, value]) => `${label} ${value}`).join(", ");
};

const toSessionLabel = (
  sessionType: QuestionSessionType,
  sessionTitle?: string | null,
  sessionCode?: string | null
) => {
  const typeLabel = sessionType === "TRYOUT" ? "Tryout" : "Latihan";
  const rawName = sessionTitle?.trim() || sessionCode?.trim() || "";
  if (!rawName) return typeLabel;
  const normalized = rawName.toLowerCase();
  const normalizedType = typeLabel.toLowerCase();
  if (normalized.startsWith(normalizedType)) return rawName;
  return `${typeLabel} ${rawName}`;
};

const TryoutScoreMonitor = () => {
  const [selectedClassId, setSelectedClassId] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isChartDialogOpen, setIsChartDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
    username?: string | null;
    email: string;
  } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-tryout-scores", selectedClassId, searchKeyword],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedClassId !== "ALL") {
        params.set("classId", selectedClassId);
      }
      if (searchKeyword.trim()) {
        params.set("search", searchKeyword.trim());
      }

      const endpoint = params.toString()
        ? `/api/admin/tryout-scores?${params.toString()}`
        : "/api/admin/tryout-scores";
      const { data } = await api.get<AdminTryoutScoreResponse>(endpoint);
      return data.data;
    }
  });

  const {
    data: detailData,
    isLoading: isDetailLoading,
    isError: isDetailError
  } = useQuery({
    queryKey: [
      "admin-tryout-score-attempts",
      selectedStudent?.id ?? null,
      selectedClassId
    ],
    queryFn: async () => {
      if (!selectedStudent) {
        return null;
      }
      const params = new URLSearchParams();
      if (selectedClassId !== "ALL") {
        params.set("classId", selectedClassId);
      }
      const endpoint = params.toString()
        ? `/api/admin/tryout-scores/${selectedStudent.id}/attempts?${params.toString()}`
        : `/api/admin/tryout-scores/${selectedStudent.id}/attempts`;

      const { data } = await api.get<AdminStudentAttemptHistoryResponse>(endpoint);
      return data.data;
    },
    enabled: (isDetailDialogOpen || isChartDialogOpen) && Boolean(selectedStudent)
  });

  const rows = data?.studentSummaries ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / SCORE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const startIndex = (safePage - 1) * SCORE_PAGE_SIZE;
    return rows.slice(startIndex, startIndex + SCORE_PAGE_SIZE);
  }, [rows, safePage]);

  const withLatestScore = rows.filter((item) => item.latestAttempt !== null).length;
  const withoutAttempt = rows.length - withLatestScore;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [selectedClassId, searchKeyword]);

  const handleOpenDetail = (student: { id: string; name: string; username?: string | null; email: string }) => {
    setSelectedStudent(student);
    setIsDetailDialogOpen(true);
  };

  const handleOpenChart = (student: { id: string; name: string; username?: string | null; email: string }) => {
    setSelectedStudent(student);
    setIsChartDialogOpen(true);
  };

  const chartData = useMemo(() => {
    if (!detailData?.attempts.length) return [];

    const sortedAttempts = [...detailData.attempts].sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );
    const recentAttempts = sortedAttempts.slice(-12);

    return recentAttempts.map((attempt, index) => ({
      index: index + 1,
      sesi: toSessionLabel(attempt.sessionType, attempt.sessionTitle, attempt.sessionCode),
      TIU: attempt.scores.TIU,
      TWK: attempt.scores.TWK,
      TKP: attempt.scores.TKP,
      total: attempt.scores.total,
      persentase: attempt.percentage
    }));
  }, [detailData?.attempts]);

  const weakestCategoryInsight = useMemo(() => {
    if (!chartData.length) return null;

    const averageByCategory = {
      TIU: chartData.reduce((sum, item) => sum + item.TIU, 0) / chartData.length,
      TWK: chartData.reduce((sum, item) => sum + item.TWK, 0) / chartData.length,
      TKP: chartData.reduce((sum, item) => sum + item.TKP, 0) / chartData.length
    };
    const weakest = (Object.entries(averageByCategory) as Array<[keyof typeof averageByCategory, number]>)
      .sort((a, b) => a[1] - b[1])[0];

    if (!weakest) return null;

    const strongest = (Object.entries(averageByCategory) as Array<[keyof typeof averageByCategory, number]>)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      weakestCategory: weakest[0],
      weakestAverage: weakest[1],
      strongestCategory: strongest[0],
      strongestAverage: strongest[1]
    };
  }, [chartData]);

  useEffect(() => {
    if (!isDetailDialogOpen && !isChartDialogOpen) {
      setSelectedStudent(null);
    }
  }, [isChartDialogOpen, isDetailDialogOpen]);

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
              <FileBarChart2 className="h-5 w-5" />
              Monitoring Nilai Tryout Siswa
            </h2>
            <p className="text-sm text-muted-foreground">
              Guru hanya melihat nilai: TKP, TIU, TWK, dan total per siswa.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="sm:w-[220px]">
                <SelectValue placeholder="Filter kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Kelas</SelectItem>
                {(data?.classes ?? []).map((studyClass) => (
                  <SelectItem key={studyClass.id} value={studyClass.id}>
                    {studyClass.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="Cari nama/username siswa"
              className="sm:w-[240px]"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Siswa</p>
            <p className="mt-1 text-2xl font-bold text-primary">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Sudah Ada Nilai
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{withLatestScore}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Belum Ada Pengerjaan
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{withoutAttempt}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-card shadow-md">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Siswa</th>
                <th className="px-4 py-3 font-semibold">Kelas</th>
                <th className="px-4 py-3 font-semibold">TIU</th>
                <th className="px-4 py-3 font-semibold">TWK</th>
                <th className="px-4 py-3 font-semibold">TKP</th>
                <th className="px-4 py-3 font-semibold">Total Nilai</th>
                <th className="px-4 py-3 font-semibold">Persen</th>
                <th className="px-4 py-3 font-semibold">Tryout Terakhir</th>
                <th className="px-4 py-3 font-semibold">Jumlah Percobaan</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8" colSpan={9}>
                    Memuat rekap nilai tryout...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td className="px-4 py-8" colSpan={9}>
                    Gagal memuat data nilai tryout.
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8" colSpan={9}>
                    Tidak ada data siswa untuk filter saat ini.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const latest = row.latestAttempt;
                  return (
                    <tr
                      key={row.student.id}
                      className="border-b border-border/40 align-top transition-colors hover:bg-muted/25"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-primary">{row.student.name}</p>
                        <p className="text-xs text-muted-foreground">{getAccountIdentifier(row.student)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-[220px] flex-wrap gap-1.5">
                          {row.classes.length ? (
                            row.classes.map((studyClass) => (
                              <Badge
                                key={studyClass.id}
                                variant="outline"
                                className="rounded-full text-[11px]"
                              >
                                {studyClass.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Belum ada kelas</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {latest ? latest.scores.TIU : "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {latest ? latest.scores.TWK : "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {latest ? latest.scores.TKP : "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-primary">
                        {latest ? `${latest.scores.total}/${latest.scores.maxScore}` : "-"}
                      </td>
                      <td className="px-4 py-3">{latest ? `${latest.percentage}%` : "-"}</td>
                      <td className="px-4 py-3">
                        {latest ? (
                          <div>
                            <p className="font-medium text-primary">{latest.package.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {latest.sessionTitle ?? latest.sessionCode ?? "-"} |{" "}
                              {formatDateTime(latest.completedAt)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Belum ada tryout
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 rounded-full"
                            onClick={() => handleOpenDetail(row.student)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {row.totalAttempts}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 rounded-full"
                            onClick={() => handleOpenChart(row.student)}
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                            Grafik
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {!isLoading && !isError && (
            <TablePagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={rows.length}
              pageSize={SCORE_PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </div>
      </section>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detail Hasil Pengerjaan - {selectedStudent?.name ?? "-"}
            </DialogTitle>
          </DialogHeader>
          {isDetailLoading ? (
            <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
              Memuat detail hasil siswa...
            </div>
          ) : isDetailError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Gagal memuat detail hasil siswa.
            </div>
          ) : !detailData?.attempts.length ? (
            <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
              Belum ada riwayat pengerjaan tryout/latihan untuk siswa ini.
            </div>
          ) : (
            <div className="space-y-3">
              {detailData.attempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-primary">
                      {toSessionLabel(
                        attempt.sessionType,
                        attempt.sessionTitle,
                        attempt.sessionCode
                      )}
                    </p>
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      {attempt.sessionType}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {attempt.package.title} ({attempt.package.category})
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    {buildCategorySummary(attempt.scores)} | Total {attempt.scores.total}/
                    {attempt.scores.maxScore} ({attempt.percentage}%)
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selesai: {formatDateTime(attempt.completedAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Lama mengerjakan: {formatDurationText(attempt.durationMinutes)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isChartDialogOpen} onOpenChange={setIsChartDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Grafik Monitoring - {selectedStudent?.name ?? "-"}
            </DialogTitle>
          </DialogHeader>
          {isDetailLoading ? (
            <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
              Memuat grafik siswa...
            </div>
          ) : isDetailError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Gagal memuat data grafik siswa.
            </div>
          ) : !chartData.length ? (
            <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
              Belum ada data tryout/latihan untuk ditampilkan dalam grafik.
            </div>
          ) : (
            <div className="space-y-4">
              {weakestCategoryInsight && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Jumlah Percobaan (grafik)
                    </p>
                    <p className="mt-1 text-xl font-bold text-primary">{chartData.length}</p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-rose-700">
                      Perlu Fokus
                    </p>
                    <p className="mt-1 text-lg font-semibold text-rose-700">
                      {weakestCategoryInsight.weakestCategory}
                    </p>
                    <p className="text-xs text-rose-700/80">
                      Rata-rata {Math.round(weakestCategoryInsight.weakestAverage)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">
                      Paling Kuat
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-700">
                      {weakestCategoryInsight.strongestCategory}
                    </p>
                    <p className="text-xs text-emerald-700/80">
                      Rata-rata {Math.round(weakestCategoryInsight.strongestAverage)}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border/70 bg-card p-3">
                <div className="mb-2 text-xs text-muted-foreground">
                  Grafik maksimal menampilkan 12 percobaan terbaru.
                </div>
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis dataKey="index" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value}`,
                          name
                        ]}
                        labelFormatter={(value) => {
                          const point = chartData.find((item) => item.index === value);
                          return point ? `Percobaan ${value} - ${point.sesi}` : `Percobaan ${value}`;
                        }}
                      />
                      <Legend />
                      <Bar dataKey="TIU" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="TWK" fill="#10b981" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="TKP" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TryoutScoreMonitor;
