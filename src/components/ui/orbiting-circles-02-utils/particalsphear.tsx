import { useEffect, useRef } from "react";

export default function ParticleSphereAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let mouseX = 0;
    let mouseY = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const size = Math.min(parent.clientWidth, parent.clientHeight);
      canvas.width = size * 1.5;
      canvas.height = size * 1.5;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: { x: number; y: number; z: number; r: number; color: string }[] = [];
    const count = 400;
    const colors = ["#4FD1E8", "#818cf8", "#a78bfa", "#c4b5fd", "#e0e7ff"];

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 100 + Math.random() * 20;
      particles.push({
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
        r: 0.5 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    canvas.addEventListener("mousemove", onMouseMove);

    let rotation = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      rotation += 0.003 + mouseX * 0.002;
      const tiltX = mouseY * 0.3;

      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);
      const cosT = Math.cos(tiltX);
      const sinT = Math.sin(tiltX);

      const projected: { x: number; y: number; z: number; r: number; color: string; opacity: number }[] = [];

      for (const p of particles) {
        const x1 = p.x * cosR - p.z * sinR;
        const z1 = p.x * sinR + p.z * cosR;
        const y1 = p.y * cosT - z1 * sinT;
        const z2 = p.y * sinT + z1 * cosT;

        const scale = 300 / (300 + z2);
        projected.push({
          x: cx + x1 * scale,
          y: cy + y1 * scale,
          z: z2,
          r: p.r * scale,
          color: p.color,
          opacity: 0.3 + 0.7 * ((z2 + 120) / 240),
        });
      }

      projected.sort((a, b) => a.z - b.z);

      for (const p of projected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
