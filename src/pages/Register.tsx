import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { Lock, Loader2, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import logo from "@/assets/sagalalogo-fix.png";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const normalizeUsernameInput = (value: string) => value.trim().toLowerCase();

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register: registerUser, isAuthenticating } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const redirectTo = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/dashboard";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const registerResult = await registerUser({
        username: normalizeUsernameInput(form.username),
        password: form.password,
      });

      if (registerResult.requiresValidation) {
        toast({
          title: "Pendaftaran berhasil",
          description:
            registerResult.message ??
            "Akun berhasil dibuat dan menunggu validasi admin sebelum bisa login.",
        });
        navigate("/login", { replace: true });
      } else {
        toast({
          title: "Pendaftaran berhasil",
          description: "Akunmu sudah aktif. Ayo mulai belajar!",
        });
        const defaultTarget =
          registerResult.user.role === "admin" || registerResult.user.role === "teacher"
            ? "/admin"
            : "/dashboard";
        navigate((location.state as { from?: { pathname: string } })?.from?.pathname ? redirectTo : defaultTarget, {
          replace: true,
        });
      }
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? "Tidak dapat membuat akun baru."
        : error instanceof Error
          ? error.message
          : "Terjadi kesalahan. Mohon coba lagi.";
      toast({ title: "Pendaftaran gagal", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_32%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--secondary)/0.16))] p-4">
      <div className="pointer-events-none absolute -left-24 bottom-10 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-14 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
      <Card className="relative w-full max-w-md overflow-hidden border border-primary/15 bg-card/95 shadow-2xl backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-accent" />
        <CardHeader className="pt-10 text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/10 to-secondary/15 p-5 shadow-xl">
              <img src={logo} alt="Sagala Bimbel Logo" className="h-20 w-20" />
            </div>
          </div>
          <CardTitle className="font-display text-3xl font-bold">
            Daftar <span className="text-primary">Sagala Bimbel</span>
          </CardTitle>
          <CardDescription className="text-base">
            Buat akun dengan username dan password saja.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <FormField
              label="Username"
              icon={User}
              placeholder="contoh: sagala123"
              value={form.username}
              onChange={(value) => setForm((prev) => ({ ...prev, username: value }))}
              autoComplete="username"
              minLength={3}
              required
            />
            <FormField
              label="Password"
              type="password"
              icon={Lock}
              placeholder="minimal 6 karakter"
              value={form.password}
              onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
              autoComplete="new-password"
              minLength={6}
              required
            />

            <Button type="submit" className="h-12 w-full text-base font-semibold shadow-xl" disabled={isAuthenticating}>
              {isAuthenticating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </span>
              ) : (
                "Daftar Sekarang"
              )}
            </Button>
          </form>

          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Masuk di sini
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const FormField = ({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  autoComplete,
  minLength,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) => (
  <div className="space-y-2">
    <label className="text-sm font-medium">{label}</label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize={type === "password" ? undefined : "none"}
        autoCorrect={type === "password" ? undefined : "off"}
        spellCheck={type === "password" ? undefined : false}
        className="h-12 pl-10"
      />
    </div>
  </div>
);

export default Register;
