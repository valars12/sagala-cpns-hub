import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Quote, Star } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import heroStudent from "@/assets/hero-student.jpg";
import gov from "@/assets/government-officers.jpg";
import paket1 from "@/assets/paket-1.jpg";

export const AlumniSection = () => {
  const testimonials = [
    {
      name: "Andi Pratama",
      position: "CPNS Kementerian Kesehatan",
      year: "2024",
      quote:
        "Alhamdulillah, berkat bimbingan intensif dari Sagala Bimbel, saya berhasil lolos CPNS Kemenkes. Materinya lengkap dan mentornya sangat membantu!",
      rating: 5,
      image: heroStudent,
    },
    {
      name: "Sari Dewi",
      position: "Mahasiswa STAN",
      year: "2024",
      quote:
        "Try out di Sagala Bimbel sangat membantu saya mempersiapkan diri menghadapi tes STAN. Soal-soalnya mirip dengan yang asli!",
      rating: 5,
      image: paket1,
    },
    {
      name: "Budi Santoso",
      position: "CPNS Pemda Jawa Barat",
      year: "2023",
      quote:
        "Program private mentoring benar-benar worth it! Bisa belajar sesuai kebutuhan dan jadwal yang fleksibel. Highly recommended!",
      rating: 5,
      image: gov,
    },
    {
      name: "Maya Indah",
      position: "Polwan Polda Metro Jaya",
      year: "2023",
      quote:
        "Sagala Bimbel tidak hanya mempersiapkan tes akademik, tapi juga mental dan strategi menghadapi seleksi. Terima kasih!",
      rating: 5,
      image: heroStudent,
    },
  ];

  const achievements = [
    { number: "500+", label: "Alumni Lulus", icon: "🏆" },
    { number: "95%", label: "Tingkat Kelulusan", icon: "📈" },
    { number: "50+", label: "Instansi Partner", icon: "🏛️" },
    { number: "5", label: "Tahun Pengalaman", icon: "⏳" },
  ];

  const apiRef = useRef<CarouselApi | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      apiRef.current?.scrollNext();
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="alumni" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16 fade-up">
          <Badge variant="outline" className="mb-4">
            Alumni Success Story
          </Badge>
          <h2 className="text-4xl font-bold mb-4">Alumni Sagala Bimbel yang Telah Sukses</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Bergabunglah dengan ribuan alumni kami yang telah berhasil meraih impian menjadi abdi negara di berbagai instansi pemerintahan.
          </p>
        </div>

        {/* Achievements */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 fade-up fade-up-delay-1">
          {achievements.map((a, i) => (
            <Card key={i} className="text-center hover-lift transition-smooth shadow-soft">
              <CardContent className="pt-6">
                <div className="text-3xl mb-2">{a.icon}</div>
                <div className="text-3xl font-bold text-primary mb-2">{a.number}</div>
                <div className="text-muted-foreground font-medium">{a.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Testimonials Carousel */}
        <Carousel className="relative" setApi={(api) => (apiRef.current = api)}>
          <CarouselContent>
            {testimonials.map((t, index) => (
              <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                <Card className="hover-lift transition-smooth shadow-soft">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <img src={t.image} alt={t.name} className="h-14 w-14 rounded-full object-cover" />
                      <div className="flex-1">
                        <h4 className="font-bold text-lg">{t.name}</h4>
                        <p className="text-primary font-medium">{t.position}</p>
                        <p className="text-sm text-muted-foreground">Lulus {t.year}</p>
                      </div>
                      <Quote className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-muted-foreground italic leading-relaxed">"{t.quote}"</p>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>

        {/* CTA */}
        <div className="text-center mt-16 fade-up">
          <Card className="bg-gradient-to-r from-primary to-secondary text-white p-8 shadow-strong">
            <CardContent className="p-0">
              <h3 className="text-2xl font-bold mb-4">Ingin Menjadi Alumni Sukses Berikutnya?</h3>
              <p className="text-white/90 mb-6 text-lg">Bergabunglah sekarang dan raih impianmu menjadi abdi negara!</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://wa.me/6282137233397?text=Halo%20Sagala%20Bimbel%20Admin%2C%20saya%20ingin%20bergabung"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white text-primary hover:bg-white/90 px-6 py-3 rounded-lg font-medium transition-smooth hover-lift"
                >
                  Mulai Perjalanan Sukses
                </a>
                <a
                  href="https://www.instagram.com/sagala_bimbel/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 border border-white text-white hover:bg-white hover:text-primary px-6 py-3 rounded-lg font-medium transition-smooth hover-lift"
                >
                  Lihat Update Alumni
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

