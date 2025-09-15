import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Instagram } from "lucide-react";
import sagalaLogo from "@/assets/sagala-logo.png";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const menuItems = [
    { name: "Home", href: "#home" },
    { name: "Program", href: "#programs" },
    { name: "Alumni", href: "#alumni" },
    { name: "Tentang Kami", href: "#about" },
    { name: "Kontak", href: "#contact" },
  ];

  return (
    <nav className="fixed top-0 w-full bg-background/95 backdrop-blur-sm border-b border-border z-50 transition-smooth">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img src={sagalaLogo} alt="Sagala Bimbel" className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-bold text-primary">SAGALA BIMBEL</h1>
              <p className="text-xs text-muted-foreground">Pejuang CPNS & Kedinasan</p>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            {menuItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-foreground hover:text-primary transition-smooth font-medium"
              >
                {item.name}
              </a>
            ))}
          </div>

          {/* Contact Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hover-lift"
            >
              <a
                href="https://www.instagram.com/sagala_bimbel/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Instagram className="h-4 w-4" />
                Instagram
              </a>
            </Button>
            <Button
              className="primary-gradient hover-lift"
              size="sm"
              asChild
            >
              <a
                href="https://wa.me/6283136485351?text=Hallo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20berkonsultasi"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                Hubungi Kami
              </a>
            </Button>
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={toggleMenu}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {menuItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 text-foreground hover:text-primary transition-smooth font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="flex flex-col gap-2 px-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full"
                >
                  <a
                    href="https://www.instagram.com/sagala_bimbel/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <Instagram className="h-4 w-4" />
                    Instagram
                  </a>
                </Button>
                <Button
                  className="primary-gradient w-full"
                  size="sm"
                  asChild
                >
                  <a
                    href="https://wa.me/6283136485351?text=Hallo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20berkonsultasi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <Phone className="h-4 w-4" />
                    Hubungi Kami
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};