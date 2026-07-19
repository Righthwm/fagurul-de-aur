"use client";

import { useEffect } from "react";

/**
 * Short cash-register style "cha-ching": two quick bell strikes synthesized
 * with Web Audio — no audio asset, no licensing. Only possible while the app
 * is open; background pushes play the system notification sound instead
 * (a Chrome/Android platform limit no web app can bypass).
 */
let audioCtx: AudioContext | null = null;

function chaChing() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    void ctx.resume().catch(() => {});
    const strike = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.75);
    };
    strike(1318.5, 0); // E6
    strike(2093.0, 0.09); // C7
  } catch {
    /* audio unavailable — ignore */
  }
}

/** Registers the admin service worker and plays the new-order sound while the
 *  app is in the foreground. Renders nothing. */
export function AdminPwa() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === "new-order") chaChing();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  return null;
}
