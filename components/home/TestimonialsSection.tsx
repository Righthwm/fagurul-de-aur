"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import type { Testimonial } from "@/types";

// Real reviews from the Fagurul de Aur Facebook page. Diacritics lightly
// corrected; wording otherwise unchanged. The "city" line credits the source.
const testimonials: Testimonial[] = [
  {
    id: "fb-alisa-bara",
    author: "Alisa Bara",
    city: "Recenzie Facebook",
    rating: 5,
    text: "Calitate excelentă! Mierea are un gust deosebit și o consistență perfectă. Felicitări producătorului! 🐻❤️",
  },
  {
    id: "fb-velica-flavius",
    author: "Velică Flavius Iulian",
    city: "Recenzie Facebook",
    rating: 5,
    text: "Am comandat de câteva ori de la Fagurul de Aur și pot spune că mierea chiar mi-a lăsat o impresie foarte bună. Are gust autentic, se simte că este naturală, iar livrarea a fost rapidă și produsele au ajuns foarte bine ambalate.",
  },
  {
    id: "fb-gabriel-moldovan",
    author: "Gabriel Moldovan",
    city: "Recenzie Facebook",
    rating: 5,
    text: "Mierea este foarte bună și livrarea a venit a doua zi. Recomand!",
  },
];

function HexAvatar({ initials }: { initials: string }) {
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 50 58" className="w-full h-full" aria-hidden="true">
        <polygon
          points="25,2 48,15 48,43 25,56 2,43 2,15"
          fill="#D4A017"
          stroke="#F5C518"
          strokeWidth="1"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-heading text-[#14100A] text-sm font-semibold">
        {initials}
      </span>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} din 5 stele`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={13}
          className={i < rating ? "text-gold-300 fill-current" : "text-text-muted"}
        />
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>();

  const next = useCallback(() => {
    setDirection(1);
    setCurrent((c) => (c + 1) % testimonials.length);
  }, []);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(next, 4500);
    return () => clearInterval(interval);
  }, [isVisible, next]);

  const t = testimonials[current];

  return (
    <section
      className="relative py-24 px-4 sm:px-6 lg:px-8 bg-bg-secondary overflow-hidden"
      aria-label="Testimoniale clienți"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(212,160,23,0.06) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="gold-line" />
          <h2 className="section-heading font-heading">Ce Spun Clienții Noștri</h2>
        </motion.div>

        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-12 lg:gap-16 items-center">
          {/* Bear "gallery print" */}
          <motion.figure
            initial={{ opacity: 0, x: -40 }}
            animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="mx-auto w-full max-w-sm lg:max-w-none"
          >
            <div className="relative">
              <div
                className="absolute -inset-3 rounded-lg border border-gold-400/30"
                aria-hidden="true"
              />
              <Image
                src="/images/urs-miere.jpg"
                alt="Urs brun bând miere direct din borcan, în pădure"
                width={1024}
                height={1024}
                className="relative rounded-lg shadow-xl w-full h-auto object-cover border border-gold-400/10"
              />
            </div>
            <figcaption className="mt-6 text-center lg:text-left">
              <p className="font-heading text-text-primary text-xl sm:text-2xl italic leading-snug">
                Clienții sunt înnebuniți după mierea noastră.
              </p>
              <p className="text-text-muted text-sm mt-1.5">Unii mai mult decât alții.</p>
            </figcaption>
          </motion.figure>

          {/* Testimonial carousel */}
          <div>
        <div className="relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={t.id}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d > 0 ? 60 : -60 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d > 0 ? -60 : 60 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="card p-8 sm:p-10 text-center"
            >
              <StarRating rating={t.rating} />
              <blockquote className="font-heading text-text-primary text-xl sm:text-2xl font-light mt-6 mb-8 leading-relaxed">
                {t.text}
              </blockquote>
              <div className="flex items-center justify-center gap-3">
                <HexAvatar initials={t.author.slice(0, 2).toUpperCase()} />
                <div className="text-left">
                  <p className="text-text-primary text-sm font-semibold font-body">{t.author}</p>
                  <p className="text-text-muted text-xs">{t.city}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Nav buttons */}
          <button
            onClick={prev}
            className="absolute -left-4 sm:-left-8 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center border border-gold-400/20 text-text-muted hover:text-gold-300 hover:border-gold-400/50 transition-all rounded-sm"
            aria-label="Testimonial anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={next}
            className="absolute -right-4 sm:-right-8 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center border border-gold-400/20 text-text-muted hover:text-gold-300 hover:border-gold-400/50 transition-all rounded-sm"
            aria-label="Testimonial următor"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-6" role="tablist" aria-label="Navighează testimoniale">
          {testimonials.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              aria-label={`Testimonial ${i + 1}`}
              onClick={() => {
                setDirection(i > current ? 1 : -1);
                setCurrent(i);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === current ? "bg-gold-400 w-5" : "bg-text-muted"
              }`}
            />
          ))}
        </div>
          </div>
        </div>
      </div>
    </section>
  );
}
