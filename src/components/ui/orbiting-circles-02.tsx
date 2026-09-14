"use client";

import React from "react";
import ParticleSphereAnimation from "@/components/ui/orbiting-circles-02-utils/particalsphear";

const TW = "https://raw.githubusercontent.com/trustwallet/assets/master";

const orbits = [
  {
    size: "w-[280px] h-[280px] md:w-[460px] md:h-[460px]",
    duration: 18,
    icons: [
      { src: `${TW}/blockchains/solana/info/logo.png`, alt: "Solana", angle: -60 },
      { src: "https://cdn.circle.com/logo/usdc.svg", alt: "USDC", angle: 0 },
      { src: `${TW}/blockchains/ethereum/info/logo.png`, alt: "Ethereum", angle: 60 },
    ],
  },
  {
    size: "w-[380px] h-[380px] md:w-[560px] md:h-[560px]",
    duration: 24,
    icons: [
      { src: `${TW}/blockchains/base/info/logo.png`, alt: "Base", angle: 0 },
      { src: `${TW}/blockchains/arbitrum/info/logo.png`, alt: "Arbitrum", angle: -90 },
      { src: `${TW}/blockchains/polygon/info/logo.png`, alt: "Polygon", angle: 90 },
    ],
  },
  {
    size: "w-[480px] h-[480px] md:w-[680px] md:h-[680px]",
    duration: 30,
    icons: [
      { src: `${TW}/blockchains/sei/info/logo.png`, alt: "Sei", angle: -60 },
      { src: `${TW}/blockchains/sonic/info/logo.png`, alt: "Sonic", angle: 0 },
      { src: `${TW}/blockchains/unichain/info/logo.png`, alt: "Unichain", angle: 60 },
    ],
  },
];

export default function OrbitingCirclesGlobe() {
  return (
    <div className="relative w-full h-[280px] md:h-[420px] overflow-hidden flex justify-center">
      <style>{`
        @keyframes orbit-cw {
          from { transform: rotate(var(--start-angle)) }
          to   { transform: rotate(calc(var(--start-angle) + 360deg)) }
        }
        @keyframes orbit-ccw {
          from { transform: rotate(var(--start-angle)) }
          to   { transform: rotate(calc(var(--start-angle) - 360deg)) }
        }
        @keyframes counter-cw {
          from { transform: rotate(var(--counter-offset, 0deg)) }
          to   { transform: rotate(calc(var(--counter-offset, 0deg) - 360deg)) }
        }
        @keyframes counter-ccw {
          from { transform: rotate(var(--counter-offset, 0deg)) }
          to   { transform: rotate(calc(var(--counter-offset, 0deg) + 360deg)) }
        }
      `}</style>

      {/* Center particle globe */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 aspect-square pointer-events-none w-[200px] md:w-[380px] z-10">
        <ParticleSphereAnimation />
      </div>

      {/* Orbiting rings */}
      {orbits.map((orbit, index) => {
        const isCW = index % 2 === 0;
        const orbitAnim = isCW ? "orbit-cw" : "orbit-ccw";
        const counterAnim = isCW ? "counter-cw" : "counter-ccw";

        const allIcons = [
          ...orbit.icons,
          ...orbit.icons.map((ic) => ({
            ...ic,
            angle: ic.angle + 180,
            alt: `${ic.alt}-mirror`,
          })),
        ];

        return (
          <div
            key={index}
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border border-[var(--color-border)] ${orbit.size}`}
          >
            {allIcons.map((iconData, iconIndex) => (
              <div
                key={iconIndex}
                className="absolute top-0 left-1/2 h-1/2 -ml-8 origin-bottom flex flex-col justify-start items-center"
                style={
                  {
                    "--start-angle": `${iconData.angle}deg`,
                    animation: `${orbitAnim} ${orbit.duration}s linear infinite`,
                  } as React.CSSProperties
                }
              >
                <div
                  className="p-3 sm:p-4 border border-[var(--color-border)] rounded-full bg-[var(--color-card)] -mt-8 relative z-10"
                  style={
                    {
                      "--counter-offset": `${-iconData.angle}deg`,
                      animation: `${counterAnim} ${orbit.duration}s linear infinite`,
                    } as React.CSSProperties
                  }
                >
                  <img
                    src={iconData.src}
                    alt={iconData.alt}
                    width={32}
                    height={32}
                    className="w-6 h-6 md:w-8 md:h-8"
                  />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
