import prisma from "../prisma";
import {
  buildSessionSourceKey,
  buildEffectiveQuestionSourcePackageIds,
  buildSessionDefaultCode,
  buildSessionDefaultTitle,
  isSessionAccessibleForPackage,
  normalizeSessionType,
  parseSessionSourceKeys,
  type PackageSessionAccess,
  type QuestionSessionType
} from "./package-session";

type SessionPackage = PackageSessionAccess & {
  id: string;
  sessionSourcePackageIds?: string | null;
};

type PackageResolvedSession = {
  sessionType: QuestionSessionType;
  sessionCode: string;
  sessionTitle: string;
  sessionOrder: number;
  questionCount: number;
  aliases: string[];
  sourcePackageIds: string[];
};

const getPackageResolvedSessions = async (
  pkg: SessionPackage
): Promise<PackageResolvedSession[]> => {
  const sourcePackageIds = buildEffectiveQuestionSourcePackageIds({
    packageId: pkg.id,
    sessionSourcePackageIds: pkg.sessionSourcePackageIds
  });
  const sourceSessionKeys = new Set(parseSessionSourceKeys(pkg.sessionSourcePackageIds));
  const hasSessionKeySources = sourceSessionKeys.size > 0;

  const grouped = await prisma.question.groupBy({
    by: ["packageId", "sessionType", "sessionCode", "sessionTitle", "sessionOrder"],
    ...(hasSessionKeySources
      ? {}
      : {
          where: { packageId: { in: sourcePackageIds } }
        }),
    _count: { _all: true }
  });

  const mergedSessions = new Map<
    string,
    {
      sessionType: QuestionSessionType;
      sessionCode: string;
      sessionTitle: string;
      sessionOrder: number;
      questionCount: number;
      sourcePackageIds: Set<string>;
      aliases: Set<string>;
    }
  >();

  for (const item of grouped) {
    const sessionType = normalizeSessionType(item.sessionType);
    const sessionOrder = item.sessionOrder > 0 ? item.sessionOrder : 1;
    const hasAccess = isSessionAccessibleForPackage({
      sessionType,
      sessionOrder,
      pkg
    });
    if (!hasAccess) continue;

    if (hasSessionKeySources) {
      const sourceSessionKey = buildSessionSourceKey(sessionType, sessionOrder);
      if (!sourceSessionKeys.has(sourceSessionKey)) continue;
    }

    const sessionKey = `${sessionType}:${sessionOrder}`;
    const defaultSessionCode = buildSessionDefaultCode(sessionType, sessionOrder);
    const defaultSessionTitle = buildSessionDefaultTitle(sessionType, sessionOrder);
    const nextSessionCode = item.sessionCode?.trim().toUpperCase() || defaultSessionCode;
    const nextSessionTitle = item.sessionTitle?.trim() || defaultSessionTitle;
    const existing = mergedSessions.get(sessionKey);

    if (!existing) {
      mergedSessions.set(sessionKey, {
        sessionType,
        sessionCode: defaultSessionCode,
        sessionTitle: nextSessionTitle,
        sessionOrder,
        questionCount: item._count._all,
        sourcePackageIds: new Set([item.packageId]),
        aliases: new Set([nextSessionCode])
      });
      continue;
    }

    existing.questionCount += item._count._all;
    existing.sourcePackageIds.add(item.packageId);
    existing.aliases.add(nextSessionCode);
    if (
      existing.sessionTitle === defaultSessionTitle &&
      nextSessionTitle !== defaultSessionTitle
    ) {
      existing.sessionTitle = nextSessionTitle;
    }
  }

  return Array.from(mergedSessions.values())
    .map((item) => {
      const aliases = Array.from(item.aliases);
      if (!aliases.includes(item.sessionCode)) {
        aliases.push(item.sessionCode);
      }

      const sessionType = normalizeSessionType(item.sessionType);

      return {
        sessionType,
        sessionCode: item.sessionCode,
        sessionTitle: item.sessionTitle,
        sessionOrder: item.sessionOrder,
        questionCount: item.questionCount,
        aliases,
        sourcePackageIds: Array.from(item.sourcePackageIds)
      };
    })
    .sort((a, b) => {
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

export { getPackageResolvedSessions };
export type { PackageResolvedSession, SessionPackage };
