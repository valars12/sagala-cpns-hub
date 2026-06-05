import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  GraduationCap,
  UserCircle,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/sagalalogo-fix.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = useMemo(
    () => [
      { name: "Beranda", path: "/" },
      { name: "Tryout", path: "/programs" },
      { name: "Tentang Kami", path: "/about" },
      { name: "Kontak", path: "/contact" },
    ],
    []
  );

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Berhasil keluar",
      description: "Sampai jumpa di sesi belajar berikutnya!",
    });
    navigate("/");
    setIsOpen(false);
  };

  const initials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const staffPanelLabel = user?.role === "teacher" ? "Teacher" : "Admin";

  return (
    <nav
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        isScrolled
          ? "bg-card/90 shadow-lg backdrop-blur"
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-lg">
              <img src={logo} alt="Sagala Bimbel" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <p className="text-xl font-bold text-primary">Sagala Bimbel</p>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Bimbingan Kedinasan & CPNS
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "relative text-sm font-semibold transition-all",
                  "after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300",
                  isActive(link.path)
                    ? "text-primary after:scale-x-100"
                    : "text-foreground hover:text-primary hover:after:scale-x-100"
                )}
              >
                {link.name}
              </Link>
            ))}
            {user && (
              <Link
                to="/dashboard"
                className={cn(
                  "relative text-sm font-semibold transition-all",
                  "after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300",
                  isActive("/dashboard")
                    ? "text-primary after:scale-x-100"
                    : "text-foreground hover:text-primary hover:after:scale-x-100"
                )}
              >
                Dashboard
              </Link>
            )}
            {(user?.role === "admin" || user?.role === "teacher") && (
              <Link
                to="/admin"
                className={cn(
                  "relative text-sm font-semibold transition-all",
                  "after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300",
                  isActive("/admin")
                    ? "text-primary after:scale-x-100"
                    : "text-foreground hover:text-primary hover:after:scale-x-100"
                )}
              >
                {staffPanelLabel}
              </Link>
            )}
            {!user ? (
              <div className="flex items-center gap-3">
                <Button asChild variant="ghost">
                  <Link to="/login">Masuk</Link>
                </Button>
                <Button asChild className="shadow-lg">
                  <Link to="/register">Daftar</Link>
                </Button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1.5 shadow-sm transition hover:border-primary/40">
                    <Avatar className="h-9 w-9 border border-primary/20">
                      <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                      <AvatarFallback>{initials || "AA"}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-primary">
                        {user.name.split(" ")[0]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.role === "admin"
                          ? "Admin Sagala Bimbel"
                          : user.role === "teacher"
                            ? "Teacher Sagala Bimbel"
                            : "Siswa Aktif"}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {(user.role === "admin" || user.role === "teacher") && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> Panel {staffPanelLabel}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/programs" className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" /> Tryout
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout} className="flex items-center gap-2 text-red-500">
                    <LogOut className="h-4 w-4" /> Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <button
            className="rounded-lg p-2 transition hover:bg-muted md:hidden"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden">
            <div className="space-y-3 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "block rounded-xl px-4 py-3 text-sm font-medium transition",
                    isActive(link.path)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </Link>
              ))}

              {user && (
                <Link
                  to="/dashboard"
                  className={cn(
                    "block rounded-xl px-4 py-3 text-sm font-medium transition",
                    isActive("/dashboard")
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  Dashboard
                </Link>
              )}
              {(user?.role === "admin" || user?.role === "teacher") && (
                <Link
                  to="/admin"
                  className={cn(
                    "block rounded-xl px-4 py-3 text-sm font-medium transition",
                    isActive("/admin")
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  Panel {staffPanelLabel}
                </Link>
              )}

              {!user ? (
                <div className="grid gap-2 pt-2">
                  <Button asChild variant="ghost" className="w-full" onClick={() => setIsOpen(false)}>
                    <Link to="/login">Masuk</Link>
                  </Button>
                  <Button asChild className="w-full" onClick={() => setIsOpen(false)}>
                    <Link to="/register">Daftar Sekarang</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 pt-2">
                  <Button asChild variant="outline" className="w-full" onClick={() => setIsOpen(false)}>
                    <Link to="/programs" className="flex items-center justify-center gap-2">
                      <PlusCircle className="h-4 w-4" /> Tambah Paket
                    </Link>
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> Keluar
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
