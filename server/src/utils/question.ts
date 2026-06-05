export const QUESTION_CATEGORIES = ["TKP", "TIU", "TWK"] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export type QuestionOptionInput =
  | string
  | {
      text: string;
      imageUrl?: string | null;
      score?: number | null;
    };

export type QuestionOption = {
  text: string;
  imageUrl: string | null;
  score: number | null;
};

type ParseQuestionContext = {
  category?: QuestionCategory;
  answer?: string;
};

const DEFAULT_TKP_FALLBACK_SCORE = 3;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeText = (value: string) => value.trim();

export const sanitizeOptionalImage = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseJsonArray = (value?: string | null): unknown[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse question options JSON", error);
    return [];
  }
};

const parseNumberLike = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeOption = (value: unknown): QuestionOption | null => {
  if (typeof value === "string") {
    const text = sanitizeText(value);
    if (!text) return null;
    return { text, imageUrl: null, score: null };
  }

  if (!isPlainObject(value)) {
    return null;
  }

  const text = typeof value.text === "string" ? sanitizeText(value.text) : "";
  if (!text) return null;

  const imageUrl =
    typeof value.imageUrl === "string" ? sanitizeOptionalImage(value.imageUrl) : null;
  const scoreLike = parseNumberLike(value.score);
  const score = scoreLike !== null && Number.isInteger(scoreLike) ? scoreLike : null;

  return { text, imageUrl, score };
};

const applyTkpFallback = (options: QuestionOption[], answer?: string) => {
  const normalizedAnswer = answer?.trim() ?? "";
  return options.map((option) => {
    if (
      option.score !== null &&
      Number.isInteger(option.score) &&
      option.score >= 1 &&
      option.score <= 5
    ) {
      return option;
    }

    return {
      ...option,
      score: option.text === normalizedAnswer ? 5 : DEFAULT_TKP_FALLBACK_SCORE
    };
  });
};

export const parseQuestionOptions = (
  value?: string | null,
  context?: ParseQuestionContext
): QuestionOption[] => {
  const options = parseJsonArray(value)
    .map(normalizeOption)
    .filter((option): option is QuestionOption => Boolean(option));

  if (context?.category === "TKP") {
    return applyTkpFallback(options, context.answer);
  }

  return options.map((option) => ({ ...option, score: null }));
};

export const normalizeQuestionOptionsInput = (
  options: QuestionOptionInput[]
): QuestionOption[] =>
  options
    .map((option) => normalizeOption(option))
    .filter((option): option is QuestionOption => Boolean(option));

export const validateAndPrepareQuestionOptions = ({
  category,
  options,
  answer
}: {
  category: QuestionCategory;
  options: QuestionOptionInput[];
  answer: string;
}): { options: QuestionOption[]; answer: string } => {
  const preparedOptions = normalizeQuestionOptionsInput(options);

  if (preparedOptions.length < 2) {
    throw new Error("Opsi jawaban minimal 2 item.");
  }

  const normalizedOptionTextSet = new Set<string>();
  for (const option of preparedOptions) {
    const normalizedText = option.text.trim().toLowerCase();
    if (normalizedOptionTextSet.has(normalizedText)) {
      throw new Error("Setiap opsi jawaban harus unik dan tidak boleh duplikat.");
    }
    normalizedOptionTextSet.add(normalizedText);
  }

  const normalizedAnswer = answer.trim();
  if (!normalizedAnswer) {
    throw new Error("Kunci jawaban tidak boleh kosong.");
  }

  const exactAnswerOption = preparedOptions.find(
    (option) => option.text === normalizedAnswer
  );

  if (!exactAnswerOption) {
    throw new Error("Kunci jawaban harus sama persis dengan salah satu opsi.");
  }

  if (category === "TKP") {
    const normalized = preparedOptions.map((option) => {
      if (
        option.score === null ||
        !Number.isInteger(option.score) ||
        option.score < 1 ||
        option.score > 5
      ) {
        throw new Error("Skor opsi TKP harus berupa bilangan bulat 1 sampai 5.");
      }
      return option;
    });

    const answerOption = normalized.find((option) => option.text === normalizedAnswer);
    if (!answerOption || answerOption.score !== 5) {
      throw new Error("Pada soal TKP, opsi yang dijadikan kunci harus bernilai 5.");
    }

    return {
      options: normalized,
      answer: normalizedAnswer
    };
  }

  return {
    options: preparedOptions.map((option) => ({
      ...option,
      score: null
    })),
    answer: normalizedAnswer
  };
};

export const serializeQuestionOptions = (options: QuestionOption[]) =>
  JSON.stringify(
    options.map((option) => ({
      text: option.text,
      imageUrl: option.imageUrl,
      score: option.score
    }))
  );
