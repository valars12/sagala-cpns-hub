import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent
} from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import api from "@/lib/api-client";
import type {
  PracticeActiveProgress,
  PracticeAttemptDetailResponse,
  PracticeProgressResponse,
  PracticeQuestion,
  PracticeResponse,
  QuestionCategory,
  QuestionOption
} from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import TablePagination from "@/components/admin/TablePagination";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  HelpCircle,
  RotateCcw,
  Search,
  Trophy,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const TRYOUT_DURATION_PER_QUESTION_SECONDS = 75;
const SESSION_CATALOG_PAGE_SIZE = 10;

type TryoutCategoryResult = {
  category: QuestionCategory;
  total: number;
  correct: number;
  score: number;
  maxScore: number;
};

type TryoutResult = {
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  blank: number;
  score: number;
  maxScore: number;
  percentage: number;
  perCategory: TryoutCategoryResult[];
};

type QuestionNavState = "ACTIVE" | "ANSWERED" | "UNANSWERED" | "CORRECT" | "WRONG";

const categoryLabel: Record<QuestionCategory, string> = {
  TKP: "TKP",
  TIU: "TIU",
  TWK: "TWK"
};

const categoryStyle: Record<QuestionCategory, string> = {
  TKP: "border-amber-200 bg-amber-50 text-amber-700",
  TIU: "border-blue-200 bg-blue-50 text-blue-700",
  TWK: "border-emerald-200 bg-emerald-50 text-emerald-700"
};

const categoryResultOrder: Record<QuestionCategory, number> = {
  TWK: 0,
  TIU: 1,
  TKP: 2
};

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const getSelectedOption = (
  question: PracticeQuestion,
  selectedValue?: string
): QuestionOption | undefined =>
  question.options.find((option) => option.text === selectedValue);

const getQuestionMaxScore = () => 5;

const getQuestionEarnedScore = (
  question: PracticeQuestion,
  selectedOption?: QuestionOption
) => {
  if (!selectedOption) return 0;

  if (question.category === "TKP") {
    return selectedOption.score ?? 0;
  }

  return selectedOption.text === question.answer ? 5 : 0;
};

const Practice = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const copyWarningShownRef = useRef(false);
  const hydrationKeyRef = useRef<string | null>(null);
  const progressSyncErrorShownRef = useRef(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);
  const [progressExpiresAtMs, setProgressExpiresAtMs] = useState<number | null>(
    null
  );
  const [activeProgressId, setActiveProgressId] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TryoutResult | null>(null);
  const [sessionSearchTerm, setSessionSearchTerm] = useState("");
  const [sessionCatalogPage, setSessionCatalogPage] = useState(1);

  const requestedSessionCode = searchParams.get("sessionCode")?.trim() ?? "";
  const attemptId = searchParams.get("attemptId")?.trim() ?? "";

  const {
    data: attemptDetail,
    isLoading: isAttemptLoading,
    error: attemptError
  } = useQuery({
    queryKey: ["practice-attempt", attemptId],
    queryFn: async () => {
      const { data } = await api.get<PracticeAttemptDetailResponse>(
        `/api/practice/attempts/${attemptId}`
      );
      return data.data;
    },
    enabled: Boolean(attemptId)
  });

  const effectiveSessionCode =
    requestedSessionCode || attemptDetail?.sessionCode?.trim() || "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["practice", slug, effectiveSessionCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveSessionCode) {
        params.set("sessionCode", effectiveSessionCode);
      }
      const endpoint = params.toString()
        ? `/api/practice/${slug}?${params.toString()}`
        : `/api/practice/${slug}`;

      const { data } = await api.get<PracticeResponse>(endpoint);
      return data.data;
    },
    enabled: Boolean(slug),
    refetchOnWindowFocus: false
  });

  const totalQuestions = data?.questions.length ?? 0;
  const configuredDurationMinutes = useMemo(() => {
    if (!data) return null;
    if (data.activeSession.sessionType === "LATIHAN") {
      return data.package.latihanDurationMinutes > 0
        ? data.package.latihanDurationMinutes
        : null;
    }
    return data.package.tryoutDurationMinutes > 0
      ? data.package.tryoutDurationMinutes
      : null;
  }, [data]);
  const defaultDurationSeconds = Math.max(
    configuredDurationMinutes
      ? configuredDurationMinutes * 60
      : totalQuestions * TRYOUT_DURATION_PER_QUESTION_SECONDS,
    1 * 60
  );

  const answeredCount = useMemo(
    () =>
      (data?.questions ?? []).filter((question) => Boolean(answers[question.id]))
        .length,
    [answers, data?.questions]
  );
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const progressValue = totalQuestions
    ? Math.round((answeredCount / totalQuestions) * 100)
    : 0;
  const activeQuestion = data?.questions[activeQuestionIndex];
  const activeSessionDisplayName =
    data?.activeSession.sessionType === "LATIHAN" ? "Latihan" : "Tryout";
  const isSessionCatalogView =
    !effectiveSessionCode && !attemptId && !data?.activeProgress;

  const filteredSessions = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const keyword = sessionSearchTerm.trim().toLowerCase();
    if (!keyword) return sessions;

    return sessions.filter((session) => {
      const searchableText = [
        session.sessionTitle,
        session.sessionCode,
        session.sessionType
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(keyword);
    });
  }, [data?.sessions, sessionSearchTerm]);

  const totalSessionCatalogPages = Math.max(
    1,
    Math.ceil(filteredSessions.length / SESSION_CATALOG_PAGE_SIZE)
  );
  const safeSessionCatalogPage = Math.min(
    sessionCatalogPage,
    totalSessionCatalogPages
  );
  const paginatedSessions = useMemo(() => {
    const startIndex = (safeSessionCatalogPage - 1) * SESSION_CATALOG_PAGE_SIZE;
    return filteredSessions.slice(
      startIndex,
      startIndex + SESSION_CATALOG_PAGE_SIZE
    );
  }, [filteredSessions, safeSessionCatalogPage]);

  const preventQuestionCopy = useCallback(
    (event: SyntheticEvent) => {
      event.preventDefault();
      if (!copyWarningShownRef.current) {
        copyWarningShownRef.current = true;
        toast({
          title: "Aksi dibatasi",
          description: "Konten soal tidak dapat di-copy pada mode tryout/pembahasan.",
          variant: "destructive"
        });
      }
    },
    [toast]
  );

  const applyActiveProgress = useCallback(
    (progress: PracticeActiveProgress) => {
      if (!data) return;
      const availableQuestionIds = new Set(
        data.questions.map((question) => question.id)
      );
      const mappedAnswers = Object.entries(progress.answers ?? {}).reduce<
        Record<string, string>
      >((acc, [questionId, selected]) => {
        if (!availableQuestionIds.has(questionId)) return acc;
        if (!selected) return acc;
        acc[questionId] = selected;
        return acc;
      }, {});

      const nextActiveQuestionIndex = Math.min(
        Math.max(progress.activeQuestionIndex, 0),
        Math.max(data.questions.length - 1, 0)
      );

      setAnswers(mappedAnswers);
      setResult(null);
      setIsSubmitted(false);
      setIsStarted(true);
      setSecondsLeft(Math.max(0, progress.remainingSeconds));
      setTotalDurationSeconds(
        Math.max(
          60,
          progress.totalDurationSeconds || defaultDurationSeconds || 60
        )
      );
      setProgressExpiresAtMs(new Date(progress.expiresAt).getTime());
      setActiveProgressId(progress.id);
      setActiveQuestionIndex(nextActiveQuestionIndex);
    },
    [data, defaultDurationSeconds]
  );

  const startTryout = useCallback(
    async (restart = false) => {
      if (!data || !slug) return;

      try {
        const { data: response } = await api.post<PracticeProgressResponse>(
          `/api/practice/${slug}/progress/start`,
          {
            sessionCode: data.activeSession.sessionCode,
            restart
          }
        );

        applyActiveProgress(response.data);
        progressSyncErrorShownRef.current = false;
      } catch (error) {
        toast({
          title: "Gagal memulai tryout",
          description: isAxiosError(error)
            ? error.response?.data?.message ?? "Coba ulangi beberapa saat lagi."
            : "Coba ulangi beberapa saat lagi.",
          variant: "destructive"
        });
      }
    },
    [applyActiveProgress, data, slug, toast]
  );

  const submitTryout = useCallback(
    async (isTimeout = false) => {
      if (!data || isSubmitted) return;

      const initialCategoryResult: Record<QuestionCategory, TryoutCategoryResult> = {
        TKP: { category: "TKP", total: 0, correct: 0, score: 0, maxScore: 0 },
        TIU: { category: "TIU", total: 0, correct: 0, score: 0, maxScore: 0 },
        TWK: { category: "TWK", total: 0, correct: 0, score: 0, maxScore: 0 }
      };

      let answered = 0;
      let correct = 0;
      let score = 0;

      for (const question of data.questions) {
        const selectedValue = answers[question.id];
        const selectedOption = getSelectedOption(question, selectedValue);
        const maxPoint = getQuestionMaxScore();
        const earnedPoint = getQuestionEarnedScore(question, selectedOption);
        const isCorrect = selectedValue === question.answer;

        initialCategoryResult[question.category].total += 1;
        initialCategoryResult[question.category].maxScore += maxPoint;
        initialCategoryResult[question.category].score += earnedPoint;

        if (isCorrect) {
          initialCategoryResult[question.category].correct += 1;
          correct += 1;
        }

        if (selectedOption) {
          answered += 1;
          score += earnedPoint;
        }
      }

      const total = data.questions.length;
      const blank = Math.max(0, total - answered);
      const wrong = Math.max(0, answered - correct);
      const maxScore = total * getQuestionMaxScore();
      const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;

      const perCategory = (
        Object.values(initialCategoryResult) as TryoutCategoryResult[]
      )
        .filter((item) => item.total > 0)
        .sort(
          (a, b) =>
            categoryResultOrder[a.category] - categoryResultOrder[b.category]
        );

      const computedResult = {
        total,
        answered,
        correct,
        wrong,
        blank,
        score,
        maxScore,
        percentage,
        perCategory
      };

      setResult(computedResult);
      setIsSubmitted(true);
      setProgressExpiresAtMs(null);

      const elapsedSeconds = Math.max(0, totalDurationSeconds - secondsLeft);
      const completedAt = new Date().toISOString();

      if (slug) {
        try {
          await api.post(`/api/practice/${slug}/attempts`, {
            sessionType: data.activeSession.sessionType,
            sessionCode: data.activeSession.sessionCode,
            sessionTitle: data.activeSession.sessionTitle,
            ...computedResult,
            durationSeconds: elapsedSeconds,
            answers,
            completedAt,
            progressId: activeProgressId ?? undefined
          });
          setActiveProgressId(null);
        } catch {
          toast({
            title: "Riwayat tryout gagal disimpan",
            description:
              "Nilai tetap tampil, tetapi riwayat belum masuk ke akun. Coba submit lagi.",
            variant: "destructive"
          });
        }
      }

      toast({
        title: isTimeout
          ? `Waktu ${activeSessionDisplayName.toLowerCase()} habis`
          : `${activeSessionDisplayName} selesai`,
        description: isTimeout
          ? "Jawaban otomatis dikumpulkan."
          : `Hasil ${activeSessionDisplayName.toLowerCase()} berhasil dihitung.`
      });
    },
    [
      activeSessionDisplayName,
      activeProgressId,
      answers,
      data,
      isSubmitted,
      secondsLeft,
      slug,
      totalDurationSeconds,
      toast
    ]
  );

  useEffect(() => {
    if (!isError) return;

    const message = isAxiosError(error)
      ? error.response?.data?.message ?? "Soal belum tersedia untuk paket ini."
      : "Soal belum tersedia untuk paket ini.";

    setErrorMessage(message);
    toast({
      title: "Gagal memuat latihan",
      description: message,
      variant: "destructive"
    });
  }, [error, isError, toast]);

  useEffect(() => {
    if (!attemptError || !attemptId) return;
    const message = isAxiosError(attemptError)
      ? attemptError.response?.data?.message ?? "Riwayat tryout tidak ditemukan."
      : "Riwayat tryout tidak ditemukan.";
    toast({
      title: "Gagal memuat riwayat",
      description: message,
      variant: "destructive"
    });
  }, [attemptError, attemptId, toast]);

  useEffect(() => {
    hydrationKeyRef.current = null;
  }, [attemptId, effectiveSessionCode, slug]);

  useEffect(() => {
    if (!data) return;
    if (attemptId && !attemptDetail && isAttemptLoading) return;

    if (attemptId && attemptDetail) {
      if (
        attemptDetail.sessionCode &&
        attemptDetail.sessionCode !== data.activeSession.sessionCode
      ) {
        return;
      }
      const hydrationKey = `attempt:${attemptId}:${data.activeSession.sessionCode}`;
      if (hydrationKeyRef.current === hydrationKey) return;
      hydrationKeyRef.current = hydrationKey;

      const availableQuestionIds = new Set(data.questions.map((question) => question.id));
      const mappedAnswers = Object.entries(attemptDetail.answers ?? {}).reduce<
        Record<string, string>
      >((acc, [questionId, selected]) => {
        if (!availableQuestionIds.has(questionId)) return acc;
        if (!selected) return acc;
        acc[questionId] = selected;
        return acc;
      }, {});

      const hydratedResult: TryoutResult = {
        total: attemptDetail.totalQuestions,
        answered: attemptDetail.answeredCount,
        correct: attemptDetail.correctCount,
        wrong: attemptDetail.wrongCount,
        blank: attemptDetail.blankCount,
        score: attemptDetail.score,
        maxScore: attemptDetail.maxScore,
        percentage: attemptDetail.percentage,
        perCategory: attemptDetail.perCategory
      };

      const firstWrongIndex = data.questions.findIndex((question) => {
        const selected = mappedAnswers[question.id];
        return Boolean(selected) && selected !== question.answer;
      });

      setAnswers(mappedAnswers);
      setResult(hydratedResult);
      setIsStarted(true);
      setIsSubmitted(true);
      setSecondsLeft(0);
      setTotalDurationSeconds(defaultDurationSeconds);
      setProgressExpiresAtMs(null);
      setActiveProgressId(null);
      setActiveQuestionIndex(firstWrongIndex >= 0 ? firstWrongIndex : 0);
      return;
    }

    const hydrationKey = `session:${slug ?? ""}:${data.activeSession.sessionCode}`;
    if (hydrationKeyRef.current === hydrationKey) return;
    hydrationKeyRef.current = hydrationKey;

    if (data.activeProgress) {
      applyActiveProgress(data.activeProgress);
      progressSyncErrorShownRef.current = false;
      return;
    }

    setAnswers({});
    setResult(null);
    setIsSubmitted(false);
    setIsStarted(false);
    setActiveQuestionIndex(0);
    setSecondsLeft(defaultDurationSeconds);
    setTotalDurationSeconds(defaultDurationSeconds);
    setProgressExpiresAtMs(null);
    setActiveProgressId(null);
  }, [
    applyActiveProgress,
    attemptDetail,
    attemptId,
    data,
    defaultDurationSeconds,
    isAttemptLoading,
    slug
  ]);

  useEffect(() => {
    if (totalQuestions <= 0) {
      setActiveQuestionIndex(0);
      return;
    }

    setActiveQuestionIndex((current) =>
      Math.min(Math.max(current, 0), totalQuestions - 1)
    );
  }, [totalQuestions]);

  useEffect(() => {
    if (sessionCatalogPage > totalSessionCatalogPages) {
      setSessionCatalogPage(totalSessionCatalogPages);
    }
  }, [sessionCatalogPage, totalSessionCatalogPages]);

  useEffect(() => {
    if (
      !isStarted ||
      isSubmitted ||
      !slug ||
      !data ||
      !activeProgressId
    ) {
      return;
    }

    const syncTimerId = window.setTimeout(() => {
      void api
        .patch<PracticeProgressResponse>(`/api/practice/${slug}/progress`, {
          progressId: activeProgressId,
          activeQuestionIndex,
          answers
        })
        .then(() => {
          progressSyncErrorShownRef.current = false;
        })
        .catch((error) => {
          if (progressSyncErrorShownRef.current) return;
          progressSyncErrorShownRef.current = true;
          toast({
            title: "Gagal sinkronisasi jawaban",
            description: isAxiosError(error)
              ? error.response?.data?.message ??
                "Jawaban akan dicoba sinkronkan ulang otomatis."
              : "Jawaban akan dicoba sinkronkan ulang otomatis.",
            variant: "destructive"
          });
        });
    }, 450);

    return () => window.clearTimeout(syncTimerId);
  }, [
    activeProgressId,
    activeQuestionIndex,
    answers,
    data,
    isStarted,
    isSubmitted,
    slug,
    toast
  ]);

  useEffect(() => {
    if (!isStarted || isSubmitted || !progressExpiresAtMs) {
      return;
    }

    const tick = () => {
      setSecondsLeft(
        Math.max(0, Math.floor((progressExpiresAtMs - Date.now()) / 1000))
      );
    };

    tick();
    const timerId = window.setInterval(() => {
      tick();
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isStarted, isSubmitted, progressExpiresAtMs]);

  useEffect(() => {
    if (!isStarted || isSubmitted) return;
    if (secondsLeft !== 0) return;
    void submitTryout(true);
  }, [isStarted, isSubmitted, secondsLeft, submitTryout]);

  useEffect(() => {
    if (!isStarted) return;

    const handleBlockedShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ["a", "c", "v", "x", "u"].includes(key)) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleBlockedShortcuts);
    return () => {
      window.removeEventListener("keydown", handleBlockedShortcuts);
    };
  }, [isStarted]);

  const handleSelectAnswer = (questionId: string, optionText: string) => {
    if (!isStarted || isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionText }));
  };

  const handleMoveQuestion = (direction: -1 | 1) => {
    setActiveQuestionIndex((current) =>
      Math.min(Math.max(current + direction, 0), Math.max(totalQuestions - 1, 0))
    );
  };

  const jumpToQuestion = (index: number) => {
    setActiveQuestionIndex(
      Math.min(Math.max(index, 0), Math.max(totalQuestions - 1, 0))
    );
  };

  const getQuestionState = (question: PracticeQuestion, index: number): QuestionNavState => {
    if (!isSubmitted) {
      if (index === activeQuestionIndex) return "ACTIVE";
      return answers[question.id] ? "ANSWERED" : "UNANSWERED";
    }

    const selected = answers[question.id];
    if (!selected) return "UNANSWERED";
    return selected === question.answer ? "CORRECT" : "WRONG";
  };

  if (isLoading || (Boolean(attemptId) && isAttemptLoading && !data)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/80 to-muted/40">
        <Navbar />
        <main className="container mx-auto px-4 pt-28 pb-24">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-3xl bg-card shadow-xl"
              />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/80 to-muted/40">
        <Navbar />
        <main className="container mx-auto px-4 pt-28 pb-24">
          <div className="rounded-3xl bg-card p-10 text-center shadow-xl">
            <HelpCircle className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="text-2xl font-semibold text-primary">Soal belum tersedia</h2>
            <p className="mt-2 text-muted-foreground">
              {errorMessage ??
                "Kami sedang menyiapkan soal terbaik untuk paket ini. Silakan cek kembali beberapa saat lagi."}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/80 to-muted/40">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-24">
        <header className="mb-10 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Button
              asChild
              variant="ghost"
              className="mb-3 gap-2 text-muted-foreground hover:text-primary"
            >
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Dashboard
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-primary">{data.package.title}</h1>
            <p className="text-muted-foreground">
              {isSessionCatalogView
                ? `Pilih sesi tryout/latihan yang ingin dikerjakan. Total sesi: ${data.sessions.length}`
                : `${data.activeSession.sessionTitle} - ${data.activeSession.questionCount} soal`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="rounded-full px-4 py-2">
              {data.package.category}
            </Badge>
            {isSessionCatalogView ? (
              <Badge variant="outline" className="rounded-full px-4 py-2">
                {data.sessions.length} sesi tersedia
              </Badge>
            ) : (
              <>
                <Badge className="rounded-full bg-primary/10 text-primary">
                  {data.activeSession.sessionType}
                </Badge>
                <Badge variant="outline" className="rounded-full px-4 py-2">
                  {data.activeSession.sessionCode}
                </Badge>
              </>
            )}
          </div>
        </header>

        {isSessionCatalogView ? (
          <section className="space-y-6">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={sessionSearchTerm}
                onChange={(event) => {
                  setSessionSearchTerm(event.target.value);
                  setSessionCatalogPage(1);
                }}
                placeholder="Cari sesi tryout/latihan..."
                className="h-12 pl-10"
              />
            </div>

            {paginatedSessions.length === 0 ? (
              <div className="rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-md">
                Tidak ada sesi yang cocok dengan kata kunci pencarian.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {paginatedSessions.map((session) => {
                    const nextParams = new URLSearchParams();
                    nextParams.set("sessionCode", session.sessionCode);

                    return (
                      <article
                        key={`${session.sessionType}-${session.sessionOrder}`}
                        className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full",
                              session.sessionType === "TRYOUT"
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-emerald-300 bg-emerald-50 text-emerald-700"
                            )}
                          >
                            {session.sessionType}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {session.questionCount} soal
                          </span>
                        </div>
                        <h3 className="line-clamp-2 min-h-[3.5rem] text-lg font-semibold text-primary">
                          {session.sessionTitle}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Kode: {session.sessionCode}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Estimasi:{" "}
                          {session.sessionType === "LATIHAN"
                            ? `${data.package.latihanDurationMinutes} menit`
                            : `${data.package.tryoutDurationMinutes} menit`}
                        </p>
                        <Button asChild className="mt-4 w-full">
                          <Link to={`/practice/${data.package.slug}?${nextParams.toString()}`}>
                            Pilih
                          </Link>
                        </Button>
                      </article>
                    );
                  })}
                </div>

                <div className="rounded-2xl bg-card shadow-sm">
                  <TablePagination
                    currentPage={safeSessionCatalogPage}
                    totalPages={totalSessionCatalogPages}
                    totalItems={filteredSessions.length}
                    pageSize={SESSION_CATALOG_PAGE_SIZE}
                    onPageChange={setSessionCatalogPage}
                  />
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-6">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sesi yang dipilih</p>
                  <p className="text-lg font-semibold text-primary">
                    {data.activeSession.sessionTitle} ({data.activeSession.questionCount} soal)
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to={`/practice/${data.package.slug}`}>Lihat Semua Sesi</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-primary/10 bg-primary/5 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {attemptId
                      ? `Review Hasil ${activeSessionDisplayName}`
                      : `Simulasi ${activeSessionDisplayName}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total soal: {totalQuestions} - Terjawab: {answeredCount} - Belum terjawab:{" "}
                    {unansweredCount}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-primary">
                  <Clock3 className="h-4 w-4" />
                  {formatDuration(secondsLeft)}
                </div>
              </div>

              {!isStarted ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-primary/10 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Klik mulai untuk masuk mode ujian. Soal ditampilkan satu per satu
                    seperti tampilan tes SKD.
                  </p>
                  <Button onClick={() => void startTryout(false)}>
                    Mulai {activeSessionDisplayName}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-primary/10 pt-4">
                  {!isSubmitted && (
                    <Button
                      onClick={() => void submitTryout(false)}
                      disabled={answeredCount === 0}
                    >
                      Kumpulkan {activeSessionDisplayName}
                    </Button>
                  )}
                  {isSubmitted && (
                    <Button
                      variant="outline"
                      onClick={() => void startTryout(true)}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" /> Kerjakan Ulang
                    </Button>
                  )}
                </div>
              )}
            </div>

            {isSubmitted && result && <TryoutResultCard result={result} />}

            {isStarted && activeQuestion && (
              <div
                className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
                onCopy={preventQuestionCopy}
                onCut={preventQuestionCopy}
                onPaste={preventQuestionCopy}
                onContextMenu={preventQuestionCopy}
                onDragStart={preventQuestionCopy}
              >
                <div className="space-y-4">
                  <TryoutQuestionCard
                    key={activeQuestion.id}
                    question={activeQuestion}
                    index={activeQuestionIndex}
                    totalQuestions={totalQuestions}
                    selectedAnswer={answers[activeQuestion.id]}
                    submitted={isSubmitted}
                    onSelect={(optionText) =>
                      handleSelectAnswer(activeQuestion.id, optionText)
                    }
                    onPreventCopy={preventQuestionCopy}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleMoveQuestion(-1)}
                      disabled={activeQuestionIndex <= 0}
                    >
                      <ChevronLeft className="h-4 w-4" /> Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleMoveQuestion(1)}
                      disabled={activeQuestionIndex >= totalQuestions - 1}
                    >
                      Berikutnya <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                  <div className="rounded-3xl bg-card p-5 shadow-xl">
                    <p className="text-sm font-semibold text-primary">Progress Pengerjaan</p>
                    <Progress value={progressValue} className="mt-3 h-3" />
                    <p className="mt-3 text-xs text-muted-foreground">
                      {answeredCount} dari {totalQuestions} soal sudah dijawab ({progressValue}
                      %)
                    </p>
                  </div>

                  <div className="rounded-3xl bg-card p-5 shadow-xl xl:flex xl:max-h-[calc(100vh-9.5rem)] xl:flex-col">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-primary">Navigasi Soal</p>
                      <Badge variant="outline" className="rounded-full">
                        {activeQuestionIndex + 1}/{totalQuestions}
                      </Badge>
                    </div>

                    {!isSubmitted ? (
                      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-primary">
                          Soal aktif
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1 text-emerald-700">
                          Sudah dikerjakan
                        </span>
                        <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                          Belum dikerjakan
                        </span>
                      </div>
                    ) : (
                      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1 text-emerald-700">
                          Benar
                        </span>
                        <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-1 text-rose-700">
                          Salah
                        </span>
                        <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                          Kosong
                        </span>
                      </div>
                    )}

                    <div className="max-h-80 overflow-y-auto pr-1 sm:max-h-96 xl:min-h-0 xl:flex-1 xl:max-h-none">
                      <div className="grid grid-cols-5 gap-2">
                        {data.questions.map((question, index) => {
                          const status = getQuestionState(question, index);
                          const isActive = index === activeQuestionIndex;

                          return (
                            <button
                              key={question.id}
                              type="button"
                              className={cn(
                                "h-10 rounded-lg border text-sm font-semibold transition",
                                !isSubmitted &&
                                  (status === "ACTIVE"
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : status === "ANSWERED"
                                    ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                    : "border-border bg-muted/40 text-muted-foreground hover:border-primary/30 hover:text-primary"),
                                isSubmitted &&
                                  (status === "CORRECT"
                                    ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                    : status === "WRONG"
                                    ? "border-rose-300 bg-rose-100 text-rose-700"
                                    : "border-border bg-muted/40 text-muted-foreground"),
                                isActive && "ring-2 ring-primary ring-offset-1"
                              )}
                              onClick={() => jumpToQuestion(index)}
                            >
                              {index + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!isSubmitted ? (
                      <div className="mt-4 border-t border-border/60 pt-4">
                        <Button
                          className="w-full"
                          onClick={() => void submitTryout(false)}
                          disabled={answeredCount === 0}
                        >
                          Selesai & Kumpulkan
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-4 border-t border-border/60 pt-4">
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => void startTryout(true)}
                        >
                          Kerjakan Ulang
                        </Button>
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

const TryoutResultCard = ({ result }: { result: TryoutResult }) => (
  <div className="rounded-3xl bg-card p-6 shadow-xl">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-primary">
        <Trophy className="h-6 w-6 text-amber-500" /> Hasil Tryout
      </h2>
      <Badge className="rounded-full bg-primary/10 text-primary">
        Skor {result.score}/{result.maxScore} ({result.percentage}%)
      </Badge>
    </div>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <ResultChip label="Total" value={result.total} />
      <ResultChip label="Terjawab" value={result.answered} />
      <ResultChip label="Benar" value={result.correct} className="text-emerald-700" />
      <ResultChip label="Salah" value={result.wrong} className="text-rose-700" />
      <ResultChip label="Kosong" value={result.blank} />
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      {result.perCategory.map((item) => (
        <div
          key={item.category}
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            categoryStyle[item.category]
          )}
        >
          <p className="font-semibold">{categoryLabel[item.category]}</p>
          <p>
            Benar {item.correct}/{item.total}
          </p>
          <p>
            Skor {item.score}/{item.maxScore}
          </p>
        </div>
      ))}
    </div>
  </div>
);

const ResultChip = ({
  label,
  value,
  className
}: {
  label: string;
  value: number | string;
  className?: string;
}) => (
  <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm">
    <p className="text-muted-foreground">{label}</p>
    <p className={cn("text-xl font-bold text-primary", className)}>{value}</p>
  </div>
);

const TryoutQuestionCard = ({
  question,
  index,
  totalQuestions,
  selectedAnswer,
  onSelect,
  submitted,
  onPreventCopy
}: {
  question: PracticeQuestion;
  index: number;
  totalQuestions: number;
  selectedAnswer?: string;
  onSelect: (optionText: string) => void;
  submitted: boolean;
  onPreventCopy: (event: SyntheticEvent) => void;
}) => {
  const selectedOption = getSelectedOption(question, selectedAnswer);
  const earnedScore = getQuestionEarnedScore(question, selectedOption);

  return (
    <div
      className="select-none rounded-3xl bg-card p-6 shadow-xl"
      onCopy={onPreventCopy}
      onCut={onPreventCopy}
      onPaste={onPreventCopy}
      onContextMenu={onPreventCopy}
      onDragStart={onPreventCopy}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="rounded-full">
            Soal {index + 1} / {totalQuestions}
          </Badge>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              categoryStyle[question.category]
            )}
          >
            {categoryLabel[question.category]}
          </span>
          <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
            {question.subtestTitle}
          </Badge>
        </div>
        {submitted && question.category === "TKP" && (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Skor +{earnedScore}
          </span>
        )}
        {submitted && question.category !== "TKP" &&
          (selectedAnswer === question.answer ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Benar (+5)
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              <XCircle className="h-4 w-4" /> Salah
            </span>
          ))}
      </div>

      <p className="mb-4 text-lg font-semibold text-slate-900">{question.prompt}</p>

      {question.promptImageUrl && (
        <img
          src={question.promptImageUrl}
          alt={`Ilustrasi soal ${index + 1}`}
          className="mb-5 max-h-72 w-full rounded-2xl border border-border object-contain"
        />
      )}

      {question.promptPdfDataUrl && (
        <div className="mb-5">
          <a
            href={question.promptPdfDataUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15"
          >
            <FileText className="h-4 w-4" />
            Buka Lampiran PDF Soal
          </a>
        </div>
      )}

      <div className="space-y-3">
        {question.options.map((option, optionIndex) => {
          const isSelected = selectedAnswer === option.text;
          const isCorrect = option.text === question.answer;

          return (
            <button
              key={`${question.id}-${optionIndex}`}
              type="button"
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                submitted
                  ? isCorrect
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : isSelected
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-border bg-muted/20 text-slate-900"
                  : isSelected
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-muted/20 text-slate-900 hover:border-primary/30 hover:bg-primary/5"
              )}
              onClick={() => onSelect(option.text)}
              disabled={submitted}
            >
              <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold">
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <div className="flex-1 space-y-2 text-sm leading-relaxed">
                <p className="font-semibold text-slate-900">{option.text}</p>
                {option.imageUrl && (
                  <img
                    src={option.imageUrl}
                    alt={`Ilustrasi opsi ${String.fromCharCode(65 + optionIndex)}`}
                    className="max-h-56 w-full rounded-xl border border-border object-contain"
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {question.category === "TKP" && submitted && (
                  <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                    {option.score ?? 0} poin
                  </span>
                )}
                {submitted && isSelected && (
                  <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
                    Pilihanmu
                  </span>
                )}
                {submitted && isCorrect && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    Kunci
                  </span>
                )}
                {submitted && isCorrect ? (
                  <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-500" />
                ) : isSelected ? (
                  <Circle className="mt-1 h-4 w-4" />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {(question.explanation || question.explanationImageUrl) && submitted && (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
          <p className="mb-1 font-semibold text-primary">Pembahasan</p>
          {question.explanation && <p>{question.explanation}</p>}
          {question.explanationImageUrl && (
            <img
              src={question.explanationImageUrl}
              alt={`Pembahasan soal ${index + 1}`}
              className="mt-3 max-h-72 w-full rounded-xl border border-border object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Practice;
