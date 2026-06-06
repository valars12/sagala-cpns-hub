import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { jsPDF } from "jspdf";
import api from "@/lib/api-client";
import type {
  AdminPackage,
  AdminPackagesResponse,
  AdminQuestion,
  AdminQuestionSessionsResponse,
  AdminQuestionsResponse,
  QuestionCategory,
  QuestionSessionType
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
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { openDataUrlInNewTab } from "@/lib/data-url";
import {
  Copy,
  Download,
  FilePenLine,
  ListChecks,
  Pencil,
  PlusCircle,
  Save,
  Settings2,
  Trash2
} from "lucide-react";
import TablePagination from "@/components/admin/TablePagination";

const ADMIN_TABLE_PAGE_SIZE = 10;
const SESSION_EDITOR_PAGE_SIZE = 5;
const fileInputAccentClassName =
  "cursor-pointer border-amber-300 bg-amber-50/80 text-amber-900 file:mr-4 file:rounded-md file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:font-semibold file:text-amber-950 hover:file:bg-amber-500 focus-visible:ring-amber-400";

const categoryBadgeStyles: Record<QuestionCategory, string> = {
  TKP: "bg-amber-100 text-amber-700 border-amber-200",
  TIU: "bg-blue-100 text-blue-700 border-blue-200",
  TWK: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const QUESTION_SESSION_TYPES: QuestionSessionType[] = ["TRYOUT", "LATIHAN"];

const toSessionDisplayName = (sessionType: QuestionSessionType) =>
  sessionType === "TRYOUT" ? "Tryout" : "Latihan";

const getDefaultSessionCode = (
  sessionType: QuestionSessionType,
  sessionOrder: number
) => `${sessionType}-${Math.max(sessionOrder, 1)}`;

const getDefaultSessionTitle = (
  sessionType: QuestionSessionType,
  sessionOrder: number
) => `${toSessionDisplayName(sessionType)} ${Math.max(sessionOrder, 1)}`;

type SessionEditorItem = {
  key: string;
  packageId: string;
  packageTitle: string;
  sessionType: QuestionSessionType;
  sessionOrder: number;
  sessionCode: string;
  sessionTitle: string;
  sessionDurationMinutes: number;
  questionCount: number;
  questionBreakdown: Record<QuestionCategory, number>;
  questions: AdminQuestion[];
};

type QuestionOptionForm = {
  text: string;
  imageUrl: string;
  score: string;
};

const DEFAULT_QUESTION_OPTION_COUNT = 5;

const createEmptyOption = (): QuestionOptionForm => ({
  text: "",
  imageUrl: "",
  score: "",
});

const createDefaultOptions = () =>
  Array.from({ length: DEFAULT_QUESTION_OPTION_COUNT }, () => createEmptyOption());

const defaultSubtestByCategory = (category: QuestionCategory) => {
  if (category === "TWK") return "TWK - Subtest Nasionalisme";
  if (category === "TIU") return "TIU - Subtest Deret";
  return "TKP - Subtest Pelayanan Publik";
};

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

const toLocalDateKey = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const normalizeDiscountPercent = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const getOriginalPriceFromDiscount = (
  currentPrice: number,
  discountPercent?: number | null
) => {
  const safeDiscount = normalizeDiscountPercent(discountPercent);
  if (safeDiscount <= 0 || safeDiscount >= 100) {
    return currentPrice;
  }
  return Math.round(currentPrice / (1 - safeDiscount / 100));
};

const splitLines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

const highlightsToText = (highlights: Array<{ title: string; value: string }>) =>
  highlights.map((item) => `${item.title}|${item.value}`).join("\n");

const parseHighlights = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...rest] = line.split("|");
      return {
        title: title?.trim() ?? "",
        value: rest.join("|").trim(),
      };
    })
    .filter((item) => item.title && item.value);

const getErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError(error) ? error.response?.data?.message ?? fallback : fallback;

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

const exportQuestionsToPdf = async ({
  fileName,
  scopeLabel,
  rows,
  filters
}: {
  fileName: string;
  scopeLabel: string;
  rows: AdminQuestion[];
  filters: {
    packageId: string | null;
    category: QuestionCategory | null;
    sessionType: QuestionSessionType | null;
    sessionCode: string | null;
    createdDate: string | null;
    sortOrder: "NEWEST" | "OLDEST";
  };
}) => {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const topMargin = 44;
  const bottomMargin = 44;
  const maxWidth = pageWidth - marginX * 2;
  let y = topMargin;

  const ensureSpace = (requiredHeight = 16) => {
    if (y + requiredHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = topMargin;
    }
  };

  const addVerticalSpace = (space = 8) => {
    ensureSpace(space);
    y += space;
  };

  const writeText = ({
    text,
    size = 10,
    style = "normal",
    indent = 0,
    lineHeight = 14,
    paragraphGap = 4
  }: {
    text: string;
    size?: number;
    style?: "normal" | "bold";
    indent?: number;
    lineHeight?: number;
    paragraphGap?: number;
  }) => {
    if (!text.trim()) return;

    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth - indent);

    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, marginX + indent, y);
      y += lineHeight;
    }
    y += paragraphGap;
  };

  const isDataImageUrl = (value: string) => /^data:image\//i.test(value);
  const isHttpImageUrl = (value: string) => /^https?:\/\//i.test(value);
  const isBlobImageUrl = (value: string) => /^blob:/i.test(value);
  const isRelativeImageUrl = (value: string) =>
    value.startsWith("/") || value.startsWith("./") || value.startsWith("../");
  const isLikelyRawBase64 = (value: string) =>
    value.length > 140 &&
    !value.includes("://") &&
    !value.includes("/") &&
    !value.includes("\\") &&
    /^[A-Za-z0-9+/=\r\n]+$/.test(value);

  const loadImageForPdf = async (source: string) => {
    const normalizedSource = source.trim();
    if (!normalizedSource) return null;

    let localObjectUrl: string | null = null;
    let renderSource = normalizedSource;

    try {
      if (isHttpImageUrl(normalizedSource)) {
        const response = await fetch(normalizedSource);
        if (!response.ok) {
          throw new Error("Gagal mengunduh gambar.");
        }

        const imageBlob = await response.blob();
        localObjectUrl = URL.createObjectURL(imageBlob);
        renderSource = localObjectUrl;
      }

      if (
        !isDataImageUrl(renderSource) &&
        !isBlobImageUrl(renderSource) &&
        !isHttpImageUrl(renderSource) &&
        !isRelativeImageUrl(renderSource)
      ) {
        return null;
      }

      const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Gagal memuat gambar."));
        image.src = renderSource;
      });

      const width = Math.max(1, imageElement.naturalWidth || imageElement.width);
      const height = Math.max(1, imageElement.naturalHeight || imageElement.height);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas tidak tersedia.");
      }

      context.drawImage(imageElement, 0, 0, width, height);

      return {
        dataUrl: canvas.toDataURL("image/png"),
        width,
        height
      };
    } finally {
      if (localObjectUrl) {
        URL.revokeObjectURL(localObjectUrl);
      }
    }
  };

  const writeLabelParagraph = (
    label: string,
    text: string,
    {
      indent = 0,
      textSize = 10,
      labelSize = 10,
      lineHeight = 14,
      paragraphGap = 6
    }: {
      indent?: number;
      textSize?: number;
      labelSize?: number;
      lineHeight?: number;
      paragraphGap?: number;
    } = {}
  ) => {
    writeText({
      text: `${label}:`,
      size: labelSize,
      style: "bold",
      indent,
      lineHeight,
      paragraphGap: 2
    });
    writeText({
      text,
      size: textSize,
      indent: indent + 14,
      lineHeight,
      paragraphGap
    });
  };

  const drawDivider = ({
    color = 226,
    gapBefore = 4,
    gapAfter = 10
  }: {
    color?: number;
    gapBefore?: number;
    gapAfter?: number;
  } = {}) => {
    addVerticalSpace(gapBefore);
    ensureSpace(4);
    doc.setDrawColor(color);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += gapAfter;
  };

  const drawQuestionHeader = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const headerLines = doc.splitTextToSize(title, maxWidth - 28);
    const lineHeight = 16;
    const headerHeight = headerLines.length * lineHeight + 12;

    ensureSpace(headerHeight + 8);
    doc.setFillColor(246, 248, 252);
    doc.setDrawColor(217, 223, 234);
    doc.roundedRect(marginX, y, maxWidth, headerHeight, 8, 8, "FD");

    doc.setTextColor(17, 24, 39);
    let textY = y + 18;
    for (const line of headerLines) {
      doc.text(line, marginX + 14, textY);
      textY += lineHeight;
    }

    y += headerHeight + 10;
  };

  const writeImageBlock = async ({
    label,
    source,
    indent = 0,
    maxImageHeight = 210,
    paragraphGap = 8
  }: {
    label: string;
    source?: string | null;
    indent?: number;
    maxImageHeight?: number;
    paragraphGap?: number;
  }) => {
    if (!source?.trim()) return;
    const normalizedSource = source.trim();

    const fallbackMessage = isDataImageUrl(normalizedSource) || isLikelyRawBase64(normalizedSource)
      ? "Gambar tersedia, tetapi tidak dapat dirender pada file PDF ini."
      : `Link gambar: ${
          normalizedSource.length > 180
            ? `${normalizedSource.slice(0, 177)}...`
            : normalizedSource
        }`;

    writeText({
      text: `${label}:`,
      size: 9,
      style: "bold",
      indent,
      lineHeight: 13,
      paragraphGap: 3
    });

    try {
      const imagePayload = await loadImageForPdf(normalizedSource);
      if (!imagePayload) {
        writeText({
          text: fallbackMessage,
          size: 9,
          indent: indent + 14,
          lineHeight: 13,
          paragraphGap
        });
        return;
      }

      const containerWidth = maxWidth - indent;
      const imagePadding = 10;
      const maxImageWidth = containerWidth - imagePadding * 2;

      const aspectRatio = imagePayload.height / imagePayload.width;
      let renderWidth = maxImageWidth;
      let renderHeight = renderWidth * aspectRatio;

      if (renderHeight > maxImageHeight) {
        const scale = maxImageHeight / renderHeight;
        renderWidth *= scale;
        renderHeight *= scale;
      }

      const containerHeight = renderHeight + imagePadding * 2;
      ensureSpace(containerHeight + paragraphGap);

      const boxX = marginX + indent;
      const boxY = y;
      doc.setFillColor(250, 251, 253);
      doc.setDrawColor(221, 226, 235);
      doc.roundedRect(boxX, boxY, containerWidth, containerHeight, 6, 6, "FD");

      const imageX = boxX + (containerWidth - renderWidth) / 2;
      const imageY = boxY + imagePadding;
      doc.addImage(imagePayload.dataUrl, "PNG", imageX, imageY, renderWidth, renderHeight);

      y += containerHeight + paragraphGap;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kendala saat memuat gambar.";

      writeText({
        text: `${fallbackMessage} (${message})`,
        size: 9,
        indent: indent + 14,
        lineHeight: 13,
        paragraphGap
      });
    }
  };

  const activeFilterText = [
    filters.packageId ? `Paket: ${filters.packageId}` : "Paket: Semua",
    filters.category ? `Kategori: ${filters.category}` : "Kategori: Semua",
    filters.sessionType
      ? `Jenis Sesi: ${toSessionDisplayName(filters.sessionType)}`
      : "Jenis Sesi: Semua",
    filters.sessionCode ? `Kode Sesi: ${filters.sessionCode}` : "Kode Sesi: Semua",
    filters.createdDate ? `Tanggal Input: ${filters.createdDate}` : "Tanggal Input: Semua",
    `Urutan Waktu: ${
      filters.sortOrder === "NEWEST" ? "Terbaru ke Terlama" : "Terlama ke Terbaru"
    }`
  ].join(" | ");

  doc.setTextColor(17, 24, 39);
  writeText({
    text: "Laporan Bank Soal",
    size: 22,
    style: "bold",
    lineHeight: 24,
    paragraphGap: 8
  });
  writeText({
    text: `Cakupan: ${scopeLabel}`,
    size: 11,
    lineHeight: 16,
    paragraphGap: 2
  });
  writeText({
    text: `Tanggal export: ${new Date().toLocaleString("id-ID")}`,
    size: 11,
    lineHeight: 16,
    paragraphGap: 2
  });
  writeText({
    text: `Total soal: ${rows.length}`,
    size: 11,
    lineHeight: 16,
    paragraphGap: 4
  });
  writeLabelParagraph("Filter aktif", activeFilterText, {
    textSize: 10,
    labelSize: 10,
    lineHeight: 14,
    paragraphGap: 8
  });

  drawDivider({
    color: 207,
    gapBefore: 0,
    gapAfter: 14
  });

  for (const [questionIndex, question] of rows.entries()) {
    drawQuestionHeader(
      `${questionIndex + 1}. [${question.category}] ${question.sessionTitle} (${question.sessionCode})`
    );

    writeText({
      text: `Paket: ${question.package?.title ?? "-"} (${question.package?.slug ?? "-"})`,
      size: 10,
      style: "bold",
      lineHeight: 14,
      paragraphGap: 2
    });
    writeText({
      text: `Subtest: ${question.subtestTitle}`,
      size: 10,
      lineHeight: 14,
      paragraphGap: 8
    });

    writeLabelParagraph("Soal", question.prompt, {
      textSize: 11,
      labelSize: 10,
      lineHeight: 16,
      paragraphGap: 6
    });

    await writeImageBlock({
      label: "Gambar Soal",
      source: question.promptImageUrl,
      maxImageHeight: 240
    });

    writeText({
      text: "Pilihan Jawaban:",
      size: 10,
      style: "bold",
      lineHeight: 14,
      paragraphGap: 3
    });

    for (const [optionIndex, option] of question.options.entries()) {
      const label = String.fromCharCode(65 + optionIndex);
      const scoreText =
        option.score !== undefined && option.score !== null
          ? ` (Skor ${option.score})`
          : "";
      writeText({
        text: `${label}. ${option.text}${scoreText}`,
        indent: 16,
        size: 10,
        lineHeight: 14,
        paragraphGap: 3
      });
      await writeImageBlock({
        label: `Gambar Opsi ${label}`,
        source: option.imageUrl,
        indent: 16,
        maxImageHeight: 180,
        paragraphGap: 6
      });
    }

    addVerticalSpace(3);
    writeLabelParagraph("Kunci Jawaban", question.answer, {
      textSize: 11,
      labelSize: 10,
      lineHeight: 15,
      paragraphGap: 6
    });

    if (question.explanation) {
      writeLabelParagraph("Pembahasan", question.explanation, {
        textSize: 10,
        labelSize: 10,
        lineHeight: 15,
        paragraphGap: 6
      });
    }

    await writeImageBlock({
      label: "Gambar Pembahasan",
      source: question.explanationImageUrl,
      maxImageHeight: 220
    });

    drawDivider({
      color: 232,
      gapBefore: 2,
      gapAfter: 12
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    doc.setPage(pageIndex);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Halaman ${pageIndex} / ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 16,
      { align: "right" }
    );
  }

  doc.save(fileName);
};

const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jfif: "image/jpeg",
  jpe: "image/jpeg",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp"
};

const IMAGE_UPLOAD_ACCEPT =
  "image/*,.avif,.bmp,.gif,.heic,.heif,.jfif,.jpe,.jpeg,.jpg,.png,.svg,.tif,.tiff,.webp";
const PDF_UPLOAD_ACCEPT = ".pdf,application/pdf,application/x-pdf";
const QUESTION_PDF_MAX_BYTES = 10 * 1024 * 1024;

const getFileExtension = (fileName: string) => {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const inferMimeTypeFromFilename = (fileName: string) => {
  const extension = getFileExtension(fileName);
  return IMAGE_EXTENSION_TO_MIME[extension] ?? null;
};

const normalizeImageMimeType = (mimeType: string) => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/jpg" || normalized === "image/pjpeg") {
    return "image/jpeg";
  }
  return normalized;
};

const normalizePdfMimeType = (mimeType: string) => mimeType.trim().toLowerCase();

const isUploadableImageFile = (file: File) => {
  if (file.type && normalizeImageMimeType(file.type).startsWith("image/")) {
    return true;
  }

  return Boolean(inferMimeTypeFromFilename(file.name));
};

const isUploadablePdfFile = (file: File) => {
  const normalizedMimeType = normalizePdfMimeType(file.type || "");
  if (
    normalizedMimeType === "application/pdf" ||
    normalizedMimeType === "application/x-pdf"
  ) {
    return true;
  }

  return getFileExtension(file.name) === "pdf";
};

const normalizeImageDataUrl = (dataUrl: string, file: File) => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return dataUrl;

  const mimeTypeFromDataUrl = normalizeImageMimeType(match[1]);
  const base64Payload = match[2];

  if (mimeTypeFromDataUrl.startsWith("image/")) {
    return `data:${mimeTypeFromDataUrl};base64,${base64Payload}`;
  }

  const inferredMimeType = inferMimeTypeFromFilename(file.name);
  if (!inferredMimeType) return dataUrl;

  return `data:${inferredMimeType};base64,${base64Payload}`;
};

const normalizePdfDataUrl = (dataUrl: string, file: File) => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return dataUrl;

  const mimeTypeFromDataUrl = normalizePdfMimeType(match[1]);
  const base64Payload = match[2];
  const extension = getFileExtension(file.name);
  const isPdfMime =
    mimeTypeFromDataUrl === "application/pdf" ||
    mimeTypeFromDataUrl === "application/x-pdf";

  if (isPdfMime || mimeTypeFromDataUrl === "application/octet-stream" || extension === "pdf") {
    return `data:application/pdf;base64,${base64Payload}`;
  }

  return dataUrl;
};

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

type PackageQuestionManagerProps = {
  canManagePackages?: boolean;
  showPackageSection?: boolean;
  showQuestionSection?: boolean;
};

const PackageQuestionManager = ({
  canManagePackages = true,
  showPackageSection = true,
  showQuestionSection = true
}: PackageQuestionManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [questionPackageFilter, setQuestionPackageFilter] = useState<string>("ALL");
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState<
    QuestionCategory | "ALL"
  >("ALL");
  const [questionSessionTypeFilter, setQuestionSessionTypeFilter] = useState<
    QuestionSessionType | "ALL"
  >("ALL");
  const [questionSessionCodeFilter, setQuestionSessionCodeFilter] = useState("");
  const [questionCreatedDateFilter, setQuestionCreatedDateFilter] = useState("");
  const [questionSortOrder, setQuestionSortOrder] = useState<"NEWEST" | "OLDEST">(
    "NEWEST"
  );
  const [packagePage, setPackagePage] = useState(1);
  const [questionPage, setQuestionPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);

  const [selectedPackage, setSelectedPackage] = useState<AdminPackage | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<AdminQuestion | null>(null);
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isManualSubtestTitle, setIsManualSubtestTitle] = useState(false);
  const [quickEntryMode, setQuickEntryMode] = useState(true);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [selectedSessionForEdit, setSelectedSessionForEdit] =
    useState<SessionEditorItem | null>(null);
  const [sessionEditForm, setSessionEditForm] = useState({
    sessionCode: "",
    sessionTitle: "",
    sessionDurationMinutes: "100"
  });
  const [sessionQuestionOrderMap, setSessionQuestionOrderMap] = useState<
    Record<string, string>
  >({});
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isDuplicatingQuestionId, setIsDuplicatingQuestionId] = useState<string | null>(
    null
  );
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const [packageForm, setPackageForm] = useState({
    slug: "",
    title: "",
    subtitle: "",
    description: "",
    category: "",
    level: "",
    imageUrl: "",
    price: "0",
    discountPercent: "50",
    durationDays: "365",
    tryoutDurationMinutes: "100",
    latihanDurationMinutes: "20",
    tryoutAccessStart: "1",
    tryoutAccessEnd: "",
    latihanAccessStart: "1",
    latihanAccessEnd: "",
    sessionSourceSessionKeys: [] as string[],
    badge: "",
    features: "",
    whatsIncluded: "",
    highlights: "",
  });

  const [questionForm, setQuestionForm] = useState({
    packageId: "",
    category: "TIU" as QuestionCategory,
    sessionType: "TRYOUT" as QuestionSessionType,
    sessionCode: getDefaultSessionCode("TRYOUT", 1),
    sessionTitle: getDefaultSessionTitle("TRYOUT", 1),
    sessionOrder: "1",
    subtestTitle: defaultSubtestByCategory("TIU"),
    prompt: "",
    promptImageUrl: "",
    promptPdfDataUrl: "",
    promptPdfFileName: "",
    options: createDefaultOptions(),
    answer: "",
    explanation: "",
    explanationImageUrl: "",
  });

  const {
    data: packages,
    isLoading: packagesLoading,
    isError: packagesError,
    error: packagesQueryError,
  } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => {
      const { data } = await api.get<AdminPackagesResponse>("/api/admin/packages");
      return data.data;
    },
  });

  const {
    data: questions,
    isLoading: questionsLoading,
    isError: questionsError,
    error: questionsQueryError,
  } = useQuery({
    queryKey: [
      "admin-questions",
      questionPackageFilter,
      questionCategoryFilter,
      questionSessionTypeFilter,
      questionSessionCodeFilter
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (questionPackageFilter !== "ALL") {
        params.append("packageId", questionPackageFilter);
      }
      if (questionCategoryFilter !== "ALL") {
        params.append("category", questionCategoryFilter);
      }
      if (questionSessionTypeFilter !== "ALL") {
        params.append("sessionType", questionSessionTypeFilter);
      }
      if (questionSessionCodeFilter.trim()) {
        params.append("sessionCode", questionSessionCodeFilter.trim().toUpperCase());
      }

      const query = params.toString();
      const endpoint = query ? `/api/admin/questions?${query}` : "/api/admin/questions";
      const { data } = await api.get<AdminQuestionsResponse>(endpoint);
      return data.data;
    },
  });

  const { data: sessionEditorQuestions } = useQuery({
    queryKey: ["admin-questions-session-editor", questionPackageFilter],
    enabled: questionPackageFilter !== "ALL",
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("packageId", questionPackageFilter);
      const { data } = await api.get<AdminQuestionsResponse>(
        `/api/admin/questions?${params.toString()}`
      );
      return data.data;
    }
  });

  const {
    data: questionSessions,
    isLoading: questionSessionsLoading,
  } = useQuery({
    queryKey: ["admin-question-sessions"],
    queryFn: async () => {
      const { data } = await api.get<AdminQuestionSessionsResponse>(
        "/api/admin/question-sessions"
      );
      return data.data;
    },
  });

  const totalQuestionCount = useMemo(
    () => (packages ?? []).reduce((sum, pkg) => sum + pkg.questionCount, 0),
    [packages]
  );

  const packageRows = packages ?? [];
  const rawQuestionRows = questions ?? [];
  const questionRows = useMemo(() => {
    const rows = [...rawQuestionRows];
    const normalizedDateFilter = questionCreatedDateFilter.trim();

    const filteredByDate = normalizedDateFilter
      ? rows.filter(
          (question) => toLocalDateKey(question.createdAt) === normalizedDateFilter
        )
      : rows;

    return filteredByDate.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      const safeATime = Number.isFinite(aTime) ? aTime : 0;
      const safeBTime = Number.isFinite(bTime) ? bTime : 0;
      const createdAtDiff = safeBTime - safeATime;

      if (createdAtDiff !== 0) {
        return questionSortOrder === "NEWEST" ? createdAtDiff : -createdAtDiff;
      }

      if (a.questionOrder !== b.questionOrder) {
        return a.questionOrder - b.questionOrder;
      }

      return a.id.localeCompare(b.id);
    });
  }, [questionCreatedDateFilter, questionSortOrder, rawQuestionRows]);
  const sessionEditorSourceRows = sessionEditorQuestions ?? [];
  const sessionMetaSourceRows =
    sessionEditorSourceRows.length > 0 ? sessionEditorSourceRows : rawQuestionRows;
  const selectedPackageForQuestionFilter =
    questionPackageFilter === "ALL"
      ? null
      : packageRows.find((pkg) => pkg.id === questionPackageFilter) ?? null;

  const sessionEditorItems = useMemo(() => {
    if (!selectedPackageForQuestionFilter) return [] as SessionEditorItem[];

    const grouped = new Map<string, SessionEditorItem>();

    for (const question of sessionEditorSourceRows) {
      const sessionKey = `${question.sessionType}:${question.sessionOrder}`;
      const defaultCode = getDefaultSessionCode(
        question.sessionType,
        question.sessionOrder
      );
      const defaultTitle = getDefaultSessionTitle(
        question.sessionType,
        question.sessionOrder
      );
      const sessionCode = question.sessionCode?.trim() || defaultCode;
      const sessionTitle = question.sessionTitle?.trim() || defaultTitle;

      const existing = grouped.get(sessionKey);
      if (!existing) {
        grouped.set(sessionKey, {
          key: sessionKey,
          packageId: selectedPackageForQuestionFilter.id,
          packageTitle: selectedPackageForQuestionFilter.title,
          sessionType: question.sessionType,
          sessionOrder: question.sessionOrder,
          sessionCode,
          sessionTitle,
          sessionDurationMinutes:
            question.sessionType === "TRYOUT"
              ? selectedPackageForQuestionFilter.tryoutDurationMinutes
              : selectedPackageForQuestionFilter.latihanDurationMinutes,
          questionCount: 1,
          questionBreakdown: {
            TKP: question.category === "TKP" ? 1 : 0,
            TIU: question.category === "TIU" ? 1 : 0,
            TWK: question.category === "TWK" ? 1 : 0
          },
          questions: [question]
        });
        continue;
      }

      existing.questionCount += 1;
      existing.questions.push(question);
      existing.questionBreakdown[question.category] += 1;
      if (existing.sessionCode === defaultCode && sessionCode !== defaultCode) {
        existing.sessionCode = sessionCode;
      }
      if (existing.sessionTitle === defaultTitle && sessionTitle !== defaultTitle) {
        existing.sessionTitle = sessionTitle;
      }
    }

    return Array.from(grouped.values())
      .map((session) => ({
        ...session,
        questions: [...session.questions].sort((a, b) => {
          if (a.questionOrder !== b.questionOrder) {
            return a.questionOrder - b.questionOrder;
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })
      }))
      .sort((a, b) => {
        if (a.sessionType !== b.sessionType) {
          if (a.sessionType === "TRYOUT") return -1;
          if (b.sessionType === "TRYOUT") return 1;
        }
        return a.sessionOrder - b.sessionOrder;
      });
  }, [selectedPackageForQuestionFilter, sessionEditorSourceRows]);

  const totalPackagePages = Math.max(
    1,
    Math.ceil(packageRows.length / ADMIN_TABLE_PAGE_SIZE)
  );
  const safePackagePage = Math.min(packagePage, totalPackagePages);
  const paginatedPackages = useMemo(() => {
    const startIndex = (safePackagePage - 1) * ADMIN_TABLE_PAGE_SIZE;
    return packageRows.slice(startIndex, startIndex + ADMIN_TABLE_PAGE_SIZE);
  }, [packageRows, safePackagePage]);

  const totalQuestionPages = Math.max(
    1,
    Math.ceil(questionRows.length / ADMIN_TABLE_PAGE_SIZE)
  );
  const safeQuestionPage = Math.min(questionPage, totalQuestionPages);
  const paginatedQuestions = useMemo(() => {
    const startIndex = (safeQuestionPage - 1) * ADMIN_TABLE_PAGE_SIZE;
    return questionRows.slice(startIndex, startIndex + ADMIN_TABLE_PAGE_SIZE);
  }, [questionRows, safeQuestionPage]);
  const selectedQuestionIdSet = useMemo(
    () => new Set(selectedQuestionIds),
    [selectedQuestionIds]
  );
  const selectedQuestionsOnPageCount = useMemo(
    () =>
      paginatedQuestions.filter((question) => selectedQuestionIdSet.has(question.id)).length,
    [paginatedQuestions, selectedQuestionIdSet]
  );
  const isAllQuestionsOnPageSelected =
    paginatedQuestions.length > 0 &&
    selectedQuestionsOnPageCount === paginatedQuestions.length;
  const hasSomeQuestionsOnPageSelected =
    selectedQuestionsOnPageCount > 0 && !isAllQuestionsOnPageSelected;

  const totalSessionPages = Math.max(
    1,
    Math.ceil(sessionEditorItems.length / SESSION_EDITOR_PAGE_SIZE)
  );
  const safeSessionPage = Math.min(sessionPage, totalSessionPages);
  const paginatedSessionEditorItems = useMemo(() => {
    const startIndex = (safeSessionPage - 1) * SESSION_EDITOR_PAGE_SIZE;
    return sessionEditorItems.slice(startIndex, startIndex + SESSION_EDITOR_PAGE_SIZE);
  }, [safeSessionPage, sessionEditorItems]);

  useEffect(() => {
    if (packagePage > totalPackagePages) {
      setPackagePage(totalPackagePages);
    }
  }, [packagePage, totalPackagePages]);

  useEffect(() => {
    if (questionPage > totalQuestionPages) {
      setQuestionPage(totalQuestionPages);
    }
  }, [questionPage, totalQuestionPages]);

  useEffect(() => {
    if (!questionRows.length) {
      setSelectedQuestionIds([]);
      return;
    }

    const visibleIdSet = new Set(questionRows.map((question) => question.id));
    setSelectedQuestionIds((prev) => prev.filter((id) => visibleIdSet.has(id)));
  }, [questionRows]);

  useEffect(() => {
    if (sessionPage > totalSessionPages) {
      setSessionPage(totalSessionPages);
    }
  }, [sessionPage, totalSessionPages]);

  useEffect(() => {
    setSessionPage(1);
  }, [questionPackageFilter]);

  useEffect(() => {
    if (!selectedSessionForEdit) return;

    const refreshedSession = sessionEditorItems.find(
      (item) =>
        item.packageId === selectedSessionForEdit.packageId &&
        item.key === selectedSessionForEdit.key
    );

    if (!refreshedSession) {
      setSelectedSessionForEdit(null);
      setIsSessionDialogOpen(false);
      return;
    }

    setSelectedSessionForEdit(refreshedSession);
    setSessionQuestionOrderMap(
      refreshedSession.questions.reduce<Record<string, string>>((result, question) => {
        result[question.id] = String(Math.max(question.questionOrder || 1, 1));
        return result;
      }, {})
    );
  }, [sessionEditorItems, selectedSessionForEdit]);

  const availableAnswerOptions = useMemo(
    () =>
      questionForm.options
        .map((option) => option.text.trim())
        .filter(Boolean),
    [questionForm.options]
  );

  const activeSessionQuestionCount = useMemo(() => {
    const sessionOrder = Math.max(Number(questionForm.sessionOrder) || 1, 1);
    const sessionKey = `${questionForm.sessionType}:${sessionOrder}`;
    const selectedSession = sessionEditorItems.find((item) => item.key === sessionKey);
    if (selectedSession) {
      return selectedSession.questionCount;
    }

    const globalSession = (questionSessions ?? []).find(
      (session) => session.key === sessionKey
    );
    return globalSession?.questionCount ?? 0;
  }, [
    questionForm.sessionOrder,
    questionForm.sessionType,
    questionSessions,
    sessionEditorItems
  ]);

  const refreshPackages = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
  };

  const refreshQuestions = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-questions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-questions-session-editor"] })
    ]);
  };

  const refreshQuestionSessions = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-question-sessions"] });
  };

  const buildQuestionExportQuery = (
    forcedSessionType?: QuestionSessionType
  ) => {
    const params = new URLSearchParams();

    if (questionPackageFilter !== "ALL") {
      params.set("packageId", questionPackageFilter);
    }
    if (questionCategoryFilter !== "ALL") {
      params.set("category", questionCategoryFilter);
    }

    const resolvedSessionType =
      forcedSessionType ??
      (questionSessionTypeFilter !== "ALL" ? questionSessionTypeFilter : null);
    if (resolvedSessionType) {
      params.set("sessionType", resolvedSessionType);
    }

    const normalizedSessionCode = questionSessionCodeFilter.trim().toUpperCase();
    if (normalizedSessionCode) {
      params.set("sessionCode", normalizedSessionCode);
    }

    return params;
  };

  const exportQuestionRows = async (scopeLabel: string, rows: AdminQuestion[]) => {
    if (!rows.length) {
      toast({
        title: "Data soal kosong",
        description: "Tidak ada soal yang bisa diunduh untuk filter ini.",
        variant: "destructive"
      });
      return;
    }

    const activeFilters = {
      packageId: questionPackageFilter === "ALL" ? null : questionPackageFilter,
      category: questionCategoryFilter === "ALL" ? null : questionCategoryFilter,
      sessionType:
        questionSessionTypeFilter === "ALL" ? null : questionSessionTypeFilter,
      sessionCode: questionSessionCodeFilter.trim().toUpperCase() || null,
      createdDate: questionCreatedDateFilter || null,
      sortOrder: questionSortOrder
    };
    const fileLabel = normalizeFileNameSegment(scopeLabel);
    try {
      await exportQuestionsToPdf({
        fileName: `bank-soal-${fileLabel}-${getExportTimestamp()}.pdf`,
        scopeLabel,
        rows,
        filters: activeFilters
      });

      toast({
        title: "Download dimulai",
        description: `${rows.length} soal berhasil disiapkan dalam PDF.`
      });
    } catch (error) {
      toast({
        title: "Gagal mengunduh soal",
        description: getErrorMessage(error, "Terjadi kendala saat menyiapkan file soal."),
        variant: "destructive"
      });
    }
  };

  const handleExportFilteredQuestions = () => {
    void exportQuestionRows("Filter Aktif", questionRows);
  };

  const handleExportQuestionsBySessionType = async (
    sessionType: QuestionSessionType
  ) => {
    try {
      const params = buildQuestionExportQuery(sessionType);
      const query = params.toString();
      const endpoint = query ? `/api/admin/questions?${query}` : "/api/admin/questions";
      const { data } = await api.get<AdminQuestionsResponse>(endpoint);
      const normalizedDateFilter = questionCreatedDateFilter.trim();
      const filteredRows = normalizedDateFilter
        ? data.data.filter(
            (question) => toLocalDateKey(question.createdAt) === normalizedDateFilter
          )
        : data.data;
      const sortedRows = [...filteredRows].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        const safeATime = Number.isFinite(aTime) ? aTime : 0;
        const safeBTime = Number.isFinite(bTime) ? bTime : 0;
        const createdAtDiff = safeBTime - safeATime;
        if (createdAtDiff !== 0) {
          return questionSortOrder === "NEWEST" ? createdAtDiff : -createdAtDiff;
        }
        return a.id.localeCompare(b.id);
      });

      await exportQuestionRows(
        sessionType === "TRYOUT" ? "Tryout" : "Latihan",
        sortedRows
      );
    } catch (error) {
      toast({
        title: "Gagal mengunduh soal",
        description: getErrorMessage(error, "Terjadi kendala saat menyiapkan file soal."),
        variant: "destructive"
      });
    }
  };

  const openCreatePackage = () => {
    setSelectedPackage(null);
    setPackageForm({
      slug: "",
      title: "",
      subtitle: "",
      description: "",
      category: packages?.[0]?.category ?? "CPNS S1/S2",
      level: "",
      imageUrl: "",
      price: "0",
      discountPercent: "50",
      durationDays: "365",
      tryoutDurationMinutes: "100",
      latihanDurationMinutes: "20",
      tryoutAccessStart: "1",
      tryoutAccessEnd: "",
      latihanAccessStart: "1",
      latihanAccessEnd: "",
      sessionSourceSessionKeys: [],
      badge: "",
      features: "",
      whatsIncluded: "",
      highlights: "",
    });
    setIsPackageDialogOpen(true);
  };

  const openEditPackage = (pkg: AdminPackage) => {
    setSelectedPackage(pkg);
    setPackageForm({
      slug: pkg.slug,
      title: pkg.title,
      subtitle: pkg.subtitle ?? "",
      description: pkg.description,
      category: pkg.category,
      level: pkg.level ?? "",
      imageUrl: pkg.imageUrl ?? "",
      price: String(pkg.price),
      discountPercent: String(pkg.discountPercent ?? 50),
      durationDays: String(pkg.durationDays),
      tryoutDurationMinutes: String(pkg.tryoutDurationMinutes),
      latihanDurationMinutes: String(pkg.latihanDurationMinutes),
      tryoutAccessStart: String(pkg.tryoutAccessStart ?? 1),
      tryoutAccessEnd:
        pkg.tryoutAccessEnd !== null && pkg.tryoutAccessEnd !== undefined
          ? String(pkg.tryoutAccessEnd)
          : "",
      latihanAccessStart: String(pkg.latihanAccessStart ?? 1),
      latihanAccessEnd:
        pkg.latihanAccessEnd !== null && pkg.latihanAccessEnd !== undefined
          ? String(pkg.latihanAccessEnd)
          : "",
      sessionSourceSessionKeys: pkg.sessionSourceSessionKeys ?? [],
      badge: pkg.badge ?? "",
      features: pkg.features.join("\n"),
      whatsIncluded: pkg.whatsIncluded.join("\n"),
      highlights: highlightsToText(pkg.highlights),
    });
    setIsPackageDialogOpen(true);
  };

  const openCreateQuestion = (presetSessionType?: QuestionSessionType) => {
    const preferredPackageId =
      questionPackageFilter !== "ALL" ? questionPackageFilter : packages?.[0]?.id ?? "";
    const defaultPackageId =
      (packages ?? []).find((pkg) => pkg.id === preferredPackageId)?.id ??
      packages?.[0]?.id ??
      "";
    if (!defaultPackageId) {
      toast({
        title: "Belum ada paket",
        description:
          "Tambahkan minimal 1 paket bimbel terlebih dahulu sebelum menambah bank soal.",
        variant: "destructive",
      });
      return;
    }
    const category = questionCategoryFilter === "ALL" ? "TIU" : questionCategoryFilter;
    const sessionType =
      presetSessionType ??
      (questionSessionTypeFilter === "ALL" ? "TRYOUT" : questionSessionTypeFilter);
    const sessionOrder = 1;
    const existingSessionQuestion = sessionMetaSourceRows.find(
      (item) =>
        item.packageId === defaultPackageId &&
        item.sessionType === sessionType &&
        item.sessionOrder === sessionOrder
    );

    setSelectedQuestion(null);
    setIsManualSubtestTitle(false);
    setQuickEntryMode(true);
    setQuestionForm({
      packageId: defaultPackageId,
      category,
      sessionType,
      sessionCode:
        existingSessionQuestion?.sessionCode ||
        getDefaultSessionCode(sessionType, sessionOrder),
      sessionTitle:
        existingSessionQuestion?.sessionTitle ||
        getDefaultSessionTitle(sessionType, sessionOrder),
      sessionOrder: String(sessionOrder),
      subtestTitle: defaultSubtestByCategory(category),
      prompt: "",
      promptImageUrl: "",
      promptPdfDataUrl: "",
      promptPdfFileName: "",
      options: createDefaultOptions(),
      answer: "",
      explanation: "",
      explanationImageUrl: "",
    });
    setIsQuestionDialogOpen(true);
  };

  const openEditQuestion = (question: AdminQuestion) => {
    const mappedOptions = question.options.length
      ? question.options.map((option) => ({
          text: option.text,
          imageUrl: option.imageUrl ?? "",
          score:
            option.score !== null && option.score !== undefined
              ? String(option.score)
              : ""
        }))
      : createDefaultOptions();

    setSelectedQuestion(question);
    setIsManualSubtestTitle(
      question.subtestTitle.trim() !== defaultSubtestByCategory(question.category)
    );
    setQuickEntryMode(false);
    setQuestionForm({
      packageId: question.packageId,
      category: question.category,
      sessionType: question.sessionType,
      sessionCode: question.sessionCode,
      sessionTitle: question.sessionTitle,
      sessionOrder: String(question.sessionOrder),
      subtestTitle: question.subtestTitle ?? defaultSubtestByCategory(question.category),
      prompt: question.prompt,
      promptImageUrl: question.promptImageUrl ?? "",
      promptPdfDataUrl: question.promptPdfDataUrl ?? "",
      promptPdfFileName: question.promptPdfFileName ?? "",
      options: mappedOptions,
      answer: question.answer,
      explanation: question.explanation ?? "",
      explanationImageUrl: question.explanationImageUrl ?? "",
    });
    setIsQuestionDialogOpen(true);
  };

  const handleSavePackage = async () => {
    try {
      const payload = {
        slug: packageForm.slug,
        title: packageForm.title,
        subtitle: packageForm.subtitle,
        description: packageForm.description,
        category: packageForm.category,
        level: packageForm.level,
        imageUrl: packageForm.imageUrl.trim(),
        price: Number(packageForm.price),
        discountPercent: normalizeDiscountPercent(
          Number(packageForm.discountPercent)
        ),
        durationDays: Number(packageForm.durationDays),
        tryoutDurationMinutes: Number(packageForm.tryoutDurationMinutes) || 100,
        latihanDurationMinutes:
          Number(packageForm.latihanDurationMinutes) || 20,
        tryoutAccessStart: Number(packageForm.tryoutAccessStart) || 1,
        tryoutAccessEnd: packageForm.tryoutAccessEnd.trim()
          ? Number(packageForm.tryoutAccessEnd)
          : null,
        latihanAccessStart: Number(packageForm.latihanAccessStart) || 1,
        latihanAccessEnd: packageForm.latihanAccessEnd.trim()
          ? Number(packageForm.latihanAccessEnd)
          : null,
        sessionSourceSessionKeys: packageForm.sessionSourceSessionKeys,
        badge: packageForm.badge,
        features: splitLines(packageForm.features),
        whatsIncluded: splitLines(packageForm.whatsIncluded),
        highlights: parseHighlights(packageForm.highlights),
      };

      if (selectedPackage) {
        await api.patch(`/api/admin/packages/${selectedPackage.id}`, payload);
      } else {
        await api.post("/api/admin/packages", payload);
      }

      toast({
        title: selectedPackage ? "Paket diperbarui" : "Paket ditambahkan",
        description: selectedPackage
          ? "Perubahan paket berhasil disimpan."
          : "Paket baru berhasil ditambahkan.",
      });
      setIsPackageDialogOpen(false);
      await Promise.all([refreshPackages(), refreshQuestions()]);
    } catch (error) {
      toast({
        title: selectedPackage ? "Gagal memperbarui paket" : "Gagal menambahkan paket",
        description: getErrorMessage(error, "Gagal menyimpan paket."),
        variant: "destructive",
      });
    }
  };

  const handleDeletePackage = async (pkg: AdminPackage) => {
    const confirmed = window.confirm(
      `Hapus paket ${pkg.title}? Ini akan menghapus seluruh soal dan riwayat pembelian paket tersebut.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/api/admin/packages/${pkg.id}`);
      toast({
        title: "Paket dihapus",
        description: "Paket, soal, dan riwayat pembelian terkait berhasil dihapus.",
      });

      if (questionPackageFilter === pkg.id) {
        setQuestionPackageFilter("ALL");
      }

      await Promise.all([refreshPackages(), refreshQuestions()]);
    } catch (error) {
      toast({
        title: "Gagal menghapus paket",
        description: getErrorMessage(error, "Gagal menghapus paket."),
        variant: "destructive",
      });
    }
  };

  const handleToggleSessionSource = (
    sourceSessionKey: string,
    checked: boolean
  ) => {
    setPackageForm((prev) => {
      const existing = new Set(prev.sessionSourceSessionKeys);
      if (checked) {
        existing.add(sourceSessionKey);
      } else {
        existing.delete(sourceSessionKey);
      }

      return {
        ...prev,
        sessionSourceSessionKeys: Array.from(existing)
      };
    });
  };

  const applySessionSourceKeys = (sourceSessionKeys: string[]) => {
    setPackageForm((prev) => ({
      ...prev,
      sessionSourceSessionKeys: Array.from(new Set(sourceSessionKeys))
    }));
  };

  const getSessionSourceKeysByRange = ({
    sessionType,
    start,
    end
  }: {
    sessionType?: QuestionSessionType;
    start?: number;
    end?: number | null;
  }) => {
    const safeStart = Math.max(start ?? 1, 1);
    const safeEnd = end && end >= safeStart ? end : null;

    return (questionSessions ?? [])
      .filter((session) => {
        if (sessionType && session.sessionType !== sessionType) return false;
        if (session.sessionOrder < safeStart) return false;
        if (safeEnd !== null && session.sessionOrder > safeEnd) return false;
        return true;
      })
      .map((session) => session.key);
  };

  const applySessionSourcePreset = ({
    sessionType,
    start,
    end
  }: {
    sessionType?: QuestionSessionType;
    start?: number;
    end?: number | null;
  }) => {
    applySessionSourceKeys(
      getSessionSourceKeysByRange({
        sessionType,
        start,
        end
      })
    );
  };

  const applySessionSourceFromAccessRange = () => {
    const tryoutStart = Number(packageForm.tryoutAccessStart) || 1;
    const tryoutEnd = packageForm.tryoutAccessEnd.trim()
      ? Number(packageForm.tryoutAccessEnd)
      : null;
    const latihanStart = Number(packageForm.latihanAccessStart) || 1;
    const latihanEnd = packageForm.latihanAccessEnd.trim()
      ? Number(packageForm.latihanAccessEnd)
      : null;

    applySessionSourceKeys([
      ...getSessionSourceKeysByRange({
        sessionType: "TRYOUT",
        start: tryoutStart,
        end: tryoutEnd
      }),
      ...getSessionSourceKeysByRange({
        sessionType: "LATIHAN",
        start: latihanStart,
        end: latihanEnd
      })
    ]);
  };

  const applySessionAccessPreset = (start: number, end: number | null) => {
    const nextStart = String(Math.max(start, 1));
    const nextEnd = end === null ? "" : String(Math.max(end, start));

    setPackageForm((prev) => ({
      ...prev,
      tryoutAccessStart: nextStart,
      tryoutAccessEnd: nextEnd,
      latihanAccessStart: nextStart,
      latihanAccessEnd: nextEnd
    }));
  };

  const handleQuestionCategoryChange = (nextCategory: QuestionCategory) => {
    setQuestionForm((prev) => ({
      ...prev,
      category: nextCategory,
      subtestTitle: isManualSubtestTitle
        ? prev.subtestTitle
        : defaultSubtestByCategory(nextCategory),
      options: prev.options.map((option) =>
        nextCategory === "TKP" ? option : { ...option, score: "" }
      ),
    }));
  };

  const handleSubtestModeChange = (nextMode: "AUTO" | "MANUAL") => {
    setIsManualSubtestTitle(nextMode === "MANUAL");
    if (nextMode === "MANUAL") return;

    setQuestionForm((prev) => ({
      ...prev,
      subtestTitle: defaultSubtestByCategory(prev.category)
    }));
  };

  const resolveSessionMeta = ({
    packageId,
    sessionType,
    sessionOrder
  }: {
    packageId: string;
    sessionType: QuestionSessionType;
    sessionOrder: number;
  }) => {
    const existing = sessionMetaSourceRows.find(
      (item) =>
        item.packageId === packageId &&
        item.sessionType === sessionType &&
        item.sessionOrder === sessionOrder
    );

    return {
      sessionCode: existing?.sessionCode ?? getDefaultSessionCode(sessionType, sessionOrder),
      sessionTitle:
        existing?.sessionTitle ?? getDefaultSessionTitle(sessionType, sessionOrder)
    };
  };

  const handleQuestionSessionTypeChange = (nextSessionType: QuestionSessionType) => {
    setQuestionForm((prev) => {
      const sessionOrder = Number(prev.sessionOrder) > 0 ? Number(prev.sessionOrder) : 1;
      const nextMeta = resolveSessionMeta({
        packageId: prev.packageId,
        sessionType: nextSessionType,
        sessionOrder
      });

      return {
        ...prev,
        sessionType: nextSessionType,
        sessionCode: nextMeta.sessionCode,
        sessionTitle: nextMeta.sessionTitle
      };
    });
  };

  const handleQuestionSessionOrderChange = (value: string) => {
    setQuestionForm((prev) => {
      const nextOrder = Number(value);
      const normalizedOrder = Number.isInteger(nextOrder) && nextOrder > 0 ? nextOrder : 1;
      const nextMeta = resolveSessionMeta({
        packageId: prev.packageId,
        sessionType: prev.sessionType,
        sessionOrder: normalizedOrder
      });

      return {
        ...prev,
        sessionOrder: value,
        sessionCode: nextMeta.sessionCode,
        sessionTitle: nextMeta.sessionTitle
      };
    });
  };

  const updateQuestionOption = (
    index: number,
    field: keyof QuestionOptionForm,
    value: string
  ) => {
    setQuestionForm((prev) => {
      const nextOptions = [...prev.options];
      nextOptions[index] = {
        ...nextOptions[index],
        [field]: value,
      };

      const answerStillExists = nextOptions.some(
        (option) => option.text.trim() && option.text.trim() === prev.answer.trim()
      );

      return {
        ...prev,
        options: nextOptions,
        answer: answerStillExists ? prev.answer : "",
      };
    });
  };

  const handleAddOption = () => {
    setQuestionForm((prev) => ({
      ...prev,
      options: [...prev.options, createEmptyOption()],
    }));
  };

  const clearQuestionPromptImage = () => {
    setQuestionForm((prev) => ({ ...prev, promptImageUrl: "" }));
  };

  const clearQuestionPromptPdf = () => {
    setQuestionForm((prev) => ({
      ...prev,
      promptPdfDataUrl: "",
      promptPdfFileName: ""
    }));
  };

  const openQuestionPromptPdf = async () => {
    if (!questionForm.promptPdfDataUrl) return;
    try {
      await openDataUrlInNewTab(
        questionForm.promptPdfDataUrl,
        questionForm.promptPdfFileName || "lampiran-soal.pdf"
      );
    } catch (_error) {
      toast({
        title: "Gagal membuka PDF soal",
        description: "Silakan upload ulang file PDF lalu coba lagi.",
        variant: "destructive"
      });
    }
  };

  const clearQuestionExplanationImage = () => {
    setQuestionForm((prev) => ({ ...prev, explanationImageUrl: "" }));
  };

  const clearPackageImage = () => {
    setPackageForm((prev) => ({ ...prev, imageUrl: "" }));
  };

  const clearOptionImage = (index: number) => {
    updateQuestionOption(index, "imageUrl", "");
  };

  const handleRemoveOption = (index: number) => {
    setQuestionForm((prev) => {
      if (prev.options.length <= 2) return prev;
      const nextOptions = prev.options.filter((_, idx) => idx !== index);
      const answerStillExists = nextOptions.some(
        (option) => option.text.trim() && option.text.trim() === prev.answer.trim()
      );

      return {
        ...prev,
        options: nextOptions,
        answer: answerStillExists ? prev.answer : "",
      };
    });
  };

  const attachImageFromFile = async (
    file: File | undefined,
    onResolved: (dataUrl: string) => void
  ) => {
    if (!file) return;
    if (!isUploadableImageFile(file)) {
      toast({
        title: "Format file tidak didukung",
        description:
          "Silakan upload file gambar (JPG, JPEG, PNG, WEBP, GIF, SVG, AVIF, HEIC, dan lainnya).",
        variant: "destructive",
      });
      return;
    }
    const maxSizeInBytes = 8 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      toast({
        title: "Ukuran file terlalu besar",
        description: "Maksimal 8 MB per gambar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      onResolved(normalizeImageDataUrl(dataUrl, file));
    } catch (_error) {
      toast({
        title: "Gagal membaca gambar",
        description: "Pastikan file valid lalu coba lagi.",
        variant: "destructive",
      });
    }
  };

  const attachPdfFromFile = async (
    file: File | undefined,
    onResolved: (dataUrl: string, fileName: string) => void
  ) => {
    if (!file) return;
    if (!isUploadablePdfFile(file)) {
      toast({
        title: "Format file tidak didukung",
        description: "Silakan upload file PDF (.pdf).",
        variant: "destructive"
      });
      return;
    }

    if (file.size > QUESTION_PDF_MAX_BYTES) {
      toast({
        title: "Ukuran file terlalu besar",
        description: "Maksimal 10 MB per file PDF soal.",
        variant: "destructive"
      });
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const normalizedDataUrl = normalizePdfDataUrl(dataUrl, file);
      const normalizedFileName = file.name.trim() || "lampiran-soal.pdf";
      onResolved(normalizedDataUrl, normalizedFileName);
    } catch (_error) {
      toast({
        title: "Gagal membaca PDF",
        description: "Pastikan file valid lalu coba lagi.",
        variant: "destructive"
      });
    }
  };

  const handleSaveQuestion = async (closeDialogAfterSave: boolean) => {
    try {
      const normalizedSessionOrder = Math.max(Number(questionForm.sessionOrder) || 1, 1);
      const normalizedSessionMeta = resolveSessionMeta({
        packageId: questionForm.packageId,
        sessionType: questionForm.sessionType,
        sessionOrder: normalizedSessionOrder
      });
      const payload = {
        packageId: questionForm.packageId,
        category: questionForm.category,
        sessionType: questionForm.sessionType,
        sessionCode: normalizedSessionMeta.sessionCode,
        sessionTitle: normalizedSessionMeta.sessionTitle,
        sessionOrder: normalizedSessionOrder,
        subtestTitle: questionForm.subtestTitle,
        prompt: questionForm.prompt,
        promptImageUrl: questionForm.promptImageUrl,
        promptPdfDataUrl: questionForm.promptPdfDataUrl,
        promptPdfFileName: questionForm.promptPdfFileName,
        options: questionForm.options
          .map((option) => ({
            text: option.text.trim(),
            imageUrl: option.imageUrl.trim() || undefined,
            score:
              questionForm.category === "TKP" && option.score.trim()
                ? Number(option.score)
                : undefined,
          }))
          .filter((option) => option.text),
        answer: questionForm.answer,
        explanation: questionForm.explanation,
        explanationImageUrl: questionForm.explanationImageUrl,
      };

      if (selectedQuestion) {
        await api.patch(`/api/admin/questions/${selectedQuestion.id}`, payload);
      } else {
        await api.post("/api/admin/questions", payload);
      }

      toast({
        title: selectedQuestion ? "Soal diperbarui" : "Soal ditambahkan",
        description: selectedQuestion
          ? "Perubahan soal berhasil disimpan."
          : closeDialogAfterSave
            ? "Soal baru berhasil ditambahkan."
            : "Soal tersimpan. Lanjutkan input soal berikutnya.",
      });
      if (closeDialogAfterSave || selectedQuestion) {
        setIsQuestionDialogOpen(false);
      } else {
        setQuestionForm((prev) => ({
          ...prev,
          prompt: "",
          promptImageUrl: "",
          promptPdfDataUrl: "",
          promptPdfFileName: "",
          options: createDefaultOptions(),
          answer: "",
          explanation: "",
          explanationImageUrl: ""
        }));
      }
      await Promise.all([
        refreshQuestions(),
        refreshPackages(),
        refreshQuestionSessions(),
      ]);
    } catch (error) {
      toast({
        title: "Gagal menyimpan soal",
        description: getErrorMessage(error, "Gagal menyimpan soal."),
        variant: "destructive",
      });
    }
  };

  const openSessionEditor = (session: SessionEditorItem) => {
    setSelectedSessionForEdit(session);
    setSessionEditForm({
      sessionCode: session.sessionCode,
      sessionTitle: session.sessionTitle,
      sessionDurationMinutes: String(session.sessionDurationMinutes)
    });
    setSessionQuestionOrderMap(
      session.questions.reduce<Record<string, string>>((result, question) => {
        result[question.id] = String(Math.max(question.questionOrder || 1, 1));
        return result;
      }, {})
    );
    setIsSessionDialogOpen(true);
  };

  const handleSessionOrderInputChange = (questionId: string, value: string) => {
    setSessionQuestionOrderMap((prev) => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSaveSessionSettings = async () => {
    if (!selectedSessionForEdit) return;

    const normalizedCode = sessionEditForm.sessionCode.trim().toUpperCase();
    const normalizedTitle = sessionEditForm.sessionTitle.trim();
    const normalizedDuration = Number(sessionEditForm.sessionDurationMinutes);
    if (!normalizedCode || !normalizedTitle) {
      toast({
        title: "Kode dan nama sesi wajib diisi",
        description: "Lengkapi kode sesi dan nama sesi terlebih dahulu.",
        variant: "destructive"
      });
      return;
    }

    if (!Number.isInteger(normalizedDuration) || normalizedDuration < 1) {
      toast({
        title: "Durasi sesi tidak valid",
        description: "Waktu pengerjaan harus berupa angka minimal 1 menit.",
        variant: "destructive"
      });
      return;
    }

    const questionOrders = selectedSessionForEdit.questions.map((question) => ({
      id: question.id,
      questionOrder: Math.max(
        1,
        Number(sessionQuestionOrderMap[question.id] || question.questionOrder || 1)
      )
    }));
    const orderValues = questionOrders.map((item) => item.questionOrder);
    const duplicatedOrders = new Set(orderValues).size !== orderValues.length;
    if (duplicatedOrders) {
      toast({
        title: "Nomor soal duplikat",
        description: "Setiap soal di sesi yang sama harus memiliki nomor urut unik.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingSession(true);
    try {
      await api.patch(
        `/api/admin/question-sessions/${selectedSessionForEdit.sessionType}/${selectedSessionForEdit.sessionOrder}`,
        {
          packageId: selectedSessionForEdit.packageId,
          sessionCode: normalizedCode,
          sessionTitle: normalizedTitle,
          sessionDurationMinutes: normalizedDuration,
          questionOrders
        }
      );

      toast({
        title: "Sesi berhasil diperbarui",
        description:
          "Kode sesi, nama sesi, durasi, dan nomor urut soal berhasil disimpan."
      });
      setIsSessionDialogOpen(false);
      setSelectedSessionForEdit(null);
      await Promise.all([refreshQuestions(), refreshPackages(), refreshQuestionSessions()]);
    } catch (error) {
      toast({
        title: "Gagal memperbarui sesi",
        description: getErrorMessage(error, "Terjadi kendala saat menyimpan sesi."),
        variant: "destructive"
      });
    } finally {
      setIsSavingSession(false);
    }
  };

  const handleDuplicateQuestion = async (question: AdminQuestion) => {
    setIsDuplicatingQuestionId(question.id);
    try {
      await api.post(`/api/admin/questions/${question.id}/duplicate`);
      toast({
        title: "Soal diduplikat",
        description: "Salinan soal berhasil dibuat di sesi yang sama."
      });
      await Promise.all([refreshQuestions(), refreshPackages(), refreshQuestionSessions()]);
    } catch (error) {
      toast({
        title: "Gagal menduplikat soal",
        description: getErrorMessage(error, "Terjadi kendala saat menyalin soal."),
        variant: "destructive"
      });
    } finally {
      setIsDuplicatingQuestionId(null);
    }
  };

  const handleDeleteQuestion = async (question: AdminQuestion) => {
    const confirmed = window.confirm(
      "Hapus soal ini dari bank soal? Tindakan ini tidak dapat dibatalkan."
    );
    if (!confirmed) return;

    try {
      await api.delete(`/api/admin/questions/${question.id}`);
      setSelectedQuestionIds((prev) => prev.filter((id) => id !== question.id));
      toast({
        title: "Soal dihapus",
        description: "Soal berhasil dihapus dari bank soal.",
      });
      await Promise.all([
        refreshQuestions(),
        refreshPackages(),
        refreshQuestionSessions(),
      ]);
    } catch (error) {
      toast({
        title: "Gagal menghapus soal",
        description: getErrorMessage(error, "Gagal menghapus soal."),
        variant: "destructive",
      });
    }
  };

  const handleToggleQuestionSelection = (questionId: string, checked: boolean) => {
    setSelectedQuestionIds((prev) =>
      checked
        ? Array.from(new Set([...prev, questionId]))
        : prev.filter((id) => id !== questionId)
    );
  };

  const handleToggleSelectAllQuestionsOnPage = (checked: boolean) => {
    const pageIds = paginatedQuestions.map((question) => question.id);
    if (checked) {
      setSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...pageIds])));
      return;
    }

    const pageIdSet = new Set(pageIds);
    setSelectedQuestionIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
  };

  const handleDeleteSelectedQuestions = async () => {
    if (!selectedQuestionIds.length) return;

    const selectedRows = questionRows.filter((question) => selectedQuestionIdSet.has(question.id));
    const confirmed = window.confirm(
      `Hapus ${selectedRows.length} soal terpilih dari bank soal? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    const results = await Promise.allSettled(
      selectedRows.map((question) => api.delete(`/api/admin/questions/${question.id}`))
    );
    const successCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      toast({
        title: "Hapus massal selesai",
        description:
          failedCount > 0
            ? `${successCount} soal berhasil dihapus, ${failedCount} soal gagal dihapus.`
            : `${successCount} soal berhasil dihapus.`
      });
    } else {
      toast({
        title: "Gagal menghapus soal terpilih",
        description: "Semua soal terpilih gagal dihapus.",
        variant: "destructive"
      });
    }

    setSelectedQuestionIds([]);
    await Promise.all([refreshQuestions(), refreshPackages(), refreshQuestionSessions()]);
  };

  const packageErrorMessage = getErrorMessage(
    packagesQueryError,
    "Gagal memuat data paket."
  );
  const questionErrorMessage = getErrorMessage(
    questionsQueryError,
    "Gagal memuat bank soal."
  );

  return (
    <>
      {canManagePackages && showPackageSection && (
      <section className="mb-12 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-primary">
              Manajemen Paket Bimbel
            </h2>
            <p className="text-sm text-muted-foreground">
              Tambah, edit, dan hapus paket bimbel lengkap beserta pengaturannya.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-full px-4 py-2">
              {(packages ?? []).length} Paket | {totalQuestionCount} Soal
            </Badge>
            <Button className="gap-2" onClick={openCreatePackage}>
              <PlusCircle className="h-4 w-4" /> Tambah Paket
            </Button>
          </div>
        </div>

        {packagesError ? (
          <div className="rounded-3xl bg-card p-8 text-center shadow-xl">
            <p className="font-semibold text-primary">{packageErrorMessage}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-card shadow-xl">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-semibold">Paket</th>
                  <th className="px-6 py-4 font-semibold">Kategori</th>
                  <th className="px-6 py-4 font-semibold">Harga</th>
                  <th className="px-6 py-4 font-semibold">Durasi</th>
                  <th className="px-6 py-4 font-semibold">Total Soal</th>
                  <th className="px-6 py-4 font-semibold">TKP/TIU/TWK</th>
                  <th className="px-6 py-4 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {packagesLoading ? (
                  <tr>
                    <td className="px-6 py-10" colSpan={7}>
                      Memuat paket...
                    </td>
                  </tr>
                ) : packageRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10" colSpan={7}>
                      Belum ada paket.
                    </td>
                  </tr>
                ) : (
                  paginatedPackages.map((pkg) => (
                    <tr
                      key={pkg.id}
                      className="border-b border-border/40 transition-colors hover:bg-muted/25"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-primary">{pkg.title}</p>
                        <p className="text-xs text-muted-foreground">/{pkg.slug}</p>
                      </td>
                      <td className="px-6 py-4">{pkg.category}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-primary">
                            {formatCurrency(pkg.price)}
                          </p>
                          <p className="text-xs text-muted-foreground line-through">
                            {formatCurrency(
                              getOriginalPriceFromDiscount(
                                pkg.price,
                                pkg.discountPercent
                              )
                            )}
                          </p>
                          <Badge
                            variant="outline"
                            className="w-max border-rose-200 bg-rose-50 text-rose-700"
                          >
                            Disc {normalizeDiscountPercent(pkg.discountPercent)}%
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p>{pkg.durationDays} hari</p>
                        <p className="text-xs text-muted-foreground">
                          Tryout {pkg.tryoutDurationMinutes} menit
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Latihan {pkg.latihanDurationMinutes} menit
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Akses Tryout: {pkg.tryoutAccessStart} -{" "}
                          {pkg.tryoutAccessEnd ?? "Semua"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Akses Latihan: {pkg.latihanAccessStart} -{" "}
                          {pkg.latihanAccessEnd ?? "Semua"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sumber Soal: Paket ini
                          {pkg.sessionSourceSessionKeys?.length
                            ? ` + ${pkg.sessionSourceSessionKeys.length} sesi`
                            : pkg.sessionSourcePackageIds?.length
                              ? ` + ${pkg.sessionSourcePackageIds.length} paket`
                              : ""}
                        </p>
                      </td>
                      <td className="px-6 py-4">{pkg.questionCount}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                            TKP {pkg.questionBreakdown.TKP}
                          </span>
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
                            TIU {pkg.questionBreakdown.TIU}
                          </span>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                            TWK {pkg.questionBreakdown.TWK}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => openEditPackage(pkg)}
                          >
                            <FilePenLine className="h-3.5 w-3.5" /> Edit Paket
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-2"
                            onClick={() => handleDeletePackage(pkg)}
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
            {!packagesLoading && (
              <TablePagination
                currentPage={safePackagePage}
                totalPages={totalPackagePages}
                totalItems={packageRows.length}
                pageSize={ADMIN_TABLE_PAGE_SIZE}
                onPageChange={setPackagePage}
              />
            )}
          </div>
        )}
      </section>
      )}

      {showQuestionSection && (
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-primary">
              Bank Soal Tryout & Latihan Soal
            </h2>
            <p className="text-sm text-muted-foreground">
              Tambah, edit, dan hapus soal per sesi TRYOUT/LATIHAN dan kategori TKP, TIU, TWK.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => openCreateQuestion()}>
              <ListChecks className="h-4 w-4" /> Tambah Soal
            </Button>
            <Button className="gap-2" onClick={() => openCreateQuestion("TRYOUT")}>
              <PlusCircle className="h-4 w-4" /> Tambah Tryout
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => openCreateQuestion("LATIHAN")}
            >
              <PlusCircle className="h-4 w-4" /> Tambah Latihan Soal
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bank Soal
          </p>
          <p className="text-sm font-semibold text-primary">Download Bank Soal</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Unduh data soal untuk kebutuhan backup, offline review, atau migrasi ke sistem lain.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleExportFilteredQuestions}
            >
              <Download className="h-4 w-4" /> Download Sesuai Filter
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void handleExportQuestionsBySessionType("TRYOUT")}
            >
              <Download className="h-4 w-4" /> Download Per Tryout
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void handleExportQuestionsBySessionType("LATIHAN")}
            >
              <Download className="h-4 w-4" /> Download Per Latihan
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filter Bank Soal
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <Label>Filter Paket</Label>
            <Select
              value={questionPackageFilter}
              onValueChange={(value) => {
                setQuestionPackageFilter(value);
                setQuestionPage(1);
              }}
            >
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
          <div>
            <Label>Filter Kategori Soal</Label>
            <Select
              value={questionCategoryFilter}
              onValueChange={(value) => {
                setQuestionCategoryFilter(value as QuestionCategory | "ALL");
                setQuestionPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Kategori</SelectItem>
                <SelectItem value="TKP">TKP</SelectItem>
                <SelectItem value="TIU">TIU</SelectItem>
                <SelectItem value="TWK">TWK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filter Jenis Sesi</Label>
            <Select
              value={questionSessionTypeFilter}
              onValueChange={(value) => {
                setQuestionSessionTypeFilter(value as QuestionSessionType | "ALL");
                setQuestionPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Jenis</SelectItem>
                {QUESTION_SESSION_TYPES.map((sessionType) => (
                  <SelectItem key={sessionType} value={sessionType}>
                    {toSessionDisplayName(sessionType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="question-session-code-filter">Filter Kode Sesi</Label>
            <Input
              id="question-session-code-filter"
              placeholder="Contoh: TRYOUT-1"
              value={questionSessionCodeFilter}
              onChange={(event) => {
                setQuestionSessionCodeFilter(event.target.value.toUpperCase());
                setQuestionPage(1);
              }}
            />
          </div>
          <div>
            <Label htmlFor="question-created-date-filter">Filter Tanggal Input</Label>
            <Input
              id="question-created-date-filter"
              type="date"
              value={questionCreatedDateFilter}
              onChange={(event) => {
                setQuestionCreatedDateFilter(event.target.value);
                setQuestionPage(1);
              }}
            />
          </div>
          <div>
            <Label>Urutan Waktu Upload</Label>
            <Select
              value={questionSortOrder}
              onValueChange={(value) => {
                setQuestionSortOrder(value as "NEWEST" | "OLDEST");
                setQuestionPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEWEST">Terbaru ke Terlama</SelectItem>
                <SelectItem value="OLDEST">Terlama ke Terbaru</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Pengelolaan Sesi</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Atur kode sesi, nama sesi, durasi, dan urutan nomor soal per sesi.
          </p>
          {!selectedPackageForQuestionFilter ? (
            <p className="text-xs text-muted-foreground">
              Pilih satu paket pada filter paket untuk mengelola kode sesi, nama sesi, waktu
              pengerjaan, dan nomor urut soal per sesi.
            </p>
          ) : !sessionEditorItems.length ? (
            <p className="text-xs text-muted-foreground">
              Belum ada sesi soal untuk paket ini.
            </p>
          ) : (
            <>
            <div className="grid gap-x-3 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
              {paginatedSessionEditorItems.map((session) => (
                <div
                  key={session.key}
                  className="rounded-xl border border-border/70 bg-background/80 p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-primary">{session.sessionTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.sessionCode} | {session.questionCount} soal
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      {session.sessionType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Durasi: {session.sessionDurationMinutes} menit | Urutan sesi:{" "}
                    {session.sessionOrder}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    TKP {session.questionBreakdown.TKP} | TIU{" "}
                    {session.questionBreakdown.TIU} | TWK{" "}
                    {session.questionBreakdown.TWK}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full gap-2"
                    onClick={() => openSessionEditor(session)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Kelola Sesi
                  </Button>
                </div>
              ))}
            </div>
            {sessionEditorItems.length > SESSION_EDITOR_PAGE_SIZE && (
              <div className="rounded-xl border border-border/70 bg-background/70">
                <TablePagination
                  currentPage={safeSessionPage}
                  totalPages={totalSessionPages}
                  totalItems={sessionEditorItems.length}
                  pageSize={SESSION_EDITOR_PAGE_SIZE}
                  onPageChange={setSessionPage}
                />
              </div>
            )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data Bank Soal
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Daftar pertanyaan Tryout dan Latihan Soal yang sudah diinput.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Urutan default menampilkan upload terbaru berdasarkan tanggal dan jam.
              </p>
            </div>
            {selectedQuestionIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-2"
                onClick={() => void handleDeleteSelectedQuestions()}
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus Terpilih ({selectedQuestionIds.length})
              </Button>
            )}
          </div>
        </div>

        {questionsError ? (
          <div className="rounded-3xl bg-card p-8 text-center shadow-xl">
            <p className="font-semibold text-primary">{questionErrorMessage}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-card shadow-xl">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-semibold">
                    <Checkbox
                      checked={
                        isAllQuestionsOnPageSelected
                          ? true
                          : hasSomeQuestionsOnPageSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(value) =>
                        handleToggleSelectAllQuestionsOnPage(Boolean(value))
                      }
                      aria-label="Pilih semua soal di halaman ini"
                    />
                  </th>
                  <th className="px-6 py-4 font-semibold">No</th>
                  <th className="px-6 py-4 font-semibold">Kategori</th>
                  <th className="px-6 py-4 font-semibold">Sesi</th>
                  <th className="px-6 py-4 font-semibold">Subtest</th>
                  <th className="px-6 py-4 font-semibold">Soal</th>
                  <th className="px-6 py-4 font-semibold">Kunci</th>
                  <th className="px-6 py-4 font-semibold">Dibuat</th>
                  <th className="px-6 py-4 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {questionsLoading ? (
                  <tr>
                    <td className="px-6 py-10" colSpan={9}>
                      Memuat bank soal...
                    </td>
                  </tr>
                ) : questionRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10" colSpan={9}>
                      Belum ada soal untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  paginatedQuestions.map((question) => (
                    <tr
                      key={question.id}
                      className="border-b border-border/40 transition-colors hover:bg-muted/25"
                    >
                      <td className="px-6 py-4 align-top">
                        <Checkbox
                          checked={selectedQuestionIdSet.has(question.id)}
                          onCheckedChange={(value) =>
                            handleToggleQuestionSelection(question.id, Boolean(value))
                          }
                          aria-label={`Pilih soal ${question.subtestTitle}`}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-primary">{question.questionOrder}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold",
                            categoryBadgeStyles[question.category]
                          )}
                        >
                          {question.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-primary">
                          {question.sessionTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {question.sessionType} - {question.sessionCode}
                        </p>
                      </td>
                      <td className="px-6 py-4">{question.subtestTitle}</td>
                      <td className="px-6 py-4">
                        <p className="max-w-[420px] line-clamp-2 font-medium text-primary">
                          {question.prompt}
                        </p>
                      </td>
                      <td className="px-6 py-4">{question.answer}</td>
                      <td className="px-6 py-4">{formatDateTime(question.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => openEditQuestion(question)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-2"
                            disabled={isDuplicatingQuestionId === question.id}
                            onClick={() => void handleDuplicateQuestion(question)}
                          >
                            <Copy className="h-3.5 w-3.5" /> Duplikat
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-2"
                            onClick={() => handleDeleteQuestion(question)}
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
            {!questionsLoading && (
              <TablePagination
                currentPage={safeQuestionPage}
                totalPages={totalQuestionPages}
                totalItems={questionRows.length}
                pageSize={ADMIN_TABLE_PAGE_SIZE}
                onPageChange={setQuestionPage}
              />
            )}
          </div>
        )}
      </section>
      )}

      <Dialog
        open={isSessionDialogOpen}
        onOpenChange={(open) => {
          setIsSessionDialogOpen(open);
          if (!open) {
            setSelectedSessionForEdit(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Sesi Bank Soal</DialogTitle>
          </DialogHeader>
          {!selectedSessionForEdit ? (
            <p className="text-sm text-muted-foreground">Sesi tidak ditemukan.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="session-editor-code">Kode Sesi</Label>
                  <Input
                    id="session-editor-code"
                    value={sessionEditForm.sessionCode}
                    onChange={(event) =>
                      setSessionEditForm((prev) => ({
                        ...prev,
                        sessionCode: event.target.value.toUpperCase()
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="session-editor-title">Nama Sesi</Label>
                  <Input
                    id="session-editor-title"
                    value={sessionEditForm.sessionTitle}
                    onChange={(event) =>
                      setSessionEditForm((prev) => ({
                        ...prev,
                        sessionTitle: event.target.value
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="session-editor-duration">Waktu Pengerjaan (menit)</Label>
                  <Input
                    id="session-editor-duration"
                    type="number"
                    min={1}
                    value={sessionEditForm.sessionDurationMinutes}
                    onChange={(event) =>
                      setSessionEditForm((prev) => ({
                        ...prev,
                        sessionDurationMinutes: event.target.value
                      }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/70">
                <div className="border-b border-border/70 bg-muted/30 px-4 py-3">
                  <p className="text-sm font-semibold text-primary">
                    Daftar Soal Sesi {selectedSessionForEdit.sessionTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Atur nomor urut soal. Contoh: nomor 1 dipindah ke 34.
                  </p>
                </div>
                <div className="max-h-[380px] overflow-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-border/60 bg-muted/20 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">No</th>
                        <th className="px-4 py-2 text-left font-semibold">Kategori</th>
                        <th className="px-4 py-2 text-left font-semibold">Subtest</th>
                        <th className="px-4 py-2 text-left font-semibold">Potongan Soal</th>
                        <th className="px-4 py-2 text-left font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSessionForEdit.questions.map((question) => (
                        <tr key={question.id} className="border-b border-border/50">
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={1}
                              className="h-9 w-20"
                              value={sessionQuestionOrderMap[question.id] ?? String(question.questionOrder)}
                              onChange={(event) =>
                                handleSessionOrderInputChange(question.id, event.target.value)
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-[11px]",
                                categoryBadgeStyles[question.category]
                              )}
                            >
                              {question.category}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">{question.subtestTitle}</td>
                          <td className="px-4 py-3">
                            <p className="max-w-[320px] line-clamp-2 text-xs text-muted-foreground">
                              {question.prompt}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="gap-1.5"
                                disabled={isDuplicatingQuestionId === question.id}
                                onClick={() => void handleDuplicateQuestion(question)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Duplikat
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => {
                                  setIsSessionDialogOpen(false);
                                  openEditQuestion(question);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSessionDialogOpen(false)}>
              Batal
            </Button>
            <Button
              className="gap-2"
              onClick={() => void handleSaveSessionSettings()}
              disabled={isSavingSession || !selectedSessionForEdit}
            >
              <Save className="h-4 w-4" />
              {isSavingSession ? "Menyimpan..." : "Simpan Pengaturan Sesi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPackageDialogOpen} onOpenChange={setIsPackageDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPackage ? "Edit Paket Bimbel" : "Tambah Paket Bimbel"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="package-slug">Slug</Label>
              <Input
                id="package-slug"
                value={packageForm.slug}
                onChange={(event) =>
                  setPackageForm((prev) => ({ ...prev, slug: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-title">Judul Paket</Label>
              <Input
                id="package-title"
                value={packageForm.title}
                onChange={(event) =>
                  setPackageForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="package-subtitle">Subtitle</Label>
              <Input
                id="package-subtitle"
                value={packageForm.subtitle}
                onChange={(event) =>
                  setPackageForm((prev) => ({ ...prev, subtitle: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="package-description">Deskripsi</Label>
              <Textarea
                id="package-description"
                className="min-h-28"
                value={packageForm.description}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-category">Kategori</Label>
              <Input
                id="package-category"
                value={packageForm.category}
                onChange={(event) =>
                  setPackageForm((prev) => ({ ...prev, category: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-level">Level</Label>
              <Input
                id="package-level"
                value={packageForm.level}
                onChange={(event) =>
                  setPackageForm((prev) => ({ ...prev, level: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="package-image-upload">Upload Gambar Paket</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="package-image-upload"
                  type="file"
                  className={fileInputAccentClassName}
                  accept={IMAGE_UPLOAD_ACCEPT}
                  onChange={async (event) => {
                    await attachImageFromFile(event.target.files?.[0], (dataUrl) =>
                      setPackageForm((prev) => ({
                        ...prev,
                        imageUrl: dataUrl,
                      }))
                    );
                    event.currentTarget.value = "";
                  }}
                />
                {packageForm.imageUrl && (
                  <>
                    <img
                      src={packageForm.imageUrl}
                      alt="Preview paket"
                      className="max-h-24 rounded-lg border border-border object-contain"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearPackageImage}
                    >
                      Hapus gambar
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload gambar langsung dari perangkat agar tidak bergantung pada link eksternal.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-price">Harga (IDR)</Label>
              <Input
                id="package-price"
                type="number"
                min={0}
                value={packageForm.price}
                onChange={(event) =>
                  setPackageForm((prev) => ({ ...prev, price: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-discount-percent">Diskon (%)</Label>
              <Input
                id="package-discount-percent"
                type="number"
                min={0}
                max={100}
                value={packageForm.discountPercent}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    discountPercent: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Harga akhir tetap mengikuti kolom harga. Harga coret dihitung otomatis dari diskon.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-duration">Durasi (hari)</Label>
              <Input
                id="package-duration"
                type="number"
                min={1}
                value={packageForm.durationDays}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    durationDays: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-tryout-duration">
                Waktu Pengerjaan Tryout (menit)
              </Label>
              <Input
                id="package-tryout-duration"
                type="number"
                min={1}
                value={packageForm.tryoutDurationMinutes}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    tryoutDurationMinutes: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-latihan-duration">
                Waktu Pengerjaan Latihan (menit)
              </Label>
              <Input
                id="package-latihan-duration"
                type="number"
                min={1}
                value={packageForm.latihanDurationMinutes}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    latihanDurationMinutes: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-tryout-start">Akses Tryout Mulai Dari</Label>
              <Input
                id="package-tryout-start"
                type="number"
                min={1}
                value={packageForm.tryoutAccessStart}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    tryoutAccessStart: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-tryout-end">
                Akses Tryout Sampai (kosong = semua)
              </Label>
              <Input
                id="package-tryout-end"
                type="number"
                min={1}
                value={packageForm.tryoutAccessEnd}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    tryoutAccessEnd: event.target.value,
                  }))
                }
                placeholder="Contoh: 10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-latihan-start">Akses Latihan Mulai Dari</Label>
              <Input
                id="package-latihan-start"
                type="number"
                min={1}
                value={packageForm.latihanAccessStart}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    latihanAccessStart: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="package-latihan-end">
                Akses Latihan Sampai (kosong = semua)
              </Label>
              <Input
                id="package-latihan-end"
                type="number"
                min={1}
                value={packageForm.latihanAccessEnd}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    latihanAccessEnd: event.target.value,
                  }))
                }
                placeholder="Contoh: 10"
              />
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Preset akses cepat:</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applySessionAccessPreset(1, 10)}
              >
                1 - 10
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applySessionAccessPreset(1, 20)}
              >
                1 - 20
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applySessionAccessPreset(1, null)}
              >
                Semua Sesi
              </Button>
            </div>
            <div className="md:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              Contoh: Paket Hemat - Tryout 1 sampai 10, Latihan 1 sampai 10.
              Isi batas akhir kosong jika paket boleh mengakses semua sesi. Pilih sumber
              bank soal dari sesi TRYOUT/LATIHAN yang sudah dibuat.
            </div>
            <div className="grid gap-3 md:col-span-2">
              <Label>Sumber Bank Soal (opsional)</Label>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="mb-3 text-xs text-muted-foreground">
                  Pilih sesi TRYOUT/LATIHAN yang ingin dipakai paket ini. Daftar di bawah
                  otomatis diambil dari bank soal yang sudah pernah diinput admin.
                </p>
                <div className="mb-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary">
                      Preset multi-select bank soal
                    </span>
                    <span className="rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                      {packageForm.sessionSourceSessionKeys.length}/
                      {(questionSessions ?? []).length} sesi dipilih
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={applySessionSourceFromAccessRange}
                      disabled={questionSessionsLoading || !(questionSessions ?? []).length}
                    >
                      Ikuti Batas Akses
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        applySessionSourcePreset({
                          sessionType: "TRYOUT",
                          start: 1,
                          end: 10
                        })
                      }
                      disabled={questionSessionsLoading || !(questionSessions ?? []).length}
                    >
                      Tryout 1 - 10
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        applySessionSourcePreset({
                          sessionType: "TRYOUT",
                          start: 1,
                          end: 20
                        })
                      }
                      disabled={questionSessionsLoading || !(questionSessions ?? []).length}
                    >
                      Tryout 1 - 20
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        applySessionSourcePreset({
                          sessionType: "TRYOUT",
                          start: 1,
                          end: null
                        })
                      }
                      disabled={questionSessionsLoading || !(questionSessions ?? []).length}
                    >
                      Semua Tryout
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        applySessionSourcePreset({
                          sessionType: "LATIHAN",
                          start: 1,
                          end: null
                        })
                      }
                      disabled={questionSessionsLoading || !(questionSessions ?? []).length}
                    >
                      Semua Latihan
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        applySessionSourcePreset({
                          start: 1,
                          end: null
                        })
                      }
                      disabled={questionSessionsLoading || !(questionSessions ?? []).length}
                    >
                      Semua Sesi
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => applySessionSourceKeys([])}
                      disabled={!packageForm.sessionSourceSessionKeys.length}
                    >
                      Kosongkan
                    </Button>
                  </div>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {(questionSessions ?? []).map((session) => (
                    <label
                      key={session.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-primary">
                          {toSessionDisplayName(session.sessionType)} {session.sessionOrder}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.sessionCode} - {session.questionCount} soal
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          TKP {session.questionBreakdown.TKP} | TIU{" "}
                          {session.questionBreakdown.TIU} | TWK{" "}
                          {session.questionBreakdown.TWK}
                        </p>
                      </div>
                      <Checkbox
                        checked={packageForm.sessionSourceSessionKeys.includes(session.key)}
                        onCheckedChange={(value) =>
                          handleToggleSessionSource(session.key, Boolean(value))
                        }
                      />
                    </label>
                  ))}
                  {!questionSessionsLoading && (questionSessions ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada sesi tryout/latihan di bank soal.
                    </p>
                  )}
                  {questionSessionsLoading && (
                    <p className="text-xs text-muted-foreground">
                      Memuat daftar sesi bank soal...
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="package-badge">Badge</Label>
              <Input
                id="package-badge"
                value={packageForm.badge}
                onChange={(event) =>
                  setPackageForm((prev) => ({ ...prev, badge: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="package-features">
                Fitur Paket (1 baris = 1 item)
              </Label>
              <Textarea
                id="package-features"
                className="min-h-36"
                value={packageForm.features}
                onChange={(event) =>
                  setPackageForm((prev) => ({ ...prev, features: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="package-include">
                Fasilitas (1 baris = 1 item)
              </Label>
              <Textarea
                id="package-include"
                className="min-h-36"
                value={packageForm.whatsIncluded}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    whatsIncluded: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="package-highlights">
                Highlights (format: Judul|Nilai, 1 baris = 1 item)
              </Label>
              <Textarea
                id="package-highlights"
                className="min-h-28"
                value={packageForm.highlights}
                onChange={(event) =>
                  setPackageForm((prev) => ({
                    ...prev,
                    highlights: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPackageDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSavePackage}>
              {selectedPackage ? "Simpan Perubahan" : "Tambah Paket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedQuestion ? "Edit Soal" : "Tambah Soal Baru"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {!questionForm.packageId && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                Paket internal bank soal belum ditemukan. Tambahkan paket bimbel terlebih
                dahulu, lalu coba lagi.
              </div>
            )}

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Kategori Soal</Label>
                <Select
                  value={questionForm.category}
                  onValueChange={(value) =>
                    handleQuestionCategoryChange(value as QuestionCategory)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TKP">TKP</SelectItem>
                    <SelectItem value="TIU">TIU</SelectItem>
                    <SelectItem value="TWK">TWK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Mode Judul Subtest</Label>
                <Select
                  value={isManualSubtestTitle ? "MANUAL" : "AUTO"}
                  onValueChange={(value) =>
                    handleSubtestModeChange(value as "AUTO" | "MANUAL")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih mode subtest" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Otomatis (sesuai kategori)</SelectItem>
                    <SelectItem value="MANUAL">Input manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="question-subtest">Judul Subtest</Label>
              <Input
                id="question-subtest"
                value={questionForm.subtestTitle}
                onChange={(event) =>
                  setQuestionForm((prev) => ({
                    ...prev,
                    subtestTitle: event.target.value
                  }))
                }
                placeholder="Contoh: TWK - Subtest Nasionalisme"
                disabled={!isManualSubtestTitle}
              />
              {!isManualSubtestTitle && (
                <p className="text-xs text-muted-foreground">
                  Judul subtest diisi otomatis berdasarkan kategori soal.
                </p>
              )}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Jenis Sesi</Label>
                <Select
                  value={questionForm.sessionType}
                  onValueChange={(value) =>
                    handleQuestionSessionTypeChange(value as QuestionSessionType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis sesi" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_SESSION_TYPES.map((sessionType) => (
                      <SelectItem key={sessionType} value={sessionType}>
                        {toSessionDisplayName(sessionType)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="question-session-order">Urutan Sesi</Label>
                <Input
                  id="question-session-order"
                  type="number"
                  min={1}
                  value={questionForm.sessionOrder}
                  onChange={(event) =>
                    handleQuestionSessionOrderChange(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Status Sesi Aktif</Label>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                <p>
                  {toSessionDisplayName(questionForm.sessionType)}{" "}
                  {Number(questionForm.sessionOrder) || 1} saat ini berisi{" "}
                  <span className="font-semibold text-primary">
                    {activeSessionQuestionCount} soal
                  </span>
                  .
                </p>
                <p className="mt-1">
                  Pengaturan kode sesi, nama sesi, dan waktu pengerjaan sekarang diatur dari
                  panel <span className="font-semibold text-primary">Kelola Sesi</span>.
                </p>
              </div>
            </div>

            {!selectedQuestion && (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                <Checkbox
                  checked={quickEntryMode}
                  onCheckedChange={(value) => setQuickEntryMode(Boolean(value))}
                />
                Mode input cepat (setelah simpan tetap di sesi ini)
              </label>
            )}

            <div className="grid gap-2">
              <Label htmlFor="question-prompt">Pertanyaan</Label>
              <Textarea
                id="question-prompt"
                className="min-h-24"
                value={questionForm.prompt}
                onChange={(event) =>
                  setQuestionForm((prev) => ({ ...prev, prompt: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="question-prompt-image">Gambar Soal (opsional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="question-prompt-image"
                  type="file"
                  className={fileInputAccentClassName}
                  accept={IMAGE_UPLOAD_ACCEPT}
                  onChange={async (event) => {
                    await attachImageFromFile(event.target.files?.[0], (dataUrl) =>
                      setQuestionForm((prev) => ({ ...prev, promptImageUrl: dataUrl }))
                    );
                    event.currentTarget.value = "";
                  }}
                />
                {questionForm.promptImageUrl && (
                  <>
                    <img
                      src={questionForm.promptImageUrl}
                      alt="Preview soal"
                      className="max-h-24 rounded-lg border border-border object-contain"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearQuestionPromptImage}
                    >
                      Hapus gambar
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="question-prompt-pdf">Lampiran PDF Soal (opsional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="question-prompt-pdf"
                  type="file"
                  className={fileInputAccentClassName}
                  accept={PDF_UPLOAD_ACCEPT}
                  onChange={async (event) => {
                    await attachPdfFromFile(
                      event.target.files?.[0],
                      (dataUrl, fileName) =>
                        setQuestionForm((prev) => ({
                          ...prev,
                          promptPdfDataUrl: dataUrl,
                          promptPdfFileName: fileName
                        }))
                    );
                    event.currentTarget.value = "";
                  }}
                />
                {questionForm.promptPdfDataUrl && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-primary">
                      {questionForm.promptPdfFileName || "lampiran-soal.pdf"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void openQuestionPromptPdf()}
                    >
                      Lihat PDF
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearQuestionPromptPdf}
                    >
                      Hapus PDF
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Opsi Jawaban</Label>
                <Button type="button" size="sm" variant="secondary" onClick={handleAddOption}>
                  <PlusCircle className="mr-1 h-4 w-4" /> Tambah Opsi
                </Button>
              </div>

              {questionForm.options.map((option, index) => (
                <div key={index} className="space-y-2 rounded-xl border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-primary">
                      Opsi {String.fromCharCode(65 + index)}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-rose-600"
                      onClick={() => handleRemoveOption(index)}
                      disabled={questionForm.options.length <= 2}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Hapus
                    </Button>
                  </div>

                  <Input
                    value={option.text}
                    onChange={(event) => updateQuestionOption(index, "text", event.target.value)}
                    placeholder="Teks jawaban"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="file"
                      className={fileInputAccentClassName}
                      accept={IMAGE_UPLOAD_ACCEPT}
                      onChange={async (event) => {
                        await attachImageFromFile(event.target.files?.[0], (dataUrl) =>
                          updateQuestionOption(index, "imageUrl", dataUrl)
                        );
                        event.currentTarget.value = "";
                      }}
                    />
                    {option.imageUrl && (
                      <>
                        <img
                          src={option.imageUrl}
                          alt={`Preview opsi ${index + 1}`}
                          className="max-h-20 rounded-lg border border-border object-contain"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => clearOptionImage(index)}
                        >
                          Hapus gambar
                        </Button>
                      </>
                    )}
                  </div>

                  {questionForm.category === "TKP" && (
                    <div className="grid gap-2 md:max-w-[240px]">
                      <Label>Skor Opsi TKP (1-5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={option.score}
                        onChange={(event) =>
                          updateQuestionOption(index, "score", event.target.value)
                        }
                        placeholder="1 sampai 5"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-2">
              <Label>Kunci Jawaban</Label>
              <Select
                value={questionForm.answer}
                onValueChange={(value) =>
                  setQuestionForm((prev) => ({ ...prev, answer: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih salah satu opsi" />
                </SelectTrigger>
                <SelectContent>
                  {availableAnswerOptions.map((optionText) => (
                    <SelectItem key={optionText} value={optionText}>
                      {optionText}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {questionForm.category === "TKP" && (
                <p className="text-xs text-muted-foreground">
                  Pada soal TKP, kunci jawaban harus memilih opsi dengan skor 5.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="question-explanation">Pembahasan (opsional)</Label>
              <Textarea
                id="question-explanation"
                className="min-h-24"
                value={questionForm.explanation}
                onChange={(event) =>
                  setQuestionForm((prev) => ({
                    ...prev,
                    explanation: event.target.value
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="question-explanation-image">Gambar Pembahasan (opsional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="question-explanation-image"
                  type="file"
                  className={fileInputAccentClassName}
                  accept={IMAGE_UPLOAD_ACCEPT}
                  onChange={async (event) => {
                    await attachImageFromFile(event.target.files?.[0], (dataUrl) =>
                      setQuestionForm((prev) => ({
                        ...prev,
                        explanationImageUrl: dataUrl
                      }))
                    );
                    event.currentTarget.value = "";
                  }}
                />
                {questionForm.explanationImageUrl && (
                  <>
                    <img
                      src={questionForm.explanationImageUrl}
                      alt="Preview pembahasan"
                      className="max-h-24 rounded-lg border border-border object-contain"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearQuestionExplanationImage}
                    >
                      Hapus gambar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsQuestionDialogOpen(false)}>
              Batal
            </Button>
            {selectedQuestion ? (
              <Button onClick={() => void handleSaveQuestion(true)} disabled={!questionForm.packageId}>
                Simpan Perubahan
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => void handleSaveQuestion(false)}
                  disabled={!questionForm.packageId || !quickEntryMode}
                >
                  Simpan & Tambah Lagi
                </Button>
                <Button onClick={() => void handleSaveQuestion(true)} disabled={!questionForm.packageId}>
                  Simpan & Tutup
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PackageQuestionManager;
