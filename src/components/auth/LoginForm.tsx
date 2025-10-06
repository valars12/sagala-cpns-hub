import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const mapAuthError = (message: string) => {
  if (/Invalid login credentials/i.test(message)) return "Email atau kata sandi yang Anda masukkan belum tepat.";
  if (/Email not confirmed/i.test(message)) return "Email belum diverifikasi. Periksa kotak masuk Anda untuk konfirmasi.";
  if (/over request limit/i.test(message)) return "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";
  return message;
};

export const LoginForm = ({ onSuccess, onSwitchToRegister }: { onSuccess?: () => void; onSwitchToRegister?: () => void }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const payloadPassword = password.trim();

    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: payloadPassword });
    setLoading(false);

    if (error) {
      toast({ title: "Gagal masuk", description: mapAuthError(error.message), variant: "destructive" });
    } else {
      toast({ title: "Berhasil masuk", description: "Selamat datang kembali!" });
      setPassword("");
      onSuccess?.();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="nama@email.com" autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Kata Sandi</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Memproses..." : "Masuk"}
      </Button>
      <div className="text-center text-sm">
        Belum punya akun? {" "}
        <button type="button" className="text-primary underline" onClick={onSwitchToRegister}>
          Daftar sekarang
        </button>
      </div>
    </form>
  );
};
