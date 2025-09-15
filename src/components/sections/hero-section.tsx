import { Button } from "@/components/ui/button";
import { ArrowRight, Rocket, Target } from "lucide-react";
import heroStudent from "@/assets/hero-student.jpg";

export const HeroSection = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 hero-gradient"></div>
      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 text-white/10 floating-animation">
        <Rocket className="h-16 w-16" />
      </div>
      <div className="absolute bottom-20 right-10 text-white/10 floating-animation" style={{ animationDelay: "2s" }}>
        <Target className="h-20 w-20" />
      </div>

      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center relative z-10">
        {/* Content */}
        <div className="text-white space-y-8 fade-up">
          <div className="space-y-4">
            <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium">
              🎯 Bimbingan Terpercaya untuk Masa Depan Cemerlang
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
              Selamat Datang
              <span className="block text-secondary">Pejuang CPNS & Kedinasan</span>
            </h1>
            <p className="text-xl text-white/90 leading-relaxed max-w-2xl">
              Langkah pertama menuju impianmu menjadi abdi negara dimulai di sini. 
              Persiapkan dirimu dengan materi terbaik, tryout akurat, dan bimbingan profesional. 
              Bersama, kita wujudkan kesuksesan! 🚀
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 fade-up fade-up-delay-1">
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90 transition-smooth shadow-medium text-lg px-8 py-6 hover-lift"
              asChild
            >
              <a href="#programs" className="flex items-center gap-2">
                Mulai Belajar
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white hover:text-primary transition-smooth text-lg px-8 py-6 hover-lift"
              asChild
            >
              <a
                href="https://wa.me/6283136485351?text=Hallo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20berkonsultasi"
                target="_blank"
                rel="noopener noreferrer"
              >
                Konsultasi Gratis
              </a>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 pt-8 fade-up fade-up-delay-2">
            <div className="text-center">
              <div className="text-3xl font-bold">1000+</div>
              <div className="text-white/80">Siswa Aktif</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">500+</div>
              <div className="text-white/80">Alumni Lulus</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">95%</div>
              <div className="text-white/80">Tingkat Kelulusan</div>
            </div>
          </div>
        </div>

        {/* Image */}
        <div className="relative fade-up fade-up-delay-3">
          <div className="relative">
            <img
              src={heroStudent}
              alt="Pejuang CPNS & Kedinasan"
              className="rounded-2xl shadow-strong w-full h-auto object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
          </div>
          
          {/* Floating Achievement Cards */}
          <div className="absolute -top-6 -left-6 bg-white rounded-xl p-4 shadow-medium floating-animation">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                🏆
              </div>
              <div>
                <div className="font-bold text-primary">Prestasi Terbaik</div>
                <div className="text-sm text-muted-foreground">Kelulusan 2024</div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-6 -right-6 bg-white rounded-xl p-4 shadow-medium floating-animation" style={{ animationDelay: "1s" }}>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                📚
              </div>
              <div>
                <div className="font-bold text-secondary">Materi Lengkap</div>
                <div className="text-sm text-muted-foreground">Terupdate 2025</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};