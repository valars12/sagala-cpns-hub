import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Users, Target, Heart, TrendingUp, BookOpen } from "lucide-react";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Fokus pada Hasil",
      description: "Kami berkomitmen membantu peserta mencapai target seleksi dengan metode belajar yang terukur.",
    },
    {
      icon: Heart,
      title: "Peduli pada Siswa",
      description: "Setiap peserta punya titik kuat dan tantangan berbeda. Kami membantu memetakan strategi belajarnya.",
    },
    {
      icon: TrendingUp,
      title: "Inovasi Berkelanjutan",
      description: "Materi, tryout, dan latihan diperbarui mengikuti kebutuhan seleksi CPNS dan Kedinasan.",
    },
    {
      icon: Award,
      title: "Kualitas Terjamin",
      description: "Mentor berpengalaman dan kurikulum terstruktur menjadi fondasi persiapan yang rapi.",
    },
  ];

  const achievements = [
    { number: "500+", label: "Alumni Sukses", icon: Users },
    { number: "50+", label: "Tryout & Modul", icon: BookOpen },
    { number: "95%", label: "Tingkat Kelulusan", icon: Award },
    { number: "5+", label: "Tahun Berpengalaman", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center animate-fade-up">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Tentang Kami</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold mb-6">
                Bimbingan CPNS & Kedinasan <span className="text-primary">Terpercaya</span>
              </h1>
              <p className="text-xl text-muted-foreground">
                Membantu pejuang CPNS dan Kedinasan belajar lebih terarah dengan materi, tryout, dan mentoring.
              </p>
            </div>
          </div>
        </section>

        {/* About Story */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <Card className="shadow-xl">
                <CardContent className="p-8 lg:p-12">
                  <h2 className="text-3xl font-bold mb-6">Cerita Sagala Bimbel</h2>
                  <div className="space-y-4 text-muted-foreground leading-relaxed">
                    <p>
                      <strong className="text-foreground">Sagala Bimbel</strong> hadir sebagai partner belajar untuk pejuang CPNS
                      dan Kedinasan yang membutuhkan persiapan rapi, realistis, dan mudah dipantau. Setiap program
                      dirancang agar peserta tahu harus belajar apa, berlatih bagaimana, dan mengevaluasi progresnya.
                    </p>
                    <p>
                      Kami percaya setiap peserta punya peluang yang bisa ditingkatkan lewat strategi yang tepat.
                      Karena itu, Sagala Bimbel menggabungkan materi terstruktur, latihan berkala, tryout mirip CAT,
                      dan pendampingan mentor untuk membantu peserta menjaga ritme belajar.
                    </p>
                    <p>
                      Sistem belajar kami memakai dashboard, akses paket, bank soal, modul, kelas, dan monitoring skor
                      sehingga peserta dapat melihat bagian yang sudah kuat dan bagian yang perlu dikejar lagi.
                    </p>
                    <p>
                      Dengan fokus pada TWK, TIU, TKP, psikotes, TPA, dan kebutuhan seleksi kedinasan, Sagala Bimbel
                      siap menjadi ruang persiapan yang serius sekaligus suportif.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Achievements */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Pencapaian <span className="text-primary">Kami</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Angka yang menunjukkan dedikasi kami
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {achievements.map((achievement, index) => (
                <Card 
                  key={index} 
                  className="text-center p-8 hover:shadow-xl transition-all hover:-translate-y-2 animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <achievement.icon className="h-12 w-12 text-primary mx-auto mb-4" />
                  <div className="text-4xl font-bold text-primary mb-2">{achievement.number}</div>
                  <div className="text-muted-foreground">{achievement.label}</div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Nilai-Nilai <span className="text-primary">Kami</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Prinsip yang kami pegang teguh dalam setiap aspek pembelajaran
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, index) => (
                <Card 
                  key={index}
                  className="group hover:shadow-xl transition-all hover:-translate-y-2 animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-6">
                    <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <value.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Tim <span className="text-primary">Pengajar</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Mentor berpengalaman yang siap membimbing strategi belajarmu
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <Card className="shadow-xl">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <Award className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-2">Kualifikasi Terbaik</h3>
                        <p className="text-muted-foreground">
                          Mentor Sagala Bimbel memahami pola seleksi CPNS dan Kedinasan, mulai dari materi inti,
                          manajemen waktu, hingga evaluasi hasil tryout.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-2">Pendekatan Personal</h3>
                        <p className="text-muted-foreground">
                          Setiap peserta dibantu memahami pola belajar, kelemahan materi, dan target latihan
                          sehingga progres terasa lebih jelas.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-2">Pelatihan Berkelanjutan</h3>
                        <p className="text-muted-foreground">
                          Materi dan latihan terus disesuaikan agar tetap relevan dengan kebutuhan seleksi terbaru.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
