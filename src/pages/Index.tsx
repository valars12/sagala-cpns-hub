import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Programs from "@/components/Programs";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const Index = () => {
  const { user } = useAuth();
  if (user?.role === "admin" || user?.role === "teacher") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Programs />
      <Contact />
      <Footer />
    </div>
  );
};

export default Index;
