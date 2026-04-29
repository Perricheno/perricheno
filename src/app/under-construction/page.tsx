'use client';

import Link from 'next/link';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { IconArrowLeft, IconCode, IconCpu } from '@tabler/icons-react';
import { useEffect, useState, useRef } from 'react';

// Интерактивная 3D Сфера (Blueprint / Чертежный стиль)
const WireframeSphere = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Motion values for rotation
  const rotateX = useMotionValue(20);
  const rotateY = useMotionValue(30);

  // Auto-rotation effect
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

  // Handle Dragging
  const handleDrag = (event: any, info: any) => {
    rotateY.set(rotateY.get() + info.delta.x * 0.5);
    rotateX.set(rotateX.get() - info.delta.y * 0.5);
  };

  // 12 меридианов (вертикальные кольца)
  const meridians = Array.from({ length: 12 }).map((_, i) => (
    <div
      key={`meridian-${i}`}
      className="absolute inset-0 border border-emerald-500/30 rounded-full"
      style={{ transform: `rotateY(${i * 15}deg)` }}
    />
  ));

  // 10 параллелей (горизонтальные кольца)
  const parallels = Array.from({ length: 9 }).map((_, i) => {
    const lat = -80 + (i + 1) * 16; // от -80 до 80 градусов
    const radius = Math.cos((lat * Math.PI) / 180) * 100;
    const translateZ = Math.sin((lat * Math.PI) / 180) * 100;

    return (
      <div
        key={`parallel-${i}`}
        className="absolute left-1/2 top-1/2 border border-emerald-500/20 rounded-full"
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
      className="relative w-64 h-64 md:w-80 md:h-80 cursor-grab active:cursor-grabbing group perspective-1000 mb-12"
      ref={containerRef}
      onMouseEnter={() => document.body.style.userSelect = 'none'}
      onMouseLeave={() => document.body.style.userSelect = 'auto'}
    >
      {/* Свечение за сферой */}
      <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-400/20 transition-all duration-500" />
      
      {/* Сама сфера */}
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
        
        {/* Ядро (Core) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-emerald-500/20 border border-emerald-400/50 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.5)] backdrop-blur-md flex items-center justify-center">
          <div className="w-4 h-4 bg-emerald-300 rounded-full animate-pulse shadow-[0_0_15px_#6ee7b7]" />
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

  const particles = Array.from({ length: 30 });

  return (
    <div className="relative min-h-screen bg-[#000d08] text-[#E0F2E9] overflow-hidden flex flex-col items-center justify-center font-sans selection:bg-emerald-500/30">
      
      {/* 1. Animated Background Gradients */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" 
      />
      <motion.div 
        animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-teal-600/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" 
      />

      {/* 2. Floating Code/Tech Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
        {particles.map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-emerald-500"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1000),
              scale: Math.random() * 0.5 + 0.5,
              opacity: Math.random() * 0.5 + 0.2
            }}
            animate={{ y: [null, Math.random() * -500], opacity: [null, 0] }}
            transition={{ duration: Math.random() * 10 + 10, repeat: Infinity, ease: "linear" }}
          >
            {i % 3 === 0 ? <IconCode size={40} /> : i % 2 === 0 ? <IconCpu size={30} /> : '1010'}
          </motion.div>
        ))}
      </div>

      {/* 3. Main Content Container */}
      <div className="z-10 flex flex-col items-center text-center max-w-4xl mx-auto px-6 mt-10">
        
        {/* ИНТЕРАКТИВНАЯ 3D СФЕРА */}
        <WireframeSphere />

        {/* Text Section */}
        <motion.div 
          initial={{ y: 30, opacity: 0, filter: "blur(10px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-6 mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium tracking-wide uppercase mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Сборка ядра системы
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-emerald-600 drop-shadow-lg">
            В РАЗРАБОТКЕ
          </h1>
          
          <p className="text-emerald-400/70 text-xl md:text-2xl max-w-2xl mx-auto font-light leading-relaxed">
            Мы проектируем нейронные связи и полируем интерфейсы. 
            Этот модуль проходит глубокую модернизацию архитектуры.
          </p>
        </motion.div>

        {/* Action Button */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Link href="/dashboard" className="group relative inline-flex items-center gap-3 px-8 py-4 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/30 rounded-2xl text-emerald-300 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:-translate-y-1 overflow-hidden backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            <IconArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-lg tracking-wide">Вернуться на главную</span>
          </Link>
        </motion.div>
      </div>
      
      {/* 4. Global Noise & Grid Overlays */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] pointer-events-none mix-blend-overlay" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b9810a_1px,transparent_1px),linear-gradient(to_bottom,#10b9810a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      
    </div>
  );
}
