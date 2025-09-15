import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight, BookOpen, Users, Clock, Award, CheckCircle2 } from "lucide-react";
import governmentOfficers from "@/assets/government-officers.jpg";
import paket1 from "@/assets/paket-1.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuthContext } from "@/contexts/AuthContext";
import { AuthDialog } from "@/components/auth/AuthDialog";

type Program = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  duration: string | null;
  features: string[] | null;
  is_active: boolean | null;
};

export const ProgramsSection = () => {
  const { toast } = useToast();
  const { user, profile } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<"login" | "register">("register");

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Program | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("ewallet");
  const [creating, setCreating] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const env = import.meta.env as unknown as { VITE_MIDTRANS_CLIENT_KEY?: string; VITE_MIDTRANS_IS_PRODUCTION?: string };
  const midtransClientKey = env?.VITE_MIDTRANS_CLIENT_KEY;
  const midtransIsProd = (env?.VITE_MIDTRANS_IS_PRODUCTION || "false").toLowerCase() === 'true';

  type Snap = {
    pay: (
      token: string,
      options?: {
        onSuccess?: (result: unknown) => void;
        onPending?: (result: unknown) => void;
        onError?: (error: unknown) => void;
        onClose?: () => void;
      }
    ) => void;
  };
  declare global { interface Window { snap?: Snap } }

  const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

  const loadSnap = async () => {
    if (window.snap) return;
    const script = document.createElement('script');
    script.src = midtransIsProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
    if (midtransClientKey) script.setAttribute('data-client-key', midtransClientKey);
    document.body.appendChild(script);
    await new Promise((resolve) => {
      script.onload = resolve;
    });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("programs")
        .select("id,title,description,price,duration,features,is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!error) setPrograms((data as Program[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const stats = [
    { icon: Users, number: "10,000+", label: "Pengguna" },
    { icon: BookOpen, number: "15,000+", label: "Soal" },
    { icon: Award, number: "20+", label: "Grup Belajar" },
    { icon: Clock, number: "5,000+", label: "Alumni" }
  ];

  return (
    <section id="programs" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16 fade-up">
          <Badge variant="outline" className="mb-4">Program Unggulan</Badge>
          <h2 className="text-4xl font-bold mb-4">
            Solusi Terbaik untuk Sukses di Setiap Seleksi! 🚀
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Pilih program yang sesuai dengan target kariermu. Setiap program dirancang 
            khusus dengan metode pembelajaran yang terbukti efektif.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 fade-up fade-up-delay-1">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center hover-lift transition-smooth">
              <CardContent className="pt-6">
                <div className="h-12 w-12 mx-auto mb-4 bg-primary/10 rounded-lg flex items-center justify-center">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-3xl font-bold text-primary mb-2">{stat.number}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Programs Grid (dynamic) */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {loading && <div>Memuat paket...</div>}
          {!loading && programs.length === 0 && <div>Tidak ada paket aktif.</div>}
          {programs.map((program, index) => (
            <Card key={program.id} className={`relative overflow-hidden hover-lift transition-smooth fade-up`} style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="h-40 w-full overflow-hidden">
                <img src={paket1} alt="Sampul Paket" className="w-full h-full object-cover" />
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">{program.title}</CardTitle>
                <CardDescription>
                  {program.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-2">
                  {(program.features || []).map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 bg-primary rounded-full"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border pt-4">
                  <div className="text-lg font-semibold mb-4">Rp {program.price.toLocaleString()}</div>
                  <div className="flex gap-2">
                    <Button className="primary-gradient text-white flex-1" onClick={() => { setSelected(program); setDetailsOpen(true); }}>
                      Beli Paket <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="relative rounded-2xl overflow-hidden fade-up">
          <div className="absolute inset-0">
            <img 
              src={governmentOfficers}
              alt="Government Officers"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-primary/80"></div>
          </div>
          <div className="relative p-12 text-center text-white">
            <h3 className="text-3xl font-bold mb-4">
              Siap Menjadi Bagian dari Abdi Negara?
            </h3>
            <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
              Bergabunglah dengan ribuan pejuang lainnya yang telah memilih Sagala Bimbel 
              sebagai partner menuju kesuksesan karier di pemerintahan.
            </p>
            <Button 
              size="lg"
              className="bg-white text-primary hover:bg-white/90 transition-smooth shadow-medium text-lg px-8 py-6 hover-lift"
              asChild
            >
              <a 
                href="https://wa.me/6283136485351?text=Hallo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20konsultasi%20program"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                Konsultasi Gratis Sekarang
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Paket</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3">
                <div className="text-xl font-semibold">{selected.title}</div>
                <div className="text-muted-foreground">{selected.description}</div>
                <div className="text-sm">Durasi: {selected.duration || "-"}</div>
                <Separator />
                <div>
                  <div className="font-medium mb-2">Fitur:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {(selected.features || []).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
                <div className="text-lg font-bold">Harga: Rp {selected.price.toLocaleString()}</div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>Tutup</Button>
              <Button onClick={() => { setDetailsOpen(false); setCheckoutOpen(true); }}>Beli Sekarang</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Checkout Dialog */}
        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Checkout</DialogTitle>
            </DialogHeader>
            {!user ? (
              <div className="space-y-3">
                <p className="text-muted-foreground">Silakan masuk atau daftar untuk melanjutkan pembelian.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setAuthDefaultTab("login"); setAuthOpen(true); }}>Masuk</Button>
                  <Button className="primary-gradient" onClick={() => { setAuthDefaultTab("register"); setAuthOpen(true); }}>Daftar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border p-3">
                  <div className="font-medium mb-1">Metode Pembayaran</div>
                  <RadioGroup value={payMethod} onValueChange={setPayMethod} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex items-center space-x-2 border rounded-md p-2">
                      <RadioGroupItem value="ewallet" id="pay-ewallet" />
                      <Label htmlFor="pay-ewallet">E-Wallet</Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-md p-2">
                      <RadioGroupItem value="bank" id="pay-bank" />
                      <Label htmlFor="pay-bank">Transfer Bank</Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-md p-2">
                      <RadioGroupItem value="qris" id="pay-qris" />
                      <Label htmlFor="pay-qris">QRIS</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="text-sm text-muted-foreground">
                  Setelah pembayaran, klik tombol "Tandai Sudah Bayar". Paket akan aktif dan konfirmasi akan dikirim ke email Anda.
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Batal</Button>
                  <Button disabled={creating} onClick={async () => {
                    if (!selected || !user) return;
                    setCreating(true);
                    try {
                      let eid = enrollmentId;
                      if (!eid) {
                        const { data, error } = await supabase
                          .from("enrollments")
                          .insert({ user_id: user.id, program_id: selected.id, status: "pending", payment_status: "pending" })
                          .select("id")
                          .single();
                        if (error) throw error;
                        eid = data?.id as string;
                        setEnrollmentId(eid);
                      }
                      // Create Midtrans Snap transaction
                      const { data: trx, error: trxErr } = await supabase.functions.invoke<{ token?: string; redirectUrl?: string }>("midtrans-create-transaction", {
                        body: {
                          enrollmentId: eid,
                          programId: selected.id,
                          amount: selected.price,
                          preferred_method: payMethod,
                          customer: { name: profile?.full_name, email: profile?.email, phone: profile?.phone },
                        },
                      });
                      if (trxErr) throw trxErr;
                      const token = trx?.token;
                      const redirectUrl = trx?.redirectUrl;
                      if (!token && redirectUrl) {
                        window.location.href = redirectUrl;
                        return;
                      }
                      if (!token) throw new Error("Token transaksi tidak tersedia");
                      await loadSnap();
                      window.snap?.pay(token, {
                        onSuccess: () => {
                          toast({ title: "Pembayaran berhasil", description: "Paket akan aktif setelah konfirmasi." });
                          setCheckoutOpen(false);
                        },
                        onPending: () => {
                          toast({ title: "Menunggu pembayaran", description: "Selesaikan proses pembayaran Anda." });
                        },
                        onError: (err: unknown) => {
                          console.error(err);
                          toast({ title: "Terjadi kesalahan", description: errorMessage(err), variant: "destructive" });
                        },
                        onClose: () => {
                          // user closed popup
                        },
                      });
                    } catch (e: unknown) {
                      toast({ title: "Gagal membuat pesanan", description: errorMessage(e), variant: "destructive" });
                    } finally {
                      setCreating(false);
                    }
                  }}>
                    Lanjutkan Pembayaran
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Pembayaran via e-wallet, transfer bank/VA, dan QRIS didukung (Midtrans Snap).
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Local Auth Dialog */}
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab={authDefaultTab} />
      </div>
    </section>
  );
};
