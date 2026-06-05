import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Instagram, Mail, MapPin, Phone, MessageCircle, ExternalLink } from "lucide-react";
import logo from "@/assets/sagalalogo-fix.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="group mb-4 flex items-center gap-3">
              <img
                src={logo}
                alt="Sagala Bimbel Logo"
                className="h-12 w-12 rounded-xl border border-primary/20 bg-white p-1 shadow-lg transition group-hover:scale-105"
              />
              <span className="text-xl font-bold text-primary transition group-hover:text-primary/80">
                Sagala Bimbel
              </span>
            </Link>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Bimbingan kedinasan &amp; CPNS terpercaya dengan kurikulum adaptif, latihan berkala, dan monitoring progres real-time.
            </p>
            <div className="flex gap-3">
              <SocialLink href="https://wa.me/6282137233397">
                <MessageCircle className="h-5 w-5" />
              </SocialLink>
              <SocialLink href="https://www.instagram.com/sagala_bimbel/">
                <Instagram className="h-5 w-5" />
              </SocialLink>
              <SocialLink href="mailto:sagala18@gmail.com">
                <Mail className="h-5 w-5" />
              </SocialLink>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Navigasi</h3>
            <ul className="space-y-2">
              <li>
                <FooterLink to="/">Beranda</FooterLink>
              </li>
              <li>
                <FooterLink to="/programs">Tryout</FooterLink>
              </li>
              <li>
                <FooterLink to="/about">Tentang Kami</FooterLink>
              </li>
              <li>
                <FooterLink to="/contact">Kontak</FooterLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Program Unggulan</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <FooterLink to="/packages/cpns-s1s2-regular">CPNS S1/S2 Reguler</FooterLink>
              </li>
              <li>
                <FooterLink to="/packages/cpns-sma-d3-exclusive">CPNS SMA/D3 Exclusive</FooterLink>
              </li>
              <li>
                <FooterLink to="/packages/sekolah-kedinasan-ultimate">Sekolah Kedinasan Ultimate</FooterLink>
              </li>
              <li>
                <FooterLink to="/programs">Konsultasi Belajar</FooterLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Kontak</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <span>
                  Sagala Bimbel
                  <br />
                  Jakarta, Indonesia
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Sagala%20Bimbel%20Jakarta%20Indonesia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Lihat Maps
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 text-primary" />
                <span className="space-x-2">
                  <a
                    href="https://wa.me/6282137233397"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    WhatsApp
                  </a>
                  <span>/</span>
                  <a href="tel:+6282137233397" className="text-primary hover:underline">
                    Telepon +62 821-3723-3397
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <a href="mailto:sagala18@gmail.com" className="text-primary hover:underline">
                  sagala18@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
            <p>@ {currentYear} Sagala Bimbel. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="#" className="hover:text-primary">
                Kebijakan Privasi
              </Link>
              <Link to="#" className="hover:text-primary">
                Syarat &amp; Ketentuan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

const SocialLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="rounded-xl bg-primary/10 p-3 text-primary shadow-md transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:bg-primary/20 hover:shadow-lg"
  >
    {children}
  </a>
);

const FooterLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="text-sm text-muted-foreground transition-colors hover:text-primary">
    {children}
  </Link>
);

export default Footer;

