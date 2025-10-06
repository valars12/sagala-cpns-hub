import { useEffect, useRef } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";

export const VideoTestimonialsSection = () => {
  const videos = [
    { id: "ExZUl-I4STQ", title: "Real Testi Bimbel Mentor CPNS" },
    { id: "ffqRSJi--2E", title: "Testimoni Kelas SKD Kedinasan" },
    { id: "uUctbsU9fAk", title: "Testimoni Siswa kedinasan.id" },
    { id: "lj69WmpVeUY", title: "Testimoni Bimbel Taruna Persada" },
    { id: "1lJmx9jtntY", title: "Testimoni Bimbel Science Society" },
  ];

  const apiRef = useRef<CarouselApi | null>(null);
  useEffect(() => {
    const id = setInterval(() => apiRef.current?.scrollNext(), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="video-testimonials" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Video Testimoni Alumni</h2>
          <p className="text-muted-foreground">Cerita nyata perjalanan menuju kelulusan</p>
        </div>

        <Carousel className="relative" setApi={(api) => (apiRef.current = api)}>
          <CarouselContent>
            {videos.map((v, i) => (
              <CarouselItem key={v.id} className="md:basis-1/2 lg:basis-1/3">
                <div className="aspect-video rounded-xl overflow-hidden shadow-soft">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${v.id}`}
                    title={v.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </section>
  );
};

