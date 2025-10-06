import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const ContactSection = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const wa = (text: string) => `https://wa.me/6282137233397?text=${encodeURIComponent(text)}`;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `Halo Sagala Bimbel, saya ${name} (${email}). Pesan: ${message}`;
    window.open(wa(text), "_blank");
  };

  return (
    <section id="contact" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Kontak Kami</h2>
          <p className="text-muted-foreground">Hubungi kami untuk konsultasi program</p>
        </div>
        <div className="flex justify-center">
          <form onSubmit={onSubmit} className="w-full max-w-2xl space-y-4 text-center">
            <div className="grid sm:grid-cols-2 gap-4 text-left">
              <div className="space-y-2">
                <Label>Nama</Label>
                <Input placeholder="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="email@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2 text-left">
              <Label>Pesan</Label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[120px] bg-background"
                placeholder="Tulis pesan"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center justify-center">
              <Button
                type="submit"
                className="primary-gradient transition-bounce active:scale-95 px-8"
                aria-label="Kirim pesan ke Sagala Bimbel melalui WhatsApp"
              >
                Kirim via WhatsApp
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

