declare module "midtrans-client" {
  interface SnapOptions {
    isProduction?: boolean;
    serverKey: string;
    clientKey?: string;
  }

  interface TransactionDetails {
    order_id: string;
    gross_amount: number;
  }

  interface ItemDetail {
    id: string;
    price: number;
    quantity: number;
    name: string;
    category?: string;
  }

  interface CustomerDetail {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  }

  interface TransactionPayload {
    transaction_details: TransactionDetails;
    item_details?: ItemDetail[];
    customer_details?: CustomerDetail;
    credit_card?: Record<string, unknown>;
    enabled_payments?: string[];
  }

  class Snap {
    constructor(options: SnapOptions);
    createTransaction(payload: TransactionPayload): Promise<{
      token: string;
      redirect_url: string;
    }>;
  }

  interface MidtransClient {
    Snap: typeof Snap;
  }

  const midtransClient: MidtransClient;

  export { Snap, SnapOptions, TransactionPayload, MidtransClient };
  export default midtransClient;
}
