import { Navbar } from "@/components/ui/Navbar";
import { Hero } from "@/components/sections/Hero";
import { NetworkMap } from "@/components/sections/NetworkMap";
import { TerminalIntro } from "@/components/sections/TerminalIntro";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Features } from "@/components/sections/Features";
import { ScaleSection } from "@/components/sections/ScaleSection";
import { LiveNetwork } from "@/components/sections/LiveNetwork";
import { Footer } from "@/components/ui/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <NetworkMap />
      <TerminalIntro />
      <HowItWorks />
      <Features />
      <ScaleSection />
      <LiveNetwork />
      <Footer />
    </main>
  );
}
