"use client";

import { Closing } from "./_components/closing";
import { Contact } from "./_components/contact";
import { Features } from "./_components/features";
import { Footer } from "./_components/footer";
import { Hero } from "./_components/hero";
import { Nav } from "./_components/nav";
import { Pitch } from "./_components/pitch";
import { Pricing } from "./_components/pricing";
import { Value } from "./_components/value";
import { Divider, DotGrid } from "./_sections/layout";

export default function Home() {
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <DotGrid />

      <Nav onScrollTo={scrollToSection} />

      <Hero onScrollTo={scrollToSection} />
      <Divider />

      <Pitch />
      {/* Pitch gère ses Dividers internes: Problem → Solution → HowItWorks */}
      <Divider />

      <Features />
      <Divider />

      <Value />
      {/* Value gère ses Dividers internes: Benefits → UseCases */}
      <Divider />

      <Pricing />
      <Divider />

      <Contact />
      <Divider />

      <Closing />
      {/* Closing gère ses Dividers internes: Trust → CTA */}

      <Footer />

      <style>{`
        .float-card-a {
          animation: float-a 5.5s ease-in-out infinite;
        }
        .float-card-b {
          animation: float-b 6.5s ease-in-out infinite;
          animation-delay: 1.5s;
        }
        @keyframes float-a {
          0%, 100% { transform: translateY(0px) rotate(0deg);    }
          50%       { transform: translateY(-8px) rotate(0.4deg); }
        }
        @keyframes float-b {
          0%, 100% { transform: translateY(0px) rotate(0deg);     }
          50%       { transform: translateY(-6px) rotate(-0.3deg); }
        }
      `}</style>
    </div>
  );
}
