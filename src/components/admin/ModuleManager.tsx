import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { jsPDF } from "jspdf";
import api from "@/lib/api-client";
import type {
  AdminModule,
  AdminPackagesResponse,
  AdminModuleAccessResponse,
  AdminModulesResponse
} from "@/types";
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
import TablePagination from "@/components/admin/TablePagination";
import { openDataUrlInNewTab } from "@/lib/data-url";
import {
  BookOpenText,
  Download,
  ExternalLink,
  FileText,
  Pencil,
  PlusCircle,
  Trash2,
  UserCheck,
  X
} from "lucide-react";

type ModuleManagerProps = {
  canManageAccess: boolean;
};

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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    const responseMessage =
      typeof error.response?.data?.message === "string"
        ? error.response.data.message
        : null;
    if (responseMessage) return responseMessage;
    if (error.message) return error.message;
    return fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const getAccountIdentifier = (user: { username?: string | null; email?: string }) =>
  user.username?.trim() || user.email || "-";

const MODULE_PDF_MAX_BYTES = 10 * 1024 * 1024;
const MODULE_PPT_MAX_BYTES = 15 * 1024 * 1024;
const MODULE_UPLOAD_CHUNK_BASE64_SIZE = 180_000;
const MODULE_TABLE_PAGE_SIZE = 10;
const STUDENT_ACCESS_PAGE_SIZE = 8;

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Gagal membaca file."));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });

const DATA_URL_BASE64_REGEX = /^data:([^;,]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/i;
const PPT_MIME_PPT = "application/vnd.ms-powerpoint";
const PPT_MIME_PPTX =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const getFileExtension = (fileName: string) => {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const normalizeModulePdfDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(DATA_URL_BASE64_REGEX);
  if (!match?.[2]) return dataUrl;
  const base64Payload = match[2].replace(/\s+/g, "");
  return `data:application/pdf;base64,${base64Payload}`;
};

const normalizeModulePptDataUrl = (dataUrl: string, fileName: string) => {
  const match = dataUrl.match(DATA_URL_BASE64_REGEX);
  if (!match?.[2]) return dataUrl;
  const base64Payload = match[2].replace(/\s+/g, "");
  const extension = getFileExtension(fileName);
  const targetMimeType = extension === "ppt" ? PPT_MIME_PPT : PPT_MIME_PPTX;
  return `data:${targetMimeType};base64,${base64Payload}`;
};

const getDataUrlBase64Payload = (dataUrl: string) => {
  const match = dataUrl.match(DATA_URL_BASE64_REGEX);
  if (!match?.[2]) {
    throw new Error("File tidak valid. Silakan upload ulang.");
  }
  return match[2].replace(/\s+/g, "");
};

const resolveFileMimeType = (file: File, fileType: "PDF" | "PPT") => {
  if (file.type?.trim()) return file.type.trim();
  const fileName = file.name.toLowerCase();
  if (fileType === "PDF") return "application/pdf";
  if (fileName.endsWith(".ppt")) return PPT_MIME_PPT;
  return PPT_MIME_PPTX;
};

const formatFileSize = (value?: number | null) => {
  if (!value || value <= 0) return "0 KB";
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const normalizeFileNameSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const getExportTimestamp = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}`;
};

const exportModulesToPdf = ({
  fileName,
  scopeLabel,
  rows
}: {
  fileName: string;
  scopeLabel: string;
  rows: AdminModule[];
}) => {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const topMargin = 40;
  const bottomMargin = 40;
  const maxWidth = pageWidth - marginX * 2;
  let y = topMargin;

  const ensureSpace = (requiredHeight = 16) => {
    if (y + requiredHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = topMargin;
    }
  };

  const writeText = ({
    text,
    size = 10,
    style = "normal",
    indent = 0
  }: {
    text: string;
    size?: number;
    style?: "normal" | "bold";
    indent?: number;
  }) => {
    if (!text.trim()) return;

    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth - indent);

    for (const line of lines) {
      ensureSpace(size + 6);
      doc.text(line, marginX + indent, y);
      y += size + 4;
    }
  };

  writeText({ text: "Laporan Modul Materi", size: 17, style: "bold" });
  writeText({ text: `Cakupan: ${scopeLabel}` });
  writeText({
    text: `Tanggal export: ${new Date().toLocaleString("id-ID")}`
  });
  writeText({ text: `Total modul: ${rows.length}` });

  ensureSpace(20);
  doc.setDrawColor(210);
  doc.line(marginX, y + 2, pageWidth - marginX, y + 2);
  y += 16;

  rows.forEach((module, moduleIndex) => {
    writeText({
      text: `${moduleIndex + 1}. ${module.title}`,
      size: 12,
      style: "bold"
    });

    if (module.bab || module.subBab) {
      writeText({
        text: `Bab: ${module.bab ?? "-"}${module.subBab ? ` | Bagian: ${module.subBab}` : ""}`
      });
    }

    writeText({
      text: `Status: ${module.isPublished ? "Published" : "Draft"} | Dibuat oleh: ${module.createdBy.name}`
    });

    if (module.summary) {
      writeText({
        text: `Ringkasan: ${module.summary}`
      });
    }

    if (module.content) {
      writeText({
        text: `Isi Materi: ${module.content}`
      });
    }

    if (module.pdfFileName || module.pptFileName) {
      writeText({
        text: `Lampiran: ${module.pdfFileName ? `PDF (${module.pdfFileName})` : ""}${module.pdfFileName && module.pptFileName ? ", " : ""}${module.pptFileName ? `PPT (${module.pptFileName})` : ""}`
      });
    }

    if (module.packages.length) {
      writeText({
        text: `Paket Terkait: ${module.packages.map((pkg) => pkg.title).join(", ")}`
      });
    }

    writeText({
      text: `Diperbarui: ${formatDateTime(module.updatedAt)}`,
      size: 9
    });

    ensureSpace(16);
    doc.setDrawColor(235);
    doc.line(marginX, y + 2, pageWidth - marginX, y + 2);
    y += 14;
  });

  doc.save(fileName);
};

const estimateDataUrlSizeInBytes = (dataUrl: string) => {
  const match = dataUrl.match(/^data:[^;]+;base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match?.[1]) return 0;
  const base64Payload = match[1].replace(/\s+/g, "");
  const padding = base64Payload.endsWith("==")
    ? 2
    : base64Payload.endsWith("=")
      ? 1
      : 0;
  return Math.max(0, Math.floor((base64Payload.length * 3) / 4) - padding);
};

const ModuleManager = ({ canManageAccess }: ModuleManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedModule, setSelectedModule] = useState<AdminModule | null>(null);
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
    username?: string | null;
    email: string;
    moduleIds: string[];
  } | null>(null);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [studentModuleIds, setStudentModuleIds] = useState<string[]>([]);
  const [studentAccessPage, setStudentAccessPage] = useState(1);
  const [modulePage, setModulePage] = useState(1);
  const [isUploadingModuleFile, setIsUploadingModuleFile] = useState(false);

  const [moduleForm, setModuleForm] = useState({
    title: "",
    bab: "",
    subBab: "",
    summary: "",
    content: "",
    pdfDataUrl: "",
    pdfFileName: "",
    pdfSizeInBytes: 0,
    pdfUploadToken: "",
    pdfDirty: false,
    pptDataUrl: "",
    pptFileName: "",
    pptSizeInBytes: 0,
    pptUploadToken: "",
    pptDirty: false,
    isPublished: true,
    packageIds: [] as string[]
  });

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ["admin-modules"],
    queryFn: async () => {
      const { data } = await api.get<AdminModulesResponse>("/api/admin/modules");
      return data.data;
    }
  });

  const { data: packageOptions, isLoading: packagesLoading } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => {
      const { data } = await api.get<AdminPackagesResponse>("/api/admin/packages");
      return data.data;
    }
  });

  const { data: accessData, isLoading: accessLoading } = useQuery({
    queryKey: ["admin-module-access"],
    queryFn: async () => {
      const { data } = await api.get<AdminModuleAccessResponse>("/api/admin/modules/access");
      return data.data;
    },
    enabled: canManageAccess
  });

  const sortedModules = useMemo(
    () => [...(modules ?? [])].sort((a, b) => a.title.localeCompare(b.title, "id")),
    [modules]
  );
  const totalModulePages = Math.max(
    1,
    Math.ceil(sortedModules.length / MODULE_TABLE_PAGE_SIZE)
  );
  const safeModulePage = Math.min(modulePage, totalModulePages);
  const paginatedModules = useMemo(() => {
    const startIndex = (safeModulePage - 1) * MODULE_TABLE_PAGE_SIZE;
    return sortedModules.slice(startIndex, startIndex + MODULE_TABLE_PAGE_SIZE);
  }, [safeModulePage, sortedModules]);

  const students = accessData?.students ?? [];
  const accessModules = accessData?.modules ?? [];
  const packageItems = packageOptions ?? [];
  const totalStudentAccessPages = Math.max(
    1,
    Math.ceil(students.length / STUDENT_ACCESS_PAGE_SIZE)
  );
  const safeStudentAccessPage = Math.min(studentAccessPage, totalStudentAccessPages);
  const paginatedStudents = useMemo(() => {
    const startIndex = (safeStudentAccessPage - 1) * STUDENT_ACCESS_PAGE_SIZE;
    return students.slice(startIndex, startIndex + STUDENT_ACCESS_PAGE_SIZE);
  }, [safeStudentAccessPage, students]);

  const areAllStudentModulesSelected =
    accessModules.length > 0 &&
    accessModules.every((module) => studentModuleIds.includes(module.id));
  const areAllPackagesSelected =
    packageItems.length > 0 &&
    packageItems.every((pkg) => moduleForm.packageIds.includes(pkg.id));

  useEffect(() => {
    if (studentAccessPage > totalStudentAccessPages) {
      setStudentAccessPage(totalStudentAccessPages);
    }
  }, [studentAccessPage, totalStudentAccessPages]);

  useEffect(() => {
    if (modulePage > totalModulePages) {
      setModulePage(totalModulePages);
    }
  }, [modulePage, totalModulePages]);

  const refreshModules = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-modules"] });
  };

  const refreshModuleAccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-module-access"] });
  };

  const openCreateModule = () => {
    setSelectedModule(null);
    setModuleForm({
      title: "",
      bab: "",
      subBab: "",
      summary: "",
      content: "",
      pdfDataUrl: "",
      pdfFileName: "",
      pdfSizeInBytes: 0,
      pdfUploadToken: "",
      pdfDirty: false,
      pptDataUrl: "",
      pptFileName: "",
      pptSizeInBytes: 0,
      pptUploadToken: "",
      pptDirty: false,
      isPublished: true,
      packageIds: []
    });
    setIsModuleDialogOpen(true);
  };

  const openEditModule = (module: AdminModule) => {
    setSelectedModule(module);
    setModuleForm({
      title: module.title,
      bab: module.bab ?? "",
      subBab: module.subBab ?? "",
      summary: module.summary ?? "",
      content: module.content ?? "",
      pdfDataUrl: module.pdfDataUrl ?? "",
      pdfFileName: module.pdfFileName ?? "",
      pdfSizeInBytes: module.pdfDataUrl
        ? estimateDataUrlSizeInBytes(module.pdfDataUrl)
        : 0,
      pdfUploadToken: "",
      pdfDirty: false,
      pptDataUrl: module.pptDataUrl ?? "",
      pptFileName: module.pptFileName ?? "",
      pptSizeInBytes: module.pptDataUrl
        ? estimateDataUrlSizeInBytes(module.pptDataUrl)
        : 0,
      pptUploadToken: "",
      pptDirty: false,
      isPublished: module.isPublished,
      packageIds: module.packageIds
    });
    setIsModuleDialogOpen(true);
  };

  const uploadModuleFileInChunks = async ({
    file,
    fileType,
    dataUrl
  }: {
    file: File;
    fileType: "PDF" | "PPT";
    dataUrl: string;
  }) => {
    const base64Payload = getDataUrlBase64Payload(dataUrl);
    const totalChunks = Math.max(
      1,
      Math.ceil(base64Payload.length / MODULE_UPLOAD_CHUNK_BASE64_SIZE)
    );
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const mimeType = resolveFileMimeType(file, fileType);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * MODULE_UPLOAD_CHUNK_BASE64_SIZE;
      const end = start + MODULE_UPLOAD_CHUNK_BASE64_SIZE;
      const chunkBase64 = base64Payload.slice(start, end);

      await api.post("/api/admin/module-files/chunk", {
        uploadId,
        fileType,
        fileName: file.name,
        mimeType,
        chunkIndex,
        totalChunks,
        chunkBase64
      });
    }

    const { data } = await api.post<{
      data: { uploadToken: string; fileName: string; sizeInBytes: number };
    }>("/api/admin/module-files/complete", {
      uploadId,
      fileType
    });

    return data.data;
  };

  const handleAttachModulePdf = async (file: File | undefined) => {
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();
    const isPdfMimeType = file.type === "application/pdf";
    const isPdfFileName = fileNameLower.endsWith(".pdf");

    if (!isPdfMimeType && !isPdfFileName) {
      toast({
        title: "Format file tidak didukung",
        description: "Hanya file PDF (.pdf) yang bisa diupload.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > MODULE_PDF_MAX_BYTES) {
      toast({
        title: "Ukuran file terlalu besar",
        description: "Ukuran PDF maksimal 10MB.",
        variant: "destructive"
      });
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const normalizedDataUrl = normalizeModulePdfDataUrl(dataUrl);
      setIsUploadingModuleFile(true);
      const uploaded = await uploadModuleFileInChunks({
        file,
        fileType: "PDF",
        dataUrl: normalizedDataUrl
      });
      setModuleForm((prev) => ({
        ...prev,
        pdfDataUrl: normalizedDataUrl,
        pdfFileName: uploaded.fileName || file.name,
        pdfSizeInBytes: uploaded.sizeInBytes || file.size,
        pdfUploadToken: uploaded.uploadToken,
        pdfDirty: true
      }));
      toast({
        title: "PDF berhasil dipilih",
        description: "File modul PDF siap disimpan."
      });
    } catch (error) {
      toast({
        title: "Gagal membaca file PDF",
        description: getErrorMessage(error, "Silakan coba file PDF lain."),
        variant: "destructive"
      });
    } finally {
      setIsUploadingModuleFile(false);
    }
  };

  const handleRemoveModulePdf = () => {
    setModuleForm((prev) => ({
      ...prev,
      pdfDataUrl: "",
      pdfFileName: "",
      pdfSizeInBytes: 0,
      pdfUploadToken: "",
      pdfDirty: true
    }));
  };

  const handleAttachModulePpt = async (file: File | undefined) => {
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();
    const isPptMimeType =
      file.type === "application/vnd.ms-powerpoint" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const isPptFileName =
      fileNameLower.endsWith(".ppt") || fileNameLower.endsWith(".pptx");

    if (!isPptMimeType && !isPptFileName) {
      toast({
        title: "Format file tidak didukung",
        description: "Hanya file PPT/PPTX (.ppt / .pptx) yang bisa diupload.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > MODULE_PPT_MAX_BYTES) {
      toast({
        title: "Ukuran file terlalu besar",
        description: "Ukuran PPT maksimal 15MB.",
        variant: "destructive"
      });
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const normalizedDataUrl = normalizeModulePptDataUrl(dataUrl, file.name);
      setIsUploadingModuleFile(true);
      const uploaded = await uploadModuleFileInChunks({
        file,
        fileType: "PPT",
        dataUrl: normalizedDataUrl
      });
      setModuleForm((prev) => ({
        ...prev,
        pptDataUrl: normalizedDataUrl,
        pptFileName: uploaded.fileName || file.name,
        pptSizeInBytes: uploaded.sizeInBytes || file.size,
        pptUploadToken: uploaded.uploadToken,
        pptDirty: true
      }));
      toast({
        title: "PPT berhasil dipilih",
        description: "File modul PPT siap disimpan."
      });
    } catch (error) {
      toast({
        title: "Gagal membaca file PPT",
        description: getErrorMessage(error, "Silakan coba file PPT lain."),
        variant: "destructive"
      });
    } finally {
      setIsUploadingModuleFile(false);
    }
  };

  const handleRemoveModulePpt = () => {
    setModuleForm((prev) => ({
      ...prev,
      pptDataUrl: "",
      pptFileName: "",
      pptSizeInBytes: 0,
      pptUploadToken: "",
      pptDirty: true
    }));
  };

  const handleSaveModule = async () => {
    try {
      if (isUploadingModuleFile) {
        toast({
          title: "Upload file masih berjalan",
          description: "Tunggu upload PDF/PPT selesai sebelum menyimpan modul.",
          variant: "destructive"
        });
        return;
      }

      const normalizedTitle = moduleForm.title.trim();
      if (normalizedTitle.length < 3) {
        toast({
          title: "Judul modul belum valid",
          description: "Judul modul minimal 3 karakter.",
          variant: "destructive"
        });
        return;
      }

      const sanitizedContent = moduleForm.content.trim();
      if (sanitizedContent.length > 0 && sanitizedContent.length < 10) {
        toast({
          title: "Isi materi terlalu pendek",
          description: "Isi materi manual minimal 10 karakter.",
          variant: "destructive"
        });
        return;
      }

      if (!sanitizedContent && !moduleForm.pdfDataUrl && !moduleForm.pptDataUrl) {
        toast({
          title: "Materi belum lengkap",
          description: "Isi materi manual, upload PDF, atau upload PPT terlebih dahulu.",
          variant: "destructive"
        });
        return;
      }

      const payload = {
        title: normalizedTitle,
        bab: moduleForm.bab,
        subBab: moduleForm.subBab,
        summary: moduleForm.summary,
        content: sanitizedContent,
        isPublished: moduleForm.isPublished,
        packageIds: moduleForm.packageIds
      };

      if (!selectedModule || moduleForm.pdfDirty) {
        Object.assign(payload, {
          pdfDataUrl: moduleForm.pdfUploadToken ? "" : moduleForm.pdfDataUrl,
          pdfFileName: moduleForm.pdfFileName,
          pdfUploadToken: moduleForm.pdfUploadToken
        });
      }

      if (!selectedModule || moduleForm.pptDirty) {
        Object.assign(payload, {
          pptDataUrl: moduleForm.pptUploadToken ? "" : moduleForm.pptDataUrl,
          pptFileName: moduleForm.pptFileName,
          pptUploadToken: moduleForm.pptUploadToken
        });
      }

      if (selectedModule) {
        await api.patch(`/api/admin/modules/${selectedModule.id}`, payload);
      } else {
        await api.post("/api/admin/modules", payload);
      }
      toast({
        title: selectedModule ? "Modul diperbarui" : "Modul ditambahkan",
        description: selectedModule
          ? "Perubahan modul materi berhasil disimpan."
          : "Modul materi baru berhasil dibuat."
      });
      setIsModuleDialogOpen(false);
      await Promise.all([refreshModules(), refreshModuleAccess()]);
    } catch (error) {
      toast({
        title: "Gagal menyimpan modul",
        description: getErrorMessage(error, "Gagal menyimpan modul materi."),
        variant: "destructive"
      });
    }
  };

  const handleDeleteModule = async (module: AdminModule) => {
    const confirmed = window.confirm(
      `Hapus modul "${module.title}"? Akses modul siswa untuk modul ini juga akan terhapus.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/api/admin/modules/${module.id}`);
      toast({
        title: "Modul dihapus",
        description: "Modul materi berhasil dihapus."
      });
      await Promise.all([refreshModules(), refreshModuleAccess()]);
    } catch (error) {
      toast({
        title: "Gagal menghapus modul",
        description: getErrorMessage(error, "Gagal menghapus modul materi."),
        variant: "destructive"
      });
    }
  };

  const handleDownloadModule = (module: AdminModule) => {
    const fileLabel = normalizeFileNameSegment(module.title || module.id);
    exportModulesToPdf({
      fileName: `modul-${fileLabel}-${getExportTimestamp()}.pdf`,
      scopeLabel: `Modul: ${module.title}`,
      rows: [module]
    });
    toast({
      title: "Download modul dimulai",
      description: `Modul "${module.title}" sedang diunduh dalam PDF.`
    });
  };

  const handleDownloadAllModules = () => {
    if (!sortedModules.length) {
      toast({
        title: "Data modul kosong",
        description: "Belum ada modul yang bisa diunduh.",
        variant: "destructive"
      });
      return;
    }

    exportModulesToPdf({
      fileName: `semua-modul-${getExportTimestamp()}.pdf`,
      scopeLabel: "Semua Modul",
      rows: sortedModules
    });
    toast({
      title: "Download modul dimulai",
      description: `${sortedModules.length} modul sedang diunduh dalam PDF.`
    });
  };

  const handleOpenAttachment = async (
    dataUrl?: string | null,
    fileName?: string | null
  ) => {
    if (!dataUrl) return;
    try {
      await openDataUrlInNewTab(dataUrl, fileName);
    } catch (error) {
      toast({
        title: "Gagal membuka lampiran",
        description: getErrorMessage(error, "File lampiran tidak bisa dibuka."),
        variant: "destructive"
      });
    }
  };

  const openStudentAccessDialog = (student: {
    id: string;
    name: string;
    username?: string | null;
    email: string;
    moduleIds: string[];
  }) => {
    setSelectedStudent(student);
    setStudentModuleIds(student.moduleIds);
    setIsAccessDialogOpen(true);
  };

  const handleToggleStudentModule = (moduleId: string, checked: boolean) => {
    setStudentModuleIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(moduleId);
      } else {
        next.delete(moduleId);
      }
      return Array.from(next);
    });
  };

  const handleSelectAllStudentModules = () => {
    setStudentModuleIds(accessModules.map((module) => module.id));
  };

  const handleClearAllStudentModules = () => {
    setStudentModuleIds([]);
  };

  const handleToggleModulePackage = (packageId: string, checked: boolean) => {
    setModuleForm((prev) => {
      const next = new Set(prev.packageIds);
      if (checked) {
        next.add(packageId);
      } else {
        next.delete(packageId);
      }
      return {
        ...prev,
        packageIds: Array.from(next)
      };
    });
  };

  const handleSelectAllModulePackages = () => {
    setModuleForm((prev) => ({
      ...prev,
      packageIds: packageItems.map((pkg) => pkg.id)
    }));
  };

  const handleClearAllModulePackages = () => {
    setModuleForm((prev) => ({
      ...prev,
      packageIds: []
    }));
  };

  const handleSaveStudentAccess = async () => {
    if (!selectedStudent) return;
    try {
      await api.put(`/api/admin/modules/access/${selectedStudent.id}`, {
        moduleIds: studentModuleIds
      });
      toast({
        title: "Akses modul diperbarui",
        description: `Akses modul untuk ${selectedStudent.name} berhasil diperbarui.`
      });
      setIsAccessDialogOpen(false);
      await refreshModuleAccess();
    } catch (error) {
      toast({
        title: "Gagal memperbarui akses modul",
        description: getErrorMessage(error, "Gagal menyimpan akses modul siswa."),
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-primary">Modul Materi</h2>
            <p className="text-sm text-muted-foreground">
              Tambah, edit, dan hapus materi belajar. Modul bisa diatur untuk paket tertentu atau diberikan manual per siswa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={handleDownloadAllModules}>
              <Download className="h-4 w-4" /> Download Semua Modul
            </Button>
            <Button className="gap-2" onClick={openCreateModule}>
              <PlusCircle className="h-4 w-4" /> Tambah Modul
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl bg-card shadow-xl">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-semibold">Judul</th>
                <th className="px-6 py-4 font-semibold">Paket Terkait</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Dibuat Oleh</th>
                <th className="px-6 py-4 font-semibold">Akses Siswa</th>
                <th className="px-6 py-4 font-semibold">Diperbarui</th>
                <th className="px-6 py-4 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {modulesLoading ? (
                <tr>
                  <td className="px-6 py-10" colSpan={7}>
                    Memuat modul materi...
                  </td>
                </tr>
              ) : sortedModules.length === 0 ? (
                <tr>
                  <td className="px-6 py-10" colSpan={7}>
                    Belum ada modul materi.
                  </td>
                </tr>
              ) : (
                paginatedModules.map((module) => (
                  <tr key={module.id} className="border-b border-border/40 align-top">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-primary">{module.title}</p>
                      {(module.bab || module.subBab) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {module.bab ? `Bab: ${module.bab}` : "Bab: -"}{" "}
                          {module.subBab ? `| Bagian: ${module.subBab}` : ""}
                        </p>
                      )}
                      {module.summary && (
                        <p className="mt-1 max-w-[360px] text-xs text-muted-foreground">
                          {module.summary}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {module.content ? (
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            Teks
                          </Badge>
                        ) : null}
                        {module.pdfDataUrl ? (
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            PDF
                          </Badge>
                        ) : null}
                        {module.pptDataUrl ? (
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            PPT
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {module.packages.length ? (
                        <div className="max-w-[220px] space-y-1">
                          <p className="line-clamp-1 text-sm font-medium text-primary">
                            {module.packages[0]?.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full text-[11px]">
                              {module.packages.length} paket
                            </Badge>
                            {module.packages.length > 1 && (
                              <span className="text-[11px] text-muted-foreground">
                                +{module.packages.length - 1} lainnya
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Manual per siswa</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={
                          module.isPublished
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }
                      >
                        {module.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">{module.createdBy.name}</td>
                    <td className="px-6 py-4">{module.accessCount} siswa</td>
                    <td className="px-6 py-4">{formatDateTime(module.updatedAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadModule(module)}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" /> Download
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditModule(module)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteModule(module)}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!modulesLoading && sortedModules.length > 0 && (
          <div className="border-t border-border/60">
            <TablePagination
              currentPage={safeModulePage}
              totalPages={totalModulePages}
              totalItems={sortedModules.length}
              pageSize={MODULE_TABLE_PAGE_SIZE}
              onPageChange={setModulePage}
            />
          </div>
        )}

        {canManageAccess && (
          <div className="space-y-4 rounded-3xl bg-card p-6 shadow-xl">
            <div>
              <h3 className="text-lg font-semibold text-primary">Akses Modul Siswa</h3>
              <p className="text-sm text-muted-foreground">
                Admin dapat menentukan modul materi mana saja yang boleh diakses setiap siswa.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Nama</th>
                    <th className="px-3 py-3 font-semibold">Username</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Modul Aktif</th>
                    <th className="px-3 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {accessLoading ? (
                    <tr>
                      <td className="px-3 py-8" colSpan={5}>
                        Memuat data akses modul...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8" colSpan={5}>
                        Belum ada siswa terdaftar.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((student) => (
                      <tr key={student.id} className="border-b border-border/40">
                        <td className="px-3 py-3 font-medium text-primary">{student.name}</td>
                        <td className="px-3 py-3">{getAccountIdentifier(student)}</td>
                        <td className="px-3 py-3">
                          <Badge
                            variant="outline"
                            className={
                              student.isValidated
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            }
                          >
                            {student.isValidated ? "Aktif" : "Belum Validasi"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">{student.moduleIds.length}</td>
                        <td className="px-3 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStudentAccessDialog(student)}
                          >
                            <UserCheck className="mr-1 h-3.5 w-3.5" /> Atur Akses
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!accessLoading && students.length > 0 && (
              <TablePagination
                currentPage={safeStudentAccessPage}
                totalPages={totalStudentAccessPages}
                totalItems={students.length}
                pageSize={STUDENT_ACCESS_PAGE_SIZE}
                onPageChange={setStudentAccessPage}
              />
            )}
          </div>
        )}
      </section>

      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedModule ? "Edit Modul Materi" : "Tambah Modul Materi"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="module-title">Judul Modul</Label>
              <Input
                id="module-title"
                value={moduleForm.title}
                onChange={(event) =>
                  setModuleForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-bab">Bab</Label>
              <Input
                id="module-bab"
                value={moduleForm.bab}
                onChange={(event) =>
                  setModuleForm((prev) => ({ ...prev, bab: event.target.value }))
                }
                placeholder="Contoh: Bab 1 - Pengantar"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-sub-bab">Bagian</Label>
              <Input
                id="module-sub-bab"
                value={moduleForm.subBab}
                onChange={(event) =>
                  setModuleForm((prev) => ({ ...prev, subBab: event.target.value }))
                }
                placeholder="Contoh: 1.1 Dasar Materi"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-summary">Ringkasan (opsional)</Label>
              <Textarea
                id="module-summary"
                className="min-h-20"
                value={moduleForm.summary}
                onChange={(event) =>
                  setModuleForm((prev) => ({ ...prev, summary: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-content">Isi Materi Manual (opsional)</Label>
              <Textarea
                id="module-content"
                className="min-h-56"
                value={moduleForm.content}
                onChange={(event) =>
                  setModuleForm((prev) => ({ ...prev, content: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Isi materi minimal 10 karakter jika diisi. Anda bisa pakai materi teks,
                PDF, PPT, atau kombinasinya.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-pdf-upload">Upload PDF Modul (opsional)</Label>
              <Input
                id="module-pdf-upload"
                type="file"
                accept="application/pdf,.pdf"
                onChange={async (event) => {
                  await handleAttachModulePdf(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <p className="text-xs text-muted-foreground">
                Maksimal 10MB. PDF ini akan langsung bisa dilihat oleh siswa.
              </p>
              {moduleForm.pdfDataUrl && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium text-primary">
                    {moduleForm.pdfFileName || "modul-materi.pdf"}
                  </span>
                  <span>({formatFileSize(moduleForm.pdfSizeInBytes)})</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() =>
                      void handleOpenAttachment(
                        moduleForm.pdfDataUrl,
                        moduleForm.pdfFileName
                      )
                    }
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Buka PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={handleRemoveModulePdf}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Hapus PDF
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-ppt-upload">Upload PPT Modul (opsional)</Label>
              <Input
                id="module-ppt-upload"
                type="file"
                accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={async (event) => {
                  await handleAttachModulePpt(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <p className="text-xs text-muted-foreground">
                Maksimal 15MB. PPT/PPTX akan ikut tersimpan untuk akses siswa.
              </p>
              {moduleForm.pptDataUrl && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium text-primary">
                    {moduleForm.pptFileName || "modul-materi.pptx"}
                  </span>
                  <span>({formatFileSize(moduleForm.pptSizeInBytes)})</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() =>
                      void handleOpenAttachment(
                        moduleForm.pptDataUrl,
                        moduleForm.pptFileName
                      )
                    }
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Buka PPT
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={handleRemoveModulePpt}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Hapus PPT
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Paket Yang Mendapat Modul Ini</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={packagesLoading || packageItems.length === 0}
                    onClick={handleSelectAllModulePackages}
                  >
                    Pilih Semua
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={moduleForm.packageIds.length === 0}
                    onClick={handleClearAllModulePackages}
                  >
                    Kosongkan
                  </Button>
                </div>
              </div>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-border/70 p-3">
                {packagesLoading ? (
                  <p className="text-xs text-muted-foreground">Memuat daftar paket...</p>
                ) : packageItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Belum ada paket tersedia.
                  </p>
                ) : (
                  packageItems.map((pkg) => (
                    <label
                      key={pkg.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-primary">{pkg.title}</p>
                        <p className="text-xs text-muted-foreground">{pkg.category}</p>
                      </div>
                      <Checkbox
                        checked={moduleForm.packageIds.includes(pkg.id)}
                        onCheckedChange={(value) =>
                          handleToggleModulePackage(pkg.id, Boolean(value))
                        }
                      />
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Jika tidak dipilih, modul hanya bisa diberikan manual melalui "Akses Modul Siswa".
                {packageItems.length > 0
                  ? ` (${moduleForm.packageIds.length}/${packageItems.length} paket dipilih)`
                  : ""}
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              <Checkbox
                checked={moduleForm.isPublished}
                onCheckedChange={(value) =>
                  setModuleForm((prev) => ({
                    ...prev,
                    isPublished: Boolean(value)
                  }))
                }
              />
              Modul siap ditampilkan ke siswa (Published)
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModuleDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveModule} disabled={isUploadingModuleFile}>
              <BookOpenText className="mr-1 h-4 w-4" />
              {isUploadingModuleFile
                ? "Mengupload File..."
                : selectedModule
                  ? "Simpan Perubahan"
                  : "Tambah Modul"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Atur Akses Modul - {selectedStudent?.name ?? "-"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pilih modul yang boleh diakses oleh siswa ini.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {studentModuleIds.length}/{accessModules.length} modul dipilih
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={accessModules.length === 0 || areAllStudentModulesSelected}
                  onClick={handleSelectAllStudentModules}
                >
                  Pilih Semua
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={studentModuleIds.length === 0}
                  onClick={handleClearAllStudentModules}
                >
                  Hapus Semua
                </Button>
              </div>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/70 p-3">
              {accessModules.map((module) => (
                <label
                  key={module.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-primary">{module.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {module.isPublished ? "Published" : "Draft"}
                    </p>
                  </div>
                  <Checkbox
                    checked={studentModuleIds.includes(module.id)}
                    onCheckedChange={(value) =>
                      handleToggleStudentModule(module.id, Boolean(value))
                    }
                  />
                </label>
              ))}
              {accessModules.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Belum ada modul materi yang bisa dipilih.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAccessDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveStudentAccess}>Simpan Akses</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModuleManager;
