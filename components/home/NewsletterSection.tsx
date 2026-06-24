"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, CheckCircle } from "lucide-react";
import { HexPattern } from "@/components/ui/HexPattern";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Te rugăm să introduci un email valid.");
      return;
    }
    setError("");
    setStatus("loading");
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("success");
  };

  return (
    <section
      className="relative py-20 px-4 sm:px-6 lg:px-8 bg-bg-secondary overflow-hidden"
      aria-label="Newsletter"
    >
      <HexPattern opacity={0.03} />

      <div className="relative max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
        >
          <Mail className="text-gold-400 mx-auto mb-4" size={32} aria-hidden="true" />
          <h2 className="font-heading text-text-primary mb-3">
            Fii primul care știe când e miere nouă
          </h2>
          <p className="text-text-secondary mb-8 text-base">
            Abonează-te și primești{" "}
            <strong className="text-gold-300">10% reducere</strong> la prima comandă.
          </p>

          {status === "success" ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <CheckCircle size={40} className="text-success" />
              <p className="text-text-primary font-heading text-xl">Mulțumim pentru abonare!</p>
              <p className="text-text-muted text-sm">Codul tău de reducere a fost trimis pe email.</p>
            </motion.div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              aria-label="Formular newsletter"
            >
              <div className="flex-1">
                <label htmlFor="newsletter-email" className="sr-only">
                  Adresa de email
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adresa@email.ro"
                  className={`input-field ${error ? "error" : ""}`}
                  aria-describedby={error ? "newsletter-error" : undefined}
                  required
                />
                {error && (
                  <p id="newsletter-error" className="text-error text-xs mt-1 text-left">
                    {error}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="btn-primary shrink-0"
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <span className="inline-block w-4 h-4 border-2 border-bg-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Mă Abonez"
                )}
              </button>
            </form>
          )}

          <p className="text-text-muted text-xs mt-4">
            Nu trimitem spam. Te poți dezabona oricând.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
