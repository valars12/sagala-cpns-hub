import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const useHashParams = (hash: string) =>
  useMemo(() => new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash), [hash]);

type Status = "processing" | "success" | "error";

const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useHashParams(location.hash);
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("Memverifikasi tautan...");

  useEffect(() => {
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      setStatus("error");
      setMessage(errorDescription || "Tautan verifikasi tidak valid atau sudah kedaluwarsa.");
      return;
    }

    const accessToken = params.get("access_token");
    const type = params.get("type");

    const finalize = async () => {
      setStatus("processing");
      setMessage(type === "recovery" ? "Menyiapkan pengaturan ulang kata sandi..." : "Menyelesaikan proses masuk...");

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && data.session) {
        setStatus("success");
        setMessage("Email berhasil terverifikasi. Anda akan diarahkan untuk masuk.");
        setTimeout(() => navigate("/?auth=login", { replace: true }), 1800);
      } else {
        setStatus("success");
        setMessage(
          type === "recovery"
            ? "Silakan lanjutkan pengaturan ulang kata sandi Anda."
            : "Email berhasil dikonfirmasi. Silakan masuk menggunakan akun Anda."
        );
      }
    };

    if (accessToken) {
      void finalize();
    } else if (!params.toString()) {
      setStatus("error");
      setMessage("Tidak ada informasi verifikasi yang diterima. Silakan minta tautan baru.");
    } else {
      setStatus("success");
      setMessage("Email berhasil dikonfirmasi. Silakan masuk ke akun Anda.");
    }

    if (typeof window !== "undefined") {
      window.location.hash = "";
    }
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="max-w-md w-full bg-background border border-border rounded-2xl shadow-lg p-8 text-center space-y-4">
        {status === "processing" && <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />}
        {status === "success" && <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />}
        {status === "error" && <XCircle className="h-10 w-10 mx-auto text-destructive" />}

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {status === "processing" ? "Memproses Verifikasi" : status === "success" ? "Verifikasi Berhasil" : "Verifikasi Gagal"}
          </h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate("/", { replace: true })}>
            Ke Beranda
          </Button>
          <Button onClick={() => navigate("/?auth=login", { replace: true })}>Buka Halaman Masuk</Button>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
