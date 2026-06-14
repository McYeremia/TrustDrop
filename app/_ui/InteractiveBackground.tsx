"use client";

import { useEffect, useRef } from "react";

/**
 * Interactive "verified network" backdrop: drifting nodes connected by hairlines,
 * with a cursor-following glow and live links. Respects prefers-reduced-motion,
 * pauses when the tab is hidden, and never blocks pointer events.
 */
export function InteractiveBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    return startNetwork(canvas, ctx);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 size-full"
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, black 0%, black 55vh, transparent 82vh)",
        maskImage:
          "linear-gradient(to bottom, black 0%, black 55vh, transparent 82vh)",
      }}
    />
  );
}

type P = { x: number; y: number; vx: number; vy: number };

const SEAL = "240,169,59";
const LINK = 130;

function startNetwork(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): () => void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0;
  let nodes: P[] = [];
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
  let raf = 0;

  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(90, Math.max(28, Math.floor((w * h) / 22000)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);

    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    const px = mouse.active ? (mouse.x / w - 0.5) * 14 : 0;
    const py = mouse.active ? (mouse.y / h - 0.5) * 14 : 0;

    if (mouse.active) {
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 100);
      g.addColorStop(0, `rgba(${SEAL},0.13)`);
      g.addColorStop(1, `rgba(${SEAL},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0) n.x += w; else if (n.x > w) n.x -= w;
      if (n.y < 0) n.y += h; else if (n.y > h) n.y -= h;

      const dx = n.x + px, dy = n.y + py;

      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const a = dx - (m.x + px), b = dy - (m.y + py);
        const d2 = a * a + b * b;
        if (d2 < LINK * LINK) {
          const o = (1 - Math.sqrt(d2) / LINK) * 0.18;
          ctx.strokeStyle = `rgba(${SEAL},${o})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(m.x + px, m.y + py);
          ctx.stroke();
        }
      }

      // Nodes only drift — no cursor attraction, so they never cluster over
      // content. The cursor adds a soft glow + parallax only.
      ctx.beginPath();
      ctx.fillStyle = `rgba(${SEAL},0.4)`;
      ctx.arc(dx, dy, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(frame);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const a = n.x - m.x, b = n.y - m.y, d2 = a * a + b * b;
        if (d2 < LINK * LINK) {
          ctx.strokeStyle = `rgba(${SEAL},${(1 - Math.sqrt(d2) / LINK) * 0.14})`;
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.fillStyle = `rgba(${SEAL},0.4)`;
      ctx.arc(n.x, n.y, 1.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  const onMove = (e: PointerEvent) => {
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
    if (!mouse.active) { mouse.x = e.clientX; mouse.y = e.clientY; }
    mouse.active = true;
  };
  const onLeave = () => { mouse.active = false; mouse.tx = -9999; mouse.ty = -9999; };
  const onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduce) raf = requestAnimationFrame(frame);
  };
  const onResize = () => { resize(); if (reduce) drawStatic(); };

  resize();
  if (reduce) {
    drawStatic();
  } else {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);
  }
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerout", onLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
  };
}
