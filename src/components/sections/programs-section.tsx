import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Users, Clock, Award } from "lucide-react";
import governmentOfficers from "@/assets/government-officers.jpg";

export const ProgramsSection = () => {
  const programs = [
    {
      title: "Program CPNS",
      description: "Persiapan lengkap untuk seleksi CPNS dengan materi terkini dan strategi jitu",
      features: ["Materi SKD Lengkap", "Try Out Berkala", "Analisis Hasil", "Bimbingan Personal"],
      price: "Mulai dari Rp 299.000",
      badge: "Populer",
      bgColor: "primary-gradient",
      textColor: "text-white"
    },
    {
      title: "Program Kedinasan", 
      description: "Bimbingan khusus untuk sekolah kedinasan seperti IPDN, STAN, PKN STAN",
      features: ["Tes Akademik", "Tes Psikologi", "Tes Kesehatan", "Interview Preparation"],
      price: "Mulai dari Rp 399.000",
      badge: "Premium",
      bgColor: "secondary-gradient",
      textColor: "text-white"
    },
    {
      title: "Private Mentoring",
      description: "Bimbingan one-on-one dengan mentor berpengalaman untuk hasil maksimal",
      features: ["Jadwal Fleksibel", "Materi Kustom", "Progress Tracking", "Garansi Hasil"],
      price: "Mulai dari Rp 599.000",
      badge: "Eksklusif",
      bgColor: "bg-card",
      textColor: "text-foreground"
    }
  ];

  const stats = [
    { icon: Users, number: "10,000+", label: "Pengguna" },
    { icon: BookOpen, number: "15,000+", label: "Soal" },
    { icon: Award, number: "20+", label: "Grup Belajar" },
    { icon: Clock, number: "5,000+", label: "Alumni" }
  ];

  return (
    <section id="programs" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16 fade-up">
          <Badge variant="outline" className="mb-4">Program Unggulan</Badge>
          <h2 className="text-4xl font-bold mb-4">
            Solusi Terbaik untuk Sukses di Setiap Seleksi! 🚀
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Pilih program yang sesuai dengan target kariermu. Setiap program dirancang 
            khusus dengan metode pembelajaran yang terbukti efektif.
          </p>
        </div>

        {/* Stats */}
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

        {/* Programs Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {programs.map((program, index) => (
            <Card key={index} className={`relative overflow-hidden hover-lift transition-smooth ${program.bgColor} ${program.textColor} fade-up`} style={{ animationDelay: `${index * 0.1}s` }}>
              {program.badge && (
                <Badge className="absolute top-4 right-4 bg-white text-primary">
                  {program.badge}
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{program.title}</CardTitle>
                <CardDescription className={program.textColor === "text-white" ? "text-white/80" : ""}>
                  {program.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-2">
                  {program.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 bg-current rounded-full"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="border-t border-current/20 pt-4">
                  <div className="text-lg font-semibold mb-4">{program.price}</div>
                  <Button 
                    className={`w-full ${program.textColor === "text-white" ? "bg-white text-primary hover:bg-white/90" : "primary-gradient text-white"}`}
                    asChild
                  >
                    <a 
                      href="https://wa.me/6283136485351?text=Hallo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20info%20tentang%20program"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      Daftar Sekarang
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="relative rounded-2xl overflow-hidden fade-up">
          <div className="absolute inset-0">
            <img 
              src={governmentOfficers}
              alt="Government Officers"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-primary/80"></div>
          </div>
          <div className="relative p-12 text-center text-white">
            <h3 className="text-3xl font-bold mb-4">
              Siap Menjadi Bagian dari Abdi Negara?
            </h3>
            <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
              Bergabunglah dengan ribuan pejuang lainnya yang telah memilih Sagala Bimbel 
              sebagai partner menuju kesuksesan karier di pemerintahan.
            </p>
            <Button 
              size="lg"
              className="bg-white text-primary hover:bg-white/90 transition-smooth shadow-medium text-lg px-8 py-6 hover-lift"
              asChild
            >
              <a 
                href="https://wa.me/6283136485351?text=Hallo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20konsultasi%20program"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                Konsultasi Gratis Sekarang
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};