import midtransClient from "midtrans-client";
import { env } from "../config/env";

export type SnapInstance = InstanceType<typeof midtransClient.Snap>;

let snapInstance: SnapInstance | null = null;

export const getSnapClient = () => {
  if (!env.MIDTRANS_SERVER_KEY) {
    return null;
  }

  if (!snapInstance) {
    snapInstance = new midtransClient.Snap({
      isProduction: env.MIDTRANS_IS_PRODUCTION,
      serverKey: env.MIDTRANS_SERVER_KEY,
      clientKey: env.MIDTRANS_CLIENT_KEY ?? ""
    });
  }

  return snapInstance;
};
