import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Clock, Instagram, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const messageBody = `Halo Sagala Bimbel,%0A%0ASaya ${form.name} (${form.phone}) ingin berkonsultasi.%0A%0APesan:%0A${form.message}`;
    window.open(`https://wa.me/6282137233397?text=${messageBody}`, "_blank");
    toast({
      title: "Pesan terkirim",
      description: "Admin kami akan segera menghubungi Anda melalui WhatsApp.",
    });
    setForm({ name: "", phone: "", message: "" });
  };

  return (
    <section className="py-20" id="contact">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <Mail className="h-4 w-4" />
            <span className="text-sm font-medium">Hubungi Kami</span>
          </div>
          <h2 className="text-4xl font-bold">
            Siap Bergabung dengan <span className="text-primary">Sagala Bimbel</span>?
          </h2>
          <p className="mt-2 text-lg text-muted-foreground">
            Tim kami siap membantu konsultasi program dan proses pendaftaranmu.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
          <Card className="h-fit shadow-xl">
            <CardContent className="p-8 pb-7">
              <h3 className="mb-6 text-2xl font-bold">Kirim Pesan</h3>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <FormField
                  label="Nama Lengkap"
                  value={form.name}
                  onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                  placeholder="Masukkan nama lengkap"
                  required
                />
                <FormField
                  label="Nomor WhatsApp"
                  value={form.phone}
                  onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                  placeholder="08xxxxxxxxxx"
                  required
                />
                <div>
                  <label className="mb-2 block text-sm font-medium">Pesan</label>
                  <Textarea
                    required
                    placeholder="Ceritakan kebutuhan belajarmu..."
                    className="min-h-32"
                    value={form.message}
                    onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="flex w-full items-center justify-center gap-2 text-base">
                  <Send className="h-4 w-4" />
                  Kirim melalui WhatsApp
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <InfoCard
              icon={<MapPin className="h-6 w-6 text-primary" />}
              title="Alamat Kantor"
              description={
                <>
                  <p>Sagala Bimbel</p>
                  <p>Jakarta, Indonesia</p>
                  <Button variant="link" size="sm" className="px-0" asChild>
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=Sagala%20Bimbel%20Jakarta%20Indonesia"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Lihat di Google Maps
                    </a>
                  </Button>
                </>
              }
            />
            <InfoCard
              icon={<Phone className="h-6 w-6 text-primary" />}
              title="Telepon & WhatsApp"
              description={
                <>
                  <a
                    className="flex flex-wrap items-center gap-2 text-primary"
                    href="https://wa.me/6282137233397"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="min-w-[88px] font-semibold text-foreground">
                      WhatsApp
                    </span>
                    <span>+62 821-3723-3397</span>
                  </a>
                  <a
                    className="flex flex-wrap items-center gap-2 text-primary"
                    href="tel:+6282137233397"
                  >
                    <span className="min-w-[88px] font-semibold text-foreground">
                      Telepon
                    </span>
                    <span>+62 821-3723-3397</span>
                  </a>
                  <p className="text-sm text-muted-foreground">Aktif setiap hari 08.00 - 21.00 WIB</p>
                </>
              }
            />
            <InfoCard
              icon={<Mail className="h-6 w-6 text-primary" />}
              title="Email"
              description={
                <>
                  <a className="text-primary" href="mailto:sagala18@gmail.com">
                    sagala18@gmail.com
                  </a>
                </>
              }
            />
            <InfoCard
              icon={<Instagram className="h-6 w-6 text-primary" />}
              title="Instagram"
              description={
                <a className="text-primary" href="https://www.instagram.com/sagala_bimbel/" target="_blank" rel="noopener noreferrer">
                  @sagala_bimbel
                </a>
              }
            />
            <InfoCard
              icon={<Clock className="h-6 w-6 text-primary" />}
              title="Jam Operasional"
              description={
                <p>
                  Senin - Minggu<br />08.00 - 21.00 WIB
                </p>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const FormField = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) => (
  <div>
    <label className="mb-2 block text-sm font-medium">{label}</label>
    <Input
      type={type}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12"
    />
  </div>
);

const InfoCard = ({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: React.ReactNode;
}) => (
  <Card className="shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
    <CardContent className="flex items-start gap-4 p-5 sm:p-6">
      <div className="shrink-0 rounded-xl bg-primary/10 p-3">{icon}</div>
      <div className="min-w-0">
        <h4 className="mb-1.5 font-bold text-primary">{title}</h4>
        <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
      </div>
    </CardContent>
  </Card>
);

export default Contact;

