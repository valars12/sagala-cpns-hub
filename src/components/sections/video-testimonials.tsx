import { useEffect, useRef } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";

export const VideoTestimonialsSection = () => {
  const videos = [
    { id: "dQw4w9WgXcQ", title: "Testimoni Alumni CPNS" },
    { id: "Zi_XLOBDo_Y", title: "Pengalaman Kedinasan" },
    { id: "3GwjfUFyY6M", title: "Tips Lulus Seleksi" },
    { id: "C0DPdy98e4c", title: "Strategi SKD" },
    { id: "kXYiU_JCYtU", title: "Kisah Sukses" },
  ];

  const apiRef = useRef<CarouselApi | null>(null);
  useEffect(() => {
    if (!apiRef.current) return;
    const id = setInterval(() => apiRef.current?.scrollNext(), 5000);
    return () => clearInterval(id);
  }, [apiRef.current]);

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
