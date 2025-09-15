import { Navigation } from "@/components/ui/navigation";
import { HeroSection } from "@/components/sections/hero-section";
import { ProgramsSection } from "@/components/sections/programs-section";
import { AlumniSection } from "@/components/sections/alumni-section";
import { Footer } from "@/components/sections/footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <HeroSection />
        <ProgramsSection />
        <AlumniSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
