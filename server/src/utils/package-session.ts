const QUESTION_SESSION_TYPES = ["TRYOUT", "LATIHAN"] as const;

type QuestionSessionType = (typeof QUESTION_SESSION_TYPES)[number];

type PackageSessionAccess = {
  tryoutAccessStart: number;
  tryoutAccessEnd: number | null;
  latihanAccessStart: number;
  latihanAccessEnd: number | null;
};

const parseJsonArray = (value?: string | null): unknown[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse JSON field", value, error);
    return [];
  }
};

const SESSION_SOURCE_KEY_PATTERN = /^(TRYOUT|LATIHAN):(\d+)$/i;

const normalizeSessionType = (value: string): QuestionSessionType =>
  value === "LATIHAN" ? "LATIHAN" : "TRYOUT";

const buildSessionSourceKey = (
  sessionType: QuestionSessionType,
  sessionOrder: number
) => `${normalizeSessionType(sessionType)}:${Math.max(sessionOrder, 1)}`;

const parseSessionSourceKey = (value: string) => {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(SESSION_SOURCE_KEY_PATTERN);
  if (!match) return null;

  const sessionType = normalizeSessionType(match[1]);
  const sessionOrder = Number(match[2]);
  if (!Number.isInteger(sessionOrder) || sessionOrder < 1) return null;

  return buildSessionSourceKey(sessionType, sessionOrder);
};

const parseSourceItems = (value?: string | null) =>
  parseJsonArray(value)
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

const parsePackageSourceIds = (value?: string | null) =>
  parseSourceItems(value).filter((item) => !parseSessionSourceKey(item));

const parseSessionSourceKeys = (value?: string | null) =>
  Array.from(
    new Set(
      parseSourceItems(value)
        .map((item) => parseSessionSourceKey(item))
        .filter((item): item is string => Boolean(item))
    )
  );

const buildEffectiveQuestionSourcePackageIds = ({
  packageId,
  sessionSourcePackageIds,
  allowedPackageIds
}: {
  packageId: string;
  sessionSourcePackageIds?: string | null;
  allowedPackageIds?: Set<string>;
}) => {
  const ids = new Set<string>([packageId]);

  for (const sourcePackageId of parsePackageSourceIds(sessionSourcePackageIds)) {
    if (sourcePackageId === packageId) continue;
    if (allowedPackageIds && !allowedPackageIds.has(sourcePackageId)) continue;
    ids.add(sourcePackageId);
  }

  return Array.from(ids);
};

const buildSessionDefaultCode = (
  sessionType: QuestionSessionType,
  sessionOrder: number
) => `${sessionType}-${Math.max(sessionOrder, 1)}`;

const buildSessionDefaultTitle = (
  sessionType: QuestionSessionType,
  sessionOrder: number
) => `${sessionType === "TRYOUT" ? "Tryout" : "Latihan"} ${Math.max(sessionOrder, 1)}`;

const isSessionAccessibleForPackage = ({
  sessionType,
  sessionOrder,
  pkg
}: {
  sessionType: QuestionSessionType;
  sessionOrder: number;
  pkg: PackageSessionAccess;
}) => {
  if (sessionType === "TRYOUT") {
    const minOrder = pkg.tryoutAccessStart > 0 ? pkg.tryoutAccessStart : 1;
    const maxOrder = pkg.tryoutAccessEnd && pkg.tryoutAccessEnd > 0 ? pkg.tryoutAccessEnd : null;
    return sessionOrder >= minOrder && (maxOrder === null || sessionOrder <= maxOrder);
  }

  const minOrder = pkg.latihanAccessStart > 0 ? pkg.latihanAccessStart : 1;
  const maxOrder = pkg.latihanAccessEnd && pkg.latihanAccessEnd > 0 ? pkg.latihanAccessEnd : null;
  return sessionOrder >= minOrder && (maxOrder === null || sessionOrder <= maxOrder);
};

export {
  QUESTION_SESSION_TYPES,
  buildSessionSourceKey,
  buildEffectiveQuestionSourcePackageIds,
  buildSessionDefaultCode,
  buildSessionDefaultTitle,
  isSessionAccessibleForPackage,
  normalizeSessionType,
  parsePackageSourceIds,
  parseSessionSourceKey,
  parseSessionSourceKeys
};
export type { PackageSessionAccess, QuestionSessionType };
