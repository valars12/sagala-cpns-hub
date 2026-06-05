export const PURCHASE_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  EXPIRED: "EXPIRED",
  CANCELED: "CANCELED"
} as const;

export type PurchaseStatus =
  (typeof PURCHASE_STATUS)[keyof typeof PURCHASE_STATUS];
