'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { EB_Garamond, IBM_Plex_Mono, Syne } from 'next/font/google';

const garamond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-garamond',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-mono-px',
});
const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
});

// ─── Floating LaTeX strings ────────────────────────────────────────────────────

const FLOAT_EQ = [
  String.raw`\text{Attention}(Q,K,V) = \text{softmax}\!\left(\tfrac{QK^\top}{\sqrt{d_k}}\right)V`,
  String.raw`\mathcal{L}_{\theta} = -\sum_{i} y_i \log \hat{y}_i`,
  String.raw`\nabla_\theta J = \mathbb{E}_\pi\!\left[\nabla_\theta \log \pi_\theta(a|s)\cdot Q^\pi\right]`,
  String.raw`p(z \mid x) = \frac{p(x \mid z)\,p(z)}{p(x)}`,
  String.raw`\mathbf{h}_t = \tanh\!\left(\mathbf{W}_h \mathbf{h}_{t-1} + \mathbf{W}_x \mathbf{x}_t\right)`,
  String.raw`\text{KL}(p \| q) = \int p(x)\log\tfrac{p(x)}{q(x)}\,dx`,
  String.raw`\hat{y} = \arg\max_{y}\; P(y \mid x;\,\theta)`,
  String.raw`\mathcal{F} = \mathbb{E}_{q}\!\left[\log p(x|z)\right] - \text{KL}(q \| p)`,
  String.raw`\sigma(z) = \frac{1}{1+e^{-z}}`,
  String.raw`\text{BLEU} = \mathrm{BP}\cdot\exp\!\left(\sum_{n=1}^{N} w_n \log p_n\right)`,
];

// ─── Neural canvas ─────────────────────────────────────────────────────────────

function useNeuralCanvas(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let id: number;
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const N = 38, D = 130;
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random() * (c.width || 1200),
      y: Math.random() * (c.height || 800),
      vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .18,
      r: Math.random() * 1.4 + .9,
      p: Math.random() * Math.PI * 2, pd: Math.random() > .5 ? 1 : -1,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy; n.p += .014 * n.pd;
        if (n.x < 0 || n.x > c.width)  n.vx *= -1;
        if (n.y < 0 || n.y > c.height) n.vy *= -1;
      }
      for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
        const d = Math.hypot(nodes[i].x-nodes[j].x, nodes[i].y-nodes[j].y);
        if (d < D) {
          ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(26,26,26,${(1-d/D)*.07})`; ctx.lineWidth = .55; ctx.stroke();
        }
      }
      for (const n of nodes) {
        const g = .45 + Math.sin(n.p) * .22;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(26,26,26,${g*.3})`; ctx.fill();
      }
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize); };
  }, [ref]);
}

// ─── Typewriter ────────────────────────────────────────────────────────────────

const PHRASES = [
  'fetching citations from arXiv…',
  'querying OpenAlex index…',
  'compiling bibliography…',
  'rendering Python figures…',
  'typesetting LaTeX document…',
  'repairing compilation errors…',
  'exporting to PDF…',
];

function useTypewriter(phrases: string[], speed = 48, pause = 2200) {
  const [text, setText] = useState('');
  const [idx, setIdx]   = useState(0);
  const [del, setDel]   = useState(false);
  useEffect(() => {
    const cur = phrases[idx % phrases.length];
    const t = setTimeout(() => {
      if (!del) {
        setText(cur.slice(0, text.length + 1));
        if (text.length + 1 === cur.length) setTimeout(() => setDel(true), pause);
      } else {
        setText(cur.slice(0, text.length - 1));
        if (text.length - 1 === 0) { setDel(false); setIdx(i => i+1); }
      }
    }, del ? speed/2 : speed);
    return () => clearTimeout(t);
  }, [text, del, idx, phrases, speed, pause]);
  return text;
}

// ─── Compile log ───────────────────────────────────────────────────────────────

const LOG_ENTRIES = [
  { ok: true,  line: 'pdflatex engine ············· v3.14159' },
  { ok: true,  line: 'arXiv index ················· connected' },
  { ok: true,  line: 'OpenAlex index ·············· connected' },
  { ok: false, line: 'citations resolver ·········· building' },
  { ok: true,  line: 'Python runtime (matplotlib) · ready' },
  { ok: true,  line: 'R runtime (ggplot2) ·········· ready' },
  { ok: false, line: 'LaTeX compiler pipeline ····· assembling' },
  { ok: true,  line: 'bibliography (.bib) ·········· indexed' },
  { ok: false, line: 'PDF export pipeline ·········· pending' },
  { ok: true,  line: 'OCR engine ··················· loaded' },
];

function useCompileLog() {
  const [lines, setLines] = useState(LOG_ENTRIES.slice(0, 3));
  useEffect(() => {
    let i = 3;
    const id = setInterval(() => {
      setLines(p => [...p.slice(-4), LOG_ENTRIES[i % LOG_ENTRIES.length]]);
      i++;
    }, 1700);
    return () => clearInterval(id);
  }, []);
  return lines;
}

// ─── Floating equation positions ──────────────────────────────────────────────

const EQ_POSITIONS = [
  { top: '10%',  left: '2%',   delay: 0,    dur: 18 },
  { top: '22%',  right: '2%',  delay: 2.5,  dur: 22 },
  { top: '42%',  left: '1%',   delay: 5,    dur: 20 },
  { top: '62%',  right: '3%',  delay: 1.5,  dur: 17 },
  { top: '78%',  left: '3%',   delay: 3.5,  dur: 24 },
  { top: '88%',  right: '2%',  delay: 6,    dur: 19 },
  { top: '6%',   right: '22%', delay: 4,    dur: 21 },
  { top: '50%',  left: '24%',  delay: 7,    dur: 16 },
  { top: '32%',  left: '60%',  delay: 2,    dur: 23 },
  { top: '70%',  right: '22%', delay: 8,    dur: 20 },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function UnderConstructionPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useNeuralCanvas(canvasRef);
  const typed = useTypewriter(PHRASES);
  const logs  = useCompileLog();

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  return (
    <>
      <style>{`
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scanv   { 0%{top:-1px;opacity:0} 6%{opacity:1} 94%{opacity:.35} 100%{top:100%;opacity:0} }
        @keyframes floateq { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadein  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

        .cursor { animation: blink 1s step-end infinite; }
        .scan-line {
          position:absolute; left:0; right:0; height:1px; pointer-events:none; z-index:1;
          background: linear-gradient(90deg,transparent,rgba(26,26,26,.1) 25%,rgba(26,26,26,.1) 75%,transparent);
          animation: scanv 11s linear infinite;
        }
        .eq-float { animation: floateq var(--dur,20s) ease-in-out var(--delay,0s) infinite; }
      `}</style>

      <div
        className={`relative min-h-screen flex flex-col overflow-hidden
          ${garamond.variable} ${mono.variable} ${syne.variable}`}
        style={{ background: 'var(--background)', color: 'var(--foreground)' }}
      >
        {/* Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />

        {/* Scan line */}
        <div className="scan-line" />

        {/* Floating LaTeX equations */}
        {FLOAT_EQ.map((eq, i) => {
          const pos = EQ_POSITIONS[i];
          return (
            <motion.div
              key={i}
              className="eq-float absolute pointer-events-none select-none hidden lg:block"
              style={{
                ...pos,
                fontFamily: 'var(--font-mono-px)',
                fontSize: '10px',
                color: 'var(--foreground)',
                opacity: 0,
                maxWidth: '320px',
                letterSpacing: '.03em',
                lineHeight: 1.4,
                ['--dur' as string]: `${pos.dur}s`,
                ['--delay' as string]: `${pos.delay}s`,
                zIndex: 1,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.09 }}
              transition={{ delay: 1.5 + i * 0.2, duration: 1.5 }}
            >
              {eq}
            </motion.div>
          );
        })}

        {/* ── TOP BAR ─────────────────────────────────────────── */}
        <motion.header
          className="relative z-10 flex items-center justify-between px-6 md:px-10 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span style={{ fontFamily: 'var(--font-mono-px)', fontSize: '10.5px', color: 'var(--muted)', letterSpacing: '.12em' }}>
            \documentclass[12pt]&#123;perricheno&#125;
          </span>
          <div className="hidden md:flex items-center gap-5"
            style={{ fontFamily: 'var(--font-mono-px)', fontSize: '10px', color: 'var(--muted)', letterSpacing: '.08em' }}>
            <span>{dateStr}</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{ color: 'var(--foreground)', opacity: .45 }}>compile status:</span>
            <span>
              <span style={{ animation: 'blink 1.4s ease-in-out infinite', display: 'inline-block',
                width: 6, height: 6, borderRadius: '50%', background: 'var(--foreground)',
                opacity: .4, marginRight: 6, verticalAlign: 'middle' }} />
              building
            </span>
          </div>
        </motion.header>

        {/* ── MAIN ────────────────────────────────────────────── */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10">

          {/* \maketitle block */}
          <motion.div
            className="flex flex-col items-center text-center"
            style={{ maxWidth: 560 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.9 }}
          >
            {/* Logo */}
            <motion.div
              className="relative mb-8"
              initial={{ opacity: 0, scale: .94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 1.0, ease: [.22, 1, .36, 1] }}
            >
              {/* Corner brackets */}
              {[
                { top: 0, left: 0, rotate: '0deg' },
                { top: 0, right: 0, rotate: '90deg' },
                { bottom: 0, right: 0, rotate: '180deg' },
                { bottom: 0, left: 0, rotate: '270deg' },
              ].map((b, i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 14 14"
                  style={{ position: 'absolute', ...b, opacity: .38 }}>
                  <path d={`M0 8 L0 0 L8 0`} fill="none"
                    stroke="var(--foreground)" strokeWidth="1.4"
                    transform={`rotate(${b.rotate}, 7, 7)`} />
                </svg>
              ))}
              <div className="p-6">
                <div className="relative w-20 h-20 md:w-28 md:h-28">
                  <Image src="/newlogo.png" alt="Perricheno" fill className="object-contain" priority />
                </div>
              </div>
            </motion.div>

            {/* \author tag */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.8 }}
              style={{ fontFamily: 'var(--font-mono-px)', fontSize: '10px',
                color: 'var(--muted)', letterSpacing: '.2em', marginBottom: '0.75rem' }}
            >
              \title&#123;
            </motion.div>

            {/* Main headline */}
            <motion.h1
              style={{ fontFamily: 'var(--font-syne)', fontWeight: 800,
                fontSize: 'clamp(2.4rem, 6vw, 4.6rem)', lineHeight: .94,
                letterSpacing: '-.03em', color: 'var(--accent)', margin: 0 }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.9, ease: [.22, 1, .36, 1] }}
            >
              Research, Write,
            </motion.h1>
            <motion.h1
              style={{ fontFamily: 'var(--font-syne)', fontWeight: 800,
                fontSize: 'clamp(2.4rem, 6vw, 4.6rem)', lineHeight: 1.0,
                letterSpacing: '-.03em', color: 'var(--accent)', margin: 0, marginBottom: '.6rem' }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.76, duration: 0.9, ease: [.22, 1, .36, 1] }}
            >
              Cite. Compile.
            </motion.h1>

            {/* closing \title tag */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85, duration: 0.8 }}
              style={{ fontFamily: 'var(--font-mono-px)', fontSize: '10px',
                color: 'var(--muted)', letterSpacing: '.2em', marginBottom: '1.75rem' }}
            >
              &#125;
            </motion.div>

            {/* \begin{abstract} */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.95, duration: 0.8 }}
              className="w-full"
              style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                padding: '1rem 0', marginBottom: '1.75rem' }}
            >
              <div style={{ fontFamily: 'var(--font-mono-px)', fontSize: '9.5px',
                color: 'var(--border)', letterSpacing: '.25em', marginBottom: '.6rem' }}>
                \begin&#123;abstract&#125;
              </div>
              <p style={{ fontFamily: 'var(--font-garamond)', fontStyle: 'italic',
                fontSize: '1.05rem', lineHeight: 1.65, color: 'var(--foreground)',
                opacity: .72, margin: 0 }}>
                Perricheno turns a topic into a compiled LaTeX paper — with real citations
                from arXiv and OpenAlex, publication-ready R&nbsp;+&nbsp;Python figures,
                and shareable PDFs. Built for students and researchers who want depth,
                not boilerplate.
              </p>
              <div style={{ fontFamily: 'var(--font-mono-px)', fontSize: '9.5px',
                color: 'var(--border)', letterSpacing: '.25em', marginTop: '.6rem' }}>
                \end&#123;abstract&#125;
              </div>
            </motion.div>

            {/* Typewriter — compile progress */}
            <motion.div
              className="flex items-center gap-1 mb-7"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.05, duration: 0.8 }}
            >
              <span style={{ fontFamily: 'var(--font-mono-px)', fontSize: '11.5px',
                color: 'var(--muted)', letterSpacing: '.05em' }}>
                {typed}
              </span>
              <span className="cursor" style={{ color: 'var(--muted)',
                fontFamily: 'var(--font-mono-px)', fontSize: '13px' }}>▌</span>
            </motion.div>

            {/* Compile log card */}
            <motion.div
              className="w-full"
              style={{ background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '13px 16px', minHeight: 116 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15, duration: 0.8 }}
            >
              <div style={{ fontFamily: 'var(--font-mono-px)', fontSize: '9px',
                letterSpacing: '.2em', color: 'var(--muted)',
                borderBottom: '1px solid var(--border)',
                paddingBottom: 6, marginBottom: 7 }}>
                COMPILE LOG — LIVE
              </div>
              <AnimatePresence mode="popLayout">
                {logs.map((entry, i) => (
                  <motion.div key={entry.line + i}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                    style={{ display: 'flex', alignItems: 'baseline', gap: 8,
                      fontFamily: 'var(--font-mono-px)', fontSize: '10px',
                      letterSpacing: '.04em', lineHeight: 1.9,
                      color: entry.ok ? 'var(--foreground)' : 'var(--muted)' }}
                  >
                    <span style={{ opacity: entry.ok ? .9 : .45, minWidth: 28 }}>
                      {entry.ok ? '[ ✓ ]' : '[ · ]'}
                    </span>
                    {entry.line}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </main>

        {/* ── BOTTOM BAR ──────────────────────────────────────── */}
        <motion.footer
          className="relative z-10 flex items-center justify-between px-6 md:px-10 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
        >
          <span style={{ fontFamily: 'var(--font-mono-px)', fontSize: '10px',
            color: 'var(--muted)', letterSpacing: '.12em' }}>
            \end&#123;document&#125;
          </span>
          <div className="flex items-center gap-4"
            style={{ fontFamily: 'var(--font-mono-px)', fontSize: '10px',
              color: 'var(--border)', letterSpacing: '.08em' }}>
            <span>arXiv · OpenAlex · R · Python · LaTeX</span>
          </div>
        </motion.footer>
      </div>
    </>
  );
}