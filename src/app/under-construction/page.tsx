'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { IconTool, IconArrowLeft, IconSparkles, IconCode, IconCpu } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

export default function UnderConstructionPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Background floating particles
  const particles = Array.from({ length: 30 });

  return (
    <div className="relative min-h-screen bg-[#000d08] text-[#E0F2E9] overflow-hidden flex flex-col items-center justify-center font-sans">
      
      {/* 1. Animated Background Gradients */}
      <motion.div 
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" 
      />
      <motion.div 
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
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
            animate={{
              y: [null, Math.random() * -500],
              opacity: [null, 0]
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {i % 3 === 0 ? <IconCode size={40} /> : i % 2 === 0 ? <IconCpu size={30} /> : '1010'}
          </motion.div>
        ))}
      </div>

      {/* 3. Main Content Container */}
      <div className="z-10 flex flex-col items-center text-center max-w-3xl mx-auto px-6">
        
        {/* Floating Icon Orb */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="relative group mb-12"
        >
          {/* Pulsing rings */}
          <motion.div 
            animate={{ scale: [1, 1.5, 2], opacity: [0.5, 0, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 bg-emerald-500 rounded-full blur-md" 
          />
          <motion.div 
            animate={{ scale: [1, 1.2, 1.5], opacity: [0.3, 0, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            className="absolute inset-0 bg-teal-400 rounded-full blur-lg" 
          />

          <motion.div 
            animate={{ y: [-10, 10, -10], rotate: [-2, 2, -2] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-32 h-32 bg-gradient-to-br from-[#002a1b] to-[#00170f] border-2 border-emerald-500/40 rounded-[2rem] shadow-[0_0_40px_rgba(16,185,129,0.3)] flex items-center justify-center backdrop-blur-xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
            <IconTool className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            
            {/* Sparkle animations */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 pointer-events-none"
            >
              <IconSparkles className="absolute top-4 right-4 w-6 h-6 text-teal-300" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Text Section */}
        <motion.div 
          initial={{ y: 30, opacity: 0, filter: "blur(10px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-6 mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium tracking-wide uppercase mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            System Upgrade
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-emerald-600 drop-shadow-lg">
            В РАЗРАБОТКЕ
          </h1>
          
          <p className="text-emerald-400/70 text-xl md:text-2xl max-w-2xl mx-auto font-light leading-relaxed">
            Мы собираем квантовые кубиты и полируем интерфейсы. 
            Этот модуль проходит глубокую модернизацию.
          </p>
        </motion.div>

        {/* Action Button */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Link href="/dashboard" className="group relative inline-flex items-center gap-3 px-8 py-4 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/30 rounded-2xl text-emerald-300 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:-translate-y-1 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            <IconArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-lg tracking-wide">Вернуться в систему</span>
          </Link>
        </motion.div>
      </div>
      
      {/* 4. Global Noise & Grid Overlays */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] pointer-events-none mix-blend-overlay" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b9810a_1px,transparent_1px),linear-gradient(to_bottom,#10b9810a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      
    </div>
  );
}
