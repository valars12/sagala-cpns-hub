import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { Lock, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logo from "@/assets/sagalalogo-fix.png";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";

type DeviceConflictPayload = {
  message?: string;
  code?: string;
  activeSession?: {
    deviceLabel?: string;
    startedAt?: string;
  };
};

type SessionConflictState = {
  message: string;
  activeDeviceLabel?: string;
  activeSessionStartedAt?: string;
};

const normalizeUsernameInput = (value: string) => value.trim().toLowerCase();

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticating } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", password: "" });
  const [sessionConflict, setSessionConflict] =
    useState<SessionConflictState | null>(null);

  const redirectState = (location.state as { from?: Location })?.from;
  const redirectTo = redirectState
    ? `${redirectState.pathname}${redirectState.search ?? ""}`
    : "/dashboard";

  const parseDeviceConflict = (error: unknown): SessionConflictState | null => {
    if (!isAxiosError(error) || error.response?.status !== 409) return null;

    const payload = error.response?.data as DeviceConflictPayload | undefined;
    if (!payload || payload.code !== "DEVICE_CONFLICT") return null;

    return {
      message:
        payload.message ??
        "Akun sedang aktif di perangkat lain. Pilih aksi untuk melanjutkan.",
      activeDeviceLabel: payload.activeSession?.deviceLabel,
      activeSessionStartedAt: payload.activeSession?.startedAt,
    };
  };

  const formatConflictTime = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resolveRedirectTarget = (role?: string) => {
    if (redirectState) return redirectTo;
    return role === "admin" || role === "teacher" ? "/admin" : "/dashboard";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const loggedInUser = await login({
        username: normalizeUsernameInput(form.username),
        password: form.password,
      });
      toast({
        title: "Selamat datang kembali!",
        description: "Ayo lanjutkan perjalanan belajarmu.",
      });
      navigate(resolveRedirectTarget(loggedInUser.role), { replace: true });
    } catch (error) {
      const conflict = parseDeviceConflict(error);
      if (conflict) {
        setSessionConflict(conflict);
        return;
      }
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Username atau password tidak valid."
        : error instanceof Error
          ? error.message
          : "Terjadi kesalahan. Mohon coba lagi.";
      toast({ title: "Gagal masuk", description: message, variant: "destructive" });
    }
  };

  const handleTakeoverSession = async () => {
    if (!sessionConflict) return;

    try {
      const loggedInUser = await login({
        username: normalizeUsernameInput(form.username),
        password: form.password,
        forceLogin: true,
      });

      toast({
        title: "Perangkat sebelumnya dikeluarkan",
        description: "Sesi sekarang aktif di perangkat ini.",
      });
      setSessionConflict(null);
      navigate(resolveRedirectTarget(loggedInUser.role), { replace: true });
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Gagal mengambil alih sesi."
        : error instanceof Error
          ? error.message
          : "Gagal mengambil alih sesi.";
      toast({
        title: "Gagal melanjutkan login",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--secondary)/0.22),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--primary)/0.08))] p-4">
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
      <Card className="relative w-full max-w-md overflow-hidden border border-primary/15 bg-card/95 shadow-2xl backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
        <CardHeader className="pt-10 text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/10 to-secondary/15 p-5 shadow-xl">
              <img src={logo} alt="Sagala Bimbel Logo" className="h-20 w-20" />
            </div>
          </div>
          <CardTitle className="font-display text-3xl font-bold">
            Masuk ke <span className="text-primary">Sagala Bimbel</span>
          </CardTitle>
          <CardDescription className="text-base">
            Gunakan username dan password untuk mengakses paket belajar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="login-username">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-username"
                  name="username"
                  type="text"
                  required
                  minLength={3}
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="contoh: sagala123"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-12 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="********"
                  autoComplete="current-password"
                  className="h-12 pl-10"
                />
              </div>
            </div>

            <Button type="submit" className="h-12 w-full text-base font-semibold shadow-xl" disabled={isAuthenticating}>
              {isAuthenticating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sedang masuk...
                </span>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>

          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 text-center text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Daftar dengan username
            </Link>
          </div>
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(sessionConflict)}
        onOpenChange={(open) => {
          if (!open) setSessionConflict(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Perangkat Lain Terdeteksi</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block">
                {sessionConflict?.message ??
                  "Akun ini sedang dipakai di perangkat lain."}
              </span>
              {sessionConflict?.activeDeviceLabel ? (
                <span className="block text-xs">
                  Perangkat aktif: <strong>{sessionConflict.activeDeviceLabel}</strong>
                </span>
              ) : null}
              {formatConflictTime(sessionConflict?.activeSessionStartedAt) ? (
                <span className="block text-xs">
                  Login sejak:{" "}
                  <strong>
                    {formatConflictTime(sessionConflict?.activeSessionStartedAt)}
                  </strong>
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSessionConflict(null)}
            >
              Keluar
            </Button>
            <Button type="button" onClick={() => void handleTakeoverSession()}>
              Tetap di sini
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
