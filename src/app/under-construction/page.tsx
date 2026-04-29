'use client';

import Link from 'next/link';
import { motion, useMotionValue } from 'framer-motion';
import { IconArrowLeft } from '@tabler/icons-react';
import { useEffect, useState, useRef } from 'react';

// Гигантская Сфера-Фон
const FullScreenSphere = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(10);
  const rotateY = useMotionValue(20);

  useEffect(() => {
    let animationFrame: number;
    let autoRotate = true;

    const animate = () => {
      if (autoRotate) {
        rotateY.set(rotateY.get() + 0.1); // Медленное вращение для гигантской сферы
        rotateX.set(rotateX.get() + 0.05);
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, [rotateX, rotateY]);

  const handleDrag = (event: any, info: any) => {
    // Вращение мышкой/пальцем
    rotateY.set(rotateY.get() + info.delta.x * 0.15);
    rotateX.set(rotateX.get() - info.delta.y * 0.15);
  };

  // МНОЖЕСТВО меридианов (36 штук, каждые 10 градусов)
  const meridians = Array.from({ length: 36 }).map((_, i) => (
    <div
      key={`meridian-${i}`}
      className="absolute inset-0 border border-[var(--foreground)] opacity-[0.04] rounded-full"
      style={{ transform: `rotateY(${i * 10}deg)` }}
    />
  ));

  // МНОЖЕСТВО параллелей (34 штуки)
  const parallels = Array.from({ length: 34 }).map((_, i) => {
    const lat = -85 + (i + 1) * 5; // шаг 5 градусов
    const radius = Math.cos((lat * Math.PI) / 180) * 100;
    const translateZ = Math.sin((lat * Math.PI) / 180) * 100;

    return (
      <div
        key={`parallel-${i}`}
        className="absolute left-1/2 top-1/2 border border-[var(--foreground)] opacity-[0.04] rounded-full"
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
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] sm:w-[120vw] sm:h-[120vw] lg:w-[90vw] lg:h-[90vw] max-w-[1500px] max-h-[1500px] cursor-grab active:cursor-grabbing perspective-[2000px] z-0"
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
        className="w-full h-full relative"
      >
        {meridians}
        {parallels}
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
      
      {/* 1. ГИГАНТСКАЯ ИНТЕРАКТИВНАЯ 3D СФЕРА НА ФОНЕ */}
      <FullScreenSphere />

      {/* 2. Контент поверх сферы (pointer-events-none чтобы клики проходили сквозь текст на сферу) */}
      <div className="z-10 flex flex-col items-center text-center px-6 pointer-events-none">
        
        {/* Text Section */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="space-y-6 mb-12 backdrop-blur-sm bg-[var(--background)]/30 p-8 rounded-3xl border border-[var(--border)]/50 shadow-2xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] text-xs font-semibold tracking-widest uppercase mb-2 shadow-sm pointer-events-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--foreground)] opacity-30"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--foreground)]"></span>
            </span>
            Система обновляется
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-[var(--foreground)]">
            В РАЗРАБОТКЕ
          </h1>
          
          <p className="text-[var(--muted)] text-lg md:text-xl max-w-lg mx-auto font-medium leading-relaxed">
            Мы проектируем этот раздел. Покрутите сферу, пока мы всё не настроим.
          </p>
        </motion.div>

        {/* Action Button (pointer-events-auto чтобы кнопка нажималась) */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="pointer-events-auto"
        >
          <Link href="/dashboard" className="group relative inline-flex items-center gap-3 px-8 py-4 bg-[var(--card)] hover:bg-[var(--sidebar-bg)] border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <IconArrowLeft className="w-5 h-5 opacity-70 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-base tracking-wide">Вернуться назад</span>
          </Link>
        </motion.div>
      </div>
      
    </div>
  );
}
