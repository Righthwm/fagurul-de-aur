import { HeroSection } from "@/components/home/HeroSection";
import { TrustBar } from "@/components/home/TrustBar";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { SeasonBanner } from "@/components/home/SeasonBanner";
import { StorySection } from "@/components/home/StorySection";
import { BenefitsSection } from "@/components/home/BenefitsSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { ExitIntentPopup } from "@/components/home/ExitIntentPopup";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustBar />
      <FeaturedProducts />
      <SeasonBanner />
      <StorySection />
      <BenefitsSection />
      <TestimonialsSection />
      <NewsletterSection />
      <ExitIntentPopup />
    </>
  );
}
