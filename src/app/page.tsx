import { About } from "@/components/landing/about";
import { CtaBanner } from "@/components/landing/cta-banner";
import { FadeInSection } from "@/components/landing/fade-in-section";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { InfoCards } from "@/components/landing/info-cards";
import { Navbar } from "@/components/landing/navbar";
import { getCtaState } from "@/lib/auth/cta";

export default async function Home() {
  const ctaState = await getCtaState();

  return (
    <div className="min-h-screen bg-background">
      <Navbar ctaState={ctaState} />
      <main>
        <Hero ctaState={ctaState} />
        <FadeInSection>
          <About />
        </FadeInSection>
        <FadeInSection delay={100}>
          <InfoCards />
        </FadeInSection>
        <FadeInSection delay={150}>
          <CtaBanner ctaState={ctaState} />
        </FadeInSection>
      </main>
      <FadeInSection delay={200}>
        <Footer />
      </FadeInSection>
    </div>
  );
}
