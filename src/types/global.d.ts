declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: Record<string, unknown>) => void;
          onPending?: (result: Record<string, unknown>) => void;
          onError?: (error: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export {};
