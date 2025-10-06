import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, BookOpen, Users, Clock, Award } from "lucide-react";
import governmentOfficers from "@/assets/government-officers.jpg";
import paket1 from "@/assets/paket-1.jpg";
import { supabase } from "@/integrations/supabase/client";

type Program = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  duration: string | null;
  features: string[] | null;
  is_active: boolean | null;
};

const WHATSAPP_NUMBER = "6282137233397";
const WHATSAPP_BASE_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
const buildWhatsAppUrl = (programTitle?: string) => {
  const message = programTitle
    ? `Halo Sagala Bimbel, saya tertarik dengan program ${programTitle}.`
    : "Halo Sagala Bimbel, saya ingin berkonsultasi mengenai program belajar.";
  return `${WHATSAPP_BASE_URL}?text=${encodeURIComponent(message)}`;
};

const stats = [
  { icon: Users, number: "10,000+", label: "Pengguna" },
  { icon: BookOpen, number: "15,000+", label: "Soal" },
  { icon: Award, number: "20+", label: "Grup Belajar" },
  { icon: Clock, number: "5,000+", label: "Alumni" },
];

export const ProgramsSection = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Program | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("programs")
        .select("id,title,description,price,duration,features,is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Failed to load programs", fetchError);
        setError("Tidak dapat memuat daftar program. Silakan coba lagi nanti.");
        setPrograms([]);
      } else {
        setPrograms((data as Program[]) || []);
      }
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <section id="programs" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 fade-up">
          <Badge variant="outline" className="mb-4">
            Program Unggulan
          </Badge>
          <h2 className="text-4xl font-bold mb-4">
            Solusi Terbaik untuk Sukses di Setiap Seleksi!
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Pilih program yang sesuai dengan target kariermu. Setiap program dirancang khusus dengan metode pembelajaran yang
            terbukti efektif.
          </p>
        </div>

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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {loading && (
            <div className="col-span-full text-center text-muted-foreground">Memuat paket...</div>
          )}
          {error && !loading && (
            <div className="col-span-full text-center text-destructive">{error}</div>
          )}
          {!loading && !error && programs.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground">Belum ada paket yang aktif saat ini.</div>
          )}

          {programs.map((program, index) => {
            const formattedPrice =
              typeof program.price === "number"
                ? `Rp ${program.price.toLocaleString("id-ID")}`
                : "Hubungi Admin";
            const whatsappUrl = buildWhatsAppUrl(program.title || undefined);

            return (
              <Card
                key={program.id}
                className="relative overflow-hidden hover-lift transition-smooth fade-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="h-40 w-full overflow-hidden">
                  <img src={paket1} alt="Sampul Paket" className="w-full h-full object-cover" />
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">{program.title}</CardTitle>
                  <CardDescription>{program.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-2">
                    {(program.features || []).map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2 text-sm">
                        <span className="h-1.5 w-1.5 bg-primary rounded-full" aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="text-lg font-semibold">{formattedPrice}</div>
                    <Button
                      className="w-full primary-gradient"
                      onClick={() => {
                        setSelected(program);
                        setDetailsOpen(true);
                      }}
                    >
                      Lihat Detail Program
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2"
                      >
                        Konsultasi Program
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="relative rounded-2xl overflow-hidden fade-up">
          <div className="absolute inset-0">
            <img src={governmentOfficers} alt="Government Officers" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-primary/80" />
          </div>
          <div className="relative p-12 text-center text-white">
            <h3 className="text-3xl font-bold mb-4">Siap Menjadi Bagian dari Abdi Negara?</h3>
            <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
              Bergabunglah dengan ribuan pejuang lainnya yang telah memilih Sagala Bimbel sebagai partner menuju kesuksesan karier
              di pemerintahan.
            </p>
            <div className="flex justify-center">
              <a
                href={buildWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white text-primary font-semibold px-8 py-4 shadow-medium transition-smooth hover-lift hover:bg-white/90"
              >
                Konsultasi Gratis Sekarang
                <ArrowRight className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

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
                <div className="text-lg font-bold">
                  Harga: {typeof selected.price === "number" ? `Rp ${selected.price.toLocaleString("id-ID")}` : "Hubungi Admin"}
                </div>
                <Button className="w-full" asChild>
                  <a
                    href={buildWhatsAppUrl(selected.title || undefined)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    Konsultasi via WhatsApp
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

