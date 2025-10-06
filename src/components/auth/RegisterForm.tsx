import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type Props = { onSuccess?: () => void; onSwitchToLogin?: () => void };

const resolveRedirectUrl = () => {
  const configured = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim();
  const base = configured && configured.length > 0
    ? configured
    : typeof window !== "undefined"
      ? window.location.origin
      : "";
  if (!base) return "/auth/callback";
  return `${base.replace(/\/$/, "")}/auth/callback`;
};

export const RegisterForm = ({ onSuccess, onSwitchToLogin }: Props) => {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRedirectTo = useMemo(resolveRedirectUrl, []);

  const clearForm = () => {
    setFullName("");
    setNickname("");
    setEmail("");
    setPhone("");
    setProvince("");
    setCity("");
    setPassword("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const payloadPassword = password.trim();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: payloadPassword,
      options: {
        data: { full_name: fullName.trim(), phone: phone.trim(), nickname: nickname.trim(), province: province.trim(), city: city.trim() },
        emailRedirectTo,
      },
    });

    if (error) {
      toast({ title: "Pendaftaran gagal", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const uid = data.user?.id;
    if (uid) {
      await supabase
        .from("profiles")
        .upsert({
          user_id: uid,
          full_name: fullName.trim(),
          email: normalizedEmail,
          phone: phone.trim(),
          nickname: nickname.trim(),
          province: province.trim(),
          city: city.trim(),
        }, { onConflict: "user_id" });
    }

    setLoading(false);
    clearForm();
    toast({
      title: "Pendaftaran berhasil",
      description: "Cek email Anda dan klik tautan verifikasi untuk mengaktifkan akun.",
    });
    onSuccess?.();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nama Lengkap</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nickname">Nama Panggilan</Label>
          <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Nomor HP</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="province">Provinsi</Label>
          <Input id="province" value={province} onChange={(e) => setProvince(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Kota/Kabupaten</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Kata Sandi</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Memproses..." : "Daftar"}
      </Button>
      <div className="text-center text-sm">
        Sudah punya akun? {" "}
        <button type="button" className="text-primary underline" onClick={onSwitchToLogin}>
          Masuk sekarang
        </button>
      </div>
    </form>
  );
};
