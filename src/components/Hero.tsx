import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Users, Award } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";
import { useAuth } from "@/context/AuthContext";

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleFeatureShortcut = (focus: "modules" | "tryouts") => {
    if (!user) {
      navigate("/login", {
        state: {
          from: {
            pathname: "/dashboard",
            search: `?focus=${focus}`
          }
        }
      });
      return;
    }
    navigate(`/dashboard?focus=${focus}`);
  };

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Students Learning" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/90 to-background/70" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-5 py-2.5 rounded-full mb-6 animate-bounce-in shadow-lg">
              <Award className="h-5 w-5 animate-pulse-soft" />
              <span className="text-sm font-semibold">Bimbingan CPNS & Kedinasan Terpercaya</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-extrabold mb-6 leading-tight">
              Wujudkan Target Seleksi{" "}
              <span className="bg-gradient-to-r from-primary via-secondary to-secondary bg-clip-text text-transparent animate-shimmer bg-[length:200%_auto]">
                Terbaikmu
              </span>
            </h1>

            <p className="text-xl lg:text-2xl text-muted-foreground mb-10 leading-relaxed">
              Bergabunglah dengan Sagala Bimbel untuk persiapan CPNS dan Kedinasan yang terarah,
              lengkap dengan tryout, bank soal, materi, dan pendampingan mentor.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link to="/programs">
                <Button size="lg" className="group text-lg shadow-xl hover:shadow-2xl">
                  Lihat Program
                  <ArrowRight className="ml-2 h-5 w-5 transition-all duration-300 group-hover:translate-x-2" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline" className="text-lg shadow-md hover:shadow-xl">
                  Hubungi Kami
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center group cursor-default">
                <div className="text-4xl font-bold text-secondary mb-2 transition-all duration-300 group-hover:scale-110">500+</div>
                <div className="text-sm text-muted-foreground font-medium">Peserta Aktif</div>
              </div>
              <div className="text-center group cursor-default">
                <div className="text-4xl font-bold text-secondary mb-2 transition-all duration-300 group-hover:scale-110">50+</div>
                <div className="text-sm text-muted-foreground font-medium">Tryout & Modul</div>
              </div>
              <div className="text-center group cursor-default">
                <div className="text-4xl font-bold text-secondary mb-2 transition-all duration-300 group-hover:scale-110">95%</div>
                <div className="text-sm text-muted-foreground font-medium">Tingkat Kelulusan</div>
              </div>
            </div>
          </div>

          {/* Right Content - Feature Cards */}
          <div className="hidden lg:block animate-fade-in">
            <div className="grid grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => handleFeatureShortcut("modules")}
                className="bg-gradient-to-br from-card to-primary/5 rounded-2xl p-7 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-105 border border-primary/10 text-left"
              >
                <div className="bg-primary/15 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:animate-bounce-in">
                  <BookOpen className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-primary">Materi Lengkap</h3>
                <p className="text-sm text-muted-foreground">Kurikulum terstruktur dan up-to-date</p>
              </button>

              <div className="bg-gradient-to-br from-card to-secondary/5 rounded-2xl p-7 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-105 mt-8 border border-secondary/10">
                <div className="bg-secondary/15 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="h-7 w-7 text-secondary" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-primary">Mentoring Interaktif</h3>
                <p className="text-sm text-muted-foreground">Diskusi strategi seleksi yang efektif</p>
              </div>

              <div className="bg-gradient-to-br from-card to-secondary/5 rounded-2xl p-7 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-105 border border-secondary/10">
                <div className="bg-secondary/15 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                  <Award className="h-7 w-7 text-secondary" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-primary">Analisis Skor</h3>
                <p className="text-sm text-muted-foreground">Evaluasi hasil untuk fokus belajar</p>
              </div>

              <button
                type="button"
                onClick={() => handleFeatureShortcut("tryouts")}
                className="bg-gradient-to-br from-card to-primary/5 rounded-2xl p-7 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-105 mt-8 border border-primary/10 text-left"
              >
                <div className="bg-primary/15 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                  <BookOpen className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-primary">Try Out Rutin</h3>
                <p className="text-sm text-muted-foreground">Evaluasi berkala untuk progress</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
