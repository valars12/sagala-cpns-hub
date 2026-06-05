import type { AxiosError } from "axios";

export type ApiError = AxiosError<{ message?: string; errors?: unknown }>;

export type RegistrationSource =
  | "SELF_REGISTERED"
  | "ADMIN_CREATED"
  | "UNKNOWN";

export type User = {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  provider: string;
  role: "student" | "admin" | "teacher";
  registrationSource: RegistrationSource;
  isValidated: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SagalaPackage = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description: string;
  category: string;
  level?: string | null;
  imageUrl?: string | null;
  price: number;
  discountPercent?: number | null;
  durationDays: number;
  tryoutDurationMinutes: number;
  latihanDurationMinutes: number;
  tryoutAccessStart: number;
  tryoutAccessEnd?: number | null;
  latihanAccessStart: number;
  latihanAccessEnd?: number | null;
  sessionSourcePackageIds?: string[];
  sessionSourceSessionKeys?: string[];
  badge?: string | null;
  features: string[];
  whatsIncluded: string[];
  highlights: Array<{ title: string; value: string }>;
  createdAt?: string;
  updatedAt?: string;
};

export type PurchaseStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELED";
export type QuestionCategory = "TKP" | "TIU" | "TWK";
export type QuestionSessionType = "TRYOUT" | "LATIHAN";

export type QuestionOption = {
  text: string;
  imageUrl?: string | null;
  score?: number | null;
};

export type Purchase = {
  id: string;
  orderCode: string;
  status: PurchaseStatus;
  hiddenAt?: string | null;
  isAdminGranted?: boolean;
  paymentMethod?: string | null;
  paymentType?: string | null;
  paidAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  validityDays?: number;
  createdAt: string;
  package: SagalaPackage;
};

export type DashboardStats = {
  totalPackages: number;
  activePackages: number;
  pendingPackages: number;
  completedPackages: number;
};

export type DashboardPayload = {
  stats: DashboardStats;
  purchases: Purchase[];
  trashedPurchases: Purchase[];
  accessibleModules: Array<{
    id: string;
    title: string;
    bab?: string | null;
    subBab?: string | null;
    summary?: string | null;
    content?: string | null;
    pdfDataUrl?: string | null;
    pdfFileName?: string | null;
    pptDataUrl?: string | null;
    pptFileName?: string | null;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: {
      id: string;
      name: string;
    };
    packages: Array<{
      id: string;
      slug: string;
      title: string;
    }>;
  }>;
  accessibleTryouts: Array<{
    id: string;
    packageId: string;
    packageSlug: string;
    packageTitle: string;
    category: string;
    sessionType: QuestionSessionType;
    sessionCode: string;
    sessionTitle: string;
    sessionOrder: number;
    questionCount: number;
    tryoutNumber?: number | null;
  }>;
  tryoutHistory: Array<{
    id: string;
    package: Pick<SagalaPackage, "id" | "slug" | "title" | "category">;
    sessionType: QuestionSessionType;
    sessionCode?: string | null;
    sessionTitle?: string | null;
    totalQuestions: number;
    answeredCount: number;
    correctCount: number;
    wrongCount: number;
    blankCount: number;
    score: number;
    maxScore: number;
    percentage: number;
    durationSeconds?: number | null;
    completedAt: string;
    perCategory: Array<{
      category: QuestionCategory;
      total: number;
      correct: number;
      score: number;
      maxScore: number;
    }>;
  }>;
};

export type PracticeQuestion = {
  id: string;
  category: QuestionCategory;
  sessionType: QuestionSessionType;
  sessionCode: string;
  sessionTitle: string;
  sessionOrder: number;
  subtestTitle: string;
  prompt: string;
  promptImageUrl?: string | null;
  promptPdfDataUrl?: string | null;
  promptPdfFileName?: string | null;
  options: QuestionOption[];
  answer: string;
  explanation?: string | null;
  explanationImageUrl?: string | null;
};

export type PracticeActiveProgress = {
  id: string;
  sessionType: QuestionSessionType;
  sessionCode: string;
  sessionTitle?: string | null;
  sessionOrder: number;
  totalQuestions: number;
  totalDurationSeconds: number;
  startedAt: string;
  expiresAt: string;
  remainingSeconds: number;
  activeQuestionIndex: number;
  answers: Record<string, string>;
};

export type PracticePayload = {
  package: Pick<
    SagalaPackage,
    | "id"
    | "slug"
    | "title"
    | "subtitle"
    | "category"
    | "durationDays"
    | "tryoutDurationMinutes"
    | "latihanDurationMinutes"
  >;
  sessions: Array<{
    sessionType: QuestionSessionType;
    sessionCode: string;
    sessionTitle: string;
    sessionOrder: number;
    questionCount: number;
  }>;
  activeSession: {
    sessionType: QuestionSessionType;
    sessionCode: string;
    sessionTitle: string;
    sessionOrder: number;
    questionCount: number;
  };
  activeProgress?: PracticeActiveProgress | null;
  questions: PracticeQuestion[];
};

export type PracticeAttemptDetail = {
  id: string;
  package: Pick<SagalaPackage, "id" | "slug" | "title" | "category">;
  sessionType: QuestionSessionType;
  sessionCode?: string | null;
  sessionTitle?: string | null;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  durationSeconds?: number | null;
  completedAt: string;
  perCategory: Array<{
    category: QuestionCategory;
    total: number;
    correct: number;
    score: number;
    maxScore: number;
  }>;
  answers: Record<string, string>;
};

export type AuthResponse = {
  user: User;
  token?: string;
  requiresValidation?: boolean;
  message?: string;
};

export type PackageListResponse = {
  data: SagalaPackage[];
};

export type PackageDetailResponse = {
  data: SagalaPackage;
};

export type OrderResponse = {
  data: Purchase;
  payment: {
    snapToken: string | null;
    snapRedirectUrl: string | null;
    isSimulation: boolean;
    message: string;
  };
};

export type DashboardResponse = {
  data: DashboardPayload;
};

export type PracticeResponse = {
  data: PracticePayload;
};

export type PracticeAttemptDetailResponse = {
  data: PracticeAttemptDetail;
};

export type PracticeProgressResponse = {
  data: PracticeActiveProgress;
};

export type AdminUser = {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  phone?: string | null;
  provider: string;
  role: string;
  registrationSource: RegistrationSource;
  isValidated: boolean;
  createdAt: string;
};

export type AdminPayment = {
  id: string;
  orderCode: string;
  status: PurchaseStatus;
  isAdminGranted?: boolean;
  grossAmount: number;
  paymentMethod?: string | null;
  paymentType?: string | null;
  paidAt?: string | null;
  createdAt: string;
  user: Pick<User, "id" | "name" | "username" | "email" | "phone">;
  package: Pick<SagalaPackage, "id" | "slug" | "title" | "category" | "price">;
};

export type AdminStats = {
  totalUsers: number;
  totalPayments: number;
  paidPayments: number;
  pendingPayments: number;
  totalRevenue: number;
};

export type AdminOverviewResponse = {
  data: {
    stats: AdminStats;
    users: AdminUser[];
    payments: AdminPayment[];
  };
};

export type AdminPackage = SagalaPackage & {
  questionCount: number;
  questionBreakdown: Record<QuestionCategory, number>;
  questionSessionBreakdown: Record<QuestionSessionType, number>;
  questionSessionAvailability: Record<QuestionSessionType, number[]>;
};

export type AdminQuestion = {
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
  promptImageUrl?: string | null;
  promptPdfDataUrl?: string | null;
  promptPdfFileName?: string | null;
  options: QuestionOption[];
  answer: string;
  explanation?: string | null;
  explanationImageUrl?: string | null;
  createdAt: string;
  package?: Pick<SagalaPackage, "id" | "slug" | "title" | "category">;
};

export type AdminPackagesResponse = {
  data: AdminPackage[];
};

export type AdminQuestionsResponse = {
  data: AdminQuestion[];
};

export type AdminQuestionSession = {
  key: string;
  sessionType: QuestionSessionType;
  sessionOrder: number;
  sessionCode: string;
  sessionTitle: string;
  questionCount: number;
  questionBreakdown: Record<QuestionCategory, number>;
};

export type AdminQuestionSessionsResponse = {
  data: AdminQuestionSession[];
};

export type AdminModule = {
  id: string;
  title: string;
  bab?: string | null;
  subBab?: string | null;
  summary?: string | null;
  content?: string | null;
  pdfDataUrl?: string | null;
  pdfFileName?: string | null;
  pptDataUrl?: string | null;
  pptFileName?: string | null;
  isPublished: boolean;
  accessCount: number;
  packageIds: string[];
  packages: Array<{
    id: string;
    slug: string;
    title: string;
  }>;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    role: "admin" | "teacher" | "student";
  };
};

export type AdminModulesResponse = {
  data: AdminModule[];
};

export type AdminModuleAccessResponse = {
  data: {
    modules: Array<{
      id: string;
      title: string;
      isPublished: boolean;
    }>;
    students: Array<{
      id: string;
      name: string;
      username?: string | null;
      email: string;
      isValidated: boolean;
      moduleIds: string[];
    }>;
  };
};

export type AdminStudyClass = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    username?: string | null;
    email: string;
  } | null;
  teachers: Array<{
    id: string;
    name: string;
    username?: string | null;
    email: string;
  }>;
  students: Array<{
    id: string;
    name: string;
    username?: string | null;
    email: string;
  }>;
};

export type AdminClassesResponse = {
  data: {
    classes: AdminStudyClass[];
    teachers: Array<{
      id: string;
      name: string;
      username?: string | null;
      email: string;
    }>;
    students: Array<{
      id: string;
      name: string;
      username?: string | null;
      email: string;
    }>;
  };
};

export type AdminClassTryoutAssignmentsResponse = {
  data: {
    classes: Array<{
      id: string;
      name: string;
      teacherCount: number;
      studentCount: number;
    }>;
    assignments: Array<{
      id: string;
      studyClass: {
        id: string;
        name: string;
      };
      package: {
        id: string;
        title: string;
        category: string;
      };
      sessionType: QuestionSessionType;
      sessionOrder: number;
      sessionCode: string;
      sessionTitle: string;
      startAt: string;
      endAt: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      createdBy?: {
        id: string;
        name: string;
        role: string;
      } | null;
    }>;
  };
};

export type AdminPackageSessionsResponse = {
  data: Array<{
    sessionType: QuestionSessionType;
    sessionCode: string;
    sessionTitle: string;
    sessionOrder: number;
    questionCount: number;
  }>;
};

export type AdminQuestionBackup = {
  id: string;
  action: "CREATE" | "UPDATE_BEFORE" | "DELETE" | "RESTORE";
  questionId?: string | null;
  packageId?: string | null;
  packageTitle?: string | null;
  sessionType?: QuestionSessionType | null;
  sessionOrder?: number | null;
  sessionCode?: string | null;
  sessionTitle?: string | null;
  category?: QuestionCategory | null;
  subtestTitle?: string | null;
  promptExcerpt?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  restoredAt?: string | null;
  restoredById?: string | null;
  restoredByName?: string | null;
  restoredQuestionId?: string | null;
  createdAt: string;
};

export type AdminQuestionBackupsResponse = {
  data: AdminQuestionBackup[];
};

export type AdminTryoutScoreResponse = {
  data: {
    classes: Array<{
      id: string;
      name: string;
      teacherCount: number;
      studentCount: number;
    }>;
    studentSummaries: Array<{
      student: {
        id: string;
        name: string;
        username?: string | null;
        email: string;
      };
      classes: Array<{
        id: string;
        name: string;
      }>;
      totalAttempts: number;
      latestAttempt: {
        id: string;
        sessionTitle?: string | null;
        sessionCode?: string | null;
        package: {
          id: string;
          title: string;
          category: string;
        };
        completedAt: string;
        percentage: number;
        scores: {
          TKP: number;
          TIU: number;
          TWK: number;
          total: number;
          maxScore: number;
        };
      } | null;
    }>;
  };
};

export type AdminStudentAttemptHistoryResponse = {
  data: {
    student: {
      id: string;
      name: string;
      username?: string | null;
      email: string;
    };
    classes: Array<{
      id: string;
      name: string;
    }>;
    attempts: Array<{
      id: string;
      sessionType: QuestionSessionType;
      sessionTitle?: string | null;
      sessionCode?: string | null;
      package: {
        id: string;
        title: string;
        category: string;
      };
      completedAt: string;
      durationSeconds?: number | null;
      durationMinutes?: number | null;
      percentage: number;
      scores: {
        TKP: number;
        TIU: number;
        TWK: number;
        total: number;
        maxScore: number;
      };
    }>;
  };
};
