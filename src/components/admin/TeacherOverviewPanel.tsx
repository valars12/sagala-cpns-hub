import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";
import type { AdminTryoutScoreResponse } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { BarChart3, ClipboardCheck, TrendingUp, Users2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const roundPercent = (value: number) => Math.round(value * 10) / 10;

const getAccountIdentifier = (user: { username?: string | null; email?: string }) =>
  user.username?.trim() || user.email || "-";

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short"
  });
};

const TeacherOverviewPanel = () => {
  const [selectedClassId, setSelectedClassId] = useState("ALL");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["teacher-overview-scores", "all"],
    queryFn: async () => {
      const response = await api.get<AdminTryoutScoreResponse>("/api/admin/tryout-scores");
      return response.data.data;
    }
  });

  const classes = data?.classes ?? [];
  const rows = data?.studentSummaries ?? [];

  useEffect(() => {
    if (selectedClassId === "ALL") return;
    if (classes.some((studyClass) => studyClass.id === selectedClassId)) return;
    setSelectedClassId("ALL");
  }, [classes, selectedClassId]);

  const filteredRows = useMemo(
    () =>
      selectedClassId === "ALL"
        ? rows
        : rows.filter((row) => row.classes.some((studyClass) => studyClass.id === selectedClassId)),
    [rows, selectedClassId]
  );

  const rowsWithAttempt = useMemo(
    () => filteredRows.filter((row) => row.latestAttempt !== null),
    [filteredRows]
  );

  const summary = useMemo(() => {
    const attemptCount = rowsWithAttempt.length;
    const averagePercent = attemptCount
      ? rowsWithAttempt.reduce((sum, row) => sum + (row.latestAttempt?.percentage ?? 0), 0) /
        attemptCount
      : 0;

    const completionRate = filteredRows.length
      ? (attemptCount / filteredRows.length) * 100
      : 0;

    return {
      classCount:
        selectedClassId === "ALL"
          ? classes.length
          : classes.filter((studyClass) => studyClass.id === selectedClassId).length,
      studentCount: filteredRows.length,
      attemptCount,
      averagePercent: roundPercent(averagePercent),
      completionRate: roundPercent(completionRate)
    };
  }, [classes, filteredRows, rowsWithAttempt, selectedClassId]);

  const classPerformanceData = useMemo(() => {
    const sourceClasses =
      selectedClassId === "ALL"
        ? classes
        : classes.filter((studyClass) => studyClass.id === selectedClassId);

    return sourceClasses
      .map((studyClass) => {
        const classRows = rows.filter((row) =>
          row.classes.some((currentClass) => currentClass.id === studyClass.id)
        );
        const classRowsWithAttempt = classRows.filter((row) => row.latestAttempt !== null);
        const averagePercent = classRowsWithAttempt.length
          ? classRowsWithAttempt.reduce(
              (sum, row) => sum + (row.latestAttempt?.percentage ?? 0),
              0
            ) / classRowsWithAttempt.length
          : 0;
        return {
          id: studyClass.id,
          kelas: studyClass.name,
          siswa: classRows.length,
          sudahTryout: classRowsWithAttempt.length,
          rataPersen: roundPercent(averagePercent)
        };
      })
      .sort((a, b) => b.rataPersen - a.rataPersen)
      .slice(0, 8);
  }, [classes, rows, selectedClassId]);

  const categoryChartData = useMemo(() => {
    if (!rowsWithAttempt.length) {
      return [
        { name: "TKP", nilai: 0 },
        { name: "TIU", nilai: 0 },
        { name: "TWK", nilai: 0 }
      ];
    }

    const categoryAverage = {
      TKP:
        rowsWithAttempt.reduce((sum, row) => sum + (row.latestAttempt?.scores.TKP ?? 0), 0) /
        rowsWithAttempt.length,
      TIU:
        rowsWithAttempt.reduce((sum, row) => sum + (row.latestAttempt?.scores.TIU ?? 0), 0) /
        rowsWithAttempt.length,
      TWK:
        rowsWithAttempt.reduce((sum, row) => sum + (row.latestAttempt?.scores.TWK ?? 0), 0) /
        rowsWithAttempt.length
    };

    return [
      { name: "TKP", nilai: roundPercent(categoryAverage.TKP) },
      { name: "TIU", nilai: roundPercent(categoryAverage.TIU) },
      { name: "TWK", nilai: roundPercent(categoryAverage.TWK) }
    ];
  }, [rowsWithAttempt]);

  const latestTrendData = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of rowsWithAttempt) {
      const completedAt = row.latestAttempt?.completedAt;
      if (!completedAt) continue;
      const dateKey = new Date(completedAt).toISOString().slice(0, 10);
      grouped.set(dateKey, (grouped.get(dateKey) ?? 0) + 1);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([dateKey, total]) => ({
        tanggal: formatDateLabel(dateKey),
        total
      }));
  }, [rowsWithAttempt]);

  const topStudents = useMemo(
    () =>
      rowsWithAttempt
        .map((row) => ({
          id: row.student.id,
          name: row.student.name,
          username: row.student.username,
          email: row.student.email,
          classes: row.classes,
          percentage: row.latestAttempt?.percentage ?? 0
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 8),
    [rowsWithAttempt]
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        Memuat ringkasan teacher...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700 shadow-sm">
        Gagal memuat ringkasan teacher.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-primary">Monitoring Kinerja Murid</p>
          <p className="text-xs text-muted-foreground">
            Ringkasan nilai dan progres berdasarkan kelas yang Anda ajar.
          </p>
        </div>
        <div className="w-full max-w-[260px]">
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kelas</SelectItem>
              {classes.map((studyClass) => (
                <SelectItem key={studyClass.id} value={studyClass.id}>
                  {studyClass.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Users2 className="h-3.5 w-3.5" />
            Total Kelas
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{summary.classCount}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Total Siswa
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{summary.studentCount}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Siswa Sudah Tryout
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{summary.attemptCount}</p>
          <p className="text-xs text-muted-foreground">{summary.completionRate}% dari total siswa</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Rata-rata Nilai
          </p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{summary.averagePercent}%</p>
          <p className="text-xs text-muted-foreground">Berdasarkan tryout terakhir murid</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm xl:col-span-2">
          <p className="mb-2 text-sm font-semibold text-primary">Performa per Kelas</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Menampilkan rata-rata persentase nilai dan jumlah murid yang sudah tryout.
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="kelas" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="rataPersen" name="Rata-rata %" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="sudahTryout" name="Sudah Tryout" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-primary">Rata-rata Kategori</p>
          <p className="mb-3 text-xs text-muted-foreground">Rata skor TKP, TIU, TWK terbaru.</p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="nilai" name="Nilai" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-primary">Trend Pengerjaan Terakhir</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Distribusi tanggal tryout terakhir dari murid.
          </p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latestTrendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Siswa"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">Top Kinerja Siswa</p>
            <Badge variant="outline" className="rounded-full">
              {topStudents.length} siswa
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Siswa</th>
                  <th className="px-3 py-2 font-semibold">Kelas</th>
                  <th className="px-3 py-2 font-semibold">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {topStudents.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6" colSpan={3}>
                      Belum ada data nilai pada filter kelas ini.
                    </td>
                  </tr>
                ) : (
                  topStudents.map((student) => (
                    <tr key={student.id} className="border-b border-border/40 hover:bg-muted/25">
                      <td className="px-3 py-2">
                        <p className="font-medium text-primary">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{getAccountIdentifier(student)}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {student.classes.map((studyClass) => studyClass.name).join(", ") || "-"}
                      </td>
                      <td className="px-3 py-2 font-semibold text-emerald-700">
                        {student.percentage}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TeacherOverviewPanel;
