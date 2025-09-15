import { Navigation } from "@/components/ui/navigation";
import { HeroSection } from "@/components/sections/hero-section";
import { ProgramsSection } from "@/components/sections/programs-section";
import { AlumniSection } from "@/components/sections/alumni-section";
import { Footer } from "@/components/sections/footer";
import { VideoTestimonialsSection } from "@/components/sections/video-testimonials";
import { EventsSection } from "@/components/sections/events-section";
import { ContactSection } from "@/components/sections/contact-section";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <HeroSection />
        <ProgramsSection />
        <AlumniSection />
        <VideoTestimonialsSection />
        <EventsSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
