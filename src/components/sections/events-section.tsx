import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const EventsSection = () => {
  const events = [
    { title: "Tryout Nasional AutoCPNS", date: "28 Sep 2025", tag: "AutoCPNS", desc: "Ikuti simulasi nasional dengan pembahasan lengkap." },
    { title: "Webinar Strategi SKD", date: "5 Okt 2025", tag: "Webinar", desc: "Belajar teknik cepat TWK, TIU, TKP." },
    { title: "Kelas Intensif Kedinasan", date: "12 Okt 2025", tag: "Kedinasan", desc: "Pendalaman materi dan simulasi wawancara." },
  ];
  return (
    <section id="events" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Informasi & Event AutoCPNS</h2>
          <p className="text-muted-foreground">Jangan lewatkan agenda penting untuk persiapanmu</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((e, i) => (
            <Card key={i} className="hover-lift transition-smooth">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{e.title}</CardTitle>
                <Badge variant="outline">{e.tag}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-2">{e.date}</div>
                <p className="text-sm">{e.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

