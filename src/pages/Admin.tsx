import { useEffect, useMemo, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Navigation } from "@/components/ui/navigation";
import { Footer } from "@/components/sections/footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

type Program = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  duration: string | null;
  features: string[] | null;
  is_active: boolean | null;
};

const Admin = () => {
  const { user, profile } = useAuthContext();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = useMemo(() => profile?.role === "admin", [profile]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from("programs").select("*").order("created_at", { ascending: false });
    setPrograms((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const onAddProgram = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget as any;
    const title = form.title.value as string;
    const price = parseFloat(form.price.value);
    const type = form.type.value as string; // CPNS/Kedinasan
    const duration = form.duration.value as string;
    const description = form.description.value as string;
    const features = (form.features.value as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    const { error } = await supabase.from("programs").insert({
      title: `${title} (${type})`,
      price,
      duration,
      description,
      features,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Gagal menambahkan program", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Program ditambahkan" });
      (e.target as HTMLFormElement).reset();
      await loadData();
    }
  };

  const toggleActive = async (p: Program) => {
    const { error } = await supabase.from("programs").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) toast({ title: "Gagal memperbarui", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Berhasil diperbarui" });
      await loadData();
    }
  };

  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-24 pb-16 space-y-10">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Tambah Program/Paket</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onAddProgram}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Judul Paket</Label>
                    <Input id="title" placeholder="CPNS Intensif" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Kategori</Label>
                    <Input id="type" placeholder="CPNS/Kedinasan" required />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Harga (Rp)</Label>
                    <Input id="price" type="number" min="0" step="1000" required />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="duration">Durasi</Label>
                    <Input id="duration" placeholder="3 Bulan" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Input id="description" placeholder="Deskripsi singkat paket" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="features">Fitur (pisah dengan koma)</Label>
                  <Input id="features" placeholder="Video, Bank Soal, Tryout, Grup Diskusi" />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan Program"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistik Singkat</CardTitle>
            </CardHeader>
            <CardContent>
              {/* In a real app, query counts with supabase.rpc or select().limit */}
              <p className="text-muted-foreground">Pantau program, pendaftaran, dan pembayaran.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Program</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Memuat...</div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {programs.map((p) => (
                  <div key={p.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{p.title}</div>
                        <div className="text-sm text-muted-foreground">{p.duration}</div>
                      </div>
                      {p.is_active ? (
                        <Badge>Aktif</Badge>
                      ) : (
                        <Badge variant="outline">Nonaktif</Badge>
                      )}
                    </div>
                    <div className="text-sm">Rp {p.price.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground line-clamp-3">{p.description}</div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(p)}>
                        {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;

