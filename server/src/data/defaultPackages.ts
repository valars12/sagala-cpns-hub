export type SeedPackage = {
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  category: string;
  level?: string;
  imageUrl?: string;
  price: number;
  discountPercent: number;
  durationDays: number;
  tryoutDurationMinutes: number;
  latihanDurationMinutes: number;
  badge?: string;
  features: string[];
  whatsIncluded: string[];
  highlights?: Array<{ title: string; value: string }>;
};

export type SeedQuestion = {
  category: "TKP" | "TIU" | "TWK";
  subtestTitle: string;
  prompt: string;
  promptImageUrl?: string;
  options: Array<{
    text: string;
    imageUrl?: string;
    score?: number;
  }>;
  answer: string;
  explanation?: string;
  explanationImageUrl?: string;
};

type CategoryKey = "cpnsS1S2" | "cpnsSmaD3" | "kedinasan";
type TierKey = "hemat" | "basic" | "regular" | "preExclusive" | "exclusive" | "platinum" | "ultimate";

type CategoryMeta = {
  categoryName: string;
  examDescriptor: string;
  audience: string;
  coreFeature: string;
};

type CopyParams = {
  accessLabel: string;
  tryoutCount: number;
  questionCount: number;
  tryoutVariant: "Reguler" | "Exclusive";
  supportLevel: string;
};

const categoryMeta: Record<CategoryKey, CategoryMeta> = {
  cpnsS1S2: {
    categoryName: "CPNS S1/S2",
    examDescriptor: "SKD CPNS S1/S2",
    audience: "lulusan S1/S2",
    coreFeature: "Pendalaman TWK, TIU, dan TKP sesuai kisi-kisi CPNS terbaru.",
  },
  cpnsSmaD3: {
    categoryName: "CPNS SMA/D3",
    examDescriptor: "SKD CPNS SMA/D3",
    audience: "lulusan SMA/D3",
    coreFeature: "Materi TWK, TIU, dan TKP disederhanakan sesuai kurikulum SMA/D3.",
  },
  kedinasan: {
    categoryName: "Sekolah Kedinasan",
    examDescriptor: "latihan sekolah kedinasan",
    audience: "calon taruna sekolah kedinasan",
    coreFeature: "Soal TPA, TBI, psikotes, dan wawasan kebangsaan khas sekolah kedinasan.",
  },
};

const tierLabels: Record<TierKey, string> = {
  hemat: "Hemat",
  basic: "Basic",
  regular: "Reguler",
  preExclusive: "Pre Exclusive",
  exclusive: "Exclusive",
  platinum: "Platinum",
  ultimate: "Ultimate",
};

const tierDurations: Record<TierKey, number> = {
  hemat: 365,
  basic: 365,
  regular: 365,
  preExclusive: 365,
  exclusive: 365,
  platinum: 365,
  ultimate: 365,
};

const tierAccessLabels: Record<TierKey, string> = {
  hemat: "1 Tahun",
  basic: "1 Tahun",
  regular: "1 Tahun",
  preExclusive: "1 Tahun",
  exclusive: "1 Tahun",
  platinum: "1 Tahun",
  ultimate: "1 Tahun",
};

const tierTryouts: Record<TierKey, number> = {
  hemat: 10,
  basic: 20,
  regular: 30,
  preExclusive: 10,
  exclusive: 20,
  platinum: 30,
  ultimate: 50,
};

const tierQuestionBank: Record<TierKey, number> = {
  hemat: 500,
  basic: 500,
  regular: 500,
  preExclusive: 1000,
  exclusive: 1000,
  platinum: 1000,
  ultimate: 1000,
};

const tierVariants: Record<TierKey, "Reguler" | "Exclusive"> = {
  hemat: "Reguler",
  basic: "Reguler",
  regular: "Reguler",
  preExclusive: "Exclusive",
  exclusive: "Exclusive",
  platinum: "Exclusive",
  ultimate: "Exclusive",
};

const tierSupport: Record<TierKey, string> = {
  hemat: "Group Diskusi",
  basic: "Mentor Dasar",
  regular: "Mentor Rutin",
  preExclusive: "Coaching Kisi-kisi",
  exclusive: "Kelas Eksklusif",
  platinum: "Coaching Premium",
  ultimate: "VIP Mentoring",
};

const tierLevels: Record<TierKey, string> = {
  hemat: "Starter",
  basic: "Basic",
  regular: "Intermediate",
  preExclusive: "Intermediate",
  exclusive: "Advanced",
  platinum: "Professional",
  ultimate: "Elite",
};

const tierPrices: Record<TierKey, number> = {
  hemat: 99000,
  basic: 199000,
  regular: 249000,
  preExclusive: 499000,
  exclusive: 999000,
  platinum: 1499000,
  ultimate: 1999000,
};

const tierAdditionalFeatures: Partial<Record<TierKey, string[]>> = {
  hemat: ["Sesi pemetaan target skor dan strategi belajar mandiri."],
  basic: ["Planner belajar 5 bulan lengkap dengan tracker progres mingguan."],
  regular: ["Reminder belajar otomatis dan analisis per topik prioritas."],
  preExclusive: ["Bedah kisi-kisi eksklusif serta strategi memilih formasi terkini."],
  exclusive: ["Kelas live mingguan bersama mentor top Sagala Bimbel."],
  platinum: [
    "Coaching psikotes dan interview premium setiap bulan.",
    "Mentoring penyusunan CV dan dokumen pendukung lolos seleksi.",
  ],
  ultimate: [
    "Pendampingan 1-on-1 prioritas hingga hari-H seleksi.",
    "Simulasi SKB dan interview lanjutan bersama mentor ahli.",
  ],
};

const premiumFacility = "Ruang mentoring eksklusif untuk sesi coaching kelompok kecil.";
const privateFacility = "Penjadwalan private session fleksibel bersama mentor ahli.";
const vipFacility = "Prioritas fasilitas premium termasuk studio belajar pribadi dan konsultasi ekstra.";

const tierAdditionalFacilities: Partial<Record<TierKey, string[]>> = {
  preExclusive: [premiumFacility],
  exclusive: [premiumFacility],
  platinum: [premiumFacility, privateFacility],
  ultimate: [premiumFacility, privateFacility, vipFacility],
};

const tierAdditionalHighlights: Partial<Record<TierKey, Array<{ title: string; value: string }>>> = {
  platinum: [{ title: "Bonus", value: "Coaching Premium" }],
  ultimate: [{ title: "Bonus", value: "Pendampingan Penuh" }],
};

const tierCopy: Record<
  TierKey,
  {
    subtitle: (meta: CategoryMeta, params: CopyParams) => string;
    description: (meta: CategoryMeta, params: CopyParams) => string;
  }
> = {
  hemat: {
    subtitle: (meta, params) => `Pemanasan hemat ${params.accessLabel.toLowerCase()} untuk ${meta.audience}.`,
    description: (meta, params) =>
      `Mulai perjalanan ${meta.examDescriptor} dengan ${params.tryoutCount} latihan reguler dan ${formatQuestionCount(params.questionCount)}. Paket hemat ini cocok bagi ${meta.audience} yang ingin pemanasan cepat dengan dukungan ${params.supportLevel.toLowerCase()}.`,
  },
  basic: {
    subtitle: (meta, params) => `Paket dasar ${params.accessLabel.toLowerCase()} dengan ritme belajar terarah.`,
    description: (meta, params) =>
      `Kombinasi ${params.tryoutCount} latihan ${params.tryoutVariant.toLowerCase()} dan ${formatQuestionCount(params.questionCount)} menjaga ${meta.audience} konsisten selama ${params.accessLabel.toLowerCase()}. Tracking mingguan dan feedback mentor dasar membantu progres tetap stabil.`,
  },
  regular: {
    subtitle: (meta, params) => `Program favorit dengan akses ${params.accessLabel.toLowerCase()} penuh.`,
    description: (meta, params) =>
      `${params.tryoutCount} latihan ${params.tryoutVariant.toLowerCase()} dipadukan dengan ${formatQuestionCount(params.questionCount)} dan dukungan ${params.supportLevel.toLowerCase()} memastikan ${meta.audience} siap menghadapi ${meta.examDescriptor} sepanjang tahun.`,
  },
  preExclusive: {
    subtitle: (meta, params) => `Jembatan menuju kelas eksklusif dengan coaching kisi-kisi ${params.accessLabel.toLowerCase()}.`,
    description: (meta, params) =>
      `Paket pra eksklusif memberikan ${params.tryoutCount} latihan eksklusif dan ${formatQuestionCount(params.questionCount)} soal premium plus coaching kisi-kisi. Ideal untuk ${meta.audience} yang ingin peningkatan signifikan dalam waktu singkat.`,
  },
  exclusive: {
    subtitle: (meta, params) => `Pendampingan intensif ${params.accessLabel.toLowerCase()} dengan kelas eksklusif.`,
    description: (meta, params) =>
      `Dirancang bagi ${meta.audience} yang mengejar skor tinggi. ${params.tryoutCount} latihan eksklusif, ${formatQuestionCount(params.questionCount)}, dan kelas live mingguan memastikan progres terukur selama ${params.accessLabel.toLowerCase()}.`,
  },
  platinum: {
    subtitle: (meta, params) => `Program premium ${params.accessLabel.toLowerCase()} lengkap dengan coaching lanjutan.`,
    description: (meta, params) =>
      `Level platinum menggabungkan ${params.tryoutCount} latihan eksklusif, ${formatQuestionCount(params.questionCount)}, dan coaching psikotes serta interview premium. Cocok untuk ${meta.audience} yang menyiapkan tahapan lanjutan seleksi.`,
  },
  ultimate: {
    subtitle: (meta, params) => `Pendampingan penuh hingga lulus dengan akses ${params.accessLabel.toLowerCase()}.`,
    description: (meta, params) =>
      `Ultimate hadir bagi pejuang serius: ${params.tryoutCount} latihan eksklusif, ${formatQuestionCount(params.questionCount)}, simulasi SKB, dan support prioritas memastikan setiap aspek persiapan ${meta.examDescriptor} tertangani.`,
  },
};

const baseFacilities = [
  "Ruang kelas dan area belajar + santai ber-AC dengan suasana nyaman.",
  "Snack & coffee corner lengkap beserta akses WiFi cepat dan Netflix.",
  "Kamar mandi bersih serta alat kebugaran ringan untuk menjaga stamina.",
  "Tutor pendamping dan konsultasi strategi belajar setiap hari.",
  "Modul online serta cetak yang selalu diperbarui sesuai kisi-kisi terbaru.",
  "Latihan soal dan simulasi terupdate lengkap dengan analisis skor otomatis.",
];

const tierSlugs: Record<TierKey, string> = {
  hemat: "hemat",
  basic: "basic",
  regular: "regular",
  preExclusive: "pre-exclusive",
  exclusive: "exclusive",
  platinum: "platinum",
  ultimate: "ultimate",
};

const categorySlugPrefix: Record<CategoryKey, string> = {
  cpnsS1S2: "cpns-s1s2",
  cpnsSmaD3: "cpns-sma-d3",
  kedinasan: "sekolah-kedinasan",
};

const categoryOrder: CategoryKey[] = ["cpnsS1S2", "cpnsSmaD3", "kedinasan"];
const tierOrder: TierKey[] = ["hemat", "basic", "regular", "preExclusive", "exclusive", "platinum", "ultimate"];

const formatQuestionCount = (count: number) => `${count}+ soal`;

type BuildFeaturesParams = {
  meta: CategoryMeta;
  tryoutCount: number;
  tryoutVariant: "Reguler" | "Exclusive";
  questionCount: number;
  accessLabel: string;
  additionalFeatures?: string[];
};

const buildFeatures = ({
  meta,
  tryoutCount,
  tryoutVariant,
  questionCount,
  accessLabel,
  additionalFeatures = [],
}: BuildFeaturesParams): string[] => {
  const variantDescriptor = tryoutVariant === "Exclusive" ? "eksklusif" : "reguler";
  const soalDescriptor = tryoutVariant === "Exclusive" ? "premium dengan pembahasan ahli" : "komprehensif siap pakai";
  const bedahDescriptor = tryoutVariant === "Exclusive" ? "mendalam" : "sistematis";

  return [
    `${tryoutCount} paket latihan ${meta.examDescriptor} ${variantDescriptor}.`,
    `+${questionCount} soal latihan ${soalDescriptor}.`,
    `Materi belajar ${variantDescriptor} lengkap dengan bedah soal ${bedahDescriptor}.`,
    meta.coreFeature,
    "Passing grade kelulusan terbaru berdasarkan aturan Menpan RB.",
    "Simulasi CAT mirip BKN lengkap dengan kisi-kisi SKD terbaru.",
    "Paket ujian 110 soal per paket latihan berikut raport hasil otomatis.",
    "Bisa dikerjakan ulang kapan saja dengan monitoring progres belajar.",
    `Masa aktif akses ${accessLabel}.`,
    ...additionalFeatures,
  ];
};

type BuildFacilitiesParams = {
  tier: TierKey;
  additionalFacilities?: string[];
};

const buildFacilities = ({ tier, additionalFacilities = [] }: BuildFacilitiesParams): string[] => [
  ...baseFacilities,
  ...additionalFacilities,
];

type BuildHighlightsParams = {
  accessLabel: string;
  tryoutCount: number;
  questionCount: number;
  supportLevel: string;
  additionalHighlights?: Array<{ title: string; value: string }>;
};

const buildHighlights = ({
  accessLabel,
  tryoutCount,
  questionCount,
  supportLevel,
  additionalHighlights = [],
}: BuildHighlightsParams): Array<{ title: string; value: string }> => [
  { title: "Durasi Akses", value: accessLabel },
  { title: "Jumlah Latihan", value: `${tryoutCount} Paket` },
  { title: "Bank Soal", value: `+${questionCount} Soal` },
  { title: "Pendampingan", value: supportLevel },
  ...additionalHighlights,
];

const slugFor = (categoryKey: CategoryKey, tier: TierKey) =>
  `${categorySlugPrefix[categoryKey]}-${tierSlugs[tier]}`;

const defaultTryoutDurationMinutes = 100;
const defaultLatihanDurationMinutes = 20;
const tierDiscountPercent: Record<TierKey, number> = {
  hemat: 35,
  basic: 35,
  regular: 40,
  preExclusive: 50,
  exclusive: 50,
  platinum: 50,
  ultimate: 50,
};

export const defaultPackages: SeedPackage[] = categoryOrder.flatMap((categoryKey) =>
  tierOrder.map((tier) => {
    const meta = categoryMeta[categoryKey];
    const label = tierLabels[tier];
    const price = tierPrices[tier];
    const durationDays = tierDurations[tier];
    const accessLabel = tierAccessLabels[tier];
    const tryoutCount = tierTryouts[tier];
    const questionCount = tierQuestionBank[tier];
    const tryoutVariant = tierVariants[tier];
    const supportLevel = tierSupport[tier];

    const copyParams: CopyParams = {
      accessLabel,
      tryoutCount,
      questionCount,
      tryoutVariant,
      supportLevel,
    };

    return {
      slug: slugFor(categoryKey, tier),
      title: `Paket ${meta.categoryName} ${label}`,
      subtitle: tierCopy[tier].subtitle(meta, copyParams),
      description: tierCopy[tier].description(meta, copyParams),
      category: meta.categoryName,
      level: tierLevels[tier],
      imageUrl: undefined,
      price,
      discountPercent: tierDiscountPercent[tier],
      durationDays,
      tryoutDurationMinutes: defaultTryoutDurationMinutes,
      latihanDurationMinutes: defaultLatihanDurationMinutes,
      badge: label,
      features: buildFeatures({
        meta,
        tryoutCount,
        tryoutVariant,
        questionCount,
        accessLabel,
        additionalFeatures: tierAdditionalFeatures[tier],
      }),
      whatsIncluded: buildFacilities({
        tier,
        additionalFacilities: tierAdditionalFacilities[tier],
      }),
      highlights: buildHighlights({
        accessLabel,
        tryoutCount,
        questionCount,
        supportLevel,
        additionalHighlights: tierAdditionalHighlights[tier],
      }),
    };
  })
);

export const baseQuestions: SeedQuestion[] = [
  {
    category: "TIU",
    subtestTitle: "TIU - Subtest Aritmatika",
    prompt:
      "Seorang siswa menyelesaikan 15 soal matematika dalam 30 menit. Jika ia ingin menyelesaikan 45 soal dengan kecepatan yang sama, berapa waktu tambahan yang dibutuhkan?",
    options: [
      { text: "30 menit" },
      { text: "45 menit" },
      { text: "60 menit" },
      { text: "75 menit" }
    ],
    answer: "60 menit",
    explanation:
      "Kecepatan siswa adalah 30 menit / 15 soal = 2 menit per soal. Untuk 45 soal membutuhkan 90 menit, sehingga tambahan waktunya 60 menit."
  },
  {
    category: "TWK",
    subtestTitle: "TWK - Subtest Nasionalisme",
    prompt:
      "Pemerintah mengusulkan anggaran pendidikan naik 12% dari Rp80 triliun. Berapa anggaran baru yang diusulkan?",
    options: [
      { text: "Rp85,6 triliun" },
      { text: "Rp88,0 triliun" },
      { text: "Rp89,6 triliun" },
      { text: "Rp92,4 triliun" }
    ],
    answer: "Rp89,6 triliun",
    explanation: "12% dari 80 adalah 9,6. 80 + 9,6 = 89,6 triliun."
  },
  {
    category: "TIU",
    subtestTitle: "TIU - Subtest Penalaran Logis",
    prompt:
      "Jika sebuah pernyataan logika berbentuk 'Jika A maka B' dan diketahui A salah, kesimpulan yang tepat adalah?",
    options: [
      { text: "B pasti benar" },
      { text: "B pasti salah" },
      { text: "Tidak dapat disimpulkan" },
      { text: "A dan B pasti salah" }
    ],
    answer: "Tidak dapat disimpulkan",
    explanation:
      "Dalam implikasi, ketika premis A salah, kesimpulan B bisa benar atau salah sehingga tidak dapat disimpulkan."
  },
  {
    category: "TKP",
    subtestTitle: "TKP - Subtest Pelayanan Publik",
    prompt:
      "Apa langkah pertama yang tepat ketika menghadapi konflik dengan rekan kerja?",
    options: [
      { text: "Mengabaikan konflik", score: 1 },
      { text: "Menyampaikan keluhan ke atasan", score: 3 },
      { text: "Membicarakan secara langsung dan terbuka", score: 5 },
      { text: "Mengumpulkan bukti sebanyak mungkin", score: 2 }
    ],
    answer: "Membicarakan secara langsung dan terbuka",
    explanation:
      "Pendekatan komunikasi langsung dan terbuka membantu menyelesaikan konflik secara efektif."
  },
  {
    category: "TIU",
    subtestTitle: "TIU - Subtest Numerik",
    prompt: "Berapa hasil dari 65% dari 320?",
    options: [{ text: "180" }, { text: "195" }, { text: "205" }, { text: "208" }],
    answer: "208",
    explanation: "65% dari 320 adalah 0,65 x 320 = 208."
  }
];
