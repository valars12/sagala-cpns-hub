import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import api from "@/lib/api-client";
import type {
  AdminClassTryoutAssignmentsResponse,
  AdminPackage,
  AdminPackageSessionsResponse,
  AdminPackagesResponse,
  QuestionSessionType
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { CalendarClock, PlusCircle, Trash2 } from "lucide-react";

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

const toInputDateTime = (value: Date) => {
  const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const getStatusBadge = (startAt: string, endAt: string) => {
  const now = Date.now();
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return {
      label: "Tidak Valid",
      className: "border-rose-300 bg-rose-50 text-rose-700"
    };
  }

  if (now < startTime) {
    return {
      label: "Akan Datang",
      className: "border-amber-300 bg-amber-50 text-amber-700"
    };
  }

  if (now > endTime) {
    return {
      label: "Selesai",
      className: "border-slate-300 bg-slate-100 text-slate-700"
    };
  }

  return {
    label: "Sedang Aktif",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700"
  };
};

const sessionTypeLabel = (value: QuestionSessionType) =>
  value === "TRYOUT" ? "Tryout" : "Latihan";

const TryoutAssignmentManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const now = useMemo(() => new Date(), []);
  const nextTwoHours = useMemo(() => new Date(now.getTime() + 2 * 60 * 60 * 1000), [now]);

  const [filterClassId, setFilterClassId] = useState<string>("ALL");
  const [form, setForm] = useState({
    studyClassId: "",
    packageId: "",
    sessionKey: "",
    startAt: toInputDateTime(now),
    endAt: toInputDateTime(nextTwoHours)
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["class-tryout-assignments", filterClassId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterClassId !== "ALL") {
        params.set("classId", filterClassId);
      }
      const endpoint = params.toString()
        ? `/api/admin/class-tryout-assignments?${params.toString()}`
        : "/api/admin/class-tryout-assignments";
      const response = await api.get<AdminClassTryoutAssignmentsResponse>(endpoint);
      return response.data.data;
    }
  });

  const { data: packages } = useQuery({
    queryKey: ["admin-packages", "assignment-manager"],
    queryFn: async () => {
      const response = await api.get<AdminPackagesResponse>("/api/admin/packages");
      return response.data.data;
    }
  });

  const { data: packageSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["admin-package-sessions", form.packageId],
    queryFn: async () => {
      const response = await api.get<AdminPackageSessionsResponse>(
        `/api/admin/packages/${form.packageId}/sessions`
      );
      return response.data.data;
    },
    enabled: Boolean(form.packageId)
  });

  const classes = data?.classes ?? [];
  const assignments = data?.assignments ?? [];
  const packageRows = packages ?? [];

  useEffect(() => {
    if (!classes.length) return;
    if (form.studyClassId) return;

    setForm((prev) => ({
      ...prev,
      studyClassId: classes[0].id
    }));
  }, [classes, form.studyClassId]);

  useEffect(() => {
    if (!packageRows.length) return;
    if (form.packageId) return;

    setForm((prev) => ({
      ...prev,
      packageId: packageRows[0].id
    }));
  }, [form.packageId, packageRows]);

  useEffect(() => {
    if (!packageSessions?.length) {
      setForm((prev) => ({
        ...prev,
        sessionKey: ""
      }));
      return;
    }

    const isCurrentKeyAvailable = packageSessions.some(
      (session) => `${session.sessionType}:${session.sessionOrder}` === form.sessionKey
    );

    if (!isCurrentKeyAvailable) {
      const firstSession = packageSessions[0];
      setForm((prev) => ({
        ...prev,
        sessionKey: `${firstSession.sessionType}:${firstSession.sessionOrder}`
      }));
    }
  }, [form.sessionKey, packageSessions]);

  const packageMap = useMemo(
    () => new Map(packageRows.map((pkg: AdminPackage) => [pkg.id, pkg])),
    [packageRows]
  );

  const refreshAssignments = async () => {
    await queryClient.invalidateQueries({ queryKey: ["class-tryout-assignments"] });
  };

  const handleCreateAssignment = async () => {
    try {
      if (!form.studyClassId || !form.packageId || !form.sessionKey) {
        toast({
          title: "Data belum lengkap",
          description: "Pilih kelas, paket, dan sesi terlebih dahulu.",
          variant: "destructive"
        });
        return;
      }

      const [sessionTypeRaw, sessionOrderRaw] = form.sessionKey.split(":");
      const sessionType = sessionTypeRaw === "LATIHAN" ? "LATIHAN" : "TRYOUT";
      const sessionOrder = Number(sessionOrderRaw);

      if (!Number.isInteger(sessionOrder) || sessionOrder < 1) {
        toast({
          title: "Nomor sesi tidak valid",
          description: "Periksa kembali sesi yang dipilih.",
          variant: "destructive"
        });
        return;
      }

      await api.post("/api/admin/class-tryout-assignments", {
        studyClassId: form.studyClassId,
        packageId: form.packageId,
        sessionType,
        sessionOrder,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString()
      });

      toast({
        title: "Jadwal berhasil dibuat",
        description: "Siswa di kelas terkait akan mengikuti jadwal ini saat mengerjakan tryout."
      });

      await refreshAssignments();
    } catch (error) {
      toast({
        title: "Gagal membuat jadwal",
        description: getErrorMessage(error, "Terjadi kesalahan saat membuat jadwal tryout kelas."),
        variant: "destructive"
      });
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    const confirmed = window.confirm("Hapus jadwal ini? Siswa tidak bisa lagi mengakses sesi dari jadwal tersebut.");
    if (!confirmed) return;

    try {
      await api.delete(`/api/admin/class-tryout-assignments/${assignmentId}`);
      toast({
        title: "Jadwal dihapus",
        description: "Jadwal tryout kelas berhasil dihapus."
      });
      await refreshAssignments();
    } catch (error) {
      toast({
        title: "Gagal menghapus jadwal",
        description: getErrorMessage(error, "Terjadi kesalahan saat menghapus jadwal."),
        variant: "destructive"
      });
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <CalendarClock className="h-5 w-5" />
          Penjadwalan Tryout Kelas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Guru hanya bisa membuat jadwal untuk kelas yang diajar. Siswa di kelas tersebut hanya
          dapat mengerjakan sesi sesuai tanggal dan jam jadwal.
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="grid gap-2">
            <Label>Kelas</Label>
            <Select
              value={form.studyClassId}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  studyClassId: value
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((studyClass) => (
                  <SelectItem key={studyClass.id} value={studyClass.id}>
                    {studyClass.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Paket</Label>
            <Select
              value={form.packageId}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  packageId: value,
                  sessionKey: ""
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih paket" />
              </SelectTrigger>
              <SelectContent>
                {packageRows.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Sesi</Label>
            <Select
              value={form.sessionKey}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  sessionKey: value
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={sessionsLoading ? "Memuat sesi..." : "Pilih sesi"} />
              </SelectTrigger>
              <SelectContent>
                {(packageSessions ?? []).map((session) => (
                  <SelectItem
                    key={`${session.sessionType}:${session.sessionOrder}`}
                    value={`${session.sessionType}:${session.sessionOrder}`}
                  >
                    {sessionTypeLabel(session.sessionType)} {session.sessionOrder} - {session.questionCount} soal
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="assignment-start">Mulai</Label>
            <Input
              id="assignment-start"
              type="datetime-local"
              value={form.startAt}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  startAt: event.target.value
                }))
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="assignment-end">Selesai</Label>
            <Input
              id="assignment-end"
              type="datetime-local"
              value={form.endAt}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  endAt: event.target.value
                }))
              }
            />
          </div>

          <div className="flex items-end">
            <Button className="w-full gap-2" onClick={() => void handleCreateAssignment()}>
              <PlusCircle className="h-4 w-4" /> Buat Jadwal
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Total jadwal: <span className="font-semibold text-primary">{assignments.length}</span>
        </div>
        <div className="w-full sm:w-[280px]">
          <Select value={filterClassId} onValueChange={setFilterClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter kelas" />
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

      <div className="overflow-x-auto rounded-2xl bg-card shadow-md">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Kelas</th>
              <th className="px-4 py-3 font-semibold">Paket</th>
              <th className="px-4 py-3 font-semibold">Sesi</th>
              <th className="px-4 py-3 font-semibold">Mulai</th>
              <th className="px-4 py-3 font-semibold">Selesai</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Pembuat</th>
              <th className="px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-8" colSpan={8}>
                  Memuat jadwal tryout kelas...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td className="px-4 py-8" colSpan={8}>
                  Gagal memuat jadwal tryout kelas.
                </td>
              </tr>
            ) : assignments.length === 0 ? (
              <tr>
                <td className="px-4 py-8" colSpan={8}>
                  Belum ada jadwal tryout yang dibuat.
                </td>
              </tr>
            ) : (
              assignments.map((assignment) => {
                const status = getStatusBadge(assignment.startAt, assignment.endAt);
                const pkg = packageMap.get(assignment.package.id);
                return (
                  <tr key={assignment.id} className="border-b border-border/40 align-top">
                    <td className="px-4 py-3 font-semibold text-primary">
                      {assignment.studyClass.name}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{assignment.package.title}</p>
                      <p className="text-xs text-muted-foreground">{pkg?.category ?? assignment.package.category}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{assignment.sessionTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.sessionCode} ({sessionTypeLabel(assignment.sessionType)} {assignment.sessionOrder})
                      </p>
                    </td>
                    <td className="px-4 py-3">{formatDateTime(assignment.startAt)}</td>
                    <td className="px-4 py-3">{formatDateTime(assignment.endAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {assignment.createdBy ? (
                        <div>
                          <p className="font-medium text-primary">{assignment.createdBy.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{assignment.createdBy.role}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-2"
                        onClick={() => void handleDeleteAssignment(assignment.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus
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

export default TryoutAssignmentManager;
