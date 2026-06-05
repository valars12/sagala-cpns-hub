import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import api from "@/lib/api-client";
import type { AdminClassesResponse, AdminStudyClass } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Pencil, PlusCircle, Trash2, Users } from "lucide-react";

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

const getErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError(error) ? error.response?.data?.message ?? fallback : fallback;

const getAccountIdentifier = (user: { username?: string | null; email?: string }) =>
  user.username?.trim() || user.email || "-";

type ClassManagerProps = {
  canManage: boolean;
  isAdmin: boolean;
};

const ClassManager = ({ canManage, isAdmin }: ClassManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState<AdminStudyClass | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    teacherIds: [] as string[],
    studentIds: [] as string[]
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => {
      const { data } = await api.get<AdminClassesResponse>("/api/admin/classes");
      return data.data;
    },
    enabled: canManage
  });

  const classRows = data?.classes ?? [];
  const teacherRows = data?.teachers ?? [];
  const studentRows = data?.students ?? [];
  const selectedClassIdSet = useMemo(() => new Set(selectedClassIds), [selectedClassIds]);
  const selectedRows = useMemo(
    () => classRows.filter((studyClass) => selectedClassIdSet.has(studyClass.id)),
    [classRows, selectedClassIdSet]
  );
  const isAllClassesSelected =
    classRows.length > 0 && selectedRows.length === classRows.length;
  const hasSomeClassesSelected = selectedRows.length > 0 && !isAllClassesSelected;

  const filteredTeachers = useMemo(() => {
    const keyword = teacherSearch.trim().toLowerCase();
    if (!keyword) return teacherRows;
    return teacherRows.filter(
      (teacher) =>
        teacher.name.toLowerCase().includes(keyword) ||
        getAccountIdentifier(teacher).toLowerCase().includes(keyword)
    );
  }, [teacherRows, teacherSearch]);

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    if (!keyword) return studentRows;
    return studentRows.filter(
      (student) =>
        student.name.toLowerCase().includes(keyword) ||
        getAccountIdentifier(student).toLowerCase().includes(keyword)
    );
  }, [studentRows, studentSearch]);

  const refreshClasses = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
  };

  const openCreateClass = () => {
    setSelectedClass(null);
    setTeacherSearch("");
    setStudentSearch("");
    setForm({
      name: "",
      description: "",
      teacherIds: [],
      studentIds: []
    });
    setIsDialogOpen(true);
  };

  const openEditClass = (studyClass: AdminStudyClass) => {
    setSelectedClass(studyClass);
    setTeacherSearch("");
    setStudentSearch("");
    setForm({
      name: studyClass.name,
      description: studyClass.description ?? "",
      teacherIds: studyClass.teachers.map((teacher) => teacher.id),
      studentIds: studyClass.students.map((student) => student.id)
    });
    setIsDialogOpen(true);
  };

  const handleToggleClassSelection = (classId: string, checked: boolean) => {
    setSelectedClassIds((prev) =>
      checked ? Array.from(new Set([...prev, classId])) : prev.filter((id) => id !== classId)
    );
  };

  const handleToggleSelectAllClasses = (checked: boolean) => {
    if (checked) {
      setSelectedClassIds(classRows.map((studyClass) => studyClass.id));
      return;
    }
    setSelectedClassIds([]);
  };

  const handleOpenEditSelectedClass = () => {
    if (selectedRows.length !== 1) return;
    openEditClass(selectedRows[0]);
  };

  const handleToggleTeacher = (teacherId: string, checked: boolean) => {
    setForm((prev) => {
      const next = new Set(prev.teacherIds);
      if (checked) {
        next.add(teacherId);
      } else {
        next.delete(teacherId);
      }
      return {
        ...prev,
        teacherIds: Array.from(next)
      };
    });
  };

  const handleToggleStudent = (studentId: string, checked: boolean) => {
    setForm((prev) => {
      const next = new Set(prev.studentIds);
      if (checked) {
        next.add(studentId);
      } else {
        next.delete(studentId);
      }
      return {
        ...prev,
        studentIds: Array.from(next)
      };
    });
  };

  const handleSaveClass = async () => {
    try {
      const payload = {
        name: form.name,
        description: form.description,
        ...(isAdmin ? { teacherIds: form.teacherIds } : {}),
        studentIds: form.studentIds
      };

      if (selectedClass) {
        await api.patch(`/api/admin/classes/${selectedClass.id}`, payload);
      } else {
        await api.post("/api/admin/classes", payload);
      }

      toast({
        title: selectedClass ? "Kelas diperbarui" : "Kelas ditambahkan",
        description: selectedClass
          ? "Perubahan data kelas berhasil disimpan."
          : "Kelas baru berhasil dibuat."
      });
      setIsDialogOpen(false);
      await refreshClasses();
    } catch (error) {
      toast({
        title: "Gagal menyimpan kelas",
        description: getErrorMessage(error, "Terjadi kesalahan saat menyimpan kelas."),
        variant: "destructive"
      });
    }
  };

  const handleDeleteClass = async (studyClass: AdminStudyClass) => {
    const confirmed = window.confirm(
      `Hapus kelas "${studyClass.name}"? Anggota guru dan siswa di kelas ini juga akan dilepas.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/api/admin/classes/${studyClass.id}`);
      toast({
        title: "Kelas dihapus",
        description: "Kelas berhasil dihapus."
      });
      await refreshClasses();
    } catch (error) {
      toast({
        title: "Gagal menghapus kelas",
        description: getErrorMessage(error, "Terjadi kesalahan saat menghapus kelas."),
        variant: "destructive"
      });
    }
  };

  const handleDeleteSelectedClasses = async () => {
    if (!selectedRows.length) return;

    const confirmed = window.confirm(
      `Hapus ${selectedRows.length} kelas terpilih? Seluruh relasi guru/siswa di kelas tersebut akan dilepas.`
    );
    if (!confirmed) return;

    const results = await Promise.allSettled(
      selectedRows.map((studyClass) => api.delete(`/api/admin/classes/${studyClass.id}`))
    );
    const successCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      toast({
        title: "Hapus kelas selesai",
        description:
          failedCount > 0
            ? `${successCount} kelas berhasil dihapus, ${failedCount} kelas gagal dihapus.`
            : `${successCount} kelas berhasil dihapus.`
      });
    } else {
      toast({
        title: "Gagal menghapus kelas",
        description: "Semua kelas terpilih gagal dihapus.",
        variant: "destructive"
      });
    }

    setSelectedClassIds([]);
    await refreshClasses();
  };

  useEffect(() => {
    const visibleClassIdSet = new Set(classRows.map((studyClass) => studyClass.id));
    setSelectedClassIds((prev) => prev.filter((id) => visibleClassIdSet.has(id)));
  }, [classRows]);

  if (!canManage) {
    return null;
  }

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-primary">Manajemen Kelas</h2>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Buat kelas, lalu tetapkan guru dan siswa yang tergabung di dalam kelas."
                : "Kelola kelas yang Anda ajar, termasuk edit nama, deskripsi, dan daftar siswa."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1.5">
              {selectedRows.length}/{classRows.length} kelas dipilih
            </Badge>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={selectedRows.length !== 1}
              onClick={handleOpenEditSelectedClass}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Terpilih
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={selectedRows.length === 0}
              onClick={() => void handleDeleteSelectedClasses()}
            >
              <Trash2 className="h-3.5 w-3.5" /> Hapus Terpilih
            </Button>
            <Button className="gap-2" onClick={openCreateClass}>
              <PlusCircle className="h-4 w-4" /> Buat Kelas
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-card shadow-md">
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  <Checkbox
                    checked={
                      isAllClassesSelected ? true : hasSomeClassesSelected ? "indeterminate" : false
                    }
                    onCheckedChange={(value) => handleToggleSelectAllClasses(Boolean(value))}
                    aria-label="Pilih semua kelas"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Nama Kelas</th>
                <th className="px-4 py-3 font-semibold">Deskripsi</th>
                <th className="px-4 py-3 font-semibold">Guru</th>
                <th className="px-4 py-3 font-semibold">Siswa</th>
                <th className="px-4 py-3 font-semibold">Diperbarui</th>
                <th className="px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8" colSpan={7}>
                    Memuat data kelas...
                  </td>
                </tr>
              ) : classRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8" colSpan={7}>
                    Belum ada kelas dibuat.
                  </td>
                </tr>
              ) : (
                classRows.map((studyClass) => (
                  <tr
                    key={studyClass.id}
                    className="border-b border-border/40 align-top transition-colors hover:bg-muted/25"
                  >
                    <td className="px-4 py-3 align-top">
                      <Checkbox
                        checked={selectedClassIdSet.has(studyClass.id)}
                        onCheckedChange={(value) =>
                          handleToggleClassSelection(studyClass.id, Boolean(value))
                        }
                        aria-label={`Pilih kelas ${studyClass.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-primary">{studyClass.name}</p>
                      {studyClass.createdBy && (
                        <p className="text-xs text-muted-foreground">
                          Dibuat oleh {studyClass.createdBy.name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[280px]">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {studyClass.description || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[260px] flex-wrap gap-1.5">
                        {studyClass.teachers.slice(0, 3).map((teacher) => (
                          <Badge key={teacher.id} variant="outline" className="rounded-full text-[11px]">
                            {teacher.name}
                          </Badge>
                        ))}
                        {studyClass.teachers.length > 3 && (
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            +{studyClass.teachers.length - 3}
                          </Badge>
                        )}
                        {studyClass.teachers.length === 0 && (
                          <span className="text-xs text-muted-foreground">Belum ada guru</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[260px] flex-wrap gap-1.5">
                        {studyClass.students.slice(0, 4).map((student) => (
                          <Badge key={student.id} variant="outline" className="rounded-full text-[11px]">
                            {student.name}
                          </Badge>
                        ))}
                        {studyClass.students.length > 4 && (
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            +{studyClass.students.length - 4}
                          </Badge>
                        )}
                        {studyClass.students.length === 0 && (
                          <span className="text-xs text-muted-foreground">Belum ada siswa</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatDateTime(studyClass.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => openEditClass(studyClass)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          onClick={() => handleDeleteClass(studyClass)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedClass ? "Edit Kelas" : "Buat Kelas Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="class-name">Nama Kelas</Label>
              <Input
                id="class-name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Contoh: Kelas Alpha"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="class-description">Deskripsi (opsional)</Label>
              <Textarea
                id="class-description"
                className="min-h-20"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value
                  }))
                }
                placeholder="Catatan singkat tentang kelas ini"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {isAdmin ? (
                <div className="space-y-2 rounded-2xl border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-2 text-base text-primary">
                      <Users className="h-4 w-4" /> Daftar Guru
                    </Label>
                    <Badge variant="outline" className="rounded-full">
                      {form.teacherIds.length} terpilih
                    </Badge>
                  </div>
                  <Input
                    value={teacherSearch}
                    onChange={(event) => setTeacherSearch(event.target.value)}
                    placeholder="Cari nama/username guru"
                  />
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {filteredTeachers.map((teacher) => (
                      <label
                        key={teacher.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-primary">{teacher.name}</p>
                          <p className="text-xs text-muted-foreground">{getAccountIdentifier(teacher)}</p>
                        </div>
                        <Checkbox
                          checked={form.teacherIds.includes(teacher.id)}
                          onCheckedChange={(value) =>
                            handleToggleTeacher(teacher.id, Boolean(value))
                          }
                        />
                      </label>
                    ))}
                    {filteredTeachers.length === 0 && (
                      <p className="text-xs text-muted-foreground">Guru tidak ditemukan.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 rounded-2xl border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-2 text-base text-primary">
                      <Users className="h-4 w-4" /> Guru Pengampu
                    </Label>
                    <Badge variant="outline" className="rounded-full">
                      {selectedClass?.teachers.length ?? 1} guru
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Teacher hanya dapat mengelola kelas yang diampu. Penugasan guru dikelola admin.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedClass?.teachers ?? []).map((teacher) => (
                      <Badge key={teacher.id} variant="outline" className="rounded-full text-[11px]">
                        {teacher.name}
                      </Badge>
                    ))}
                    {!selectedClass && (
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        Otomatis: akun teacher aktif
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-2xl border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-2 text-base text-primary">
                    <Users className="h-4 w-4" /> Daftar Siswa
                  </Label>
                  <Badge variant="outline" className="rounded-full">
                    {form.studentIds.length} terpilih
                  </Badge>
                </div>
                <Input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Cari nama/username siswa"
                />
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {filteredStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-primary">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{getAccountIdentifier(student)}</p>
                      </div>
                      <Checkbox
                        checked={form.studentIds.includes(student.id)}
                        onCheckedChange={(value) =>
                          handleToggleStudent(student.id, Boolean(value))
                        }
                      />
                    </label>
                  ))}
                  {filteredStudents.length === 0 && (
                    <p className="text-xs text-muted-foreground">Siswa tidak ditemukan.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveClass}>
              {selectedClass ? "Simpan Perubahan" : "Buat Kelas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClassManager;
