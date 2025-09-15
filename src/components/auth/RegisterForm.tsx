import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type Props = { onSuccess?: () => void; onSwitchToLogin?: () => void };

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Sign up with email verification; store metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone, nickname, province, city },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast({ title: "Pendaftaran gagal", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Update profile table with extra fields (trigger inserts basic profile)
    const uid = data.user?.id;
    if (uid) {
      await supabase.from("profiles").update({
        full_name: fullName,
        email,
        phone,
        nickname,
        province,
        city,
      }).eq("user_id", uid);
    }

    setLoading(false);
    toast({
      title: "Pendaftaran berhasil",
      description: "Cek email Anda untuk verifikasi dan kode autentikasi.",
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
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
