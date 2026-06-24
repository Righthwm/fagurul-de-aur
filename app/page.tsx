import { HeroSection } from "@/components/home/HeroSection";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { StorySection } from "@/components/home/StorySection";
import { BenefitsSection } from "@/components/home/BenefitsSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedProducts />
      <StorySection />
      <BenefitsSection />
      <TestimonialsSection />
      <NewsletterSection />
    </>
  );
}
