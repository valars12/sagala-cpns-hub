import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import type { Package as PrismaPackage, Question as PrismaQuestion } from "@prisma/client";
import prisma from "../prisma";
import { requireAdmin, requireAuth, requireStaff } from "../middleware/auth";
import { PURCHASE_STATUS } from "../constants";
import {
  QUESTION_CATEGORIES,
  parseQuestionOptions,
  sanitizeOptionalImage,
  serializeQuestionOptions,
  validateAndPrepareQuestionOptions,
  type QuestionCategory,
  type QuestionOption,
  type QuestionOptionInput
} from "../utils/question";
import {
  QUESTION_SESSION_TYPES,
  buildSessionSourceKey,
  buildEffectiveQuestionSourcePackageIds,
  buildSessionDefaultCode,
  buildSessionDefaultTitle,
  isSessionAccessibleForPackage,
  normalizeSessionType,
  parsePackageSourceIds,
  parseSessionSourceKey,
  parseSessionSourceKeys,
  type QuestionSessionType
} from "../utils/package-session";
import { getPackageResolvedSessions } from "../utils/package-resolved-sessions";

const router = Router();
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MODULE_DATA_URL_BASE64_REGEX =
  /^data:([^;,]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/i;
const MODULE_PDF_MIME_TYPES = new Set(["application/pdf", "application/x-pdf"]);
const MODULE_PDF_MAX_BYTES = 10 * 1024 * 1024;
const MODULE_PPT_MIME_PPT = "application/vnd.ms-powerpoint";
const MODULE_PPT_MIME_PPTX =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MODULE_PPT_MIME_TYPES = new Set([MODULE_PPT_MIME_PPT, MODULE_PPT_MIME_PPTX]);
const MODULE_PPT_MAX_BYTES = 15 * 1024 * 1024;
const MODULE_UPLOAD_CHUNK_BASE64_MAX_CHARS = 200_000;
const MODULE_UPLOAD_SESSION_TTL_MS = 30 * 60 * 1000;
const QUESTION_BACKUP_ACTIONS = ["CREATE", "UPDATE_BEFORE", "DELETE", "RESTORE"] as const;
const normalizeUsername = (username: string) => username.trim().toLowerCase();
const buildInternalEmail = (username: string) =>
  `${normalizeUsername(username)}@sagalabimbel.local`;

const usernameField = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter")
  .max(30, "Username maksimal 30 karakter")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Username hanya boleh berisi huruf, angka, titik, underscore, atau strip"
  )
  .transform((value) => normalizeUsername(value));

type QuestionBackupAction = (typeof QUESTION_BACKUP_ACTIONS)[number];

const optionalImageSchema = z
  .string()
  .optional()
  .nullable()
  .or(z.literal(""));
const optionalPdfDataUrlSchema = z
  .string()
  .optional()
  .nullable()
  .or(z.literal(""));
const optionalFileNameSchema = z
  .string()
  .max(255)
  .optional()
  .nullable()
  .or(z.literal(""));

type QuestionCountBreakdown = Record<QuestionCategory, number>;
type QuestionSessionBreakdown = Record<QuestionSessionType, number>;
type QuestionSessionAvailability = Record<QuestionSessionType, number[]>;
type QuestionSessionSummary = {
  breakdown: QuestionSessionBreakdown;
  availability: QuestionSessionAvailability;
};

const userCreateSchema = z.object({
  name: z.string().trim().optional().or(z.literal("")),
  username: usernameField,
  phone: z.string().min(8).optional().or(z.literal("")),
  password: z.string().min(6),
  role: z.enum(["student", "admin", "teacher"]).default("student"),
  isValidated: z.boolean().optional()
});

const userUpdateSchema = z.object({
  name: z.string().trim().optional().or(z.literal("")),
  username: usernameField.optional(),
  phone: z.string().min(8).optional().or(z.literal("")),
  password: z.string().min(6).optional(),
  role: z.enum(["student", "admin", "teacher"]).optional(),
  registrationSource: z
    .enum(["SELF_REGISTERED", "ADMIN_CREATED", "UNKNOWN"])
    .optional(),
  isValidated: z.boolean().optional()
});

const paymentUpdateSchema = z.object({
  status: z
    .enum([
      PURCHASE_STATUS.PENDING,
      PURCHASE_STATUS.PAID,
      PURCHASE_STATUS.EXPIRED,
      PURCHASE_STATUS.CANCELED
    ])
    .optional(),
  paymentType: z.string().optional(),
  paidAt: z.coerce.date().optional()
});

const highlightSchema = z.object({
  title: z.string().min(1),
  value: z.string().min(1)
});

const packageCreateSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(3).max(180),
  subtitle: z.string().max(220).optional().or(z.literal("")),
  description: z.string().min(10),
  category: z.string().min(2).max(100),
  level: z.string().max(80).optional().or(z.literal("")),
  imageUrl: optionalImageSchema,
  price: z.coerce.number().int().nonnegative(),
  discountPercent: z.coerce.number().int().min(0).max(100).default(50),
  durationDays: z.coerce.number().int().min(1).max(3650),
  tryoutDurationMinutes: z.coerce.number().int().min(1).max(600).default(100),
  latihanDurationMinutes: z.coerce.number().int().min(1).max(600).default(20),
  tryoutAccessStart: z.coerce.number().int().min(1).default(1),
  tryoutAccessEnd: z.coerce.number().int().min(1).optional().nullable(),
  latihanAccessStart: z.coerce.number().int().min(1).default(1),
  latihanAccessEnd: z.coerce.number().int().min(1).optional().nullable(),
  sessionSourcePackageIds: z.array(z.string().min(1)).optional(),
  sessionSourceSessionKeys: z.array(z.string().min(1)).optional(),
  badge: z.string().max(80).optional().or(z.literal("")),
  features: z.array(z.string().min(1)).min(1),
  whatsIncluded: z.array(z.string().min(1)).min(1),
  highlights: z.array(highlightSchema).optional()
});

const packageUpdateSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  title: z.string().min(3).max(180).optional(),
  subtitle: z.string().max(220).optional().or(z.literal("")),
  description: z.string().min(10).optional(),
  category: z.string().min(2).max(100).optional(),
  level: z.string().max(80).optional().or(z.literal("")),
  imageUrl: optionalImageSchema,
  price: z.coerce.number().int().nonnegative().optional(),
  discountPercent: z.coerce.number().int().min(0).max(100).optional(),
  durationDays: z.coerce.number().int().min(1).max(3650).optional(),
  tryoutDurationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  latihanDurationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  tryoutAccessStart: z.coerce.number().int().min(1).optional(),
  tryoutAccessEnd: z.coerce.number().int().min(1).optional().nullable(),
  latihanAccessStart: z.coerce.number().int().min(1).optional(),
  latihanAccessEnd: z.coerce.number().int().min(1).optional().nullable(),
  sessionSourcePackageIds: z.array(z.string().min(1)).optional(),
  sessionSourceSessionKeys: z.array(z.string().min(1)).optional(),
  badge: z.string().max(80).optional().or(z.literal("")),
  features: z.array(z.string().min(1)).min(1).optional(),
  whatsIncluded: z.array(z.string().min(1)).min(1).optional(),
  highlights: z.array(highlightSchema).optional()
});

const questionCreateSchema = z.object({
  packageId: z.string().min(1),
  category: z.enum(QUESTION_CATEGORIES),
  sessionType: z.enum(QUESTION_SESSION_TYPES).default("TRYOUT"),
  sessionCode: z.string().max(80).optional().or(z.literal("")),
  sessionTitle: z.string().max(180).optional().or(z.literal("")),
  sessionOrder: z.coerce.number().int().min(1).max(500).default(1),
  sessionDurationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  subtestTitle: z.string().min(3).max(160),
  prompt: z.string().min(10),
  promptImageUrl: optionalImageSchema,
  promptPdfDataUrl: optionalPdfDataUrlSchema,
  promptPdfFileName: optionalFileNameSchema,
  options: z
    .array(
      z.union([
        z.string().min(1),
        z.object({
          text: z.string().min(1),
          imageUrl: optionalImageSchema,
          score: z.coerce.number().int().min(1).max(5).optional().nullable()
        })
      ])
    )
    .min(2)
    .max(7),
  answer: z.string().min(1),
  explanation: z.string().max(5000).optional().or(z.literal("")),
  explanationImageUrl: optionalImageSchema
});

const questionUpdateSchema = z.object({
  packageId: z.string().min(1).optional(),
  category: z.enum(QUESTION_CATEGORIES).optional(),
  sessionType: z.enum(QUESTION_SESSION_TYPES).optional(),
  sessionCode: z.string().max(80).optional().or(z.literal("")),
  sessionTitle: z.string().max(180).optional().or(z.literal("")),
  sessionOrder: z.coerce.number().int().min(1).max(500).optional(),
  questionOrder: z.coerce.number().int().min(1).max(5000).optional(),
  sessionDurationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  subtestTitle: z.string().min(3).max(160).optional(),
  prompt: z.string().min(10).optional(),
  promptImageUrl: optionalImageSchema,
  promptPdfDataUrl: optionalPdfDataUrlSchema,
  promptPdfFileName: optionalFileNameSchema,
  options: z
    .array(
      z.union([
        z.string().min(1),
        z.object({
          text: z.string().min(1),
          imageUrl: optionalImageSchema,
          score: z.coerce.number().int().min(1).max(5).optional().nullable()
        })
      ])
    )
    .min(2)
    .max(7)
    .optional(),
  answer: z.string().min(1).optional(),
  explanation: z.string().max(5000).optional().or(z.literal("")),
  explanationImageUrl: optionalImageSchema
});

const questionQuerySchema = z.object({
  packageId: z.string().min(1).optional(),
  category: z.enum(QUESTION_CATEGORIES).optional(),
  sessionType: z.enum(QUESTION_SESSION_TYPES).optional(),
  sessionCode: z.string().min(1).optional()
});

const questionSessionUpdateSchema = z.object({
  packageId: z.string().min(1),
  sessionCode: z.string().max(80).optional().or(z.literal("")),
  sessionTitle: z.string().max(180).optional().or(z.literal("")),
  sessionDurationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  questionOrders: z
    .array(
      z.object({
        id: z.string().min(1),
        questionOrder: z.coerce.number().int().min(1).max(5000)
      })
    )
    .min(1)
    .optional()
});

const userPackageAccessSchema = z.object({
  packageIds: z.array(z.string().min(1)).default([])
});

const userValidationSchema = z.object({
  isValidated: z.boolean()
});

const moduleCreateSchema = z.object({
  title: z.string().min(3).max(180),
  bab: z.string().max(180).optional().or(z.literal("")),
  subBab: z.string().max(180).optional().or(z.literal("")),
  summary: z.string().max(500).optional().or(z.literal("")),
  content: z.string().optional().or(z.literal("")),
  pdfDataUrl: z.string().optional().nullable().or(z.literal("")),
  pdfFileName: z.string().max(255).optional().or(z.literal("")),
  pdfUploadToken: z.string().min(8).max(120).optional().or(z.literal("")),
  pptDataUrl: z.string().optional().nullable().or(z.literal("")),
  pptFileName: z.string().max(255).optional().or(z.literal("")),
  pptUploadToken: z.string().min(8).max(120).optional().or(z.literal("")),
  isPublished: z.boolean().optional().default(true),
  packageIds: z.array(z.string().min(1)).default([])
});

const moduleUpdateSchema = z.object({
  title: z.string().min(3).max(180).optional(),
  bab: z.string().max(180).optional().or(z.literal("")),
  subBab: z.string().max(180).optional().or(z.literal("")),
  summary: z.string().max(500).optional().or(z.literal("")),
  content: z.string().optional().or(z.literal("")),
  pdfDataUrl: z.string().optional().nullable().or(z.literal("")),
  pdfFileName: z.string().max(255).optional().or(z.literal("")),
  pdfUploadToken: z.string().min(8).max(120).optional().or(z.literal("")),
  pptDataUrl: z.string().optional().nullable().or(z.literal("")),
  pptFileName: z.string().max(255).optional().or(z.literal("")),
  pptUploadToken: z.string().min(8).max(120).optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
  packageIds: z.array(z.string().min(1)).optional()
});

const moduleUploadChunkSchema = z.object({
  uploadId: z.string().min(8).max(120),
  fileType: z.enum(["PDF", "PPT"]),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(160),
  chunkIndex: z.coerce.number().int().min(0).max(5000),
  totalChunks: z.coerce.number().int().min(1).max(5000),
  chunkBase64: z
    .string()
    .min(1)
    .max(MODULE_UPLOAD_CHUNK_BASE64_MAX_CHARS)
    .regex(/^[A-Za-z0-9+/=\r\n]+$/)
});

const moduleUploadCompleteSchema = z.object({
  uploadId: z.string().min(8).max(120),
  fileType: z.enum(["PDF", "PPT"])
});

const moduleAccessUpdateSchema = z.object({
  moduleIds: z.array(z.string().min(1)).default([])
});

const classCreateSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  teacherIds: z.array(z.string().min(1)).default([]),
  studentIds: z.array(z.string().min(1)).default([])
});

const classUpdateSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  description: z.string().max(500).optional().or(z.literal("")),
  teacherIds: z.array(z.string().min(1)).optional(),
  studentIds: z.array(z.string().min(1)).optional()
});

const classTryoutScoreQuerySchema = z.object({
  classId: z.string().min(1).optional(),
  search: z.string().max(120).optional()
});

const classTryoutAttemptDetailQuerySchema = z.object({
  classId: z.string().min(1).optional()
});

const classTryoutAssignmentQuerySchema = z.object({
  classId: z.string().min(1).optional()
});

const classTryoutAssignmentCreateSchema = z.object({
  studyClassId: z.string().min(1),
  packageId: z.string().min(1),
  sessionType: z.enum(QUESTION_SESSION_TYPES).default("TRYOUT"),
  sessionOrder: z.coerce.number().int().min(1).max(500),
  startAt: z.coerce.date(),
  endAt: z.coerce.date()
});

const questionBackupQuerySchema = z.object({
  packageId: z.string().min(1).optional(),
  action: z.enum(QUESTION_BACKUP_ACTIONS).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

const parseJsonArray = <T>(value?: string | null): T[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    console.warn("Failed to parse JSON field", value, error);
    return [];
  }
};

const sanitizeStringArray = (values: string[]) =>
  values.map((value) => value.trim()).filter(Boolean);

const sanitizePackageSourceIds = (packageIds: string[]) =>
  Array.from(new Set(packageIds.map((id) => id.trim()).filter(Boolean)));

const sanitizeSessionSourceKeys = (sessionKeys: string[]) =>
  Array.from(
    new Set(
      sessionKeys
        .map((key) => parseSessionSourceKey(key))
        .filter((key): key is string => Boolean(key))
    )
  );

const sanitizeModulePackageIds = (packageIds: string[]) =>
  Array.from(new Set(packageIds.map((id) => id.trim()).filter(Boolean)));

const createBadRequestError = (message: string) => {
  const error = new Error(message);
  error.name = "BadRequestError";
  return error;
};

const estimateBase64ByteLength = (base64Payload: string) => {
  const sanitizedPayload = base64Payload.replace(/\s+/g, "");
  const padding = sanitizedPayload.endsWith("==")
    ? 2
    : sanitizedPayload.endsWith("=")
      ? 1
      : 0;
  return Math.max(0, Math.floor((sanitizedPayload.length * 3) / 4) - padding);
};

const sanitizeDataUrlMimeType = (mimeType: string) =>
  mimeType.trim().toLowerCase().replace(/\s+/g, "");

const getModuleFileExtension = (value?: string | null) => {
  if (!value) return "";
  const fileName = value.toLowerCase().split(".").pop();
  return fileName?.trim() ?? "";
};

const parseModuleBase64DataUrl = (value: string) => {
  const match = value.match(MODULE_DATA_URL_BASE64_REGEX);
  if (!match?.[1] || !match?.[2]) return null;
  return {
    mimeType: sanitizeDataUrlMimeType(match[1]),
    base64Payload: match[2].replace(/\s+/g, "")
  };
};

type ModuleUploadFileType = "PDF" | "PPT";

type ModuleUploadChunkSession = {
  uploadId: string;
  fileType: ModuleUploadFileType;
  fileName: string;
  mimeType: string;
  totalChunks: number;
  chunks: Map<number, string>;
  expiresAt: number;
};

type ModuleUploadTokenEntry = {
  fileType: ModuleUploadFileType;
  fileName: string;
  dataUrl: string;
  sizeInBytes: number;
  expiresAt: number;
};

const moduleUploadChunkSessions = new Map<string, ModuleUploadChunkSession>();
const moduleUploadTokens = new Map<string, ModuleUploadTokenEntry>();

const cleanupExpiredModuleUploads = () => {
  const now = Date.now();
  for (const [uploadId, session] of moduleUploadChunkSessions.entries()) {
    if (session.expiresAt <= now) {
      moduleUploadChunkSessions.delete(uploadId);
    }
  }
  for (const [token, entry] of moduleUploadTokens.entries()) {
    if (entry.expiresAt <= now) {
      moduleUploadTokens.delete(token);
    }
  }
};

const resolveModuleMimeType = ({
  fileType,
  mimeType,
  fileName
}: {
  fileType: ModuleUploadFileType;
  mimeType: string;
  fileName: string;
}) => {
  const normalizedMimeType = sanitizeDataUrlMimeType(mimeType);
  const extension = getModuleFileExtension(fileName);
  const isGenericMime = normalizedMimeType === "application/octet-stream";

  if (fileType === "PDF") {
    const isPdfMime = MODULE_PDF_MIME_TYPES.has(normalizedMimeType);
    const isPdfExtension = extension === "pdf";
    if (!isPdfMime && !isPdfExtension && !isGenericMime) {
      throw createBadRequestError("Format file PDF tidak valid.");
    }
    return "application/pdf";
  }

  const isPptExtension = extension === "ppt";
  const isPptxExtension = extension === "pptx";
  const isPptMime = MODULE_PPT_MIME_TYPES.has(normalizedMimeType);
  if (!isPptExtension && !isPptxExtension && !isPptMime && !isGenericMime) {
    throw createBadRequestError("Format file PPT tidak valid. Gunakan file .ppt atau .pptx.");
  }

  if (isPptExtension || normalizedMimeType === MODULE_PPT_MIME_PPT) {
    return MODULE_PPT_MIME_PPT;
  }
  return MODULE_PPT_MIME_PPTX;
};

const buildModuleDataUrlFromToken = (token: string, expectedType: ModuleUploadFileType) => {
  cleanupExpiredModuleUploads();
  const entry = moduleUploadTokens.get(token);
  if (!entry || entry.fileType !== expectedType) {
    throw createBadRequestError("File modul belum siap disimpan. Silakan upload ulang.");
  }
  moduleUploadTokens.delete(token);
  return entry;
};

const sanitizeOptionalModuleContent = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const content = value.trim();
  return content.length ? content : null;
};

const sanitizeOptionalModuleSectionText = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const sanitizeOptionalModulePdfDataUrl = (
  value?: string | null,
  fileName?: string | null
) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = parseModuleBase64DataUrl(normalized);
  if (!parsed) {
    throw createBadRequestError("Format file PDF tidak valid. Silakan upload ulang.");
  }

  const extension = getModuleFileExtension(fileName);
  const isPdfMime = MODULE_PDF_MIME_TYPES.has(parsed.mimeType);
  const isPdfExtension = extension === "pdf";
  const isGenericMime = parsed.mimeType === "application/octet-stream";

  if (!isPdfMime && !isPdfExtension && !isGenericMime) {
    throw createBadRequestError("Format file PDF tidak valid. Silakan upload ulang.");
  }

  const base64Payload = parsed.base64Payload;
  if (estimateBase64ByteLength(base64Payload) > MODULE_PDF_MAX_BYTES) {
    throw createBadRequestError("Ukuran file PDF maksimal 10MB.");
  }

  return `data:application/pdf;base64,${base64Payload}`;
};

const sanitizeOptionalModulePptDataUrl = (
  value?: string | null,
  fileName?: string | null
) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = parseModuleBase64DataUrl(normalized);
  if (!parsed) {
    throw createBadRequestError(
      "Format file PPT tidak valid. Gunakan file .ppt atau .pptx."
    );
  }

  const extension = getModuleFileExtension(fileName);
  const isPptExtension = extension === "ppt";
  const isPptxExtension = extension === "pptx";
  const isPptMime = MODULE_PPT_MIME_TYPES.has(parsed.mimeType);
  const isGenericMime = parsed.mimeType === "application/octet-stream";

  if (!isPptExtension && !isPptxExtension && !isPptMime && !isGenericMime) {
    throw createBadRequestError(
      "Format file PPT tidak valid. Gunakan file .ppt atau .pptx."
    );
  }

  const base64Payload = parsed.base64Payload;
  if (estimateBase64ByteLength(base64Payload) > MODULE_PPT_MAX_BYTES) {
    throw createBadRequestError("Ukuran file PPT maksimal 15MB.");
  }

  let targetMimeType = MODULE_PPT_MIME_PPTX;
  if (isPptExtension) {
    targetMimeType = MODULE_PPT_MIME_PPT;
  } else if (isPptxExtension) {
    targetMimeType = MODULE_PPT_MIME_PPTX;
  } else if (parsed.mimeType === MODULE_PPT_MIME_PPT) {
    targetMimeType = MODULE_PPT_MIME_PPT;
  }

  return `data:${targetMimeType};base64,${base64Payload}`;
};

const sanitizeOptionalModuleFileName = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = value
    .split(/[\\/]/)
    .pop()
    ?.trim();

  if (!normalized) return null;
  return normalized.slice(0, 255);
};

const sanitizeUserIds = (userIds: string[]) =>
  Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));

const parseTryoutCategoryScore = (perCategoryRaw: string) => {
  const categoryScores: Record<QuestionCategory, number> = {
    TKP: 0,
    TIU: 0,
    TWK: 0
  };

  try {
    const parsed = JSON.parse(perCategoryRaw) as Array<{
      category?: string;
      score?: number;
    }>;

    if (!Array.isArray(parsed)) {
      return categoryScores;
    }

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const category = item.category as QuestionCategory | undefined;
      if (!category || !QUESTION_CATEGORIES.includes(category)) continue;
      categoryScores[category] =
        typeof item.score === "number" && Number.isFinite(item.score)
          ? item.score
          : 0;
    }
  } catch (error) {
    console.warn("Failed to parse tryout perCategory", error);
  }

  return categoryScores;
};

const questionBackupSnapshotSchema = z.object({
  packageId: z.string().min(1),
  category: z.enum(QUESTION_CATEGORIES),
  sessionType: z.enum(QUESTION_SESSION_TYPES),
  sessionCode: z.string().max(80),
  sessionTitle: z.string().max(180),
  sessionOrder: z.coerce.number().int().min(1).max(500),
  questionOrder: z.coerce.number().int().min(1).max(5000),
  subtestTitle: z.string().min(1).max(160),
  prompt: z.string().min(1),
  promptImageUrl: optionalImageSchema,
  promptPdfDataUrl: optionalPdfDataUrlSchema,
  promptPdfFileName: optionalFileNameSchema,
  options: z
    .array(
      z.object({
        text: z.string().min(1),
        imageUrl: optionalImageSchema,
        score: z.coerce.number().int().min(1).max(5).optional().nullable()
      })
    )
    .min(2)
    .max(7),
  answer: z.string().min(1),
  explanation: z.string().optional().nullable(),
  explanationImageUrl: optionalImageSchema
});

type QuestionBackupSnapshot = z.infer<typeof questionBackupSnapshotSchema>;

const buildQuestionBackupSnapshot = (
  question: PrismaQuestion
): QuestionBackupSnapshot => ({
  packageId: question.packageId,
  category: question.category as QuestionCategory,
  sessionType: normalizeSessionType(question.sessionType),
  sessionCode: question.sessionCode,
  sessionTitle: question.sessionTitle,
  sessionOrder: question.sessionOrder > 0 ? question.sessionOrder : 1,
  questionOrder: question.questionOrder > 0 ? question.questionOrder : 1,
  subtestTitle: question.subtestTitle,
  prompt: question.prompt,
  promptImageUrl: question.promptImageUrl,
  promptPdfDataUrl: question.promptPdfDataUrl,
  promptPdfFileName: question.promptPdfFileName,
  options: parseQuestionOptions(question.options, {
    category: question.category as QuestionCategory,
    answer: question.answer
  }),
  answer: question.answer,
  explanation: question.explanation,
  explanationImageUrl: question.explanationImageUrl
});

const createQuestionBackupEntry = async ({
  action,
  question,
  packageTitle,
  actor
}: {
  action: QuestionBackupAction;
  question: PrismaQuestion;
  packageTitle: string | null;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}) => {
  const snapshot = buildQuestionBackupSnapshot(question);
  await prisma.questionBackup.create({
    data: {
      action,
      questionId: question.id,
      packageId: question.packageId,
      packageTitle: packageTitle ?? null,
      sessionType: snapshot.sessionType,
      sessionOrder: snapshot.sessionOrder,
      sessionCode: snapshot.sessionCode,
      sessionTitle: snapshot.sessionTitle,
      category: snapshot.category,
      subtestTitle: snapshot.subtestTitle,
      promptExcerpt: snapshot.prompt.slice(0, 240),
      snapshot: JSON.stringify(snapshot),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role
    }
  });
};

const serializeStudyClass = (studyClass: {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    username: string | null;
    email: string;
  } | null;
  teacherLinks: Array<{
    teacher: {
      id: string;
      name: string;
      username: string | null;
      email: string;
    };
  }>;
  studentLinks: Array<{
    student: {
      id: string;
      name: string;
      username: string | null;
      email: string;
    };
  }>;
}) => ({
  id: studyClass.id,
  name: studyClass.name,
  description: studyClass.description,
  createdAt: studyClass.createdAt,
  updatedAt: studyClass.updatedAt,
  createdBy: studyClass.createdBy,
  teachers: studyClass.teacherLinks
    .map((item) => item.teacher)
    .sort((a, b) => a.name.localeCompare(b.name, "id")),
  students: studyClass.studentLinks
    .map((item) => item.student)
    .sort((a, b) => a.name.localeCompare(b.name, "id"))
});

const serializeModule = (module: {
  id: string;
  title: string;
  bab: string | null;
  subBab: string | null;
  summary: string | null;
  content: string | null;
  pdfDataUrl: string | null;
  pdfFileName: string | null;
  pptDataUrl: string | null;
  pptFileName: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  _count: {
    accesses: number;
  };
  packageLinks: Array<{
    package: {
      id: string;
      slug: string;
      title: string;
    };
  }>;
}) => {
  const packages = module.packageLinks
    .map((link) => link.package)
    .sort((a, b) => a.title.localeCompare(b.title, "id"));

  return {
    id: module.id,
    title: module.title,
    bab: module.bab,
    subBab: module.subBab,
    summary: module.summary,
    content: module.content,
    pdfDataUrl: module.pdfDataUrl,
    pdfFileName: module.pdfFileName,
    pptDataUrl: module.pptDataUrl,
    pptFileName: module.pptFileName,
    isPublished: module.isPublished,
    createdBy: module.createdBy,
    accessCount: module._count.accesses,
    packageIds: packages.map((item) => item.id),
    packages,
    createdAt: module.createdAt,
    updatedAt: module.updatedAt
  };
};

const mergeSourceReferences = ({
  packageIds,
  sessionKeys
}: {
  packageIds: string[];
  sessionKeys: string[];
}) => Array.from(new Set([...packageIds, ...sessionKeys]));

const sanitizeQuestionOptionInput = (options: QuestionOptionInput[]) =>
  options.map((option) => {
    if (typeof option === "string") {
      return option.trim();
    }

    return {
      text: option.text.trim(),
      imageUrl: sanitizeOptionalImage(option.imageUrl),
      score: option.score ?? null
    };
  });

const sanitizeHighlights = (highlights: Array<{ title: string; value: string }>) =>
  highlights
    .map((item) => ({
      title: item.title.trim(),
      value: item.value.trim()
    }))
    .filter((item) => item.title && item.value);

const buildDefaultQuestionBreakdown = (): QuestionCountBreakdown => ({
  TKP: 0,
  TIU: 0,
  TWK: 0
});

const buildDefaultQuestionSessionBreakdown = (): QuestionSessionBreakdown => ({
  TRYOUT: 0,
  LATIHAN: 0
});

const buildDefaultQuestionSessionAvailability = (): QuestionSessionAvailability => ({
  TRYOUT: [],
  LATIHAN: []
});

const normalizeSessionAccessRange = ({
  start,
  end
}: {
  start?: number | null;
  end?: number | null;
}) => {
  const normalizedStart =
    typeof start === "number" && Number.isInteger(start) && start > 0 ? start : 1;
  const normalizedEnd =
    typeof end === "number" && Number.isInteger(end) && end > 0 ? end : null;

  if (normalizedEnd !== null && normalizedEnd < normalizedStart) {
    throw new Error("Batas akhir akses sesi tidak boleh lebih kecil dari batas awal.");
  }

  return {
    start: normalizedStart,
    end: normalizedEnd
  };
};

const buildQuestionSessionMeta = ({
  sessionType,
  sessionCode,
  sessionTitle,
  sessionOrder
}: {
  sessionType: QuestionSessionType;
  sessionCode?: string | null;
  sessionTitle?: string | null;
  sessionOrder: number;
}) => {
  const normalizedType = sessionType;
  const normalizedOrder = Number.isInteger(sessionOrder) && sessionOrder > 0 ? sessionOrder : 1;
  const normalizedCode =
    sessionCode?.trim().toUpperCase() ||
    buildSessionDefaultCode(normalizedType, normalizedOrder);
  const normalizedTitle =
    sessionTitle?.trim() ||
    buildSessionDefaultTitle(normalizedType, normalizedOrder);

  return {
    sessionType: normalizedType,
    sessionCode: normalizedCode,
    sessionTitle: normalizedTitle,
    sessionOrder: normalizedOrder
  };
};

const generateAdminOrderCode = () =>
  `ADM-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const serializeAdminPackage = (
  pkg: PrismaPackage,
  questionBreakdown?: QuestionCountBreakdown,
  sessionSummary?: QuestionSessionSummary
) => {
  const breakdown = questionBreakdown ?? buildDefaultQuestionBreakdown();
  const safeSessionSummary = sessionSummary ?? {
    breakdown: buildDefaultQuestionSessionBreakdown(),
    availability: buildDefaultQuestionSessionAvailability()
  };

  return {
    id: pkg.id,
    slug: pkg.slug,
    title: pkg.title,
    subtitle: pkg.subtitle,
    description: pkg.description,
    category: pkg.category,
    level: pkg.level,
    imageUrl: pkg.imageUrl,
    price: pkg.price,
    discountPercent: pkg.discountPercent,
    durationDays: pkg.durationDays,
    tryoutDurationMinutes: pkg.tryoutDurationMinutes,
    latihanDurationMinutes: pkg.latihanDurationMinutes,
    tryoutAccessStart: pkg.tryoutAccessStart,
    tryoutAccessEnd: pkg.tryoutAccessEnd,
    latihanAccessStart: pkg.latihanAccessStart,
    latihanAccessEnd: pkg.latihanAccessEnd,
    sessionSourcePackageIds: parsePackageSourceIds(pkg.sessionSourcePackageIds),
    sessionSourceSessionKeys: parseSessionSourceKeys(pkg.sessionSourcePackageIds),
    badge: pkg.badge,
    features: parseJsonArray<string>(pkg.features),
    whatsIncluded: parseJsonArray<string>(pkg.whatsIncluded),
    highlights: parseJsonArray<{ title: string; value: string }>(pkg.highlights),
    questionCount:
      breakdown.TKP +
      breakdown.TIU +
      breakdown.TWK,
    questionBreakdown: breakdown,
    questionSessionBreakdown: safeSessionSummary.breakdown,
    questionSessionAvailability: safeSessionSummary.availability,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt
  };
};

const buildQuestionSessionSummaryByPackage = ({
  packages,
  groupedQuestions
}: {
  packages: PrismaPackage[];
  groupedQuestions: Array<{
    packageId: string;
    sessionType: string;
    sessionOrder: number;
    _count: { _all: number };
  }>;
}) => {
  const rowsByPackageId = new Map<string, typeof groupedQuestions>();

  for (const row of groupedQuestions) {
    const rows = rowsByPackageId.get(row.packageId) ?? [];
    rows.push(row);
    rowsByPackageId.set(row.packageId, rows);
  }

  const summaryMap = new Map<string, QuestionSessionSummary>();

  for (const pkg of packages) {
    const rows = rowsByPackageId.get(pkg.id) ?? [];
    const breakdown = buildDefaultQuestionSessionBreakdown();
    const tryoutOrders = new Set<number>();
    const latihanOrders = new Set<number>();

    for (const row of rows) {
      const sessionType = normalizeSessionType(row.sessionType);
      const sessionOrder = row.sessionOrder > 0 ? row.sessionOrder : 1;

      breakdown[sessionType] += row._count._all;

      if (sessionType === "TRYOUT") {
        tryoutOrders.add(sessionOrder);
      } else {
        latihanOrders.add(sessionOrder);
      }
    }

    summaryMap.set(pkg.id, {
      breakdown,
      availability: {
        TRYOUT: Array.from(tryoutOrders).sort((a, b) => a - b),
        LATIHAN: Array.from(latihanOrders).sort((a, b) => a - b)
      }
    });
  }

  return summaryMap;
};

const buildQuestionBreakdownByPackageAccess = ({
  packages,
  groupedQuestions
}: {
  packages: PrismaPackage[];
  groupedQuestions: Array<{
    packageId: string;
    category: string;
    sessionType: string;
    sessionOrder: number;
    _count: { _all: number };
  }>;
}) => {
  const packageIdSet = new Set(packages.map((pkg) => pkg.id));
  const sourceRowsByPackageId = new Map<string, typeof groupedQuestions>();

  for (const row of groupedQuestions) {
    const rows = sourceRowsByPackageId.get(row.packageId) ?? [];
    rows.push(row);
    sourceRowsByPackageId.set(row.packageId, rows);
  }

  const breakdownMap = new Map<string, QuestionCountBreakdown>();

  for (const pkg of packages) {
    const breakdown = buildDefaultQuestionBreakdown();
    const configuredSessionKeys = new Set(
      parseSessionSourceKeys(pkg.sessionSourcePackageIds)
    );
    const hasSessionKeySources = configuredSessionKeys.size > 0;
    const sourcePackageIds = buildEffectiveQuestionSourcePackageIds({
      packageId: pkg.id,
      sessionSourcePackageIds: pkg.sessionSourcePackageIds,
      allowedPackageIds: packageIdSet
    });

    const candidateRows = hasSessionKeySources
      ? groupedQuestions
      : sourcePackageIds.flatMap((sourcePackageId) =>
          sourceRowsByPackageId.get(sourcePackageId) ?? []
        );

    for (const row of candidateRows) {
      const category = row.category as QuestionCategory;
      if (!QUESTION_CATEGORIES.includes(category)) continue;

      const normalizedSessionType = normalizeSessionType(row.sessionType);
      const normalizedSessionOrder = row.sessionOrder > 0 ? row.sessionOrder : 1;
      const hasAccess = isSessionAccessibleForPackage({
        sessionType: normalizedSessionType,
        sessionOrder: normalizedSessionOrder,
        pkg
      });
      if (!hasAccess) continue;

      if (hasSessionKeySources) {
        const sourceSessionKey = buildSessionSourceKey(
          normalizedSessionType,
          normalizedSessionOrder
        );
        if (!configuredSessionKeys.has(sourceSessionKey)) continue;
      }

      breakdown[category] += row._count._all;
    }

    breakdownMap.set(pkg.id, breakdown);
  }

  return breakdownMap;
};

type QuestionSessionCatalogItem = {
  key: string;
  sessionType: QuestionSessionType;
  sessionOrder: number;
  sessionCode: string;
  sessionTitle: string;
  questionCount: number;
  questionBreakdown: QuestionCountBreakdown;
};

const buildQuestionSessionCatalog = (
  groupedSessions: Array<{
    sessionType: string;
    sessionOrder: number;
    sessionCode: string;
    sessionTitle: string;
    category: string;
    _count: { _all: number };
  }>
) => {
  const merged = new Map<string, QuestionSessionCatalogItem>();

  for (const row of groupedSessions) {
    const sessionType = normalizeSessionType(row.sessionType);
    const sessionOrder = row.sessionOrder > 0 ? row.sessionOrder : 1;
    const sessionKey = buildSessionSourceKey(sessionType, sessionOrder);
    const defaultCode = buildSessionDefaultCode(sessionType, sessionOrder);
    const defaultTitle = buildSessionDefaultTitle(sessionType, sessionOrder);
    const nextSessionCode = row.sessionCode?.trim().toUpperCase() || defaultCode;
    const nextSessionTitle = row.sessionTitle?.trim() || defaultTitle;
    const category = row.category as QuestionCategory;

    const existing = merged.get(sessionKey);
    if (!existing) {
      const breakdown = buildDefaultQuestionBreakdown();
      if (QUESTION_CATEGORIES.includes(category)) {
        breakdown[category] += row._count._all;
      }
      merged.set(sessionKey, {
        key: sessionKey,
        sessionType,
        sessionOrder,
        sessionCode: defaultCode,
        sessionTitle: nextSessionTitle,
        questionCount: row._count._all,
        questionBreakdown: breakdown
      });
      continue;
    }

    existing.questionCount += row._count._all;
    if (QUESTION_CATEGORIES.includes(category)) {
      existing.questionBreakdown[category] += row._count._all;
    }
    if (
      existing.sessionTitle === defaultTitle &&
      nextSessionTitle !== defaultTitle
    ) {
      existing.sessionTitle = nextSessionTitle;
    }
    if (existing.sessionCode === defaultCode && nextSessionCode !== defaultCode) {
      existing.sessionCode = nextSessionCode;
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    if (a.sessionType !== b.sessionType) {
      if (a.sessionType === "TRYOUT") return -1;
      if (b.sessionType === "TRYOUT") return 1;
    }
    if (a.sessionOrder !== b.sessionOrder) {
      return a.sessionOrder - b.sessionOrder;
    }
    return a.sessionCode.localeCompare(b.sessionCode);
  });
};

type SerializedQuestion = {
  id: string;
  packageId: string;
  category: QuestionCategory;
  sessionType: QuestionSessionType;
  sessionCode: string;
  sessionTitle: string;
  sessionOrder: number;
  questionOrder: number;
  subtestTitle: string;
  prompt: string;
  promptImageUrl: string | null;
  promptPdfDataUrl: string | null;
  promptPdfFileName: string | null;
  options: QuestionOption[];
  answer: string;
  explanation: string | null;
  explanationImageUrl: string | null;
  createdAt: Date;
  package?: {
    id: string;
    slug: string;
    title: string;
    category: string;
  };
};

const serializeQuestion = (
  question: PrismaQuestion & {
    package?: {
      id: string;
      slug: string;
      title: string;
      category: string;
    };
  }
): SerializedQuestion => ({
  id: question.id,
  packageId: question.packageId,
  category: question.category as QuestionCategory,
  sessionType: question.sessionType as QuestionSessionType,
  sessionCode: question.sessionCode,
  sessionTitle: question.sessionTitle,
  sessionOrder: question.sessionOrder,
  questionOrder: question.questionOrder > 0 ? question.questionOrder : 1,
  subtestTitle: question.subtestTitle,
  prompt: question.prompt,
  promptImageUrl: question.promptImageUrl,
  promptPdfDataUrl: question.promptPdfDataUrl,
  promptPdfFileName: question.promptPdfFileName,
  options: parseQuestionOptions(question.options, {
    category: question.category as QuestionCategory,
    answer: question.answer
  }),
  answer: question.answer,
  explanation: question.explanation,
  explanationImageUrl: question.explanationImageUrl,
  createdAt: question.createdAt,
  package: question.package
});

const getStudyClassInclude = () => ({
  createdBy: {
    select: {
      id: true,
      name: true,
      username: true,
      email: true
    }
  },
  teacherLinks: {
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true
        }
      }
    }
  },
  studentLinks: {
    include: {
      student: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true
        }
      }
    }
  }
});

router.get("/overview", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        provider: true,
        role: true,
        registrationSource: true,
        isValidated: true,
        createdAt: true
      }
    });

    const payments = await prisma.purchase.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true
          }
        },
        package: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
            price: true
          }
        }
      }
    });

    const paidPayments = payments.filter(
      (payment) => payment.status === PURCHASE_STATUS.PAID
    );

    const stats = {
      totalUsers: users.length,
      totalPayments: payments.length,
      paidPayments: paidPayments.length,
      pendingPayments: payments.filter(
        (payment) => payment.status === PURCHASE_STATUS.PENDING
      ).length,
      totalRevenue: paidPayments.reduce(
        (sum, payment) => sum + payment.grossAmount,
        0
      )
    };

    return res.json({
      data: {
        stats,
        users,
        payments
      }
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return res.status(500).json({ message: "Gagal memuat data admin" });
  }
});

router.get("/classes", requireAuth, requireStaff, async (_req, res) => {
  try {
    const authUser = res.locals.user as { id: string; role: string };
    const isAdminUser = authUser.role === "admin";

    const [classes, teachers, students] = await Promise.all([
      prisma.studyClass.findMany({
        where: isAdminUser
          ? undefined
          : {
              teacherLinks: {
                some: { teacherId: authUser.id }
              }
            },
        include: getStudyClassInclude(),
        orderBy: [{ name: "asc" }]
      }),
      prisma.user.findMany({
        where: isAdminUser
          ? {
              role: "teacher"
            }
          : {
              id: authUser.id,
              role: "teacher"
            },
        select: {
          id: true,
          name: true,
          username: true,
          email: true
        },
        orderBy: [{ name: "asc" }]
      }),
      prisma.user.findMany({
        where: {
          role: "student"
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true
        },
        orderBy: [{ name: "asc" }]
      })
    ]);

    return res.json({
      data: {
        classes: classes.map(serializeStudyClass),
        teachers,
        students
      }
    });
  } catch (error) {
    console.error("Admin list classes error:", error);
    return res.status(500).json({ message: "Gagal memuat data kelas." });
  }
});

router.post("/classes", requireAuth, requireStaff, async (req, res) => {
  try {
    const authUser = res.locals.user as { id: string; role: string };
    const isAdminUser = authUser.role === "admin";
    const payload = classCreateSchema.parse(req.body);
    const teacherIds = isAdminUser ? sanitizeUserIds(payload.teacherIds) : [authUser.id];
    const studentIds = sanitizeUserIds(payload.studentIds);

    const [teacherRows, studentRows] = await Promise.all([
      teacherIds.length
        ? prisma.user.findMany({
            where: {
              id: { in: teacherIds },
              role: "teacher"
            },
            select: { id: true }
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.user.findMany({
            where: {
              id: { in: studentIds },
              role: "student"
            },
            select: { id: true }
          })
        : Promise.resolve([])
    ]);

    if (teacherRows.length !== teacherIds.length) {
      return res.status(400).json({ message: "Ada guru yang tidak valid." });
    }

    if (studentRows.length !== studentIds.length) {
      return res.status(400).json({ message: "Ada siswa yang tidak valid." });
    }

    const created = await prisma.studyClass.create({
      data: {
        name: payload.name.trim(),
        description: payload.description?.trim() ? payload.description.trim() : null,
        createdById: res.locals.user.id,
        teacherLinks: teacherIds.length
          ? {
              create: teacherIds.map((teacherId) => ({ teacherId }))
            }
          : undefined,
        studentLinks: studentIds.length
          ? {
              create: studentIds.map((studentId) => ({ studentId }))
            }
          : undefined
      },
      include: getStudyClassInclude()
    });

    return res.status(201).json({
      message: "Kelas berhasil dibuat.",
      data: serializeStudyClass(created)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return res.status(409).json({ message: "Nama kelas sudah digunakan." });
    }

    console.error("Admin create class error:", error);
    return res.status(500).json({ message: "Gagal membuat kelas." });
  }
});

router.patch("/classes/:id", requireAuth, requireStaff, async (req, res) => {
  try {
    const authUser = res.locals.user as { id: string; role: string };
    const isAdminUser = authUser.role === "admin";
    const { id } = req.params;
    const payload = classUpdateSchema.parse(req.body);

    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: "Tidak ada perubahan kelas." });
    }

    const existingClass = await prisma.studyClass.findUnique({
      where: { id },
      select: {
        id: true,
        teacherLinks: {
          select: {
            teacherId: true
          }
        }
      }
    });

    if (!existingClass) {
      return res.status(404).json({ message: "Kelas tidak ditemukan." });
    }

    if (
      !isAdminUser &&
      !existingClass.teacherLinks.some((link) => link.teacherId === authUser.id)
    ) {
      return res.status(403).json({
        message: "Guru hanya bisa mengedit kelas yang diajar."
      });
    }

    const teacherIds =
      isAdminUser && payload.teacherIds !== undefined
        ? sanitizeUserIds(payload.teacherIds)
        : null;
    const studentIds =
      payload.studentIds !== undefined ? sanitizeUserIds(payload.studentIds) : null;

    if (teacherIds !== null && teacherIds.length) {
      const teacherRows = await prisma.user.findMany({
        where: {
          id: { in: teacherIds },
          role: "teacher"
        },
        select: { id: true }
      });

      if (teacherRows.length !== teacherIds.length) {
        return res.status(400).json({ message: "Ada guru yang tidak valid." });
      }
    }

    if (studentIds !== null && studentIds.length) {
      const studentRows = await prisma.user.findMany({
        where: {
          id: { in: studentIds },
          role: "student"
        },
        select: { id: true }
      });

      if (studentRows.length !== studentIds.length) {
        return res.status(400).json({ message: "Ada siswa yang tidak valid." });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextData: {
        name?: string;
        description?: string | null;
      } = {};

      if (payload.name !== undefined) {
        nextData.name = payload.name.trim();
      }
      if (payload.description !== undefined) {
        const description = payload.description.trim();
        nextData.description = description || null;
      }

      if (Object.keys(nextData).length) {
        await tx.studyClass.update({
          where: { id },
          data: nextData
        });
      }

      if (teacherIds !== null) {
        await tx.classTeacher.deleteMany({
          where: { studyClassId: id }
        });
        if (teacherIds.length) {
          await tx.classTeacher.createMany({
            data: teacherIds.map((teacherId) => ({
              studyClassId: id,
              teacherId
            })),
            skipDuplicates: true
          });
        }
      }

      if (studentIds !== null) {
        await tx.classStudent.deleteMany({
          where: { studyClassId: id }
        });
        if (studentIds.length) {
          await tx.classStudent.createMany({
            data: studentIds.map((studentId) => ({
              studyClassId: id,
              studentId
            })),
            skipDuplicates: true
          });
        }
      }

      return tx.studyClass.findUniqueOrThrow({
        where: { id },
        include: getStudyClassInclude()
      });
    });

    return res.json({
      message: "Kelas berhasil diperbarui.",
      data: serializeStudyClass(updated)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return res.status(409).json({ message: "Nama kelas sudah digunakan." });
    }

    console.error("Admin update class error:", error);
    return res.status(500).json({ message: "Gagal memperbarui kelas." });
  }
});

router.delete("/classes/:id", requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const authUser = res.locals.user as { id: string; role: string };
    const isAdminUser = authUser.role === "admin";

    const existingClass = await prisma.studyClass.findUnique({
      where: { id },
      select: {
        id: true,
        teacherLinks: {
          select: {
            teacherId: true
          }
        }
      }
    });

    if (!existingClass) {
      return res.status(404).json({ message: "Kelas tidak ditemukan." });
    }

    if (
      !isAdminUser &&
      !existingClass.teacherLinks.some((link) => link.teacherId === authUser.id)
    ) {
      return res.status(403).json({
        message: "Guru hanya bisa menghapus kelas yang diajar."
      });
    }

    await prisma.studyClass.delete({ where: { id: existingClass.id } });
    return res.json({ message: "Kelas berhasil dihapus." });
  } catch (error) {
    console.error("Admin delete class error:", error);
    return res.status(500).json({ message: "Gagal menghapus kelas." });
  }
});

router.get("/class-tryout-assignments", requireAuth, requireStaff, async (req, res) => {
  try {
    const payload = classTryoutAssignmentQuerySchema.parse(req.query);
    const selectedClassId = payload.classId?.trim();
    const authUser = res.locals.user as { id: string; role: string };
    const isAdminUser = authUser.role === "admin";

    const visibleClasses = await prisma.studyClass.findMany({
      where: isAdminUser
        ? undefined
        : {
            teacherLinks: {
              some: { teacherId: authUser.id }
            }
          },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            teacherLinks: true,
            studentLinks: true
          }
        }
      },
      orderBy: [{ name: "asc" }]
    });

    if (selectedClassId) {
      const canAccessSelectedClass = visibleClasses.some(
        (studyClass) => studyClass.id === selectedClassId
      );
      if (!canAccessSelectedClass) {
        return res.status(403).json({
          message: "Kelas tidak tersedia untuk akun ini."
        });
      }
    }

    const visibleClassIds = visibleClasses.map((studyClass) => studyClass.id);
    const assignments = visibleClassIds.length
      ? await prisma.classTryoutAssignment.findMany({
          where: {
            studyClassId: {
              in: selectedClassId ? [selectedClassId] : visibleClassIds
            }
          },
          include: {
            studyClass: {
              select: {
                id: true,
                name: true
              }
            },
            package: {
              select: {
                id: true,
                title: true,
                category: true
              }
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          },
          orderBy: [{ startAt: "desc" }, { createdAt: "desc" }]
        })
      : [];

    return res.json({
      data: {
        classes: visibleClasses.map((studyClass) => ({
          id: studyClass.id,
          name: studyClass.name,
          teacherCount: studyClass._count.teacherLinks,
          studentCount: studyClass._count.studentLinks
        })),
        assignments: assignments.map((assignment) => ({
          id: assignment.id,
          studyClass: assignment.studyClass,
          package: assignment.package,
          sessionType: normalizeSessionType(assignment.sessionType),
          sessionOrder: assignment.sessionOrder,
          sessionCode:
            assignment.sessionCode ||
            buildSessionDefaultCode(
              normalizeSessionType(assignment.sessionType),
              assignment.sessionOrder
            ),
          sessionTitle:
            assignment.sessionTitle ||
            buildSessionDefaultTitle(
              normalizeSessionType(assignment.sessionType),
              assignment.sessionOrder
            ),
          startAt: assignment.startAt,
          endAt: assignment.endAt,
          isActive: assignment.isActive,
          createdAt: assignment.createdAt,
          updatedAt: assignment.updatedAt,
          createdBy: assignment.createdBy
        }))
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    console.error("Admin list class tryout assignments error:", error);
    return res.status(500).json({ message: "Gagal memuat jadwal tryout kelas." });
  }
});

router.post("/class-tryout-assignments", requireAuth, requireStaff, async (req, res) => {
  try {
    const payload = classTryoutAssignmentCreateSchema.parse(req.body);
    const authUser = res.locals.user as { id: string; name: string; role: string };
    const isAdminUser = authUser.role === "admin";

    if (payload.endAt <= payload.startAt) {
      return res.status(400).json({
        message: "Waktu selesai harus lebih besar dari waktu mulai."
      });
    }

    const studyClass = await prisma.studyClass.findUnique({
      where: { id: payload.studyClassId },
      include: {
        teacherLinks: {
          select: {
            teacherId: true
          }
        }
      }
    });

    if (!studyClass) {
      return res.status(404).json({ message: "Kelas tidak ditemukan." });
    }

    if (
      !isAdminUser &&
      !studyClass.teacherLinks.some((link) => link.teacherId === authUser.id)
    ) {
      return res.status(403).json({
        message: "Guru hanya bisa membuat jadwal untuk kelas yang diajar."
      });
    }

    const pkg = await prisma.package.findUnique({
      where: { id: payload.packageId },
      select: {
        id: true,
        title: true,
        category: true,
        sessionSourcePackageIds: true,
        tryoutAccessStart: true,
        tryoutAccessEnd: true,
        latihanAccessStart: true,
        latihanAccessEnd: true
      }
    });

    if (!pkg) {
      return res.status(404).json({ message: "Paket tidak ditemukan." });
    }

    const sessions = await getPackageResolvedSessions(pkg);
    const targetSession = sessions.find(
      (session) =>
        session.sessionType === payload.sessionType &&
        session.sessionOrder === payload.sessionOrder
    );
    if (!targetSession) {
      return res.status(400).json({
        message:
          "Sesi tidak ditemukan pada paket ini. Pastikan nomor sesi dan jenis sesi benar."
      });
    }

    const overlappingAssignment = await prisma.classTryoutAssignment.findFirst({
      where: {
        studyClassId: payload.studyClassId,
        packageId: payload.packageId,
        sessionType: payload.sessionType,
        sessionOrder: payload.sessionOrder,
        isActive: true,
        startAt: { lte: payload.endAt },
        endAt: { gte: payload.startAt }
      },
      select: { id: true }
    });
    if (overlappingAssignment) {
      return res.status(409).json({
        message:
          "Jadwal bentrok terdeteksi untuk sesi ini di kelas yang sama. Ubah tanggal atau jam."
      });
    }

    const created = await prisma.classTryoutAssignment.create({
      data: {
        studyClassId: payload.studyClassId,
        packageId: payload.packageId,
        sessionType: targetSession.sessionType,
        sessionOrder: targetSession.sessionOrder,
        sessionCode: targetSession.sessionCode,
        sessionTitle: targetSession.sessionTitle,
        startAt: payload.startAt,
        endAt: payload.endAt,
        isActive: true,
        createdById: authUser.id
      },
      include: {
        studyClass: {
          select: {
            id: true,
            name: true
          }
        },
        package: {
          select: {
            id: true,
            title: true,
            category: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    return res.status(201).json({
      message: "Jadwal tryout kelas berhasil dibuat.",
      data: {
        id: created.id,
        studyClass: created.studyClass,
        package: created.package,
        sessionType: normalizeSessionType(created.sessionType),
        sessionOrder: created.sessionOrder,
        sessionCode: created.sessionCode,
        sessionTitle: created.sessionTitle,
        startAt: created.startAt,
        endAt: created.endAt,
        isActive: created.isActive,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        createdBy: created.createdBy
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    console.error("Admin create class tryout assignment error:", error);
    return res.status(500).json({ message: "Gagal membuat jadwal tryout kelas." });
  }
});

router.delete(
  "/class-tryout-assignments/:id",
  requireAuth,
  requireStaff,
  async (req, res) => {
    try {
      const { id } = req.params;
      const authUser = res.locals.user as { id: string; role: string };
      const isAdminUser = authUser.role === "admin";

      const assignment = await prisma.classTryoutAssignment.findUnique({
        where: { id },
        include: {
          studyClass: {
            include: {
              teacherLinks: {
                select: {
                  teacherId: true
                }
              }
            }
          }
        }
      });

      if (!assignment) {
        return res.status(404).json({ message: "Jadwal tidak ditemukan." });
      }

      if (
        !isAdminUser &&
        !assignment.studyClass.teacherLinks.some((link) => link.teacherId === authUser.id)
      ) {
        return res.status(403).json({
          message: "Guru hanya bisa menghapus jadwal untuk kelas yang diajar."
        });
      }

      await prisma.classTryoutAssignment.delete({
        where: { id: assignment.id }
      });

      return res.json({
        message: "Jadwal tryout kelas berhasil dihapus."
      });
    } catch (error) {
      console.error("Admin delete class tryout assignment error:", error);
      return res.status(500).json({ message: "Gagal menghapus jadwal tryout kelas." });
    }
  }
);

router.get("/tryout-scores", requireAuth, requireStaff, async (req, res) => {
  try {
    const payload = classTryoutScoreQuerySchema.parse(req.query);
    const authUser = res.locals.user as { id: string; role: string };
    const isAdminUser = authUser.role === "admin";
    const selectedClassId = payload.classId?.trim();
    const searchKeyword = payload.search?.trim();

    const visibleClasses = await prisma.studyClass.findMany({
      where: isAdminUser
        ? undefined
        : {
            teacherLinks: {
              some: { teacherId: authUser.id }
            }
          },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            teacherLinks: true,
            studentLinks: true
          }
        }
      },
      orderBy: [{ name: "asc" }]
    });

    if (selectedClassId) {
      const canAccessSelectedClass = visibleClasses.some(
        (studyClass) => studyClass.id === selectedClassId
      );
      if (!canAccessSelectedClass) {
        return res.status(403).json({
          message: "Kelas tidak tersedia untuk akun ini."
        });
      }
    }

    let scopedStudentIds: string[] | null = null;
    if (selectedClassId) {
      const classStudents = await prisma.classStudent.findMany({
        where: { studyClassId: selectedClassId },
        select: { studentId: true }
      });
      scopedStudentIds = classStudents.map((item) => item.studentId);
    } else if (!isAdminUser) {
      const teacherClassStudents = await prisma.classStudent.findMany({
        where: {
          studyClass: {
            teacherLinks: {
              some: { teacherId: authUser.id }
            }
          }
        },
        select: { studentId: true }
      });
      scopedStudentIds = Array.from(
        new Set(teacherClassStudents.map((item) => item.studentId))
      );
    }

    const students = await prisma.user.findMany({
      where: {
        role: "student",
        ...(scopedStudentIds
          ? {
              id: {
                in: scopedStudentIds
              }
            }
          : {}),
        ...(searchKeyword
          ? {
              OR: [
                {
                  name: {
                    contains: searchKeyword,
                    mode: "insensitive"
                  }
                },
                {
                  username: {
                    contains: searchKeyword,
                    mode: "insensitive"
                  }
                },
                {
                  email: {
                    contains: searchKeyword,
                    mode: "insensitive"
                  }
                }
              ]
            }
          : {})
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true
      },
      orderBy: [{ name: "asc" }]
    });

    const studentIds = students.map((student) => student.id);
    const studentClassLinks = studentIds.length
      ? await prisma.classStudent.findMany({
          where: {
            studentId: { in: studentIds },
            ...(selectedClassId
              ? {
                  studyClassId: selectedClassId
                }
              : !isAdminUser
                ? {
                    studyClass: {
                      teacherLinks: {
                        some: { teacherId: authUser.id }
                      }
                    }
                  }
                : {})
          },
          include: {
            studyClass: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })
      : [];

    const classMapByStudent = new Map<
      string,
      Array<{ id: string; name: string }>
    >();
    for (const link of studentClassLinks) {
      const current = classMapByStudent.get(link.studentId) ?? [];
      current.push(link.studyClass);
      classMapByStudent.set(link.studentId, current);
    }

    const attempts = studentIds.length
      ? await prisma.tryoutAttempt.findMany({
          where: {
            userId: { in: studentIds }
          },
          select: {
            id: true,
            userId: true,
            sessionTitle: true,
            sessionCode: true,
            score: true,
            maxScore: true,
            percentage: true,
            perCategory: true,
            completedAt: true,
            package: {
              select: {
                id: true,
                title: true,
                category: true
              }
            }
          },
          orderBy: [{ completedAt: "desc" }]
        })
      : [];

    const latestAttemptByStudent = new Map<
      string,
      (typeof attempts)[number]
    >();
    const attemptCountByStudent = new Map<string, number>();

    for (const attempt of attempts) {
      attemptCountByStudent.set(
        attempt.userId,
        (attemptCountByStudent.get(attempt.userId) ?? 0) + 1
      );
      if (!latestAttemptByStudent.has(attempt.userId)) {
        latestAttemptByStudent.set(attempt.userId, attempt);
      }
    }

    const studentSummaries = students.map((student) => {
      const latestAttempt = latestAttemptByStudent.get(student.id);
      const categoryScores = latestAttempt
        ? parseTryoutCategoryScore(latestAttempt.perCategory)
        : { TKP: 0, TIU: 0, TWK: 0 };
      const studentClasses = (classMapByStudent.get(student.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, "id")
      );

      return {
        student: {
          id: student.id,
          name: student.name,
          username: student.username,
          email: student.email
        },
        classes: studentClasses,
        totalAttempts: attemptCountByStudent.get(student.id) ?? 0,
        latestAttempt: latestAttempt
          ? {
              id: latestAttempt.id,
              sessionTitle: latestAttempt.sessionTitle,
              sessionCode: latestAttempt.sessionCode,
              package: latestAttempt.package,
              completedAt: latestAttempt.completedAt,
              percentage: latestAttempt.percentage,
              scores: {
                TKP: categoryScores.TKP,
                TIU: categoryScores.TIU,
                TWK: categoryScores.TWK,
                total: latestAttempt.score,
                maxScore: latestAttempt.maxScore
              }
            }
          : null
      };
    });

    return res.json({
      data: {
        classes: visibleClasses.map((studyClass) => ({
          id: studyClass.id,
          name: studyClass.name,
          teacherCount: studyClass._count.teacherLinks,
          studentCount: studyClass._count.studentLinks
        })),
        studentSummaries
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    console.error("Admin tryout scores error:", error);
    return res.status(500).json({ message: "Gagal memuat nilai tryout siswa." });
  }
});

router.get(
  "/tryout-scores/:studentId/attempts",
  requireAuth,
  requireStaff,
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const payload = classTryoutAttemptDetailQuerySchema.parse(req.query);
      const selectedClassId = payload.classId?.trim();
      const authUser = res.locals.user as { id: string; role: string };
      const isAdminUser = authUser.role === "admin";

      const targetStudent = await prisma.user.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true
        }
      });

      if (!targetStudent || targetStudent.role !== "student") {
        return res.status(404).json({ message: "Siswa tidak ditemukan." });
      }

      if (!isAdminUser) {
        const classFilter = selectedClassId
          ? {
              studyClassId: selectedClassId
            }
          : {};

        const teacherHasAccess = await prisma.classStudent.findFirst({
          where: {
            studentId: targetStudent.id,
            ...classFilter,
            studyClass: {
              teacherLinks: {
                some: {
                  teacherId: authUser.id
                }
              }
            }
          },
          select: { id: true }
        });

        if (!teacherHasAccess) {
          return res.status(403).json({
            message: "Anda tidak memiliki akses ke data siswa ini."
          });
        }
      } else if (selectedClassId) {
        const hasStudentInClass = await prisma.classStudent.findFirst({
          where: {
            studyClassId: selectedClassId,
            studentId: targetStudent.id
          },
          select: { id: true }
        });

        if (!hasStudentInClass) {
          return res.status(404).json({
            message: "Siswa tidak terdaftar pada kelas yang dipilih."
          });
        }
      }

      const classLinks = await prisma.classStudent.findMany({
        where: {
          studentId: targetStudent.id,
          ...(selectedClassId
            ? {
                studyClassId: selectedClassId
              }
            : !isAdminUser
              ? {
                  studyClass: {
                    teacherLinks: {
                      some: { teacherId: authUser.id }
                    }
                  }
                }
              : {})
        },
        include: {
          studyClass: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      const attempts = await prisma.tryoutAttempt.findMany({
        where: {
          userId: targetStudent.id
        },
        select: {
          id: true,
          sessionType: true,
          sessionTitle: true,
          sessionCode: true,
          score: true,
          maxScore: true,
          percentage: true,
          perCategory: true,
          durationSeconds: true,
          completedAt: true,
          package: {
            select: {
              id: true,
              title: true,
              category: true
            }
          }
        },
        orderBy: [{ completedAt: "desc" }]
      });

      return res.json({
        data: {
          student: {
            id: targetStudent.id,
            name: targetStudent.name,
            username: targetStudent.username,
            email: targetStudent.email
          },
          classes: classLinks
            .map((item) => item.studyClass)
            .sort((a, b) => a.name.localeCompare(b.name, "id")),
          attempts: attempts.map((attempt) => {
            const categoryScores = parseTryoutCategoryScore(attempt.perCategory);
            const durationMinutes =
              typeof attempt.durationSeconds === "number" &&
              Number.isFinite(attempt.durationSeconds) &&
              attempt.durationSeconds > 0
                ? Math.max(1, Math.round(attempt.durationSeconds / 60))
                : null;

            return {
              id: attempt.id,
              sessionType: normalizeSessionType(attempt.sessionType),
              sessionTitle: attempt.sessionTitle,
              sessionCode: attempt.sessionCode,
              package: attempt.package,
              completedAt: attempt.completedAt,
              durationSeconds: attempt.durationSeconds,
              durationMinutes,
              percentage: attempt.percentage,
              scores: {
                TKP: categoryScores.TKP,
                TIU: categoryScores.TIU,
                TWK: categoryScores.TWK,
                total: attempt.score,
                maxScore: attempt.maxScore
              }
            };
          })
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validasi gagal",
          errors: error.flatten()
        });
      }

      console.error("Admin tryout score attempts detail error:", error);
      return res.status(500).json({ message: "Gagal memuat detail hasil siswa." });
    }
  }
);

router.get("/packages", requireAuth, requireStaff, async (_req, res) => {
  try {
    const packages = await prisma.package.findMany({
      orderBy: [{ category: "asc" }, { price: "asc" }]
    });

    const groupedQuestions = await prisma.question.groupBy({
      by: ["packageId", "category", "sessionType", "sessionOrder"],
      _count: { _all: true }
    });
    const questionMap = buildQuestionBreakdownByPackageAccess({
      packages,
      groupedQuestions
    });
    const sessionSummaryMap = buildQuestionSessionSummaryByPackage({
      packages,
      groupedQuestions
    });

    return res.json({
      data: packages.map((pkg) =>
        serializeAdminPackage(
          pkg,
          questionMap.get(pkg.id),
          sessionSummaryMap.get(pkg.id)
        )
      )
    });
  } catch (error) {
    console.error("Admin list packages error:", error);
    return res.status(500).json({ message: "Gagal memuat paket" });
  }
});

router.get("/packages/:id/sessions", requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await prisma.package.findUnique({
      where: { id },
      select: {
        id: true,
        sessionSourcePackageIds: true,
        tryoutAccessStart: true,
        tryoutAccessEnd: true,
        latihanAccessStart: true,
        latihanAccessEnd: true
      }
    });

    if (!pkg) {
      return res.status(404).json({ message: "Paket tidak ditemukan." });
    }

    const sessions = await getPackageResolvedSessions(pkg);
    return res.json({
      data: sessions.map((session) => ({
        sessionType: session.sessionType,
        sessionCode: session.sessionCode,
        sessionTitle: session.sessionTitle,
        sessionOrder: session.sessionOrder,
        questionCount: session.questionCount
      }))
    });
  } catch (error) {
    console.error("Admin list package sessions error:", error);
    return res.status(500).json({ message: "Gagal memuat sesi pada paket." });
  }
});

router.post("/packages", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = packageCreateSchema.parse(req.body);
    const tryoutRange = normalizeSessionAccessRange({
      start: payload.tryoutAccessStart,
      end: payload.tryoutAccessEnd ?? null
    });
    const latihanRange = normalizeSessionAccessRange({
      start: payload.latihanAccessStart,
      end: payload.latihanAccessEnd ?? null
    });
    const sourcePackageIds = sanitizePackageSourceIds(payload.sessionSourcePackageIds ?? []);
    const sourceSessionKeys = sanitizeSessionSourceKeys(
      payload.sessionSourceSessionKeys ?? []
    );
    const combinedSourceReferences = mergeSourceReferences({
      packageIds: sourcePackageIds,
      sessionKeys: sourceSessionKeys
    });

    const features = sanitizeStringArray(payload.features);
    const whatsIncluded = sanitizeStringArray(payload.whatsIncluded);
    const highlights = sanitizeHighlights(payload.highlights ?? []);

    if (!features.length) {
      return res.status(400).json({ message: "Fitur paket tidak boleh kosong" });
    }

    if (!whatsIncluded.length) {
      return res.status(400).json({ message: "Fasilitas paket tidak boleh kosong" });
    }

    if (sourcePackageIds.length) {
      const sourcePackages = await prisma.package.findMany({
        where: { id: { in: sourcePackageIds } },
        select: { id: true }
      });

      if (sourcePackages.length !== sourcePackageIds.length) {
        return res.status(400).json({
          message: "Ada sumber paket soal yang tidak valid."
        });
      }
    }

    const created = await prisma.package.create({
      data: {
        slug: payload.slug.trim().toLowerCase(),
        title: payload.title.trim(),
        subtitle: payload.subtitle?.trim() ? payload.subtitle.trim() : null,
        description: payload.description.trim(),
        category: payload.category.trim(),
        level: payload.level?.trim() ? payload.level.trim() : null,
        imageUrl: sanitizeOptionalImage(payload.imageUrl),
        price: payload.price,
        discountPercent: payload.discountPercent,
        durationDays: payload.durationDays,
        tryoutDurationMinutes: payload.tryoutDurationMinutes,
        latihanDurationMinutes: payload.latihanDurationMinutes,
        tryoutAccessStart: tryoutRange.start,
        tryoutAccessEnd: tryoutRange.end,
        latihanAccessStart: latihanRange.start,
        latihanAccessEnd: latihanRange.end,
        sessionSourcePackageIds: combinedSourceReferences.length
          ? JSON.stringify(combinedSourceReferences)
          : null,
        badge: payload.badge?.trim() ? payload.badge.trim() : null,
        features: JSON.stringify(features),
        whatsIncluded: JSON.stringify(whatsIncluded),
        highlights: JSON.stringify(highlights)
      }
    });
    const groupedQuestions = await prisma.question.groupBy({
      by: ["packageId", "category", "sessionType", "sessionOrder"],
      _count: { _all: true }
    });
    const breakdownMap = buildQuestionBreakdownByPackageAccess({
      packages: [created],
      groupedQuestions
    });
    const breakdown = breakdownMap.get(created.id) ?? buildDefaultQuestionBreakdown();
    const sessionSummaryMap = buildQuestionSessionSummaryByPackage({
      packages: [created],
      groupedQuestions
    });
    const sessionSummary = sessionSummaryMap.get(created.id);

    return res.status(201).json({
      message: "Paket berhasil ditambahkan",
      data: serializeAdminPackage(created, breakdown, sessionSummary)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return res.status(409).json({ message: "Slug paket sudah digunakan" });
    }

    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }

    console.error("Admin create package error:", error);
    return res.status(500).json({ message: "Gagal menambahkan paket" });
  }
});

router.patch("/packages/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = packageUpdateSchema.parse(req.body);
    const existingPackage = await prisma.package.findUnique({
      where: { id }
    });

    if (!existingPackage) {
      return res.status(404).json({ message: "Paket tidak ditemukan" });
    }

    const data: Record<string, unknown> = {};

    if (payload.slug !== undefined) data.slug = payload.slug.trim().toLowerCase();
    if (payload.title !== undefined) data.title = payload.title.trim();
    if (payload.subtitle !== undefined) {
      const subtitle = payload.subtitle.trim();
      data.subtitle = subtitle.length ? subtitle : null;
    }
    if (payload.description !== undefined) data.description = payload.description.trim();
    if (payload.category !== undefined) data.category = payload.category.trim();
    if (payload.level !== undefined) {
      const level = payload.level.trim();
      data.level = level.length ? level : null;
    }
    if (payload.imageUrl !== undefined) {
      data.imageUrl = sanitizeOptionalImage(payload.imageUrl);
    }
    if (payload.price !== undefined) data.price = payload.price;
    if (payload.discountPercent !== undefined) {
      data.discountPercent = payload.discountPercent;
    }
    if (payload.durationDays !== undefined) data.durationDays = payload.durationDays;
    if (payload.tryoutDurationMinutes !== undefined) {
      data.tryoutDurationMinutes = payload.tryoutDurationMinutes;
    }
    if (payload.latihanDurationMinutes !== undefined) {
      data.latihanDurationMinutes = payload.latihanDurationMinutes;
    }
    const nextTryoutRange = normalizeSessionAccessRange({
      start: payload.tryoutAccessStart ?? existingPackage.tryoutAccessStart,
      end:
        payload.tryoutAccessEnd !== undefined
          ? payload.tryoutAccessEnd
          : existingPackage.tryoutAccessEnd
    });
    const nextLatihanRange = normalizeSessionAccessRange({
      start: payload.latihanAccessStart ?? existingPackage.latihanAccessStart,
      end:
        payload.latihanAccessEnd !== undefined
          ? payload.latihanAccessEnd
          : existingPackage.latihanAccessEnd
    });
    if (payload.tryoutAccessStart !== undefined || payload.tryoutAccessEnd !== undefined) {
      data.tryoutAccessStart = nextTryoutRange.start;
      data.tryoutAccessEnd = nextTryoutRange.end;
    }
    if (payload.latihanAccessStart !== undefined || payload.latihanAccessEnd !== undefined) {
      data.latihanAccessStart = nextLatihanRange.start;
      data.latihanAccessEnd = nextLatihanRange.end;
    }
    if (
      payload.sessionSourcePackageIds !== undefined ||
      payload.sessionSourceSessionKeys !== undefined
    ) {
      const sourcePackageIds = sanitizePackageSourceIds(
        payload.sessionSourcePackageIds ?? []
      ).filter((packageId) => packageId !== id);
      const sourceSessionKeys = sanitizeSessionSourceKeys(
        payload.sessionSourceSessionKeys ?? []
      );

      if (sourcePackageIds.length) {
        const sourcePackages = await prisma.package.findMany({
          where: { id: { in: sourcePackageIds } },
          select: { id: true }
        });

        if (sourcePackages.length !== sourcePackageIds.length) {
          return res.status(400).json({
            message: "Ada sumber paket soal yang tidak valid."
          });
        }
      }

      const combinedSourceReferences = mergeSourceReferences({
        packageIds: sourcePackageIds,
        sessionKeys: sourceSessionKeys
      });

      data.sessionSourcePackageIds = combinedSourceReferences.length
        ? JSON.stringify(combinedSourceReferences)
        : null;
    }
    if (payload.badge !== undefined) {
      const badge = payload.badge.trim();
      data.badge = badge.length ? badge : null;
    }
    if (payload.features !== undefined) {
      const features = sanitizeStringArray(payload.features);
      if (!features.length) {
        return res.status(400).json({ message: "Fitur paket tidak boleh kosong" });
      }
      data.features = JSON.stringify(features);
    }
    if (payload.whatsIncluded !== undefined) {
      const whatsIncluded = sanitizeStringArray(payload.whatsIncluded);
      if (!whatsIncluded.length) {
        return res.status(400).json({
          message: "Fasilitas paket tidak boleh kosong"
        });
      }
      data.whatsIncluded = JSON.stringify(whatsIncluded);
    }
    if (payload.highlights !== undefined) {
      data.highlights = JSON.stringify(sanitizeHighlights(payload.highlights));
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ message: "Tidak ada data paket yang diubah" });
    }

    const updated = await prisma.package.update({
      where: { id },
      data
    });

    const groupedQuestions = await prisma.question.groupBy({
      by: ["packageId", "category", "sessionType", "sessionOrder"],
      _count: { _all: true }
    });
    const breakdownMap = buildQuestionBreakdownByPackageAccess({
      packages: [updated],
      groupedQuestions
    });
    const breakdown = breakdownMap.get(updated.id) ?? buildDefaultQuestionBreakdown();
    const sessionSummaryMap = buildQuestionSessionSummaryByPackage({
      packages: [updated],
      groupedQuestions
    });
    const sessionSummary = sessionSummaryMap.get(updated.id);

    return res.json({
      message: "Paket berhasil diperbarui",
      data: serializeAdminPackage(updated, breakdown, sessionSummary)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return res.status(409).json({ message: "Slug paket sudah digunakan" });
    }

    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }

    console.error("Admin update package error:", error);
    return res.status(500).json({ message: "Gagal memperbarui paket" });
  }
});

router.delete("/packages/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.package.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      return res.status(404).json({ message: "Paket tidak ditemukan" });
    }

    const [deletedQuestions, deletedPurchases, deletedPackage] =
      await prisma.$transaction([
        prisma.question.deleteMany({ where: { packageId: id } }),
        prisma.purchase.deleteMany({ where: { packageId: id } }),
        prisma.package.delete({ where: { id } })
      ]);

    const packagesWithSource = await prisma.package.findMany({
      where: { sessionSourcePackageIds: { not: null } },
      select: {
        id: true,
        sessionSourcePackageIds: true
      }
    });
    let cleanedSourceReferenceCount = 0;
    for (const pkg of packagesWithSource) {
      const currentSourcePackageIds = parsePackageSourceIds(
        pkg.sessionSourcePackageIds
      );
      if (!currentSourcePackageIds.includes(id)) continue;

      const currentSessionKeys = parseSessionSourceKeys(pkg.sessionSourcePackageIds);

      const nextSourcePackageIds = currentSourcePackageIds.filter(
        (sourceId) => sourceId !== id
      );
      const nextSourceReferences = mergeSourceReferences({
        packageIds: nextSourcePackageIds,
        sessionKeys: currentSessionKeys
      });
      await prisma.package.update({
        where: { id: pkg.id },
        data: {
          sessionSourcePackageIds: nextSourceReferences.length
            ? JSON.stringify(nextSourceReferences)
            : null
        }
      });
      cleanedSourceReferenceCount += 1;
    }

    return res.json({
      message: "Paket berhasil dihapus",
      data: {
        id: deletedPackage.id,
        deletedQuestions: deletedQuestions.count,
        deletedPurchases: deletedPurchases.count,
        cleanedSourceReferenceCount
      }
    });
  } catch (error) {
    console.error("Admin delete package error:", error);
    return res.status(500).json({ message: "Gagal menghapus paket" });
  }
});

router.get("/questions", requireAuth, requireStaff, async (req, res) => {
  try {
    const query = questionQuerySchema.parse(req.query);
    const sessionCodeFilter = query.sessionCode?.trim().toUpperCase();
    const includePackage = {
      package: {
        select: {
          id: true,
          slug: true,
          title: true,
          category: true
        }
      }
    } as const;
    const baseWhere = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.sessionType ? { sessionType: query.sessionType } : {}),
      ...(sessionCodeFilter ? { sessionCode: sessionCodeFilter } : {})
    };
    let questions: Array<
      PrismaQuestion & {
        package: {
          id: string;
          slug: string;
          title: string;
          category: string;
        };
      }
    > = [];

    if (query.packageId) {
      const selectedPackage = await prisma.package.findUnique({
        where: { id: query.packageId },
        select: {
          id: true,
          sessionSourcePackageIds: true,
          tryoutAccessStart: true,
          tryoutAccessEnd: true,
          latihanAccessStart: true,
          latihanAccessEnd: true
        }
      });

      if (!selectedPackage) {
        return res.status(404).json({ message: "Paket tidak ditemukan" });
      }

      const sourcePackageIds = buildEffectiveQuestionSourcePackageIds({
        packageId: selectedPackage.id,
        sessionSourcePackageIds: selectedPackage.sessionSourcePackageIds
      });
      const sourceSessionKeys = new Set(
        parseSessionSourceKeys(selectedPackage.sessionSourcePackageIds)
      );
      const hasSessionKeySources = sourceSessionKeys.size > 0;

      const candidateQuestions = await prisma.question.findMany({
        where: {
          ...baseWhere,
          ...(hasSessionKeySources ? {} : { packageId: { in: sourcePackageIds } })
        },
        include: includePackage,
        orderBy: [{ createdAt: "asc" }]
      });

      questions = candidateQuestions.filter((question) => {
        const sessionType = normalizeSessionType(question.sessionType);
        const sessionOrder = question.sessionOrder > 0 ? question.sessionOrder : 1;
        const hasAccessToSession = isSessionAccessibleForPackage({
          sessionType,
          sessionOrder,
          pkg: selectedPackage
        });
        if (!hasAccessToSession) return false;

        if (hasSessionKeySources) {
          const sourceSessionKey = buildSessionSourceKey(sessionType, sessionOrder);
          if (!sourceSessionKeys.has(sourceSessionKey)) return false;
        }

        return true;
      });
    } else {
      questions = await prisma.question.findMany({
        where: baseWhere,
        include: includePackage,
        orderBy: [{ createdAt: "asc" }]
      });
    }

    const sortedQuestions = [...questions].sort((a, b) => {
      const sessionTypeA = normalizeSessionType(a.sessionType);
      const sessionTypeB = normalizeSessionType(b.sessionType);
      if (sessionTypeA !== sessionTypeB) {
        if (sessionTypeA === "TRYOUT") return -1;
        if (sessionTypeB === "TRYOUT") return 1;
      }

      if (a.sessionOrder !== b.sessionOrder) {
        return a.sessionOrder - b.sessionOrder;
      }

      const questionOrderA = a.questionOrder > 0 ? a.questionOrder : 1;
      const questionOrderB = b.questionOrder > 0 ? b.questionOrder : 1;
      if (questionOrderA !== questionOrderB) {
        return questionOrderA - questionOrderB;
      }

      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return res.json({
      data: sortedQuestions.map(serializeQuestion)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    console.error("Admin list questions error:", error);
    return res.status(500).json({ message: "Gagal memuat bank soal" });
  }
});

router.get("/question-sessions", requireAuth, requireStaff, async (_req, res) => {
  try {
    const groupedSessions = await prisma.question.groupBy({
      by: ["sessionType", "sessionOrder", "sessionCode", "sessionTitle", "category"],
      _count: { _all: true }
    });

    return res.json({
      data: buildQuestionSessionCatalog(groupedSessions)
    });
  } catch (error) {
    console.error("Admin list question sessions error:", error);
    return res.status(500).json({ message: "Gagal memuat daftar sesi bank soal" });
  }
});

router.post("/questions", requireAuth, requireStaff, async (req, res) => {
  try {
    const payload = questionCreateSchema.parse(req.body);

    const pkg = await prisma.package.findUnique({
      where: { id: payload.packageId },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        tryoutDurationMinutes: true,
        latihanDurationMinutes: true
      }
    });

    if (!pkg) {
      return res.status(404).json({ message: "Paket tidak ditemukan" });
    }

    const { options, answer } = validateAndPrepareQuestionOptions({
      category: payload.category,
      options: sanitizeQuestionOptionInput(payload.options as QuestionOptionInput[]),
      answer: payload.answer
    });
    const sessionMeta = buildQuestionSessionMeta({
      sessionType: payload.sessionType,
      sessionCode: payload.sessionCode,
      sessionTitle: payload.sessionTitle,
      sessionOrder: payload.sessionOrder
    });
    const latestSessionQuestion = await prisma.question.findFirst({
      where: {
        packageId: payload.packageId,
        sessionType: sessionMeta.sessionType,
        sessionOrder: sessionMeta.sessionOrder
      },
      select: {
        questionOrder: true
      },
      orderBy: [{ questionOrder: "desc" }, { createdAt: "desc" }]
    });
    const nextQuestionOrder =
      (latestSessionQuestion?.questionOrder && latestSessionQuestion.questionOrder > 0
        ? latestSessionQuestion.questionOrder
        : 0) + 1;
    const nextSessionDurationMinutes =
      payload.sessionDurationMinutes ??
      (sessionMeta.sessionType === "TRYOUT"
        ? pkg.tryoutDurationMinutes
        : pkg.latihanDurationMinutes);
    const packageDurationField =
      sessionMeta.sessionType === "TRYOUT"
        ? "tryoutDurationMinutes"
        : "latihanDurationMinutes";
    let promptPdfFileName =
      sanitizeOptionalModuleFileName(payload.promptPdfFileName) ?? null;
    const promptPdfDataUrl =
      sanitizeOptionalModulePdfDataUrl(payload.promptPdfDataUrl, promptPdfFileName) ??
      null;
    if (promptPdfDataUrl && !promptPdfFileName) {
      promptPdfFileName = "lampiran-soal.pdf";
    }
    if (!promptPdfDataUrl) {
      promptPdfFileName = null;
    }

    const [created] = await prisma.$transaction([
      prisma.question.create({
        data: {
          packageId: payload.packageId,
          category: payload.category,
          sessionType: sessionMeta.sessionType,
          sessionCode: sessionMeta.sessionCode,
          sessionTitle: sessionMeta.sessionTitle,
          sessionOrder: sessionMeta.sessionOrder,
          questionOrder: nextQuestionOrder,
          subtestTitle: payload.subtestTitle.trim(),
          prompt: payload.prompt.trim(),
          promptImageUrl: sanitizeOptionalImage(payload.promptImageUrl),
          promptPdfDataUrl,
          promptPdfFileName,
          options: serializeQuestionOptions(options),
          answer,
          explanation: payload.explanation?.trim() ? payload.explanation.trim() : null,
          explanationImageUrl: sanitizeOptionalImage(payload.explanationImageUrl)
        },
        include: {
          package: {
            select: {
              id: true,
              slug: true,
              title: true,
              category: true
            }
          }
        }
      }),
      prisma.package.update({
        where: { id: payload.packageId },
        data: {
          [packageDurationField]: nextSessionDurationMinutes
        }
      })
    ]);

    await createQuestionBackupEntry({
      action: "CREATE",
      question: created,
      packageTitle: created.package.title,
      actor: {
        id: res.locals.user.id,
        name: res.locals.user.name,
        role: res.locals.user.role
      }
    });

    return res.status(201).json({
      message: "Soal berhasil ditambahkan",
      data: serializeQuestion(created)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }

    console.error("Admin create question error:", error);
    return res.status(500).json({ message: "Gagal menambahkan soal" });
  }
});

router.patch("/questions/:id", requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = questionUpdateSchema.parse(req.body);

    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: "Tidak ada data soal yang diubah" });
    }

    const existing = await prisma.question.findUnique({
      where: { id },
      include: {
        package: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
            tryoutDurationMinutes: true,
            latihanDurationMinutes: true
          }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ message: "Soal tidak ditemukan" });
    }

    await createQuestionBackupEntry({
      action: "UPDATE_BEFORE",
      question: existing,
      packageTitle: existing.package.title,
      actor: {
        id: res.locals.user.id,
        name: res.locals.user.name,
        role: res.locals.user.role
      }
    });

    let nextPackage = existing.package;
    if (payload.packageId && payload.packageId !== existing.packageId) {
      const pkg = await prisma.package.findUnique({
        where: { id: payload.packageId },
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
          tryoutDurationMinutes: true,
          latihanDurationMinutes: true
        }
      });

      if (!pkg) {
        return res.status(404).json({ message: "Paket tujuan tidak ditemukan" });
      }
      nextPackage = pkg;
    }

    const nextCategory =
      (payload.category ?? existing.category) as QuestionCategory;
    const nextOptionsInput = payload.options
      ? sanitizeQuestionOptionInput(payload.options as QuestionOptionInput[])
      : parseQuestionOptions(existing.options, {
          category: nextCategory,
          answer: payload.answer?.trim() ?? existing.answer
        });
    const nextAnswer = payload.answer?.trim() ?? existing.answer;
    const sessionMeta = buildQuestionSessionMeta({
      sessionType:
        (payload.sessionType ??
          (existing.sessionType as QuestionSessionType)) as QuestionSessionType,
      sessionCode: payload.sessionCode ?? existing.sessionCode,
      sessionTitle: payload.sessionTitle ?? existing.sessionTitle,
      sessionOrder: payload.sessionOrder ?? existing.sessionOrder
    });
    const targetPackageId = payload.packageId ?? existing.packageId;
    const isTargetSessionChanged =
      targetPackageId !== existing.packageId ||
      sessionMeta.sessionType !== normalizeSessionType(existing.sessionType) ||
      sessionMeta.sessionOrder !== existing.sessionOrder;

    let nextQuestionOrder =
      payload.questionOrder ??
      (existing.questionOrder > 0 ? existing.questionOrder : 1);

    if (isTargetSessionChanged && payload.questionOrder === undefined) {
      const latestTargetQuestion = await prisma.question.findFirst({
        where: {
          packageId: targetPackageId,
          sessionType: sessionMeta.sessionType,
          sessionOrder: sessionMeta.sessionOrder,
          id: { not: existing.id }
        },
        select: {
          questionOrder: true
        },
        orderBy: [{ questionOrder: "desc" }, { createdAt: "desc" }]
      });

      nextQuestionOrder =
        (latestTargetQuestion?.questionOrder &&
        latestTargetQuestion.questionOrder > 0
          ? latestTargetQuestion.questionOrder
          : 0) + 1;
    }

    const { options, answer } = validateAndPrepareQuestionOptions({
      category: nextCategory,
      options: nextOptionsInput,
      answer: nextAnswer
    });

    const packageDurationField =
      sessionMeta.sessionType === "TRYOUT"
        ? "tryoutDurationMinutes"
        : "latihanDurationMinutes";
    const nextSessionDurationMinutes =
      payload.sessionDurationMinutes ??
      (sessionMeta.sessionType === "TRYOUT"
        ? nextPackage.tryoutDurationMinutes
        : nextPackage.latihanDurationMinutes);
    let nextPromptPdfDataUrl = existing.promptPdfDataUrl;
    let nextPromptPdfFileName = existing.promptPdfFileName;

    if (payload.promptPdfFileName !== undefined) {
      nextPromptPdfFileName =
        sanitizeOptionalModuleFileName(payload.promptPdfFileName) ?? null;
    }

    if (payload.promptPdfDataUrl !== undefined) {
      nextPromptPdfDataUrl =
        sanitizeOptionalModulePdfDataUrl(
          payload.promptPdfDataUrl,
          nextPromptPdfFileName
        ) ?? null;
    }

    if (!nextPromptPdfDataUrl) {
      nextPromptPdfFileName = null;
    } else if (!nextPromptPdfFileName) {
      nextPromptPdfFileName = "lampiran-soal.pdf";
    }

    const [updated] = await prisma.$transaction([
      prisma.question.update({
        where: { id },
        data: {
          packageId: targetPackageId,
          category: nextCategory,
          sessionType: sessionMeta.sessionType,
          sessionCode: sessionMeta.sessionCode,
          sessionTitle: sessionMeta.sessionTitle,
          sessionOrder: sessionMeta.sessionOrder,
          questionOrder: nextQuestionOrder,
          subtestTitle: payload.subtestTitle?.trim() ?? existing.subtestTitle,
          prompt: payload.prompt?.trim() ?? existing.prompt,
          promptImageUrl:
            payload.promptImageUrl !== undefined
              ? sanitizeOptionalImage(payload.promptImageUrl)
              : existing.promptImageUrl,
          promptPdfDataUrl: nextPromptPdfDataUrl,
          promptPdfFileName: nextPromptPdfFileName,
          options: serializeQuestionOptions(options),
          answer,
          explanation:
            payload.explanation !== undefined
              ? payload.explanation.trim()
                ? payload.explanation.trim()
                : null
              : existing.explanation,
          explanationImageUrl:
            payload.explanationImageUrl !== undefined
              ? sanitizeOptionalImage(payload.explanationImageUrl)
              : existing.explanationImageUrl
        },
        include: {
          package: {
            select: {
              id: true,
              slug: true,
              title: true,
              category: true
            }
          }
        }
      }),
      prisma.package.update({
        where: { id: nextPackage.id },
        data: {
          [packageDurationField]: nextSessionDurationMinutes
        }
      })
    ]);

    return res.json({
      message: "Soal berhasil diperbarui",
      data: serializeQuestion(updated)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }

    console.error("Admin update question error:", error);
    return res.status(500).json({ message: "Gagal memperbarui soal" });
  }
});

router.patch(
  "/question-sessions/:sessionType/:sessionOrder",
  requireAuth,
  requireStaff,
  async (req, res) => {
    try {
      const sessionTypeRaw = req.params.sessionType?.trim().toUpperCase();
      if (!sessionTypeRaw || !QUESTION_SESSION_TYPES.includes(sessionTypeRaw as QuestionSessionType)) {
        return res.status(400).json({
          message: "Jenis sesi tidak valid. Gunakan TRYOUT atau LATIHAN."
        });
      }
      const sessionType = sessionTypeRaw as QuestionSessionType;

      const parsedSessionOrder = Number(req.params.sessionOrder);
      if (!Number.isInteger(parsedSessionOrder) || parsedSessionOrder < 1) {
        return res.status(400).json({ message: "Urutan sesi tidak valid." });
      }
      const sessionOrder = parsedSessionOrder;

      const payload = questionSessionUpdateSchema.parse(req.body);
      const targetPackage = await prisma.package.findUnique({
        where: { id: payload.packageId },
        select: {
          id: true,
          tryoutDurationMinutes: true,
          latihanDurationMinutes: true
        }
      });

      if (!targetPackage) {
        return res.status(404).json({ message: "Paket tidak ditemukan." });
      }

      const sessionQuestions = await prisma.question.findMany({
        where: {
          packageId: payload.packageId,
          sessionType,
          sessionOrder
        },
        select: {
          id: true,
          questionOrder: true
        }
      });

      if (!sessionQuestions.length) {
        return res.status(404).json({
          message: "Sesi tidak ditemukan pada paket tersebut."
        });
      }

      const sessionMeta = buildQuestionSessionMeta({
        sessionType,
        sessionOrder,
        sessionCode: payload.sessionCode,
        sessionTitle: payload.sessionTitle
      });

      const questionOrderUpdates = payload.questionOrders ?? [];
      if (questionOrderUpdates.length) {
        const allowedIds = new Set(sessionQuestions.map((question) => question.id));
        const providedIds = new Set(questionOrderUpdates.map((item) => item.id));
        const providedOrders = new Set(
          questionOrderUpdates.map((item) => item.questionOrder)
        );

        if (questionOrderUpdates.length !== sessionQuestions.length) {
          return res.status(400).json({
            message:
              "Urutan soal harus dikirim lengkap untuk seluruh soal pada sesi ini."
          });
        }

        if (providedIds.size !== questionOrderUpdates.length) {
          return res.status(400).json({
            message: "Daftar urutan soal mengandung ID duplikat."
          });
        }

        if (providedOrders.size !== questionOrderUpdates.length) {
          return res.status(400).json({
            message: "Nomor urut soal tidak boleh sama."
          });
        }

        const hasUnknownQuestion = questionOrderUpdates.some(
          (item) => !allowedIds.has(item.id)
        );
        if (hasUnknownQuestion) {
          return res.status(400).json({
            message: "Ada soal yang bukan bagian dari sesi ini."
          });
        }
      }

      const packageDurationField =
        sessionType === "TRYOUT" ? "tryoutDurationMinutes" : "latihanDurationMinutes";
      const nextDurationMinutes =
        payload.sessionDurationMinutes ??
        (sessionType === "TRYOUT"
          ? targetPackage.tryoutDurationMinutes
          : targetPackage.latihanDurationMinutes);

      await prisma.$transaction([
        prisma.question.updateMany({
          where: {
            packageId: payload.packageId,
            sessionType,
            sessionOrder
          },
          data: {
            sessionCode: sessionMeta.sessionCode,
            sessionTitle: sessionMeta.sessionTitle
          }
        }),
        ...questionOrderUpdates.map((item) =>
          prisma.question.update({
            where: { id: item.id },
            data: { questionOrder: item.questionOrder }
          })
        ),
        prisma.package.update({
          where: { id: payload.packageId },
          data: {
            [packageDurationField]: nextDurationMinutes
          }
        })
      ]);

      return res.json({
        message: "Sesi berhasil diperbarui."
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validasi gagal",
          errors: error.flatten()
        });
      }

      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }

      console.error("Admin update question session error:", error);
      return res.status(500).json({ message: "Gagal memperbarui sesi bank soal." });
    }
  }
);

router.post("/questions/:id/duplicate", requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.question.findUnique({
      where: { id },
      include: {
        package: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true
          }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ message: "Soal tidak ditemukan." });
    }

    const latestSessionQuestion = await prisma.question.findFirst({
      where: {
        packageId: existing.packageId,
        sessionType: existing.sessionType,
        sessionOrder: existing.sessionOrder
      },
      select: {
        questionOrder: true
      },
      orderBy: [{ questionOrder: "desc" }, { createdAt: "desc" }]
    });
    const nextQuestionOrder =
      (latestSessionQuestion?.questionOrder && latestSessionQuestion.questionOrder > 0
        ? latestSessionQuestion.questionOrder
        : 0) + 1;

    const duplicated = await prisma.question.create({
      data: {
        packageId: existing.packageId,
        category: existing.category,
        sessionType: existing.sessionType,
        sessionCode: existing.sessionCode,
        sessionTitle: existing.sessionTitle,
        sessionOrder: existing.sessionOrder,
        questionOrder: nextQuestionOrder,
        subtestTitle: existing.subtestTitle,
        prompt: existing.prompt,
        promptImageUrl: existing.promptImageUrl,
        promptPdfDataUrl: existing.promptPdfDataUrl,
        promptPdfFileName: existing.promptPdfFileName,
        options: existing.options,
        answer: existing.answer,
        explanation: existing.explanation,
        explanationImageUrl: existing.explanationImageUrl
      },
      include: {
        package: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true
          }
        }
      }
    });

    await createQuestionBackupEntry({
      action: "CREATE",
      question: duplicated,
      packageTitle: duplicated.package.title,
      actor: {
        id: res.locals.user.id,
        name: res.locals.user.name,
        role: res.locals.user.role
      }
    });

    return res.status(201).json({
      message: "Soal berhasil diduplikat.",
      data: serializeQuestion(duplicated)
    });
  } catch (error) {
    console.error("Admin duplicate question error:", error);
    return res.status(500).json({ message: "Gagal menduplikat soal." });
  }
});

router.delete("/questions/:id", requireAuth, requireStaff, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.question.findUnique({
      where: { id },
      include: {
        package: {
          select: {
            title: true
          }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ message: "Soal tidak ditemukan." });
    }

    await createQuestionBackupEntry({
      action: "DELETE",
      question: existing,
      packageTitle: existing.package.title,
      actor: {
        id: res.locals.user.id,
        name: res.locals.user.name,
        role: res.locals.user.role
      }
    });

    await prisma.question.delete({ where: { id: existing.id } });
    return res.json({ message: "Soal berhasil dihapus" });
  } catch (error) {
    console.error("Admin delete question error:", error);
    return res.status(500).json({ message: "Gagal menghapus soal" });
  }
});

router.get("/question-backups", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = questionBackupQuerySchema.parse(req.query);
    const rows = await prisma.questionBackup.findMany({
      where: {
        ...(payload.packageId ? { packageId: payload.packageId } : {}),
        ...(payload.action ? { action: payload.action } : {})
      },
      orderBy: [{ createdAt: "desc" }],
      take: payload.limit
    });

    return res.json({
      data: rows.map((row) => ({
        id: row.id,
        action: row.action,
        questionId: row.questionId,
        packageId: row.packageId,
        packageTitle: row.packageTitle,
        sessionType: row.sessionType ? normalizeSessionType(row.sessionType) : null,
        sessionOrder: row.sessionOrder,
        sessionCode: row.sessionCode,
        sessionTitle: row.sessionTitle,
        category: row.category,
        subtestTitle: row.subtestTitle,
        promptExcerpt: row.promptExcerpt,
        actorId: row.actorId,
        actorName: row.actorName,
        actorRole: row.actorRole,
        restoredAt: row.restoredAt,
        restoredById: row.restoredById,
        restoredByName: row.restoredByName,
        restoredQuestionId: row.restoredQuestionId,
        createdAt: row.createdAt
      }))
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    console.error("Admin list question backups error:", error);
    return res.status(500).json({ message: "Gagal memuat backup soal." });
  }
});

router.get("/question-backups/export", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        package: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true
          }
        }
      },
      orderBy: [
        { packageId: "asc" },
        { sessionType: "asc" },
        { sessionOrder: "asc" },
        { questionOrder: "asc" },
        { createdAt: "asc" }
      ]
    });

    const payload = {
      generatedAt: new Date().toISOString(),
      totalQuestions: questions.length,
      data: questions.map((question) => ({
        id: question.id,
        package: question.package,
        category: question.category as QuestionCategory,
        sessionType: normalizeSessionType(question.sessionType),
        sessionCode: question.sessionCode,
        sessionTitle: question.sessionTitle,
        sessionOrder: question.sessionOrder,
        questionOrder: question.questionOrder,
        subtestTitle: question.subtestTitle,
        prompt: question.prompt,
        promptImageUrl: question.promptImageUrl,
        promptPdfDataUrl: question.promptPdfDataUrl,
        promptPdfFileName: question.promptPdfFileName,
        options: parseQuestionOptions(question.options, {
          category: question.category as QuestionCategory,
          answer: question.answer
        }),
        answer: question.answer,
        explanation: question.explanation,
        explanationImageUrl: question.explanationImageUrl,
        createdAt: question.createdAt
      }))
    };

    const fileName = `question-backup-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error("Admin export question backup error:", error);
    return res.status(500).json({ message: "Gagal mengekspor backup soal." });
  }
});

router.post("/question-backups/:id/restore", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const actor = res.locals.user as { id: string; name: string; role: string };
    const backup = await prisma.questionBackup.findUnique({
      where: { id }
    });

    if (!backup) {
      return res.status(404).json({ message: "Backup soal tidak ditemukan." });
    }

    const parsedSnapshot = questionBackupSnapshotSchema.parse(
      JSON.parse(backup.snapshot) as unknown
    );

    const targetPackage = await prisma.package.findUnique({
      where: { id: parsedSnapshot.packageId },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        tryoutDurationMinutes: true,
        latihanDurationMinutes: true
      }
    });
    if (!targetPackage) {
      return res.status(404).json({
        message: "Paket tujuan backup tidak ditemukan. Restore dibatalkan."
      });
    }

    const { options, answer } = validateAndPrepareQuestionOptions({
      category: parsedSnapshot.category,
      options: sanitizeQuestionOptionInput(parsedSnapshot.options),
      answer: parsedSnapshot.answer
    });

    const latestSessionQuestion = await prisma.question.findFirst({
      where: {
        packageId: parsedSnapshot.packageId,
        sessionType: parsedSnapshot.sessionType,
        sessionOrder: parsedSnapshot.sessionOrder
      },
      select: {
        questionOrder: true
      },
      orderBy: [{ questionOrder: "desc" }, { createdAt: "desc" }]
    });

    const nextQuestionOrder =
      (latestSessionQuestion?.questionOrder && latestSessionQuestion.questionOrder > 0
        ? latestSessionQuestion.questionOrder
        : 0) + 1;
    let promptPdfFileName =
      sanitizeOptionalModuleFileName(parsedSnapshot.promptPdfFileName) ?? null;
    const promptPdfDataUrl =
      sanitizeOptionalModulePdfDataUrl(
        parsedSnapshot.promptPdfDataUrl,
        promptPdfFileName
      ) ?? null;
    if (promptPdfDataUrl && !promptPdfFileName) {
      promptPdfFileName = "lampiran-soal.pdf";
    }
    if (!promptPdfDataUrl) {
      promptPdfFileName = null;
    }

    const restored = await prisma.question.create({
      data: {
        packageId: parsedSnapshot.packageId,
        category: parsedSnapshot.category,
        sessionType: parsedSnapshot.sessionType,
        sessionCode: parsedSnapshot.sessionCode.trim().toUpperCase(),
        sessionTitle: parsedSnapshot.sessionTitle.trim(),
        sessionOrder: parsedSnapshot.sessionOrder,
        questionOrder: nextQuestionOrder,
        subtestTitle: parsedSnapshot.subtestTitle.trim(),
        prompt: parsedSnapshot.prompt.trim(),
        promptImageUrl: sanitizeOptionalImage(parsedSnapshot.promptImageUrl),
        promptPdfDataUrl,
        promptPdfFileName,
        options: serializeQuestionOptions(options),
        answer,
        explanation: parsedSnapshot.explanation?.trim()
          ? parsedSnapshot.explanation.trim()
          : null,
        explanationImageUrl: sanitizeOptionalImage(parsedSnapshot.explanationImageUrl)
      },
      include: {
        package: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true
          }
        }
      }
    });

    await prisma.questionBackup.update({
      where: { id: backup.id },
      data: {
        restoredAt: new Date(),
        restoredById: actor.id,
        restoredByName: actor.name,
        restoredQuestionId: restored.id
      }
    });

    await createQuestionBackupEntry({
      action: "RESTORE",
      question: restored,
      packageTitle: restored.package.title,
      actor
    });

    return res.status(201).json({
      message: "Soal berhasil dipulihkan dari backup.",
      data: serializeQuestion(restored)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Data backup tidak valid untuk dipulihkan.",
        errors: error.flatten()
      });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        message: "Format snapshot backup tidak valid."
      });
    }
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Admin restore question backup error:", error);
    return res.status(500).json({ message: "Gagal memulihkan backup soal." });
  }
});

router.get("/modules", requireAuth, requireStaff, async (_req, res) => {
  try {
    const modules = await prisma.module.findMany({
      include: {
        createdBy: {
          select: { id: true, name: true, role: true }
        },
        _count: {
          select: { accesses: true }
        },
        packageLinks: {
          include: {
            package: {
              select: {
                id: true,
                slug: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    return res.json({
      data: modules.map(serializeModule)
    });
  } catch (error) {
    console.error("Admin list modules error:", error);
    return res.status(500).json({ message: "Gagal memuat modul materi" });
  }
});

router.post("/module-files/chunk", requireAuth, requireStaff, async (req, res) => {
  try {
    const payload = moduleUploadChunkSchema.parse(req.body);
    cleanupExpiredModuleUploads();

    const fileName = sanitizeOptionalModuleFileName(payload.fileName);
    if (!fileName) {
      return res.status(400).json({ message: "Nama file tidak valid." });
    }

    const mimeType = resolveModuleMimeType({
      fileType: payload.fileType,
      mimeType: payload.mimeType,
      fileName
    });
    if (payload.chunkIndex >= payload.totalChunks) {
      return res.status(400).json({
        message: "Nomor potongan file tidak valid."
      });
    }

    const chunkBase64 = payload.chunkBase64.replace(/\s+/g, "");
    if (estimateBase64ByteLength(chunkBase64) > 220 * 1024) {
      return res.status(400).json({
        message: "Potongan file terlalu besar. Silakan upload ulang."
      });
    }

    const existingSession = moduleUploadChunkSessions.get(payload.uploadId);
    if (existingSession) {
      if (
        existingSession.fileType !== payload.fileType ||
        existingSession.fileName !== fileName ||
        existingSession.totalChunks !== payload.totalChunks
      ) {
        return res.status(400).json({
          message: "Sesi upload tidak cocok. Silakan mulai upload ulang."
        });
      }
      existingSession.chunks.set(payload.chunkIndex, chunkBase64);
      existingSession.expiresAt = Date.now() + MODULE_UPLOAD_SESSION_TTL_MS;
    } else {
      const session: ModuleUploadChunkSession = {
        uploadId: payload.uploadId,
        fileType: payload.fileType,
        fileName,
        mimeType,
        totalChunks: payload.totalChunks,
        chunks: new Map([[payload.chunkIndex, chunkBase64]]),
        expiresAt: Date.now() + MODULE_UPLOAD_SESSION_TTL_MS
      };
      moduleUploadChunkSessions.set(payload.uploadId, session);
    }

    const activeSession = moduleUploadChunkSessions.get(payload.uploadId);
    const receivedChunks = activeSession?.chunks.size ?? 0;

    return res.json({
      message: "Potongan file diterima.",
      data: {
        uploadId: payload.uploadId,
        receivedChunks,
        totalChunks: payload.totalChunks,
        completed: receivedChunks >= payload.totalChunks
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi upload file gagal.",
        errors: error.flatten()
      });
    }
    if (error instanceof Error && error.name === "BadRequestError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Admin module chunk upload error:", error);
    return res.status(500).json({ message: "Gagal mengupload file modul." });
  }
});

router.post("/module-files/complete", requireAuth, requireStaff, async (req, res) => {
  try {
    const payload = moduleUploadCompleteSchema.parse(req.body);
    cleanupExpiredModuleUploads();

    const session = moduleUploadChunkSessions.get(payload.uploadId);
    if (!session || session.fileType !== payload.fileType) {
      return res.status(404).json({
        message: "Sesi upload tidak ditemukan. Silakan upload ulang file."
      });
    }

    if (session.chunks.size !== session.totalChunks) {
      return res.status(400).json({
        message: "Upload file belum lengkap. Silakan tunggu hingga selesai."
      });
    }

    const orderedChunks: string[] = [];
    for (let index = 0; index < session.totalChunks; index += 1) {
      const chunk = session.chunks.get(index);
      if (!chunk) {
        return res.status(400).json({
          message: "Ada potongan file yang hilang. Silakan upload ulang."
        });
      }
      orderedChunks.push(chunk);
    }

    const base64Payload = orderedChunks.join("");
    const sizeInBytes = estimateBase64ByteLength(base64Payload);
    if (payload.fileType === "PDF" && sizeInBytes > MODULE_PDF_MAX_BYTES) {
      return res.status(400).json({ message: "Ukuran file PDF maksimal 10MB." });
    }
    if (payload.fileType === "PPT" && sizeInBytes > MODULE_PPT_MAX_BYTES) {
      return res.status(400).json({ message: "Ukuran file PPT maksimal 15MB." });
    }

    const uploadToken = `module-upload-${randomUUID()}`;
    const dataUrl = `data:${session.mimeType};base64,${base64Payload}`;
    moduleUploadTokens.set(uploadToken, {
      fileType: session.fileType,
      fileName: session.fileName,
      dataUrl,
      sizeInBytes,
      expiresAt: Date.now() + MODULE_UPLOAD_SESSION_TTL_MS
    });
    moduleUploadChunkSessions.delete(payload.uploadId);

    return res.json({
      message: "Upload file modul selesai.",
      data: {
        uploadToken,
        fileName: session.fileName,
        sizeInBytes
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi penyelesaian upload gagal.",
        errors: error.flatten()
      });
    }
    console.error("Admin complete module upload error:", error);
    return res.status(500).json({ message: "Gagal menyelesaikan upload file modul." });
  }
});

router.post("/modules", requireAuth, requireStaff, async (req, res) => {
  try {
    const payload = moduleCreateSchema.parse(req.body);
    const createdBy = res.locals.user;
    const normalizedTitle = payload.title.trim();
    if (normalizedTitle.length < 3) {
      return res.status(400).json({
        message: "Judul modul minimal 3 karakter."
      });
    }
    const packageIds = sanitizeModulePackageIds(payload.packageIds ?? []);
    const bab = sanitizeOptionalModuleSectionText(payload.bab) ?? null;
    const subBab = sanitizeOptionalModuleSectionText(payload.subBab) ?? null;
    const content = sanitizeOptionalModuleContent(payload.content) ?? null;
    const pdfUploadToken = payload.pdfUploadToken?.trim() || "";
    const pptUploadToken = payload.pptUploadToken?.trim() || "";
    let pdfFileName = sanitizeOptionalModuleFileName(payload.pdfFileName) ?? null;
    let pdfDataUrl =
      sanitizeOptionalModulePdfDataUrl(payload.pdfDataUrl, pdfFileName) ?? null;
    let pptFileName = sanitizeOptionalModuleFileName(payload.pptFileName) ?? null;
    let pptDataUrl =
      sanitizeOptionalModulePptDataUrl(payload.pptDataUrl, pptFileName) ?? null;

    if (pdfUploadToken) {
      const uploadedPdf = buildModuleDataUrlFromToken(pdfUploadToken, "PDF");
      pdfDataUrl = sanitizeOptionalModulePdfDataUrl(
        uploadedPdf.dataUrl,
        uploadedPdf.fileName
      ) ?? null;
      pdfFileName = sanitizeOptionalModuleFileName(uploadedPdf.fileName) ?? "modul-materi.pdf";
    }

    if (pptUploadToken) {
      const uploadedPpt = buildModuleDataUrlFromToken(pptUploadToken, "PPT");
      pptDataUrl = sanitizeOptionalModulePptDataUrl(
        uploadedPpt.dataUrl,
        uploadedPpt.fileName
      ) ?? null;
      pptFileName =
        sanitizeOptionalModuleFileName(uploadedPpt.fileName) ?? "modul-materi.pptx";
    }

    if (content && content.length < 10) {
      return res.status(400).json({
        message: "Isi materi manual minimal 10 karakter."
      });
    }

    if (!content && !pdfDataUrl && !pptDataUrl) {
      return res.status(400).json({
        message: "Isi materi manual, file PDF, atau file PPT wajib diisi."
      });
    }

    if (pdfDataUrl && !pdfFileName) {
      pdfFileName = "modul-materi.pdf";
    }

    if (!pdfDataUrl) {
      pdfFileName = null;
    }

    if (pptDataUrl && !pptFileName) {
      pptFileName = "modul-materi.pptx";
    }

    if (!pptDataUrl) {
      pptFileName = null;
    }

    if (packageIds.length) {
      const validPackages = await prisma.package.findMany({
        where: { id: { in: packageIds } },
        select: { id: true }
      });
      if (validPackages.length !== packageIds.length) {
        return res.status(400).json({ message: "Ada paket modul yang tidak valid." });
      }
    }

    const created = await prisma.module.create({
      data: {
        title: normalizedTitle,
        bab,
        subBab,
        summary: payload.summary?.trim() ? payload.summary.trim() : null,
        content,
        pdfDataUrl,
        pdfFileName,
        pptDataUrl,
        pptFileName,
        isPublished: payload.isPublished ?? true,
        createdById: createdBy.id,
        packageLinks: packageIds.length
          ? {
              create: packageIds.map((packageId) => ({ packageId }))
            }
          : undefined
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true }
        },
        _count: {
          select: { accesses: true }
        },
        packageLinks: {
          include: {
            package: {
              select: {
                id: true,
                slug: true,
                title: true
              }
            }
          }
        }
      }
    });

    return res.status(201).json({
      message: "Modul berhasil ditambahkan",
      data: serializeModule(created)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    if (error instanceof Error && error.name === "BadRequestError") {
      return res.status(400).json({
        message: error.message
      });
    }
    console.error("Admin create module error:", error);
    return res.status(500).json({ message: "Gagal menambahkan modul materi" });
  }
});

router.patch("/modules/:id", requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = moduleUpdateSchema.parse(req.body);
    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: "Tidak ada perubahan modul." });
    }

    const existing = await prisma.module.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Modul tidak ditemukan." });
    }

    const packageIds =
      payload.packageIds !== undefined
        ? sanitizeModulePackageIds(payload.packageIds)
        : null;
    const pdfUploadToken = payload.pdfUploadToken?.trim() || "";
    const pptUploadToken = payload.pptUploadToken?.trim() || "";

    if (packageIds !== null) {
      const validPackages = await prisma.package.findMany({
        where: { id: { in: packageIds } },
        select: { id: true }
      });
      if (validPackages.length !== packageIds.length) {
        return res.status(400).json({ message: "Ada paket modul yang tidak valid." });
      }
    }

    const nextData: {
      title?: string;
      bab?: string | null;
      subBab?: string | null;
      summary?: string | null;
      content?: string | null;
      pdfDataUrl?: string | null;
      pdfFileName?: string | null;
      pptDataUrl?: string | null;
      pptFileName?: string | null;
      isPublished?: boolean;
    } = {};
    let nextContent = existing.content;
    let nextPdfDataUrl = existing.pdfDataUrl;
    let nextPdfFileName = existing.pdfFileName;
    let nextPptDataUrl = existing.pptDataUrl;
    let nextPptFileName = existing.pptFileName;

    if (payload.title !== undefined) {
      const normalizedTitle = payload.title.trim();
      if (normalizedTitle.length < 3) {
        return res.status(400).json({
          message: "Judul modul minimal 3 karakter."
        });
      }
      nextData.title = normalizedTitle;
    }
    if (payload.bab !== undefined) {
      nextData.bab = sanitizeOptionalModuleSectionText(payload.bab) ?? null;
    }
    if (payload.subBab !== undefined) {
      nextData.subBab = sanitizeOptionalModuleSectionText(payload.subBab) ?? null;
    }
    if (payload.summary !== undefined) {
      const summary = payload.summary.trim();
      nextData.summary = summary ? summary : null;
    }
    if (payload.content !== undefined) {
      const content = sanitizeOptionalModuleContent(payload.content) ?? null;
      if (content && content.length < 10) {
        return res.status(400).json({
          message: "Isi materi manual minimal 10 karakter."
        });
      }
      nextContent = content;
      nextData.content = content;
    }
    if (payload.pdfFileName !== undefined) {
      nextPdfFileName =
        sanitizeOptionalModuleFileName(payload.pdfFileName) ?? null;
      nextData.pdfFileName = nextPdfFileName;
    }
    if (payload.pptFileName !== undefined) {
      nextPptFileName = sanitizeOptionalModuleFileName(payload.pptFileName) ?? null;
      nextData.pptFileName = nextPptFileName;
    }
    if (payload.pdfDataUrl !== undefined) {
      nextPdfDataUrl =
        sanitizeOptionalModulePdfDataUrl(payload.pdfDataUrl, nextPdfFileName) ?? null;
      nextData.pdfDataUrl = nextPdfDataUrl;
    }
    if (payload.pptDataUrl !== undefined) {
      nextPptDataUrl =
        sanitizeOptionalModulePptDataUrl(payload.pptDataUrl, nextPptFileName) ?? null;
      nextData.pptDataUrl = nextPptDataUrl;
    }
    if (pdfUploadToken) {
      const uploadedPdf = buildModuleDataUrlFromToken(pdfUploadToken, "PDF");
      nextPdfDataUrl =
        sanitizeOptionalModulePdfDataUrl(uploadedPdf.dataUrl, uploadedPdf.fileName) ?? null;
      nextPdfFileName =
        sanitizeOptionalModuleFileName(uploadedPdf.fileName) ?? "modul-materi.pdf";
      nextData.pdfDataUrl = nextPdfDataUrl;
      nextData.pdfFileName = nextPdfFileName;
    }
    if (pptUploadToken) {
      const uploadedPpt = buildModuleDataUrlFromToken(pptUploadToken, "PPT");
      nextPptDataUrl =
        sanitizeOptionalModulePptDataUrl(uploadedPpt.dataUrl, uploadedPpt.fileName) ?? null;
      nextPptFileName =
        sanitizeOptionalModuleFileName(uploadedPpt.fileName) ?? "modul-materi.pptx";
      nextData.pptDataUrl = nextPptDataUrl;
      nextData.pptFileName = nextPptFileName;
    }

    if (!nextPdfDataUrl) {
      nextPdfFileName = null;
      nextData.pdfFileName = null;
    } else if (!nextPdfFileName) {
      nextPdfFileName = "modul-materi.pdf";
      nextData.pdfFileName = nextPdfFileName;
    }

    if (!nextPptDataUrl) {
      nextPptFileName = null;
      nextData.pptFileName = null;
    } else if (!nextPptFileName) {
      nextPptFileName = "modul-materi.pptx";
      nextData.pptFileName = nextPptFileName;
    }

    if (!nextContent && !nextPdfDataUrl && !nextPptDataUrl) {
      return res.status(400).json({
        message: "Isi materi manual, file PDF, atau file PPT wajib tersedia."
      });
    }

    if (payload.isPublished !== undefined) {
      nextData.isPublished = payload.isPublished;
    }

    const updated = await prisma.$transaction(async (tx) => {

      await tx.module.update({
        where: { id },
        data: nextData
      });

      if (packageIds !== null) {
        await tx.packageModule.deleteMany({ where: { moduleId: id } });
        if (packageIds.length) {
          await tx.packageModule.createMany({
            data: packageIds.map((packageId) => ({ moduleId: id, packageId })),
            skipDuplicates: true
          });
        }
      }

      return tx.module.findUniqueOrThrow({
        where: { id },
        include: {
          createdBy: {
            select: { id: true, name: true, role: true }
          },
          _count: {
            select: { accesses: true }
          },
          packageLinks: {
            include: {
              package: {
                select: {
                  id: true,
                  slug: true,
                  title: true
                }
              }
            }
          }
        }
      });
    });

    return res.json({
      message: "Modul berhasil diperbarui",
      data: serializeModule(updated)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    if (error instanceof Error && error.name === "BadRequestError") {
      return res.status(400).json({
        message: error.message
      });
    }
    console.error("Admin update module error:", error);
    return res.status(500).json({ message: "Gagal memperbarui modul materi" });
  }
});

router.delete("/modules/:id", requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.module.delete({ where: { id } });
    return res.json({ message: "Modul berhasil dihapus." });
  } catch (error) {
    console.error("Admin delete module error:", error);
    return res.status(500).json({ message: "Gagal menghapus modul materi" });
  }
});

router.get("/modules/access", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [modules, students] = await Promise.all([
      prisma.module.findMany({
        select: {
          id: true,
          title: true,
          isPublished: true
        },
        orderBy: [{ updatedAt: "desc" }]
      }),
      prisma.user.findMany({
        where: { role: "student" },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          isValidated: true,
          moduleAccesses: {
            select: {
              moduleId: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }]
      })
    ]);

    return res.json({
      data: {
        modules,
        students: students.map((student) => ({
          id: student.id,
          name: student.name,
          username: student.username,
          email: student.email,
          isValidated: student.isValidated,
          moduleIds: student.moduleAccesses.map((item) => item.moduleId)
        }))
      }
    });
  } catch (error) {
    console.error("Admin list module access error:", error);
    return res.status(500).json({ message: "Gagal memuat akses modul siswa" });
  }
});

router.put("/modules/access/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const payload = moduleAccessUpdateSchema.parse(req.body);
    const moduleIds = Array.from(new Set(payload.moduleIds.map((item) => item.trim()).filter(Boolean)));

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });
    if (!targetUser || targetUser.role !== "student") {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    if (moduleIds.length) {
      const modules = await prisma.module.findMany({
        where: { id: { in: moduleIds } },
        select: { id: true }
      });
      if (modules.length !== moduleIds.length) {
        return res.status(400).json({ message: "Ada modul yang tidak valid." });
      }
    }

    await prisma.$transaction([
      prisma.userModuleAccess.deleteMany({ where: { userId } }),
      ...(moduleIds.length
        ? [
            prisma.userModuleAccess.createMany({
              data: moduleIds.map((moduleId) => ({
                userId,
                moduleId,
                grantedById: res.locals.user.id
              })),
              skipDuplicates: true
            })
          ]
        : [])
    ]);

    return res.json({
      message: "Akses modul siswa berhasil diperbarui.",
      data: {
        userId,
        moduleIds
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    console.error("Admin update module access error:", error);
    return res.status(500).json({ message: "Gagal memperbarui akses modul siswa" });
  }
});

router.post("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = userCreateSchema.parse(req.body);
    const normalizedUsername = payload.username;

    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: "insensitive"
        }
      }
    });

    if (existing) {
      return res.status(409).json({ message: "Username sudah terdaftar" });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    const created = await prisma.user.create({
      data: {
        name: payload.name?.trim() || normalizedUsername,
        username: normalizedUsername,
        email: buildInternalEmail(normalizedUsername),
        phone: payload.phone ? payload.phone : null,
        passwordHash,
        provider: "STANDARD",
        role: payload.role,
        registrationSource: "ADMIN_CREATED",
        isValidated:
          payload.role === "student" ? payload.isValidated ?? true : true,
        sessionVersion: 1
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        provider: true,
        role: true,
        registrationSource: true,
        isValidated: true,
        createdAt: true
      }
    });

    return res.status(201).json({
      message: "Akun berhasil dibuat",
      data: created
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    console.error("Admin create user error:", error);
    return res.status(500).json({ message: "Gagal membuat akun" });
  }
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = userUpdateSchema.parse(req.body);
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true }
    });

    if (!targetUser) {
      return res.status(404).json({ message: "Akun tidak ditemukan" });
    }

    if (payload.username) {
      const normalizedUsername = payload.username;
      const existing = await prisma.user.findFirst({
        where: {
          username: {
            equals: normalizedUsername,
            mode: "insensitive"
          }
        }
      });
      if (existing && existing.id !== id) {
        return res.status(409).json({ message: "Username sudah digunakan" });
      }
    }

    const data: Record<string, unknown> = {};
    if (payload.name?.trim()) data.name = payload.name.trim();
    if (payload.username) {
      data.username = payload.username;
      data.email = buildInternalEmail(payload.username);
    }
    if (payload.phone !== undefined) {
      data.phone = payload.phone ? payload.phone : null;
    }
    if (payload.role) data.role = payload.role;
    const nextRole = payload.role ?? targetUser.role;
    if (payload.registrationSource) {
      data.registrationSource = payload.registrationSource;
    }
    if (payload.isValidated !== undefined) {
      if (nextRole !== "student" && payload.isValidated === false) {
        return res.status(400).json({
          message: "Akun admin/teacher harus tetap aktif."
        });
      }
      data.isValidated = nextRole === "student" ? payload.isValidated : true;
    }
    if (payload.role && payload.role !== "student") {
      data.isValidated = true;
      data.registrationSource = "ADMIN_CREATED";
    }
    if (payload.password) {
      data.passwordHash = await bcrypt.hash(payload.password, 10);
      data.sessionVersion = { increment: 1 };
      data.activeDeviceId = null;
      data.activeDeviceLabel = null;
      data.activeSessionStartedAt = null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        provider: true,
        role: true,
        registrationSource: true,
        isValidated: true,
        createdAt: true
      }
    });

    return res.json({
      message: "Akun berhasil diperbarui",
      data: updated
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    console.error("Admin update user error:", error);
    return res.status(500).json({ message: "Gagal memperbarui akun" });
  }
});

router.patch("/users/:id/validation", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = userValidationSchema.parse(req.body);

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        isValidated: true
      }
    });

    if (!target) {
      return res.status(404).json({ message: "Akun tidak ditemukan" });
    }

    if (target.role !== "student") {
      return res
        .status(400)
        .json({ message: "Validasi akun hanya berlaku untuk siswa." });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isValidated: payload.isValidated,
        sessionVersion:
          payload.isValidated === target.isValidated
            ? undefined
            : { increment: 1 },
        activeDeviceId:
          payload.isValidated === target.isValidated ? undefined : null,
        activeDeviceLabel:
          payload.isValidated === target.isValidated ? undefined : null,
        activeSessionStartedAt:
          payload.isValidated === target.isValidated ? undefined : null
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        provider: true,
        role: true,
        registrationSource: true,
        isValidated: true,
        createdAt: true
      }
    });

    return res.json({
      message: payload.isValidated
        ? "Akun siswa berhasil divalidasi."
        : "Validasi akun siswa dicabut.",
      data: updated
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    console.error("Admin update user validation error:", error);
    return res.status(500).json({ message: "Gagal memperbarui validasi akun." });
  }
});

router.put("/users/:id/access", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: userId } = req.params;
    const payload = userPackageAccessSchema.parse(req.body);
    const packageIds = Array.from(new Set(payload.packageIds));

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!targetUser) {
      return res.status(404).json({ message: "Akun tidak ditemukan" });
    }

    if (targetUser.role !== "student") {
      return res
        .status(400)
        .json({ message: "Hak akses tryout hanya bisa diberikan ke akun siswa." });
    }

    const packages = await prisma.package.findMany({
      where: { id: { in: packageIds } },
      select: { id: true, price: true }
    });

    if (packages.length !== packageIds.length) {
      return res.status(400).json({ message: "Ada paket yang tidak valid." });
    }

    const paidPurchases = await prisma.purchase.findMany({
      where: {
        userId,
        status: PURCHASE_STATUS.PAID
      },
      select: {
        id: true,
        packageId: true,
        isAdminGranted: true
      }
    });

    const paidByPackage = new Map<
      string,
      { hasNonAdmin: boolean; adminPurchaseIds: string[] }
    >();

    for (const purchase of paidPurchases) {
      const current = paidByPackage.get(purchase.packageId) ?? {
        hasNonAdmin: false,
        adminPurchaseIds: []
      };

      if (purchase.isAdminGranted) {
        current.adminPurchaseIds.push(purchase.id);
      } else {
        current.hasNonAdmin = true;
      }

      paidByPackage.set(purchase.packageId, current);
    }

    const targetPackageSet = new Set(packageIds);
    const packagePriceMap = new Map(packages.map((pkg) => [pkg.id, pkg.price]));

    const packageIdsToCreate = packageIds.filter(
      (packageId) => !paidByPackage.has(packageId)
    );

    const purchaseIdsToCancel = Array.from(paidByPackage.entries())
      .filter(([packageId, purchaseState]) => {
        if (targetPackageSet.has(packageId)) return false;
        if (purchaseState.hasNonAdmin) return false;
        return purchaseState.adminPurchaseIds.length > 0;
      })
      .flatMap(([, purchaseState]) => purchaseState.adminPurchaseIds);

    await prisma.$transaction(async (tx) => {
      for (const packageId of packageIdsToCreate) {
        await tx.purchase.create({
          data: {
            orderCode: generateAdminOrderCode(),
            userId,
            packageId,
            status: PURCHASE_STATUS.PAID,
            hiddenAt: null,
            isAdminGranted: true,
            paymentMethod: "all",
            paymentType: "admin_approval",
            paidAt: new Date(),
            startDate: new Date(),
            endDate: new Date(Date.now() + ONE_YEAR_MS),
            grossAmount: packagePriceMap.get(packageId) ?? 0
          }
        });
      }

      if (purchaseIdsToCancel.length) {
        await tx.purchase.updateMany({
          where: {
            id: { in: purchaseIdsToCancel }
          },
          data: {
            status: PURCHASE_STATUS.CANCELED
          }
        });
      }
    });

    return res.json({
      message: "Hak akses tryout berhasil diperbarui.",
      data: {
        userId: targetUser.id,
        role: targetUser.role,
        grantedPackageIds: packageIds,
        createdAccessCount: packageIdsToCreate.length,
        revokedAccessCount: purchaseIdsToCancel.length
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }

    console.error("Admin update user access error:", error);
    return res.status(500).json({ message: "Gagal memperbarui hak akses tryout" });
  }
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (res.locals.user?.id === id) {
    return res.status(400).json({ message: "Tidak bisa menghapus akun sendiri" });
  }

  try {
    await prisma.$transaction([
      prisma.purchase.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } })
    ]);

    return res.json({ message: "Akun berhasil dihapus" });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return res.status(500).json({ message: "Gagal menghapus akun" });
  }
});

router.patch("/payments/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = paymentUpdateSchema.parse(req.body);

    const purchase = await prisma.purchase.findUnique({
      where: { id }
    });

    if (!purchase) {
      return res.status(404).json({ message: "Pembayaran tidak ditemukan" });
    }

    const nextStatus = payload.status ?? purchase.status;
    let paidAt = payload.paidAt ?? purchase.paidAt ?? null;
    const data: Record<string, unknown> = {
      status: nextStatus,
      paymentType: payload.paymentType ?? purchase.paymentType ?? null,
      paidAt
    };

    if (nextStatus === PURCHASE_STATUS.PAID) {
      if (!paidAt) {
        paidAt = new Date();
        data.paidAt = paidAt;
      }

      const startDate = purchase.startDate ?? paidAt ?? new Date();
      const endDate = new Date(startDate.getTime() + ONE_YEAR_MS);
      data.startDate = startDate;
      data.endDate = endDate;
      data.hiddenAt = null;
    }

    const updated = await prisma.purchase.update({
      where: { id },
      data
    });

    return res.json({
      message: "Pembayaran berhasil diperbarui",
      data: updated
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: error.flatten()
      });
    }
    console.error("Admin update payment error:", error);
    return res.status(500).json({ message: "Gagal memperbarui pembayaran" });
  }
});

router.delete("/payments/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.purchase.delete({ where: { id } });
    return res.json({ message: "Pembayaran berhasil dihapus" });
  } catch (error) {
    console.error("Admin delete payment error:", error);
    return res.status(500).json({ message: "Gagal menghapus pembayaran" });
  }
});

export default router;
