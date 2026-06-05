import { Router } from "express";
import type { TryoutProgress } from "@prisma/client";
import { z } from "zod";
import prisma from "../prisma";
import { requireAuth } from "../middleware/auth";
import { PURCHASE_STATUS } from "../constants";
import { parseQuestionOptions, type QuestionCategory } from "../utils/question";
import {
  QUESTION_SESSION_TYPES,
  normalizeSessionType,
  type QuestionSessionType
} from "../utils/package-session";
import { getPackageResolvedSessions } from "../utils/package-resolved-sessions";

const router = Router();
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const TRYOUT_DURATION_PER_QUESTION_SECONDS = 75;
const MIN_SESSION_DURATION_SECONDS = 60;
const SKD_QUESTION_ORDER: Record<QuestionCategory, number> = {
  TWK: 0,
  TIU: 1,
  TKP: 2
};

const perCategoryAttemptSchema = z.object({
  category: z.enum(["TWK", "TIU", "TKP"]),
  total: z.coerce.number().int().min(0),
  correct: z.coerce.number().int().min(0),
  score: z.coerce.number().int().min(0),
  maxScore: z.coerce.number().int().min(0)
});

const createAttemptSchema = z.object({
  sessionType: z.enum(QUESTION_SESSION_TYPES).optional(),
  sessionCode: z.string().max(80).optional(),
  sessionTitle: z.string().max(180).optional(),
  total: z.coerce.number().int().min(1),
  answered: z.coerce.number().int().min(0),
  correct: z.coerce.number().int().min(0),
  wrong: z.coerce.number().int().min(0),
  blank: z.coerce.number().int().min(0),
  score: z.coerce.number().int().min(0),
  maxScore: z.coerce.number().int().min(1),
  percentage: z.coerce.number().int().min(0).max(100),
  durationSeconds: z.coerce.number().int().min(0).optional(),
  perCategory: z.array(perCategoryAttemptSchema),
  answers: z.record(z.string()).optional(),
  completedAt: z.coerce.date().optional(),
  progressId: z.string().max(80).optional()
});

const practiceQuerySchema = z.object({
  sessionCode: z.string().min(1).optional()
});

const startProgressSchema = z.object({
  sessionCode: z.string().max(80).optional(),
  restart: z.boolean().optional().default(false)
});

const updateProgressSchema = z.object({
  progressId: z.string().min(1).max(80),
  activeQuestionIndex: z.coerce.number().int().min(0).optional(),
  answers: z.record(z.string()).optional()
});

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Failed to parse JSON field", error);
    return fallback;
  }
};

const sanitizeAnswersMap = ({
  answers,
  allowedQuestionIds
}: {
  answers?: Record<string, string> | null;
  allowedQuestionIds?: Set<string>;
}) => {
  const sanitized: Record<string, string> = {};
  if (!answers) return sanitized;

  for (const [questionId, selected] of Object.entries(answers)) {
    const normalizedQuestionId = questionId.trim();
    const normalizedSelected = selected?.trim();
    if (!normalizedQuestionId || !normalizedSelected) continue;
    if (allowedQuestionIds && !allowedQuestionIds.has(normalizedQuestionId)) continue;
    sanitized[normalizedQuestionId] = normalizedSelected;
  }

  return sanitized;
};

const getSessionDurationSeconds = ({
  sessionType,
  questionCount,
  tryoutDurationMinutes,
  latihanDurationMinutes
}: {
  sessionType: QuestionSessionType;
  questionCount: number;
  tryoutDurationMinutes: number;
  latihanDurationMinutes: number;
}) => {
  const configuredMinutes =
    sessionType === "LATIHAN" ? latihanDurationMinutes : tryoutDurationMinutes;
  const configuredSeconds =
    configuredMinutes > 0 ? configuredMinutes * 60 : 0;

  if (configuredSeconds > 0) {
    return Math.max(configuredSeconds, MIN_SESSION_DURATION_SECONDS);
  }

  return Math.max(
    questionCount * TRYOUT_DURATION_PER_QUESTION_SECONDS,
    MIN_SESSION_DURATION_SECONDS
  );
};

const getRemainingProgressSeconds = (expiresAt: Date) =>
  Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

const toSessionKey = (sessionType: QuestionSessionType, sessionOrder: number) =>
  `${normalizeSessionType(sessionType)}:${Math.max(sessionOrder, 1)}`;

const splitActiveAndExpiredProgresses = (progresses: TryoutProgress[]) => {
  const nowMs = Date.now();
  const activeProgresses: TryoutProgress[] = [];
  const expiredProgressIds: string[] = [];

  for (const progress of progresses) {
    if (progress.expiresAt.getTime() <= nowMs) {
      expiredProgressIds.push(progress.id);
      continue;
    }
    activeProgresses.push(progress);
  }

  return {
    activeProgresses,
    expiredProgressIds
  };
};

const orderQuestionsForPractice = <
  T extends {
    category: string;
    questionOrder: number;
    createdAt: Date;
    id: string;
  }
>(
  questions: T[]
) =>
  [...questions].sort((a, b) => {
    const categoryA = a.category as QuestionCategory;
    const categoryB = b.category as QuestionCategory;
    const orderA = SKD_QUESTION_ORDER[categoryA] ?? Number.MAX_SAFE_INTEGER;
    const orderB = SKD_QUESTION_ORDER[categoryB] ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const questionOrderA = a.questionOrder > 0 ? a.questionOrder : 1;
    const questionOrderB = b.questionOrder > 0 ? b.questionOrder : 1;
    if (questionOrderA !== questionOrderB) {
      return questionOrderA - questionOrderB;
    }

    const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return a.id.localeCompare(b.id);
  });

const serializeTryoutProgress = ({
  progress,
  allowedQuestionIds
}: {
  progress: TryoutProgress;
  allowedQuestionIds?: Set<string>;
}) => {
  const rawAnswers = parseJson<Record<string, string>>(progress.answers, {});
  const answers = sanitizeAnswersMap({
    answers: rawAnswers,
    allowedQuestionIds
  });

  const maxQuestionIndex = Math.max(progress.totalQuestions - 1, 0);

  return {
    id: progress.id,
    sessionType: normalizeSessionType(progress.sessionType as QuestionSessionType),
    sessionCode: progress.sessionCode,
    sessionTitle: progress.sessionTitle,
    sessionOrder: progress.sessionOrder > 0 ? progress.sessionOrder : 1,
    totalQuestions: progress.totalQuestions,
    totalDurationSeconds: progress.totalDurationSeconds,
    startedAt: progress.startedAt,
    expiresAt: progress.expiresAt,
    remainingSeconds: getRemainingProgressSeconds(progress.expiresAt),
    activeQuestionIndex: Math.min(
      Math.max(progress.activeQuestionIndex, 0),
      maxQuestionIndex
    ),
    answers
  };
};

type SessionAccessControl = {
  strictMode: boolean;
  assignmentsBySessionKey: Map<
    string,
    Array<{
      className: string;
      startAt: Date;
      endAt: Date;
    }>
  >;
  openSessionKeys: Set<string>;
};

const ensureActivePurchaseForPackage = async ({
  userId,
  packageId
}: {
  userId: string;
  packageId: string;
}) => {
  const paidPurchases = await prisma.purchase.findMany({
    where: {
      userId,
      packageId,
      status: PURCHASE_STATUS.PAID
    },
    orderBy: [{ createdAt: "desc" }]
  });

  const now = new Date();

  for (const purchase of paidPurchases) {
    const startDate = purchase.startDate ?? purchase.createdAt;
    const endDate = purchase.endDate ?? new Date(startDate.getTime() + ONE_YEAR_MS);

    if (!purchase.startDate || !purchase.endDate) {
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: { startDate, endDate }
      });
    }

    if (endDate >= now) {
      return true;
    }

    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: PURCHASE_STATUS.EXPIRED }
    });
  }

  return false;
};

const formatScheduleDate = (value: Date) =>
  value.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

const getSessionAccessControlForStudent = async ({
  userId,
  packageId
}: {
  userId: string;
  packageId: string;
}): Promise<SessionAccessControl> => {
  const studentClasses = await prisma.classStudent.findMany({
    where: { studentId: userId },
    select: { studyClassId: true }
  });

  if (!studentClasses.length) {
    return {
      strictMode: false,
      assignmentsBySessionKey: new Map(),
      openSessionKeys: new Set()
    };
  }

  const classIds = Array.from(new Set(studentClasses.map((item) => item.studyClassId)));
  const assignments = await prisma.classTryoutAssignment.findMany({
    where: {
      studyClassId: { in: classIds },
      packageId,
      isActive: true
    },
    include: {
      studyClass: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [{ startAt: "asc" }, { createdAt: "asc" }]
  });

  if (!assignments.length) {
    return {
      strictMode: false,
      assignmentsBySessionKey: new Map(),
      openSessionKeys: new Set()
    };
  }

  const now = new Date();
  const assignmentsBySessionKey = new Map<
    string,
    Array<{
      className: string;
      startAt: Date;
      endAt: Date;
    }>
  >();
  const openSessionKeys = new Set<string>();

  for (const assignment of assignments) {
    const sessionType = normalizeSessionType(assignment.sessionType);
    const sessionOrder = assignment.sessionOrder > 0 ? assignment.sessionOrder : 1;
    const sessionKey = toSessionKey(sessionType, sessionOrder);
    const items = assignmentsBySessionKey.get(sessionKey) ?? [];
    items.push({
      className: assignment.studyClass.name,
      startAt: assignment.startAt,
      endAt: assignment.endAt
    });
    assignmentsBySessionKey.set(sessionKey, items);

    if (assignment.startAt <= now && assignment.endAt >= now) {
      openSessionKeys.add(sessionKey);
    }
  }

  return {
    strictMode: true,
    assignmentsBySessionKey,
    openSessionKeys
  };
};

const buildSessionScheduleMessage = ({
  sessionType,
  sessionOrder,
  schedules,
  forEmptyOpenSessionList = false
}: {
  sessionType?: QuestionSessionType;
  sessionOrder?: number;
  schedules: Array<{
    className: string;
    startAt: Date;
    endAt: Date;
  }>;
  forEmptyOpenSessionList?: boolean;
}) => {
  if (!schedules.length) {
    return forEmptyOpenSessionList
      ? "Belum ada jadwal tryout aktif untuk kelas Anda pada paket ini."
      : "Sesi ini belum dibuka untuk kelas Anda.";
  }

  const sorted = [...schedules].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime()
  );
  const nearest = sorted[0];
  const sessionLabel =
    sessionType && sessionOrder
      ? `${sessionType === "TRYOUT" ? "Tryout" : "Latihan"} ${sessionOrder}`
      : "Sesi";

  return forEmptyOpenSessionList
    ? `Belum ada jadwal aktif. Jadwal terdekat ${sessionLabel} untuk kelas ${nearest.className}: ${formatScheduleDate(
        nearest.startAt
      )} - ${formatScheduleDate(nearest.endAt)}.`
    : `${sessionLabel} hanya bisa dikerjakan sesuai jadwal kelas ${nearest.className}: ${formatScheduleDate(
        nearest.startAt
      )} - ${formatScheduleDate(nearest.endAt)}.`;
};

router.get("/attempts/:attemptId", requireAuth, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await prisma.tryoutAttempt.findUnique({
      where: { id: attemptId },
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

    if (!attempt || attempt.userId !== req.user!.userId) {
      return res.status(404).json({ message: "Riwayat tryout tidak ditemukan." });
    }

    return res.json({
      data: {
        id: attempt.id,
        package: attempt.package,
        sessionType: normalizeSessionType(attempt.sessionType),
        sessionCode: attempt.sessionCode,
        sessionTitle: attempt.sessionTitle,
        totalQuestions: attempt.totalQuestions,
        answeredCount: attempt.answeredCount,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        blankCount: attempt.blankCount,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        durationSeconds: attempt.durationSeconds,
        completedAt: attempt.completedAt,
        perCategory: parseJson<
          Array<{
            category: QuestionCategory;
            total: number;
            correct: number;
            score: number;
            maxScore: number;
          }>
        >(attempt.perCategory, []),
        answers: parseJson<Record<string, string>>(attempt.answers, {})
      }
    });
  } catch (error) {
    console.error("Get practice attempt detail error:", error);
    return res.status(500).json({ message: "Gagal memuat detail hasil tryout." });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const attempts = await prisma.tryoutAttempt.findMany({
      where: { userId: req.user!.userId },
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
      orderBy: [{ completedAt: "desc" }]
    });

    return res.json({
      data: attempts.map((attempt) => ({
        id: attempt.id,
        package: attempt.package,
        sessionType: normalizeSessionType(attempt.sessionType),
        sessionCode: attempt.sessionCode,
        sessionTitle: attempt.sessionTitle,
        totalQuestions: attempt.totalQuestions,
        answeredCount: attempt.answeredCount,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        blankCount: attempt.blankCount,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        durationSeconds: attempt.durationSeconds,
        completedAt: attempt.completedAt,
        perCategory: parseJson<
          Array<{
            category: QuestionCategory;
            total: number;
            correct: number;
            score: number;
            maxScore: number;
          }>
        >(attempt.perCategory, [])
      }))
    });
  } catch (error) {
    console.error("Get practice history error:", error);
    return res.status(500).json({ message: "Gagal memuat riwayat tryout." });
  }
});

router.post("/:slug/progress/start", requireAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const payload = startProgressSchema.parse(req.body);

    const pkg = await prisma.package.findUnique({
      where: { slug }
    });

    if (!pkg) {
      return res.status(404).json({ message: "Paket tidak ditemukan" });
    }

    const hasAccess = await ensureActivePurchaseForPackage({
      userId: req.user!.userId,
      packageId: pkg.id
    });

    if (!hasAccess) {
      return res.status(403).json({
        message:
          "Anda belum memiliki akses ke paket ini. Silakan aktifkan paket terlebih dahulu."
      });
    }

    const sessions = await getPackageResolvedSessions(pkg);
    if (!sessions.length) {
      return res.status(404).json({
        message: "Belum ada sesi tryout atau latihan yang bisa diakses pada paket ini."
      });
    }

    const sessionAccessControl = await getSessionAccessControlForStudent({
      userId: req.user!.userId,
      packageId: pkg.id
    });

    const packageProgresses = await prisma.tryoutProgress.findMany({
      where: {
        userId: req.user!.userId,
        packageId: pkg.id
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    });
    const { activeProgresses } = splitActiveAndExpiredProgresses(packageProgresses);

    const openSessions = sessionAccessControl.strictMode
      ? sessions.filter((session) =>
          sessionAccessControl.openSessionKeys.has(
            toSessionKey(session.sessionType, session.sessionOrder)
          )
        )
      : sessions;

    const requestedSessionCode = payload.sessionCode?.trim().toUpperCase();
    const requestedSession = sessions.find(
      (session) =>
        session.sessionCode === requestedSessionCode ||
        (requestedSessionCode ? session.aliases.includes(requestedSessionCode) : false)
    );
    const progressBySessionKey = new Map(
      activeProgresses.map((progress) => [
        toSessionKey(
          normalizeSessionType(progress.sessionType as QuestionSessionType),
          progress.sessionOrder
        ),
        progress
      ])
    );
    const requestedSessionKey = requestedSession
      ? toSessionKey(requestedSession.sessionType, requestedSession.sessionOrder)
      : null;
    const requestedSessionProgress = requestedSessionKey
      ? (progressBySessionKey.get(requestedSessionKey) ?? null)
      : null;
    const fallbackSessionProgress = activeProgresses[0] ?? null;
    const fallbackProgressSession = fallbackSessionProgress
      ? sessions.find(
          (session) =>
            toSessionKey(session.sessionType, session.sessionOrder) ===
            toSessionKey(
              normalizeSessionType(fallbackSessionProgress.sessionType as QuestionSessionType),
              fallbackSessionProgress.sessionOrder
            )
        ) ?? null
      : null;

    if (sessionAccessControl.strictMode && requestedSession) {
      const requestedKey = toSessionKey(
        requestedSession.sessionType,
        requestedSession.sessionOrder
      );
      if (
        !sessionAccessControl.openSessionKeys.has(requestedKey) &&
        !(requestedSessionProgress && !payload.restart)
      ) {
        const schedules =
          sessionAccessControl.assignmentsBySessionKey.get(requestedKey) ?? [];
        return res.status(403).json({
          message: buildSessionScheduleMessage({
            sessionType: requestedSession.sessionType,
            sessionOrder: requestedSession.sessionOrder,
            schedules
          })
        });
      }
    }

    const targetSession =
      requestedSession ??
      (!payload.restart ? fallbackProgressSession : null) ??
      openSessions[0];

    if (!targetSession) {
      const schedules = Array.from(
        sessionAccessControl.assignmentsBySessionKey.values()
      ).flat();

      return res.status(403).json({
        message: buildSessionScheduleMessage({
          schedules,
          forEmptyOpenSessionList: true
        })
      });
    }

    const sessionQuestions = await prisma.question.findMany({
      where: {
        packageId: { in: targetSession.sourcePackageIds },
        sessionType: targetSession.sessionType,
        sessionOrder: targetSession.sessionOrder
      },
      select: {
        id: true,
        category: true,
        questionOrder: true,
        createdAt: true
      },
      orderBy: [{ questionOrder: "asc" }, { createdAt: "asc" }]
    });

    if (!sessionQuestions.length) {
      return res.status(404).json({
        message: "Belum ada soal pada sesi ini."
      });
    }

    const orderedQuestions = orderQuestionsForPractice(sessionQuestions);
    const allowedQuestionIds = new Set(orderedQuestions.map((question) => question.id));
    const totalQuestions = orderedQuestions.length;
    const totalDurationSeconds = getSessionDurationSeconds({
      sessionType: targetSession.sessionType,
      questionCount: totalQuestions,
      tryoutDurationMinutes: pkg.tryoutDurationMinutes,
      latihanDurationMinutes: pkg.latihanDurationMinutes
    });

    const existingProgressKey = {
      userId: req.user!.userId,
      packageId: pkg.id,
      sessionType: targetSession.sessionType,
      sessionOrder: targetSession.sessionOrder
    };

    const targetSessionKey = toSessionKey(
      targetSession.sessionType,
      targetSession.sessionOrder
    );
    let existingProgress = progressBySessionKey.get(targetSessionKey) ?? null;

    if (existingProgress && payload.restart) {
      await prisma.tryoutProgress.delete({
        where: {
          userId_packageId_sessionType_sessionOrder: existingProgressKey
        }
      });
      existingProgress = null;
    }

    if (existingProgress && !payload.restart) {
      const existingAnswers = sanitizeAnswersMap({
        answers: parseJson<Record<string, string>>(existingProgress.answers, {}),
        allowedQuestionIds
      });
      const nextActiveQuestionIndex = Math.min(
        Math.max(existingProgress.activeQuestionIndex, 0),
        Math.max(totalQuestions - 1, 0)
      );
      const shouldUpdateExisting =
        existingProgress.totalQuestions !== totalQuestions ||
        existingProgress.sessionCode !== targetSession.sessionCode ||
        existingProgress.sessionTitle !== targetSession.sessionTitle ||
        existingProgress.activeQuestionIndex !== nextActiveQuestionIndex ||
        JSON.stringify(existingAnswers) !== existingProgress.answers;

      const persistedProgress = shouldUpdateExisting
        ? await prisma.tryoutProgress.update({
            where: {
              userId_packageId_sessionType_sessionOrder: existingProgressKey
            },
            data: {
              sessionCode: targetSession.sessionCode,
              sessionTitle: targetSession.sessionTitle,
              totalQuestions,
              activeQuestionIndex: nextActiveQuestionIndex,
              answers: JSON.stringify(existingAnswers)
            }
          })
        : existingProgress;

      return res.json({
        data: serializeTryoutProgress({
          progress: persistedProgress,
          allowedQuestionIds
        })
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + totalDurationSeconds * 1000);

    const createdProgress = await prisma.tryoutProgress.create({
      data: {
        userId: req.user!.userId,
        packageId: pkg.id,
        sessionType: targetSession.sessionType,
        sessionCode: targetSession.sessionCode,
        sessionTitle: targetSession.sessionTitle,
        sessionOrder: targetSession.sessionOrder,
        totalQuestions,
        totalDurationSeconds,
        startedAt: now,
        expiresAt,
        activeQuestionIndex: 0,
        answers: "{}"
      }
    });

    return res.status(201).json({
      message: "Sesi tryout berhasil dimulai.",
      data: serializeTryoutProgress({
        progress: createdProgress,
        allowedQuestionIds
      })
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi progres tryout gagal.",
        errors: error.flatten()
      });
    }
    console.error("Start practice progress error:", error);
    return res.status(500).json({ message: "Gagal memulai progres tryout." });
  }
});

router.patch("/:slug/progress", requireAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const payload = updateProgressSchema.parse(req.body);

    const pkg = await prisma.package.findUnique({
      where: { slug }
    });

    if (!pkg) {
      return res.status(404).json({ message: "Paket tidak ditemukan" });
    }

    const hasAccess = await ensureActivePurchaseForPackage({
      userId: req.user!.userId,
      packageId: pkg.id
    });

    if (!hasAccess) {
      return res.status(403).json({
        message:
          "Anda belum memiliki akses ke paket ini. Silakan aktifkan paket terlebih dahulu."
      });
    }

    const existingProgress = await prisma.tryoutProgress.findUnique({
      where: { id: payload.progressId }
    });

    if (!existingProgress || existingProgress.userId !== req.user!.userId) {
      return res.status(404).json({ message: "Progres tryout tidak ditemukan." });
    }

    if (existingProgress.packageId !== pkg.id) {
      return res.status(400).json({
        message: "Progres tryout tidak cocok dengan paket yang sedang dibuka."
      });
    }

    const sessions = await getPackageResolvedSessions(pkg);
    const targetSession = sessions.find(
      (session) =>
        toSessionKey(session.sessionType, session.sessionOrder) ===
        toSessionKey(
          normalizeSessionType(existingProgress.sessionType),
          existingProgress.sessionOrder
        )
    );

    const sessionQuestions = targetSession
      ? await prisma.question.findMany({
          where: {
            packageId: { in: targetSession.sourcePackageIds },
            sessionType: targetSession.sessionType,
            sessionOrder: targetSession.sessionOrder
          },
          select: {
            id: true,
            category: true,
            questionOrder: true,
            createdAt: true
          },
          orderBy: [{ questionOrder: "asc" }, { createdAt: "asc" }]
        })
      : [];

    const orderedQuestions = orderQuestionsForPractice(sessionQuestions);
    const allowedQuestionIds = orderedQuestions.length
      ? new Set(orderedQuestions.map((question) => question.id))
      : undefined;
    const questionCount =
      orderedQuestions.length > 0
        ? orderedQuestions.length
        : Math.max(existingProgress.totalQuestions, 1);
    const maxQuestionIndex = Math.max(questionCount - 1, 0);

    const nextAnswers =
      payload.answers !== undefined
        ? sanitizeAnswersMap({
            answers: payload.answers,
            allowedQuestionIds
          })
        : sanitizeAnswersMap({
            answers: parseJson<Record<string, string>>(existingProgress.answers, {}),
            allowedQuestionIds
          });

    const nextActiveQuestionIndex =
      payload.activeQuestionIndex !== undefined
        ? Math.min(Math.max(payload.activeQuestionIndex, 0), maxQuestionIndex)
        : Math.min(
            Math.max(existingProgress.activeQuestionIndex, 0),
            maxQuestionIndex
          );

    const updatedProgress = await prisma.tryoutProgress.update({
      where: { id: existingProgress.id },
      data: {
        totalQuestions: questionCount,
        sessionCode: targetSession?.sessionCode ?? existingProgress.sessionCode,
        sessionTitle: targetSession?.sessionTitle ?? existingProgress.sessionTitle,
        activeQuestionIndex: nextActiveQuestionIndex,
        answers: JSON.stringify(nextAnswers)
      }
    });

    return res.json({
      message: "Progres tryout berhasil diperbarui.",
      data: serializeTryoutProgress({
        progress: updatedProgress,
        allowedQuestionIds
      })
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi progres tryout gagal.",
        errors: error.flatten()
      });
    }
    console.error("Update practice progress error:", error);
    return res.status(500).json({ message: "Gagal menyimpan progres tryout." });
  }
});

router.post("/:slug/attempts", requireAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const payload = createAttemptSchema.parse(req.body);

    const pkg = await prisma.package.findUnique({
      where: { slug }
    });

    if (!pkg) {
      return res.status(404).json({ message: "Paket tidak ditemukan" });
    }

    const hasAccess = await ensureActivePurchaseForPackage({
      userId: req.user!.userId,
      packageId: pkg.id
    });

    if (!hasAccess) {
      return res.status(403).json({
        message:
          "Anda belum memiliki akses ke paket ini. Silakan aktifkan paket terlebih dahulu."
      });
    }

    const sessions = await getPackageResolvedSessions(pkg);
    if (!sessions.length) {
      return res.status(404).json({
        message:
          "Belum ada sesi tryout atau latihan yang bisa diakses pada paket ini."
      });
    }

    const sessionAccessControl = await getSessionAccessControlForStudent({
      userId: req.user!.userId,
      packageId: pkg.id
    });

    const requestedSessionCode = payload.sessionCode?.trim().toUpperCase();
    const matchedSession =
      sessions.find(
        (item) =>
          item.sessionCode === requestedSessionCode ||
          (requestedSessionCode ? item.aliases.includes(requestedSessionCode) : false)
      ) ?? sessions[0];
    const normalizedProgressId = payload.progressId?.trim() || null;
    const linkedProgress = normalizedProgressId
      ? await prisma.tryoutProgress.findFirst({
          where: {
            id: normalizedProgressId,
            userId: req.user!.userId,
            packageId: pkg.id
          }
        })
      : null;

    if (sessionAccessControl.strictMode) {
      const sessionKey = toSessionKey(
        matchedSession.sessionType,
        matchedSession.sessionOrder
      );
      const linkedProgressMatchesSession =
        linkedProgress &&
        toSessionKey(
          normalizeSessionType(linkedProgress.sessionType as QuestionSessionType),
          linkedProgress.sessionOrder
        ) === sessionKey;

      if (
        !sessionAccessControl.openSessionKeys.has(sessionKey) &&
        !linkedProgressMatchesSession
      ) {
        const schedules =
          sessionAccessControl.assignmentsBySessionKey.get(sessionKey) ?? [];
        return res.status(403).json({
          message: buildSessionScheduleMessage({
            sessionType: matchedSession.sessionType,
            sessionOrder: matchedSession.sessionOrder,
            schedules
          })
        });
      }
    }

    const completedAt = payload.completedAt ?? new Date();

    const created = await prisma.tryoutAttempt.create({
      data: {
        userId: req.user!.userId,
        packageId: pkg.id,
        sessionType: payload.sessionType ?? matchedSession?.sessionType ?? "TRYOUT",
        sessionCode: matchedSession?.sessionCode ?? requestedSessionCode ?? null,
        sessionTitle: payload.sessionTitle ?? matchedSession?.sessionTitle ?? null,
        totalQuestions: payload.total,
        answeredCount: payload.answered,
        correctCount: payload.correct,
        wrongCount: payload.wrong,
        blankCount: payload.blank,
        score: payload.score,
        maxScore: payload.maxScore,
        percentage: payload.percentage,
        durationSeconds: payload.durationSeconds,
        perCategory: JSON.stringify(payload.perCategory),
        answers: payload.answers ? JSON.stringify(payload.answers) : null,
        completedAt
      }
    });

    if (normalizedProgressId) {
      await prisma.tryoutProgress.deleteMany({
        where: {
          id: normalizedProgressId,
          userId: req.user!.userId,
          packageId: pkg.id
        }
      });
    } else {
      await prisma.tryoutProgress.deleteMany({
        where: {
          userId: req.user!.userId,
          packageId: pkg.id,
          sessionType: matchedSession.sessionType,
          sessionOrder: matchedSession.sessionOrder
        }
      });
    }

    return res.status(201).json({
      message: "Hasil tryout berhasil disimpan.",
      data: {
        id: created.id,
        completedAt: created.completedAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validasi hasil tryout gagal.",
        errors: error.flatten()
      });
    }
    console.error("Create practice attempt error:", error);
    return res.status(500).json({ message: "Gagal menyimpan hasil tryout." });
  }
});

router.get("/:slug", requireAuth, async (req, res) => {
  const { slug } = req.params;
  const query = practiceQuerySchema.parse(req.query);

  const pkg = await prisma.package.findUnique({
    where: { slug }
  });

  if (!pkg) {
    return res.status(404).json({ message: "Paket tidak ditemukan" });
  }

  const hasAccess = await ensureActivePurchaseForPackage({
    userId: req.user!.userId,
    packageId: pkg.id
  });

  if (!hasAccess) {
    return res.status(403).json({
      message:
        "Anda belum memiliki akses ke paket ini. Silakan aktifkan paket terlebih dahulu."
    });
  }

  const sessions = await getPackageResolvedSessions(pkg);
  if (!sessions.length) {
    return res.status(404).json({
      message: "Belum ada sesi tryout atau latihan untuk paket ini."
    });
  }

  const sessionAccessControl = await getSessionAccessControlForStudent({
    userId: req.user!.userId,
    packageId: pkg.id
  });

  const packageProgresses = await prisma.tryoutProgress.findMany({
    where: {
      userId: req.user!.userId,
      packageId: pkg.id
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
  const { activeProgresses } = splitActiveAndExpiredProgresses(packageProgresses);

  const openSessions = sessionAccessControl.strictMode
    ? sessions.filter((session) =>
        sessionAccessControl.openSessionKeys.has(
          toSessionKey(session.sessionType, session.sessionOrder)
        )
      )
    : sessions;

  const requestedSessionCode = query.sessionCode?.trim().toUpperCase();
  const requestedSession = sessions.find(
    (session) =>
      session.sessionCode === requestedSessionCode ||
      (requestedSessionCode ? session.aliases.includes(requestedSessionCode) : false)
  );
  const progressBySessionKey = new Map(
    packageProgresses.map((progress) => [
      toSessionKey(
        normalizeSessionType(progress.sessionType as QuestionSessionType),
        progress.sessionOrder
      ),
      progress
    ])
  );
  const requestedSessionKey = requestedSession
    ? toSessionKey(requestedSession.sessionType, requestedSession.sessionOrder)
    : null;
  const requestedSessionProgress = requestedSessionKey
    ? (progressBySessionKey.get(requestedSessionKey) ?? null)
    : packageProgresses.find((progress) => {
        const progressSessionCode = progress.sessionCode?.trim().toUpperCase();
        return progressSessionCode === requestedSessionCode;
      }) ?? null;

  if (sessionAccessControl.strictMode && requestedSession) {
    const requestedKey = toSessionKey(
      requestedSession.sessionType,
      requestedSession.sessionOrder
    );
    if (
      !sessionAccessControl.openSessionKeys.has(requestedKey) &&
      !requestedSessionProgress
    ) {
      const schedules = sessionAccessControl.assignmentsBySessionKey.get(requestedKey) ?? [];
      return res.status(403).json({
        message: buildSessionScheduleMessage({
          sessionType: requestedSession.sessionType,
          sessionOrder: requestedSession.sessionOrder,
          schedules
        })
      });
    }
  }

  const fallbackProgress =
    requestedSessionProgress ??
    activeProgresses.find((progress) =>
      openSessions.some(
        (session) =>
          toSessionKey(session.sessionType, session.sessionOrder) ===
          toSessionKey(
            normalizeSessionType(progress.sessionType as QuestionSessionType),
            progress.sessionOrder
          )
      )
    ) ??
    activeProgresses[0] ??
    packageProgresses[0] ??
    null;
  const fallbackProgressSession = fallbackProgress
    ? sessions.find(
        (session) =>
          toSessionKey(session.sessionType, session.sessionOrder) ===
          toSessionKey(
            normalizeSessionType(fallbackProgress.sessionType as QuestionSessionType),
            fallbackProgress.sessionOrder
          )
      ) ?? null
    : null;

  const availableSessions = [...openSessions];
  if (
    fallbackProgressSession &&
    !availableSessions.some(
      (session) =>
        toSessionKey(session.sessionType, session.sessionOrder) ===
        toSessionKey(
          fallbackProgressSession.sessionType,
          fallbackProgressSession.sessionOrder
        )
    )
  ) {
    availableSessions.push(fallbackProgressSession);
  }

  if (!availableSessions.length) {
    const schedules = Array.from(
      sessionAccessControl.assignmentsBySessionKey.values()
    ).flat();

    return res.status(403).json({
      message: buildSessionScheduleMessage({
        schedules,
        forEmptyOpenSessionList: true
      })
    });
  }

  const activeSession =
    (requestedSession &&
    availableSessions.some(
      (session) =>
        toSessionKey(session.sessionType, session.sessionOrder) ===
        toSessionKey(requestedSession.sessionType, requestedSession.sessionOrder)
    )
      ? requestedSession
      : null) ??
    (fallbackProgressSession &&
    availableSessions.some(
      (session) =>
        toSessionKey(session.sessionType, session.sessionOrder) ===
        toSessionKey(
          fallbackProgressSession.sessionType,
          fallbackProgressSession.sessionOrder
        )
    )
      ? fallbackProgressSession
      : null) ??
    availableSessions[0];

  const questions = await prisma.question.findMany({
    where: {
      packageId: { in: activeSession.sourcePackageIds },
      sessionType: activeSession.sessionType,
      sessionOrder: activeSession.sessionOrder
    },
    orderBy: [{ questionOrder: "asc" }, { createdAt: "asc" }]
  });

  const orderedQuestions = orderQuestionsForPractice(questions);
  const activeSessionQuestionIds = new Set(
    orderedQuestions.map((question) => question.id)
  );
  const activeSessionProgress =
    packageProgresses.find(
      (progress) =>
        toSessionKey(
          normalizeSessionType(progress.sessionType as QuestionSessionType),
          progress.sessionOrder
        ) === toSessionKey(activeSession.sessionType, activeSession.sessionOrder)
    ) ?? null;

  return res.json({
    data: {
      package: {
        id: pkg.id,
        slug: pkg.slug,
        title: pkg.title,
        subtitle: pkg.subtitle,
        category: pkg.category,
        durationDays: pkg.durationDays,
        tryoutDurationMinutes: pkg.tryoutDurationMinutes,
        latihanDurationMinutes: pkg.latihanDurationMinutes
      },
      sessions: availableSessions.map(
        ({ aliases: _aliases, sourcePackageIds: _sourceIds, ...session }) => session
      ),
      activeSession: (({
        aliases: _aliases,
        sourcePackageIds: _sourceIds,
        ...session
      }) => session)(activeSession),
      activeProgress: activeSessionProgress
        ? serializeTryoutProgress({
            progress: activeSessionProgress,
            allowedQuestionIds: activeSessionQuestionIds
          })
        : null,
      questions: orderedQuestions.map((question) => ({
        id: question.id,
        category: question.category as QuestionCategory,
        sessionType: normalizeSessionType(question.sessionType),
        sessionCode: question.sessionCode,
        sessionTitle: question.sessionTitle,
        sessionOrder: question.sessionOrder,
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
      }))
    }
  });
});

export default router;
