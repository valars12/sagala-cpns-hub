import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Instagram, Mail, MapPin, Clock, Users } from "lucide-react";
import sagalaLogo from "@/assets/sagalalogo-fix.png";

export const Footer = () => {
  const quickLinks = [
    { name: "Home", href: "#home" },
    { name: "Program CPNS", href: "#programs" },
    { name: "Program Kedinasan", href: "#programs" },
    { name: "Alumni", href: "#alumni" },
    { name: "Tentang Kami", href: "#about" }
  ];

  const programs = [
    "Program CPNS",
    "Program Kedinasan", 
    "Private Mentoring",
    "Try Out Online",
    "Bimbingan Khusus"
  ];

  const contactInfo = [
    {
      icon: Phone,
      label: "WhatsApp",
      value: "+62 831-3648-5351",
      href: "https://wa.me/6283136485351?text=Hallo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20berkonsultasi"
    },
    {
      icon: Instagram,
      label: "Instagram",
      value: "@sagala_bimbel",
      href: "https://www.instagram.com/sagala_bimbel/"
    },
    {
      icon: Mail,
      label: "Email",
      value: "info@sagalabimbel.com",
      href: "mailto:info@sagalabimbel.com"
    },
    {
      icon: MapPin,
      label: "Alamat",
      value: "Jakarta, Indonesia",
      href: "#"
    }
  ];

  return (
    <footer className="bg-card border-t border-border">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">
          {/* Brand Section */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <img src={sagalaLogo} alt="Sagala Bimbel" className="h-12 w-12" />
              <div>
                <h3 className="text-xl font-bold text-primary">SAGALA BIMBEL</h3>
                <p className="text-sm text-muted-foreground">Pejuang CPNS & Kedinasan</p>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Sagala Bimbel adalah partner terpercaya untuk mempersiapkan diri menghadapi 
              seleksi CPNS dan Kedinasan. Bersama kami, wujudkan impianmu menjadi abdi negara!
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span>500+ Alumni Sukses</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span>5 Tahun Pengalaman</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold">Link Cepat</h4>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-smooth"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Programs */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold">Program Kami</h4>
            <ul className="space-y-3">
              {programs.map((program, index) => (
                <li key={index} className="text-muted-foreground">
                  {program}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold">Hubungi Kami</h4>
            <div className="space-y-4">
              {contactInfo.map((contact, index) => (
                <div key={index} className="flex items-center gap-3">
                  <contact.icon className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{contact.label}</p>
                    <a 
                      href={contact.href}
                      target={contact.href.startsWith('http') ? '_blank' : undefined}
                      rel={contact.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-sm font-medium hover:text-primary transition-smooth truncate block"
                    >
                      {contact.value}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                className="w-full primary-gradient"
                asChild
              >
                <a
                  href="https://wa.me/6283136485351?text=Hallo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20berkonsultasi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <Phone className="h-4 w-4" />
                  Konsultasi WhatsApp
                </a>
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                asChild
              >
                <a
                  href="https://www.instagram.com/sagala_bimbel/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <Instagram className="h-4 w-4" />
                  Follow Instagram
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Bottom Footer */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 Sagala Bimbel. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-smooth">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-smooth">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-smooth">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
