"use client";

import { useState } from "react";
import { ShaderBackground } from "@/components/ui/willzoshader";

export default function LandingHero({ onEnterApp }: { onEnterApp: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <ShaderBackground className="absolute inset-0 z-0" />
      {/* Background glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full bg-accent/3 blur-[100px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Top right text + badge */}
      <div className="hidden sm:flex absolute top-6 right-6 z-10 flex-col items-end gap-3">
        <p className="text-xs font-medium text-white/70 text-right max-w-[220px] leading-relaxed">
          Bridge USDC across chains, swap stablecoins, invest in tokenized stocks,
          and manage your portfolio — all
        </p>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium text-white">
            Powered by CCTP · Jupiter · Solana
          </span>
        </div>
      </div>

      {/* Orbiting globe — centered, smaller on mobile */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="w-full max-w-2xl px-4">
          <div className="relative h-[180px] sm:h-[280px] md:h-[420px]" />
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col sm:flex-row items-end justify-between px-4 sm:px-6 pb-4 sm:pb-6 gap-3">
        {/* Bottom left headline */}
        <h1 className="text-[clamp(28px,8vw,160px)] font-bold tracking-tighter text-white select-none leading-none">
          CLUSTER
        </h1>

        {/* Bottom right Launch button */}
        <div className="flex justify-end w-full sm:w-auto">
          <button
            onClick={onEnterApp}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="group relative rounded-xl bg-white px-4 sm:px-8 py-3 sm:py-4 text-sm font-bold text-bg transition-all hover:bg-white/90 active:scale-[0.98] shadow-lg shadow-white/10 whitespace-nowrap"
          >
            Launch App
            <svg
              className={`inline-block ml-2 h-4 w-4 transition-transform ${hovered ? 'translate-x-1' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
