'use client';

import Link from 'next/link';
import { motion, useMotionValue } from 'framer-motion';
import { IconArrowLeft } from '@tabler/icons-react';
import { useEffect, useState, useRef } from 'react';

// Минималистичная 3D Сфера (Blueprint / Чертежный стиль)
const WireframeSphere = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(20);
  const rotateY = useMotionValue(30);

  useEffect(() => {
    let animationFrame: number;
    let autoRotate = true;

    const animate = () => {
      if (autoRotate) {
        rotateY.set(rotateY.get() + 0.2);
        rotateX.set(rotateX.get() + 0.1);
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, [rotateX, rotateY]);

  const handleDrag = (event: any, info: any) => {
    rotateY.set(rotateY.get() + info.delta.x * 0.5);
    rotateX.set(rotateX.get() - info.delta.y * 0.5);
  };

  // Меридианы
  const meridians = Array.from({ length: 12 }).map((_, i) => (
    <div
      key={`meridian-${i}`}
      className="absolute inset-0 border border-[var(--foreground)] opacity-10 rounded-full"
      style={{ transform: `rotateY(${i * 15}deg)` }}
    />
  ));

  // Параллели
  const parallels = Array.from({ length: 9 }).map((_, i) => {
    const lat = -80 + (i + 1) * 16;
    const radius = Math.cos((lat * Math.PI) / 180) * 100;
    const translateZ = Math.sin((lat * Math.PI) / 180) * 100;

    return (
      <div
        key={`parallel-${i}`}
        className="absolute left-1/2 top-1/2 border border-[var(--foreground)] opacity-10 rounded-full"
        style={{
          width: `${radius}%`,
          height: `${radius}%`,
          transform: `translate(-50%, -50%) translateZ(${translateZ}px) rotateX(90deg)`,
        }}
      />
    );
  });

  return (
    <div 
      className="relative w-64 h-64 md:w-80 md:h-80 cursor-grab active:cursor-grabbing group perspective-1000 mb-10"
      ref={containerRef}
      onMouseEnter={() => document.body.style.userSelect = 'none'}
      onMouseLeave={() => document.body.style.userSelect = 'auto'}
    >
      <motion.div
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0}
        onDrag={handleDrag}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="w-full h-full relative z-10"
      >
        {meridians}
        {parallels}
        
        {/* Центральное ядро в стиле Apple Glass */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/40 border border-white/60 rounded-full shadow-[0_4px_30px_rgba(0,0,0,0.1)] backdrop-blur-md flex items-center justify-center">
          <div className="w-4 h-4 bg-[var(--foreground)] rounded-full animate-pulse opacity-80" />
        </div>
      </motion.div>
    </div>
  );
};

export default function UnderConstructionPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)] overflow-hidden flex flex-col items-center justify-center font-sans">
      
      {/* 1. Очень мягкие минималистичные градиенты на фоне */}
      <motion.div 
        animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.4, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-[var(--muted)]/20 rounded-full blur-[100px] pointer-events-none" 
      />

      {/* 2. Main Content Container */}
      <div className="z-10 flex flex-col items-center text-center max-w-3xl mx-auto px-6 mt-4">
        
        {/* ИНТЕРАКТИВНАЯ 3D СФЕРА */}
        <WireframeSphere />

        {/* Text Section */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="space-y-6 mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] text-xs font-semibold tracking-widest uppercase mb-2 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--foreground)] opacity-30"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--foreground)]"></span>
            </span>
            Модернизация
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[var(--foreground)]">
            В РАЗРАБОТКЕ
          </h1>
          
          <p className="text-[var(--muted)] text-lg md:text-xl max-w-lg mx-auto font-medium leading-relaxed">
            Мы проектируем этот раздел, чтобы он был безупречным. Скоро всё будет готово.
          </p>
        </motion.div>

        {/* Action Button */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link href="/dashboard" className="group relative inline-flex items-center gap-3 px-8 py-4 bg-[var(--card)] hover:bg-[var(--sidebar-bg)] border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <IconArrowLeft className="w-5 h-5 opacity-70 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-base tracking-wide">На главную</span>
          </Link>
        </motion.div>
      </div>
      
      {/* 3. Легкая сетка на фоне (Apple-style) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_30%,transparent_100%)] opacity-20 pointer-events-none" />
      
    </div>
  );
}
