import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Instagram, LogIn, UserPlus, LogOut, LayoutDashboard } from "lucide-react";
import sagalaLogo from "@/assets/sagalalogo-fix.png";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AuthDialog } from "@/components/auth/AuthDialog";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<"login" | "register">("login");
  const { user, profile, signOut } = useAuthContext();
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      // Clear any Supabase stored tokens
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          // delay removal until after iteration to avoid index shift
        }
      }
      // Remove after collecting keys
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-") && (k.includes("-auth-token") || k.includes("-auth-refresh-token"))) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
    setIsMenuOpen(false);
    window.location.replace("/");
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const menuItems = [
    { name: "Home", href: "#home" },
    { name: "Paket", href: "#programs" },
    { name: "Kontak Kami", href: "#contact" },
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

          {/* Right side */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <>
                {profile?.role === "admin" && (
                  <Button variant="outline" size="sm" asChild className="transition-bounce active:scale-95">
                    <a href="/admin" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild className="hover-lift transition-bounce active:scale-95">
                  <a
                    href="https://www.instagram.com/sagala_bimbel/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Instagram className="h-4 w-4" /> Instagram
                  </a>
                </Button>
                <Button className="primary-gradient hover-lift transition-bounce active:scale-95" size="sm" asChild>
                  <a
                    href="https://wa.me/6283136485351?text=Hallo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20berkonsultasi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Phone className="h-4 w-4" /> Kontak
                  </a>
                </Button>
                <Button variant="ghost" size="sm" type="button" onMouseDown={handleLogout} onClick={handleLogout} className="text-destructive transition-bounce active:scale-95 pointer-events-auto cursor-pointer">
                  <LogOut className="h-4 w-4 mr-1" /> Keluar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="transition-bounce active:scale-95" onClick={() => { setAuthDefaultTab("login"); setAuthOpen(true); }}>
                  <LogIn className="h-4 w-4 mr-1" /> Masuk
                </Button>
                <Button size="sm" className="primary-gradient transition-bounce active:scale-95" onClick={() => { setAuthDefaultTab("register"); setAuthOpen(true); }}>
                  <UserPlus className="h-4 w-4 mr-1" /> Daftar
                </Button>
              </>
            )}
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
                {!user ? (
                  <>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { setAuthDefaultTab("login"); setAuthOpen(true); }}>
                      <LogIn className="h-4 w-4 mr-1" /> Masuk
                    </Button>
                    <Button className="primary-gradient w-full" size="sm" onClick={() => { setAuthDefaultTab("register"); setAuthOpen(true); }}>
                      <UserPlus className="h-4 w-4 mr-1" /> Daftar
                    </Button>
                  </>
                ) : (
                  <>
                    {profile?.role === "admin" && (
                      <Button variant="outline" size="sm" asChild className="transition-bounce active:scale-95">
                        <a href="/admin" className="w-full flex items-center justify-center gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" type="button" onMouseDown={handleLogout} onClick={handleLogout} className="text-destructive w-full transition-bounce active:scale-95 pointer-events-auto cursor-pointer">
                      <LogOut className="h-4 w-4 mr-1" /> Keluar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab={authDefaultTab} />
    </nav>
  );
};
