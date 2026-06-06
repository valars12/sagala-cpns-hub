import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import logo from "@/assets/sagalalogo-fix.png";
import PackageQuestionManager from "@/components/admin/PackageQuestionManager";
import ModuleManager from "@/components/admin/ModuleManager";
import ClassManager from "@/components/admin/ClassManager";
import TryoutScoreMonitor from "@/components/admin/TryoutScoreMonitor";
import TryoutAssignmentManager from "@/components/admin/TryoutAssignmentManager";
import QuestionBackupManager from "@/components/admin/QuestionBackupManager";
import TeacherOverviewPanel from "@/components/admin/TeacherOverviewPanel";
import TablePagination from "@/components/admin/TablePagination";
import type {
  AdminOverviewResponse,
  AdminPackage,
  AdminPackagesResponse,
  AdminPayment,
  AdminUser,
  PurchaseStatus,
  RegistrationSource,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Archive,
  BadgeCheck,
  BookOpenText,
  Boxes,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  CircleDollarSign,
  ListTodo,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users2,
  Users,
  Wallet,
} from "lucide-react";

const ADMIN_TABLE_PAGE_SIZE = 10;
const ADMIN_PAYMENT_PAGE_SIZE = 5;

const statusStyles: Record<
  PurchaseStatus,
  { label: string; className: string }
> = {
  PAID: {
    label: "Berhasil",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  PENDING: {
    label: "Menunggu",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  EXPIRED: {
    label: "Kedaluwarsa",
    className: "bg-rose-100 text-rose-700 border-rose-200",
  },
  CANCELED: {
    label: "Dibatalkan",
    className: "bg-slate-200 text-slate-600 border-slate-300",
  },
};

const paymentMethodLabels: Record<string, string> = {
  all: "Semua Metode",
  bank_transfer: "Transfer Bank",
  e_wallet: "E-Wallet",
  qris: "QRIS",
  credit_card: "Kartu Kredit",
  cstore: "Minimarket",
};

const userRoleFilterLabels: Record<"ALL" | "admin" | "teacher" | "student", string> = {
  ALL: "Semua Role",
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
};

const userSortOptionLabels: Record<"NEWEST" | "OLDEST" | "A_Z" | "Z_A", string> = {
  NEWEST: "Tanggal Terbaru",
  OLDEST: "Tanggal Terlama",
  A_Z: "Nama A-Z",
  Z_A: "Nama Z-A",
};

const studentSourceFilterLabels: Record<
  "ALL" | "SELF_REGISTERED" | "ADMIN_CREATED" | "UNKNOWN",
  string
> = {
  ALL: "Semua Sumber Siswa",
  SELF_REGISTERED: "Daftar Sendiri",
  ADMIN_CREATED: "Input Admin",
  UNKNOWN: "Belum Ditentukan",
};

const registrationSourceLabels: Record<RegistrationSource, string> = {
  SELF_REGISTERED: "Daftar Sendiri",
  ADMIN_CREATED: "Input Admin",
  UNKNOWN: "Belum Ditentukan",
};

const registrationSourceBadgeClassNames: Record<RegistrationSource, string> = {
  SELF_REGISTERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ADMIN_CREATED: "border-amber-200 bg-amber-50 text-amber-700",
  UNKNOWN: "border-slate-200 bg-slate-100 text-slate-700",
};

type UserRoleFilter = "ALL" | "admin" | "teacher" | "student";
type StudentSourceFilter = "ALL" | RegistrationSource;
type UserSortOption = "NEWEST" | "OLDEST" | "A_Z" | "Z_A";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatInputDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

type AdminPanelSection =
  | "overview"
  | "users"
  | "payments"
  | "classes"
  | "assignments"
  | "scores"
  | "questions"
  | "packages"
  | "backups"
  | "modules";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const isStaff = isAdmin || user?.role === "teacher";
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "ALL">(
    "PAID"
  );
  const [userRoleFilter, setUserRoleFilter] = useState<
    UserRoleFilter
  >("ALL");
  const [userSortOption, setUserSortOption] = useState<UserSortOption>("A_Z");
  const [studentSourceFilter, setStudentSourceFilter] =
    useState<StudentSourceFilter>("ALL");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(
    null
  );
  const [selectedAccessUser, setSelectedAccessUser] = useState<AdminUser | null>(
    null
  );
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [accessPackageIds, setAccessPackageIds] = useState<string[]>([]);
  const [lockedPackageIds, setLockedPackageIds] = useState<string[]>([]);
  const [expandedAccessPackageIds, setExpandedAccessPackageIds] = useState<string[]>([]);
  const [userForm, setUserForm] = useState({
    name: "",
    username: "",
    phone: "",
    role: "student",
    registrationSource: "UNKNOWN" as RegistrationSource,
    isValidated: true,
    password: "",
  });
  const [createForm, setCreateForm] = useState({
    name: "",
    username: "",
    phone: "",
    role: "student",
    isValidated: true,
    password: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    status: "PENDING" as PurchaseStatus,
    paymentType: "",
    paidAt: "",
  });
  const [activeSection, setActiveSection] = useState<AdminPanelSection>("overview");
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSectionContentVisible, setIsSectionContentVisible] = useState(true);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data } = await api.get<AdminOverviewResponse>("/api/admin/overview");
      return data.data;
    },
    enabled: Boolean(isAdmin),
  });

  const { data: packages } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => {
      const { data } = await api.get<AdminPackagesResponse>("/api/admin/packages");
      return data.data;
    },
    enabled: Boolean(isStaff),
  });

  const filteredPayments = useMemo(() => {
    if (!data?.payments) return [];
    if (statusFilter === "ALL") return data.payments;
    return data.payments.filter((payment) => payment.status === statusFilter);
  }, [data?.payments, statusFilter]);

  const users = data?.users ?? [];
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (userSortOption === "NEWEST") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (userSortOption === "OLDEST") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (userSortOption === "Z_A") {
        return b.name.localeCompare(a.name, "id", { sensitivity: "base" });
      }
      return a.name.localeCompare(b.name, "id", { sensitivity: "base" });
    });
  }, [users, userSortOption]);
  const filteredUsers = useMemo(() => {
    let rows = sortedUsers;

    if (userRoleFilter !== "ALL") {
      rows = rows.filter((userItem) => userItem.role === userRoleFilter);
    }

    if (studentSourceFilter !== "ALL") {
      rows = rows.filter(
        (userItem) =>
          userItem.role === "student" &&
          userItem.registrationSource === studentSourceFilter
      );
    }

    return rows;
  }, [sortedUsers, userRoleFilter, studentSourceFilter]);
  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / ADMIN_TABLE_PAGE_SIZE)
  );
  const safeUserPage = Math.min(userPage, totalUserPages);
  const paginatedUsers = useMemo(() => {
    const startIndex = (safeUserPage - 1) * ADMIN_TABLE_PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + ADMIN_TABLE_PAGE_SIZE);
  }, [filteredUsers, safeUserPage]);
  const selectedUserIdSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
  const selectedUsersOnPageCount = useMemo(
    () => paginatedUsers.filter((userItem) => selectedUserIdSet.has(userItem.id)).length,
    [paginatedUsers, selectedUserIdSet]
  );
  const isAllUsersOnPageSelected =
    paginatedUsers.length > 0 && selectedUsersOnPageCount === paginatedUsers.length;
  const hasSomeUsersOnPageSelected =
    selectedUsersOnPageCount > 0 && !isAllUsersOnPageSelected;

  const totalPaymentPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / ADMIN_PAYMENT_PAGE_SIZE)
  );
  const safePaymentPage = Math.min(paymentPage, totalPaymentPages);
  const paginatedPayments = useMemo(() => {
    const startIndex = (safePaymentPage - 1) * ADMIN_PAYMENT_PAGE_SIZE;
    return filteredPayments.slice(startIndex, startIndex + ADMIN_PAYMENT_PAGE_SIZE);
  }, [filteredPayments, safePaymentPage]);

  const panelSections = useMemo(() => {
    const sharedSections = [
      {
        id: "overview" as const,
        title: "Ringkasan",
        description: isAdmin
          ? "Ringkasan total akun, transaksi, dan pendapatan."
          : "Ringkasan kinerja murid per kelas yang diajar.",
        icon: BarChart3,
      },
      {
        id: "scores" as const,
        title: "Nilai",
        description: "Monitoring nilai tryout siswa.",
        icon: Users2,
      },
      {
        id: "assignments" as const,
        title: "Jadwal",
        description: "Atur jadwal tryout per kelas.",
        icon: CalendarClock,
      },
      {
        id: "classes" as const,
        title: "Kelas",
        description: isAdmin
          ? "Manajemen kelas siswa dan teacher."
          : "Edit kelas yang diajar dan pantau anggotanya.",
        icon: ShieldCheck,
      },
      {
        id: "questions" as const,
        title: "Bank Soal",
        description: "Kelola sesi dan soal tryout/latihan.",
        icon: ListTodo,
      },
      {
        id: "modules" as const,
        title: "Modul",
        description: "Kelola modul materi dan akses.",
        icon: BookOpenText,
      },
    ];

    if (!isAdmin) {
      return sharedSections;
    }

    return [
      {
        id: "users" as const,
        title: "Akun",
        description: "Validasi dan manajemen akun.",
        icon: Users,
      },
      {
        id: "payments" as const,
        title: "Bayar",
        description: "Riwayat dan status pembayaran.",
        icon: CreditCard,
      },
      sharedSections.find((section) => section.id === "classes")!,
      sharedSections.find((section) => section.id === "overview")!,
      sharedSections.find((section) => section.id === "scores")!,
      sharedSections.find((section) => section.id === "assignments")!,
      sharedSections.find((section) => section.id === "questions")!,
      {
        id: "packages" as const,
        title: "Paket Bimbel",
        description: "Manajemen paket bimbel dan pengaturannya.",
        icon: Boxes,
      },
      {
        id: "backups" as const,
        title: "Backup Soal",
        description: "Riwayat backup bank soal dan restore data.",
        icon: Archive,
      },
      sharedSections.find((section) => section.id === "modules")!,
    ];
  }, [isAdmin]);

  useEffect(() => {
    if (!panelSections.some((section) => section.id === activeSection)) {
      setActiveSection("overview");
    }
  }, [activeSection, isAdmin, panelSections]);

  const activeSectionMeta = useMemo(
    () => panelSections.find((section) => section.id === activeSection),
    [activeSection, panelSections]
  );

  useEffect(() => {
    setIsSectionContentVisible(false);
    const frame = window.requestAnimationFrame(() => {
      setIsSectionContentVisible(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection]);

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(totalUserPages);
    }
  }, [totalUserPages, userPage]);

  useEffect(() => {
    if (paymentPage > totalPaymentPages) {
      setPaymentPage(totalPaymentPages);
    }
  }, [paymentPage, totalPaymentPages]);

  useEffect(() => {
    if (!filteredUsers.length) {
      setSelectedUserIds([]);
      return;
    }

    const visibleIdSet = new Set(filteredUsers.map((userItem) => userItem.id));
    setSelectedUserIds((prev) => prev.filter((id) => visibleIdSet.has(id)));
  }, [filteredUsers]);

  const refreshOverview = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const openCreateUser = () => {
    setCreateForm({
      name: "",
      username: "",
      phone: "",
      role: "student",
      isValidated: true,
      password: "",
    });
    setIsCreateUserOpen(true);
  };

  const openEditUser = (userItem: AdminUser) => {
    setSelectedUser(userItem);
    setUserForm({
      name: userItem.name,
      username: userItem.username ?? "",
      phone: userItem.phone ?? "",
      role: userItem.role,
      registrationSource: userItem.registrationSource,
      isValidated: userItem.isValidated,
      password: "",
    });
    setIsUserDialogOpen(true);
  };

  const openEditPayment = (payment: AdminPayment) => {
    setSelectedPayment(payment);
    setPaymentForm({
      status: payment.status,
      paymentType: payment.paymentType ?? "",
      paidAt: formatInputDateTime(payment.paidAt),
    });
    setIsPaymentDialogOpen(true);
  };

  const openAccessDialog = (userItem: AdminUser) => {
    const paidPayments = (data?.payments ?? []).filter(
      (payment) => payment.user.id === userItem.id && payment.status === "PAID"
    );
    const selected = Array.from(new Set(paidPayments.map((payment) => payment.package.id)));
    const locked = Array.from(
      new Set(
        paidPayments
          .filter((payment) => !payment.isAdminGranted)
          .map((payment) => payment.package.id)
      )
    );

    setSelectedAccessUser(userItem);
    setAccessPackageIds(selected);
    setLockedPackageIds(locked);
    setExpandedAccessPackageIds([]);
    setIsAccessDialogOpen(true);
  };

  const handleToggleAccessPackage = (packageId: string, checked: boolean) => {
    if (lockedPackageIds.includes(packageId)) return;

    setAccessPackageIds((prev) =>
      checked
        ? Array.from(new Set([...prev, packageId]))
        : prev.filter((id) => id !== packageId)
    );
  };

  const handleToggleAccessPackageDetail = (packageId: string) => {
    setExpandedAccessPackageIds((prev) =>
      prev.includes(packageId)
        ? prev.filter((id) => id !== packageId)
        : [...prev, packageId]
    );
  };

  const applyAccessPackagePreset = (
    predicate: (pkg: AdminPackage) => boolean
  ) => {
    const lockedIds = new Set(lockedPackageIds);
    const next = new Set(lockedPackageIds);

    for (const pkg of packages ?? []) {
      if (lockedIds.has(pkg.id)) {
        next.add(pkg.id);
        continue;
      }
      if (predicate(pkg)) {
        next.add(pkg.id);
      }
    }

    setAccessPackageIds(Array.from(next));
  };

  const applyAccessPackageTextPreset = (keyword: string) => {
    const normalizedKeyword = keyword.toLowerCase();
    applyAccessPackagePreset((pkg) =>
      [pkg.title, pkg.category, pkg.badge, pkg.level]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedKeyword))
    );
  };

  const handleSelectAllAccessPackages = () => {
    setAccessPackageIds((prev) => {
      const next = new Set(prev);
      for (const pkg of packages ?? []) {
        next.add(pkg.id);
      }
      return Array.from(next);
    });
  };

  const handleClearAccessPackages = () => {
    const lockedIds = new Set(lockedPackageIds);
    setAccessPackageIds((prev) => prev.filter((id) => lockedIds.has(id)));
  };

  const handleSaveUserAccess = async () => {
    if (!selectedAccessUser) return;

    try {
      await api.put(`/api/admin/users/${selectedAccessUser.id}/access`, {
        packageIds: accessPackageIds,
      });
      toast({
        title: "Hak akses diperbarui",
        description: "Akses paket tryout siswa berhasil di-ACC.",
      });
      setIsAccessDialogOpen(false);
      await refreshOverview();
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal memperbarui hak akses."
        : "Gagal memperbarui hak akses.";
      toast({
        title: "Gagal memperbarui hak akses",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleCreateUser = async () => {
    try {
      await api.post("/api/admin/users", {
        name: createForm.name,
        username: createForm.username,
        phone: createForm.phone,
        role: createForm.role,
        isValidated: createForm.role === "student" ? createForm.isValidated : true,
        password: createForm.password,
      });
      toast({
        title: "Akun dibuat",
        description: "Akun baru berhasil ditambahkan.",
      });
      setIsCreateUserOpen(false);
      await refreshOverview();
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal membuat akun."
        : "Gagal membuat akun.";
      toast({
        title: "Gagal membuat akun",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await api.patch(`/api/admin/users/${selectedUser.id}`, {
        name: userForm.name,
        username: userForm.username,
        phone: userForm.phone,
        role: userForm.role,
        registrationSource:
          userForm.role === "student" ? userForm.registrationSource : "ADMIN_CREATED",
        isValidated: userForm.role === "student" ? userForm.isValidated : true,
        ...(userForm.password ? { password: userForm.password } : {}),
      });
      toast({
        title: "Akun diperbarui",
        description: "Perubahan akun berhasil disimpan.",
      });
      setIsUserDialogOpen(false);
      await refreshOverview();
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal memperbarui akun."
        : "Gagal memperbarui akun.";
      toast({
        title: "Gagal memperbarui akun",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleToggleUserValidation = async (userItem: AdminUser) => {
    if (userItem.role !== "student") return;

    const nextValidation = !userItem.isValidated;
    const confirmed = window.confirm(
      nextValidation
        ? `Aktifkan akun siswa ${userItem.name}?`
        : `Nonaktifkan akun siswa ${userItem.name}? Siswa akan otomatis logout.`
    );
    if (!confirmed) return;

    try {
      await api.patch(`/api/admin/users/${userItem.id}/validation`, {
        isValidated: nextValidation,
      });
      toast({
        title: nextValidation ? "Akun diaktivasi" : "Akun dinonaktifkan",
        description: nextValidation
          ? "Siswa sekarang bisa login dan mengakses paket yang diizinkan."
          : "Siswa tidak bisa login sampai divalidasi kembali.",
      });
      await refreshOverview();
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal memperbarui status akun."
        : "Gagal memperbarui status akun.";
      toast({
        title: "Gagal validasi akun",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userItem: AdminUser) => {
    const confirmed = window.confirm(
      `Hapus akun ${userItem.name}? Tindakan ini juga menghapus riwayat pembelian pengguna.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/api/admin/users/${userItem.id}`);
      toast({
        title: "Akun dihapus",
        description: "Akun berhasil dihapus dari sistem.",
      });
      await refreshOverview();
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal menghapus akun."
        : "Gagal menghapus akun.";
      toast({
        title: "Gagal menghapus akun",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleToggleUserSelection = (userId: string, checked: boolean) => {
    setSelectedUserIds((prev) =>
      checked ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId)
    );
  };

  const handleToggleSelectAllUsersOnPage = (checked: boolean) => {
    const pageIds = paginatedUsers.map((userItem) => userItem.id);
    if (checked) {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...pageIds])));
      return;
    }

    const pageIdSet = new Set(pageIds);
    setSelectedUserIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
  };

  const handleDeleteSelectedUsers = async () => {
    if (!selectedUserIds.length) return;

    const selectedUsers = users.filter((userItem) => selectedUserIdSet.has(userItem.id));
    const confirmed = window.confirm(
      `Hapus ${selectedUsers.length} akun terpilih? Riwayat pembelian terkait akun juga akan terhapus.`
    );
    if (!confirmed) return;

    const results = await Promise.allSettled(
      selectedUsers.map((userItem) => api.delete(`/api/admin/users/${userItem.id}`))
    );
    const successCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      toast({
        title: "Hapus massal selesai",
        description:
          failedCount > 0
            ? `${successCount} akun berhasil dihapus, ${failedCount} akun gagal dihapus.`
            : `${successCount} akun berhasil dihapus.`
      });
    } else {
      toast({
        title: "Gagal menghapus akun terpilih",
        description: "Semua akun terpilih gagal dihapus.",
        variant: "destructive"
      });
    }

    setSelectedUserIds([]);
    await refreshOverview();
  };

  const handleUpdatePayment = async () => {
    if (!selectedPayment) return;
    try {
      await api.patch(`/api/admin/payments/${selectedPayment.id}`, {
        status: paymentForm.status,
        paymentType: paymentForm.paymentType || undefined,
        paidAt: paymentForm.paidAt
          ? new Date(paymentForm.paidAt).toISOString()
          : undefined,
      });
      toast({
        title: "Pembayaran diperbarui",
        description: "Data pembayaran berhasil disimpan.",
      });
      setIsPaymentDialogOpen(false);
      await refreshOverview();
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal memperbarui pembayaran."
        : "Gagal memperbarui pembayaran.";
      toast({
        title: "Gagal memperbarui pembayaran",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDeletePayment = async (payment: AdminPayment) => {
    const confirmed = window.confirm(
      `Hapus transaksi ${payment.orderCode}? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/api/admin/payments/${payment.id}`);
      toast({
        title: "Pembayaran dihapus",
        description: "Transaksi berhasil dihapus dari sistem.",
      });
      await refreshOverview();
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal menghapus pembayaran."
        : "Gagal menghapus pembayaran.";
      toast({
        title: "Gagal menghapus pembayaran",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Berhasil keluar",
      description: "Sesi admin/teacher telah diakhiri. Anda kembali ke beranda.",
    });
    navigate("/", { replace: true });
  };

  if (!user) {
    return null;
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background/80 to-muted/40">
        <main className="container mx-auto flex min-h-screen items-center justify-center px-4 py-10">
          <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border/70 bg-card p-10 text-center shadow-xl">
            <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h1 className="text-2xl font-semibold text-primary">Akses Staff Diperlukan</h1>
            <p className="mt-2 text-muted-foreground">
              Halaman ini hanya untuk role admin atau teacher.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Kembali ke Dashboard
              </Button>
              <Button asChild>
                <a href="mailto:sagala18@gmail.com">Hubungi Admin</a>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const errorMessage = isAxiosError(error)
    ? error.response?.data?.message ?? "Gagal memuat data admin."
    : "Gagal memuat data admin.";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-blue-100/70">
      <div className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-[-72px] h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl" />
      <div className="pointer-events-none absolute right-[26%] top-[30%] h-56 w-56 rounded-full bg-emerald-300/15 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-[1680px] px-3 py-4 sm:px-4 lg:px-6">
        <header className="mb-6 rounded-3xl border border-primary/20 bg-gradient-to-r from-white/95 via-white/90 to-primary/10 p-3 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Sheet open={isSidebarSheetOpen} onOpenChange={setIsSidebarSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 border-primary/20 bg-white/80 shadow-sm lg:hidden"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[300px] overflow-y-auto border-r border-primary/20 bg-gradient-to-b from-white via-slate-50 to-primary/5 p-4"
                >
                  <SheetHeader>
                    <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-white/90 p-3 shadow-sm">
                      <div className="h-10 w-10 overflow-hidden rounded-xl border border-primary/20 bg-white p-1">
                        <img
                          src={logo}
                          alt="Sagala Bimbel"
                          className="h-full w-full rounded-lg object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <SheetTitle className="truncate text-sm">
                          {isAdmin ? "Panel Admin" : "Panel Teacher"}
                        </SheetTitle>
                        <SheetDescription className="truncate text-xs">
                          Navigasi sesi panel.
                        </SheetDescription>
                      </div>
                    </div>
                  </SheetHeader>
                  <div className="mt-4 space-y-2">
                    {panelSections.map((section) => {
                      const Icon = section.icon;
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={`mobile-${section.id}`}
                          type="button"
                          onClick={() => {
                            setActiveSection(section.id);
                            setIsSidebarSheetOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all duration-300",
                            isActive
                              ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
                              : "border-primary/10 bg-white/80 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{section.title}</span>
                        </button>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 w-full justify-start gap-3 border-primary/30 bg-white/90"
                      onClick={() => {
                        void handleLogout();
                        setIsSidebarSheetOpen(false);
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Keluar
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="hidden h-11 w-11 overflow-hidden rounded-2xl border border-primary/20 bg-white p-1 shadow-sm sm:block">
                <img
                  src={logo}
                  alt="Sagala Bimbel"
                  className="h-full w-full rounded-xl object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary">
                  {isAdmin ? "Panel Admin Sagala Bimbel" : "Panel Teacher Sagala Bimbel"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Sesi aktif: {activeSectionMeta?.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full border-primary/25 bg-white/80 px-3 py-1 text-xs text-primary"
              >
                {isAdmin ? "Admin Aktif" : "Teacher Aktif"}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden gap-2 border-primary/25 bg-white/85 hover:bg-primary/5 lg:flex"
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </Button>
            </div>
          </div>
        </header>

        {isError ? (
          <div className="rounded-3xl border border-rose-200/70 bg-white/90 p-10 text-center shadow-xl backdrop-blur-sm">
            <p className="text-lg font-semibold text-rose-700">
              {errorMessage}
            </p>
          </div>
        ) : (
          <>
            <section
              className={cn(
                "grid gap-6",
                isSidebarCollapsed
                  ? "lg:grid-cols-[88px_minmax(0,1fr)]"
                  : "lg:grid-cols-[268px_minmax(0,1fr)]"
              )}
            >
              <aside className="hidden lg:block lg:sticky lg:top-[88px] lg:h-[calc(100vh-110px)]">
                <div className="flex h-full flex-col rounded-3xl border border-primary/20 bg-gradient-to-b from-slate-50/95 via-white/95 to-primary/10 p-2.5 shadow-lg backdrop-blur-sm">
                  <div
                    className={cn(
                      "mb-3 rounded-2xl border border-primary/15 bg-white/95 p-2.5 shadow-sm",
                      isSidebarCollapsed ? "space-y-2 text-center" : "space-y-2"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center",
                        isSidebarCollapsed ? "justify-center" : "justify-between gap-2"
                      )}
                    >
                      {!isSidebarCollapsed && (
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 overflow-hidden rounded-xl border border-primary/20 bg-white p-1">
                            <img
                              src={logo}
                              alt="Sagala Bimbel"
                              className="h-full w-full rounded-lg object-cover"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              Sagala Bimbel
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {isAdmin ? "Admin Panel" : "Teacher Panel"}
                            </p>
                          </div>
                        </div>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-primary/10"
                        onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                      >
                        {isSidebarCollapsed ? (
                          <PanelLeftOpen className="h-4 w-4 text-primary" />
                        ) : (
                          <PanelLeftClose className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                    </div>
                    {isSidebarCollapsed && (
                      <div className="mx-auto h-9 w-9 overflow-hidden rounded-xl border border-primary/20 bg-white p-1">
                        <img
                          src={logo}
                          alt="Sagala Bimbel"
                          className="h-full w-full rounded-lg object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <nav className="flex-1 space-y-2 overflow-y-auto pr-0.5">
                    {panelSections.map((section) => {
                      const Icon = section.icon;
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          type="button"
                          title={section.title}
                          onClick={() => setActiveSection(section.id)}
                          className={cn(
                            "group flex w-full items-center rounded-2xl border px-2.5 py-2.5 text-sm font-medium transition-all duration-300",
                            isSidebarCollapsed ? "justify-center" : "gap-2.5",
                            isActive
                              ? "border-primary/35 bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-md"
                              : "border-primary/10 bg-white/90 text-foreground hover:-translate-y-0.5 hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-110" />
                          {!isSidebarCollapsed && <span>{section.title}</span>}
                        </button>
                      );
                    })}
                  </nav>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "mt-3 border-primary/25 bg-white/90 hover:bg-primary/5",
                      isSidebarCollapsed ? "px-0" : "justify-start gap-2"
                    )}
                    onClick={() => void handleLogout()}
                  >
                    <LogOut className="h-4 w-4" />
                    {!isSidebarCollapsed && "Keluar"}
                  </Button>
                </div>
              </aside>

              <div
                className={cn(
                  "min-w-0 space-y-8 transition-all duration-300 ease-out",
                  isSectionContentVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0"
                )}
              >
                <section className="rounded-3xl border border-primary/20 bg-gradient-to-r from-white/95 via-white/90 to-primary/10 p-5 shadow-md backdrop-blur-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        Session Aktif
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-primary">
                        {activeSectionMeta?.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activeSectionMeta?.description}
                      </p>
                    </div>
                    <div className="hidden h-12 w-12 overflow-hidden rounded-2xl border border-primary/20 bg-white p-1 shadow-sm sm:block">
                      <img
                        src={logo}
                        alt="Sagala Bimbel"
                        className="h-full w-full rounded-xl object-cover"
                      />
                    </div>
                  </div>
                </section>

            {activeSection === "overview" && (
              <section className="space-y-4">
                {isAdmin ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                      icon={Users}
                      label="Total Akun"
                      value={data?.stats.totalUsers ?? 0}
                      gradient="from-primary/20 to-primary/10 text-primary"
                    />
                    <StatCard
                      icon={Wallet}
                      label="Total Transaksi"
                      value={data?.stats.totalPayments ?? 0}
                      gradient="from-indigo-200/70 to-indigo-100 text-indigo-700"
                    />
                    <StatCard
                      icon={ShieldCheck}
                      label="Pembayaran Berhasil"
                      value={data?.stats.paidPayments ?? 0}
                      gradient="from-emerald-200/70 to-emerald-100 text-emerald-700"
                    />
                    <StatCard
                      icon={CircleDollarSign}
                      label="Pendapatan"
                      value={formatCurrency(data?.stats.totalRevenue ?? 0)}
                      gradient="from-amber-200/70 to-amber-100 text-amber-700"
                    />
                  </div>
                ) : (
                  <TeacherOverviewPanel />
                )}
              </section>
            )}

            {isAdmin && activeSection === "users" && (
              <section className="mb-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-primary">
                    Daftar Akun Terdaftar
                  </h2>
                  <Badge variant="outline" className="rounded-full px-4 py-2">
                    {userRoleFilter === "ALL" && studentSourceFilter === "ALL"
                      ? `${users.length} Akun (${userSortOptionLabels[userSortOption]})`
                      : `${filteredUsers.length} Akun (${userRoleFilterLabels[userRoleFilter]}${
                          studentSourceFilter !== "ALL"
                            ? `, ${studentSourceFilterLabels[studentSourceFilter]}`
                            : ""
                        }, ${userSortOptionLabels[userSortOption]})`}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedUserIds.length > 0 && (
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
                      onClick={() => void handleDeleteSelectedUsers()}
                    >
                      <Trash2 className="h-4 w-4" /> Hapus Terpilih ({selectedUserIds.length})
                    </Button>
                  )}
                  <div className="w-[220px]">
                    <Select
                      value={studentSourceFilter}
                      onValueChange={(value) => {
                        setStudentSourceFilter(value as StudentSourceFilter);
                        setUserPage(1);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sumber siswa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Semua Sumber Siswa</SelectItem>
                        <SelectItem value="SELF_REGISTERED">Daftar Sendiri</SelectItem>
                        <SelectItem value="ADMIN_CREATED">Input Admin</SelectItem>
                        <SelectItem value="UNKNOWN">Belum Ditentukan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[180px]">
                    <Select
                      value={userRoleFilter}
                      onValueChange={(value) => {
                        setUserRoleFilter(value as UserRoleFilter);
                        setUserPage(1);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Semua Role</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[190px]">
                    <Select
                      value={userSortOption}
                      onValueChange={(value) => {
                        setUserSortOption(value as UserSortOption);
                        setUserPage(1);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Urutkan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEWEST">Tanggal Terbaru</SelectItem>
                        <SelectItem value="OLDEST">Tanggal Terlama</SelectItem>
                        <SelectItem value="A_Z">Nama A-Z</SelectItem>
                        <SelectItem value="Z_A">Nama Z-A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="gap-2" onClick={openCreateUser}>
                    <UserPlus className="h-4 w-4" /> Tambah Akun
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl bg-card shadow-md">
                <table className="w-full min-w-[1140px] text-left text-sm">
                  <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">
                        <Checkbox
                          checked={
                            isAllUsersOnPageSelected
                              ? true
                              : hasSomeUsersOnPageSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(value) =>
                            handleToggleSelectAllUsersOnPage(Boolean(value))
                          }
                          aria-label="Pilih semua akun di halaman ini"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold">Nama</th>
                      <th className="px-4 py-3 font-semibold">Username</th>
                      <th className="px-4 py-3 font-semibold">Telepon</th>
                      <th className="px-4 py-3 font-semibold">Provider</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Sumber Pendaftaran</th>
                      <th className="px-4 py-3 font-semibold">Status Akun</th>
                      <th className="px-4 py-3 font-semibold">Terdaftar</th>
                      <th className="px-4 py-3 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td className="px-4 py-8" colSpan={10}>
                          Memuat data akun...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8" colSpan={10}>
                          Belum ada akun terdaftar.
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8" colSpan={10}>
                          Tidak ada akun untuk filter{" "}
                          {userRoleFilterLabels[userRoleFilter]}
                          {studentSourceFilter !== "ALL"
                            ? ` + ${studentSourceFilterLabels[studentSourceFilter]}`
                            : ""}
                          .
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map((userItem: AdminUser) => (
                        <tr key={userItem.id} className="border-b border-border/40">
                          <td className="px-4 py-3 align-top">
                            <Checkbox
                              checked={selectedUserIdSet.has(userItem.id)}
                              onCheckedChange={(value) =>
                                handleToggleUserSelection(userItem.id, Boolean(value))
                              }
                              aria-label={`Pilih akun ${userItem.name}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">
                            {userItem.name}
                          </td>
                          <td className="px-4 py-3">{userItem.username ?? "-"}</td>
                          <td className="px-4 py-3">
                            {userItem.phone ?? "-"}
                          </td>
                          <td className="px-4 py-3">{userItem.provider}</td>
                          <td className="px-4 py-3 capitalize">{userItem.role}</td>
                          <td className="px-4 py-3">
                            {userItem.role === "student" ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full",
                                  registrationSourceBadgeClassNames[userItem.registrationSource]
                                )}
                              >
                                {registrationSourceLabels[userItem.registrationSource]}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-full border-indigo-200 bg-indigo-50 text-indigo-700"
                              >
                                Staf Internal
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {userItem.role === "student" ? (
                              userItem.isValidated ? (
                                <Badge className="gap-1 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-rose-300 bg-rose-50 text-rose-700"
                                >
                                  Belum Validasi
                                </Badge>
                              )
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-full border-indigo-200 bg-indigo-50 text-indigo-700"
                              >
                                {userItem.role === "teacher" ? "Teacher" : "Admin"}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {formatDateTime(userItem.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {userItem.role === "student" && (
                                <Button
                                  size="sm"
                                  variant={userItem.isValidated ? "outline" : "default"}
                                  className={cn(
                                    "gap-2",
                                    userItem.isValidated
                                      ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                                  )}
                                  onClick={() => handleToggleUserValidation(userItem)}
                                >
                                  {userItem.isValidated ? (
                                    <>
                                      <UserX className="h-3.5 w-3.5" /> Nonaktifkan
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-3.5 w-3.5" /> Validasi
                                    </>
                                  )}
                                </Button>
                              )}
                              {userItem.role === "student" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="gap-2"
                                  disabled={!userItem.isValidated}
                                  onClick={() => openAccessDialog(userItem)}
                                >
                                  <BadgeCheck className="h-3.5 w-3.5" />{" "}
                                  {userItem.isValidated ? "ACC Paket" : "Validasi Dulu"}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={() => openEditUser(userItem)}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-2"
                                onClick={() => handleDeleteUser(userItem)}
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
                {!isLoading && (
                  <TablePagination
                    currentPage={safeUserPage}
                    totalPages={totalUserPages}
                    totalItems={filteredUsers.length}
                    pageSize={ADMIN_TABLE_PAGE_SIZE}
                    onPageChange={setUserPage}
                  />
                )}
              </div>
            </section>
            )}

            {isAdmin && activeSection === "payments" && (
              <section className="mb-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-primary">
                    Riwayat Pembayaran
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Termasuk pembayaran manual ACC admin yang otomatis berstatus dibayar.
                  </p>
                </div>
                <div className="w-full max-w-[220px]">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value as PurchaseStatus | "ALL");
                      setPaymentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAID">Berhasil</SelectItem>
                      <SelectItem value="PENDING">Menunggu</SelectItem>
                      <SelectItem value="EXPIRED">Kedaluwarsa</SelectItem>
                      <SelectItem value="CANCELED">Dibatalkan</SelectItem>
                      <SelectItem value="ALL">Semua Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl bg-card shadow-md">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Order</th>
                      <th className="px-4 py-3 font-semibold">Siswa</th>
                      <th className="px-4 py-3 font-semibold">Paket</th>
                      <th className="px-4 py-3 font-semibold">Sumber</th>
                      <th className="px-4 py-3 font-semibold">Metode Pilihan</th>
                      <th className="px-4 py-3 font-semibold">Tipe Bayar</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Dibuat</th>
                      <th className="px-4 py-3 font-semibold">Dibayar</th>
                      <th className="px-4 py-3 font-semibold">Nominal</th>
                      <th className="px-4 py-3 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td className="px-4 py-8" colSpan={11}>
                          Memuat transaksi...
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8" colSpan={11}>
                          Tidak ada transaksi untuk filter ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedPayments.map((payment: AdminPayment) => {
                        const status = statusStyles[payment.status];
                        return (
                          <tr
                            key={payment.id}
                            className="border-b border-border/40"
                          >
                            <td className="px-4 py-3 font-semibold text-primary">
                              {payment.orderCode}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-primary">
                                {payment.user.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {payment.user.username ?? "-"}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-primary">
                                {payment.package.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {payment.package.category}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              {payment.isAdminGranted ? (
                                <span className="rounded-full border border-indigo-200 bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                                  ACC Admin
                                </span>
                              ) : (
                                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  Pembelian Siswa
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {payment.paymentMethod
                                ? paymentMethodLabels[payment.paymentMethod] ??
                                  payment.paymentMethod
                                : "-"}
                            </td>
                            <td className="px-4 py-3">
                              {payment.paymentType ?? "-"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-semibold",
                                  status.className
                                )}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {formatDateTime(payment.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              {formatDateTime(payment.paidAt)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-primary">
                              {formatCurrency(payment.grossAmount)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => openEditPayment(payment)}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="gap-2"
                                  onClick={() => handleDeletePayment(payment)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                {!isLoading && (
                  <TablePagination
                    currentPage={safePaymentPage}
                    totalPages={totalPaymentPages}
                    totalItems={filteredPayments.length}
                    pageSize={ADMIN_PAYMENT_PAGE_SIZE}
                    onPageChange={setPaymentPage}
                  />
                )}
              </div>
            </section>
            )}

            {activeSection === "classes" && (
              <section className="mb-10">
                <ClassManager canManage={isStaff} isAdmin={isAdmin} />
              </section>
            )}

            {activeSection === "assignments" && (
              <section className="mb-10">
                <TryoutAssignmentManager />
              </section>
            )}

            {activeSection === "scores" && (
              <section className="mb-10">
                <TryoutScoreMonitor />
              </section>
            )}

            {activeSection === "questions" && (
              <section className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <h2 className="text-xl font-semibold text-primary">Bank Soal</h2>
                  <p className="text-sm text-muted-foreground">
                    Kelola sesi dan soal tryout/latihan pada halaman terpisah dari paket dan backup.
                  </p>
                </div>
                <PackageQuestionManager
                  canManagePackages={isAdmin}
                  showPackageSection={false}
                  showQuestionSection
                />
              </section>
            )}
            {isAdmin && activeSection === "packages" && (
              <section className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <h2 className="text-xl font-semibold text-primary">Manajemen Paket Bimbel</h2>
                  <p className="text-sm text-muted-foreground">
                    Halaman khusus untuk tambah, edit, dan hapus paket agar tidak menumpuk dengan bank soal.
                  </p>
                </div>
                <PackageQuestionManager
                  canManagePackages
                  showPackageSection
                  showQuestionSection={false}
                />
              </section>
            )}
            {isAdmin && activeSection === "backups" && (
              <section className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <h2 className="text-xl font-semibold text-primary">Backup Bank Soal</h2>
                  <p className="text-sm text-muted-foreground">
                    Halaman khusus backup dan restore agar pengawasan data soal lebih fokus dan aman.
                  </p>
                </div>
                <QuestionBackupManager />
              </section>
            )}
            {activeSection === "modules" && (
              <section className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <h2 className="text-xl font-semibold text-primary">Modul Materi</h2>
                  <p className="text-sm text-muted-foreground">
                    Kelola materi belajar dan akses modul untuk siswa.
                  </p>
                </div>
                <ModuleManager canManageAccess={isAdmin} />
              </section>
            )}
              </div>
            </section>
          </>
        )}
      </main>
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Akun Baru</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Nama</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Nama lengkap"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-username">Username</Label>
              <Input
                id="create-username"
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="contoh: sagala123"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-phone">Telepon</Label>
              <Input
                id="create-phone"
                value={createForm.phone}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    role: value,
                    isValidated: value === "student" ? prev.isValidated : true,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createForm.role === "student" && (
              <div className="flex items-start gap-3 rounded-xl border border-border/70 p-3">
                <Checkbox
                  checked={createForm.isValidated}
                  onCheckedChange={(value) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      isValidated: Boolean(value),
                    }))
                  }
                />
                <div>
                  <p className="text-sm font-medium text-primary">Akun siswa tervalidasi</p>
                  <p className="text-xs text-muted-foreground">
                    Jika tidak dicentang, siswa belum bisa login sampai divalidasi admin.
                  </p>
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Minimal 6 karakter"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateUserOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreateUser}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Akun</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nama</Label>
              <Input
                id="edit-name"
                value={userForm.name}
                onChange={(event) =>
                  setUserForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={userForm.username}
                onChange={(event) =>
                  setUserForm((prev) => ({ ...prev, username: event.target.value }))
                }
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Telepon</Label>
              <Input
                id="edit-phone"
                value={userForm.phone}
                onChange={(event) =>
                  setUserForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={userForm.role}
                onValueChange={(value) =>
                  setUserForm((prev) => ({
                    ...prev,
                    role: value,
                    registrationSource:
                      value === "student" ? prev.registrationSource : "ADMIN_CREATED",
                    isValidated: value === "student" ? prev.isValidated : true,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {userForm.role === "student" && (
              <div className="grid gap-2">
                <Label>Sumber Pendaftaran Siswa</Label>
                <Select
                  value={userForm.registrationSource}
                  onValueChange={(value) =>
                    setUserForm((prev) => ({
                      ...prev,
                      registrationSource: value as RegistrationSource,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih sumber pendaftaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELF_REGISTERED">Daftar Sendiri</SelectItem>
                    <SelectItem value="ADMIN_CREATED">Input Admin</SelectItem>
                    <SelectItem value="UNKNOWN">Belum Ditentukan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {userForm.role === "student" && (
              <div className="flex items-start gap-3 rounded-xl border border-border/70 p-3">
                <Checkbox
                  checked={userForm.isValidated}
                  onCheckedChange={(value) =>
                    setUserForm((prev) => ({
                      ...prev,
                      isValidated: Boolean(value),
                    }))
                  }
                />
                <div>
                  <p className="text-sm font-medium text-primary">Akun siswa tervalidasi</p>
                  <p className="text-xs text-muted-foreground">
                    Nonaktifkan untuk memblokir login siswa sampai divalidasi ulang.
                  </p>
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="edit-password">Reset Password (Opsional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={userForm.password}
                onChange={(event) =>
                  setUserForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Kosongkan bila tidak diganti"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsUserDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdateUser}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Order:{" "}
              <span className="font-semibold text-primary">
                {selectedPayment?.orderCode ?? "-"}
              </span>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={paymentForm.status}
                onValueChange={(value) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    status: value as PurchaseStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Berhasil</SelectItem>
                  <SelectItem value="PENDING">Menunggu</SelectItem>
                  <SelectItem value="EXPIRED">Kedaluwarsa</SelectItem>
                  <SelectItem value="CANCELED">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-type">Tipe Pembayaran</Label>
              <Input
                id="payment-type"
                value={paymentForm.paymentType}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentType: event.target.value,
                  }))
                }
                placeholder="contoh: bank_transfer, gopay"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-paid">Waktu Dibayar</Label>
              <Input
                id="payment-paid"
                type="datetime-local"
                value={paymentForm.paidAt}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paidAt: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPaymentDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdatePayment}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              ACC Paket Tryout - {selectedAccessUser?.name ?? "-"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Paket yang dicentang akan otomatis diberi akses dan status
              pembayarannya <span className="font-semibold text-primary">PAID</span>.
              Paket yang dibeli langsung siswa tidak bisa dicabut dari dialog ini.
            </div>

            {!packages?.length ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Data paket belum tersedia.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {accessPackageIds.length}/{packages.length} paket dipilih
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSelectAllAccessPackages}
                    >
                      Pilih Semua
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={accessPackageIds.length === lockedPackageIds.length}
                      onClick={handleClearAccessPackages}
                    >
                      Kosongkan
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-primary">
                      Preset ACC cepat
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Pilih otomatis berdasarkan kategori atau tier paket.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSelectAllAccessPackages}
                    >
                      Semua Paket
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyAccessPackageTextPreset("cpns")}
                    >
                      Semua CPNS
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyAccessPackageTextPreset("kedinasan")}
                    >
                      Semua Kedinasan
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyAccessPackageTextPreset("hemat")}
                    >
                      Hemat
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyAccessPackageTextPreset("basic")}
                    >
                      Basic
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyAccessPackageTextPreset("reguler")}
                    >
                      Reguler
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyAccessPackageTextPreset("exclusive")}
                    >
                      Exclusive
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyAccessPackageTextPreset("ultimate")}
                    >
                      Ultimate
                    </Button>
                  </div>
                </div>
                {packages.map((pkg: AdminPackage) => {
                  const checked = accessPackageIds.includes(pkg.id);
                  const locked = lockedPackageIds.includes(pkg.id);
                  const expanded = expandedAccessPackageIds.includes(pkg.id);

                  return (
                    <div
                      key={pkg.id}
                      className={cn(
                        "rounded-2xl border p-4 transition",
                        checked
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background",
                        locked && "opacity-80"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={checked}
                            disabled={locked}
                            onCheckedChange={(value) =>
                              handleToggleAccessPackage(pkg.id, Boolean(value))
                            }
                          />
                          <div className="space-y-1">
                            <p className="font-semibold text-primary">{pkg.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {pkg.category} - {formatCurrency(pkg.price)}
                            </p>
                          </div>
                        </div>
                        {locked ? (
                          <Badge
                            variant="outline"
                            className="rounded-full border-indigo-200 bg-indigo-50 text-indigo-700"
                          >
                            Dibeli Siswa
                          </Badge>
                        ) : checked ? (
                          <Badge
                            variant="outline"
                            className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            ACC Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full">
                            Belum ACC
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleToggleAccessPackageDetail(pkg.id)}
                        >
                          {expanded ? "Sembunyikan Detail Akses" : "Lihat Detail Akses"}
                        </Button>
                        {expanded && (
                          <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-background/70 p-3 text-xs text-muted-foreground">
                            <p>
                              Tryout: {pkg.tryoutAccessStart} - {pkg.tryoutAccessEnd ?? "Semua"}
                            </p>
                            <p>
                              Latihan: {pkg.latihanAccessStart} - {pkg.latihanAccessEnd ?? "Semua"}
                            </p>
                            <p>
                              Sumber soal: Paket ini
                              {pkg.sessionSourceSessionKeys?.length
                                ? ` + ${pkg.sessionSourceSessionKeys.length} sesi`
                                : pkg.sessionSourcePackageIds?.length
                                  ? ` + ${pkg.sessionSourcePackageIds.length} paket`
                                  : ""}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAccessDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveUserAccess}>Simpan ACC Paket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  gradient: string;
}) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
      gradient
    )}
  >
    <div className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/30 blur-2xl" />
    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-background/70">
      <Icon className="h-6 w-6" />
    </div>
    <p className="relative text-sm font-medium opacity-80">{label}</p>
    <p className="text-3xl font-bold">{value}</p>
  </div>
);

export default AdminDashboard;


