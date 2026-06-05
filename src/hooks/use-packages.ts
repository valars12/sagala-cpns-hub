import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";
import type { PackageListResponse } from "@/types";

export const usePackages = () =>
  useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data } = await api.get<unknown>("/api/packages");

      if (
        !data ||
        typeof data !== "object" ||
        !("data" in data) ||
        !Array.isArray((data as PackageListResponse).data)
      ) {
        throw new Error(
          "Backend belum mengembalikan format paket yang benar. Periksa VITE_API_URL dan backend."
        );
      }

      return (data as PackageListResponse).data;
    },
    retry: 1,
  });
