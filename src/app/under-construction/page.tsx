'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

export default function UnderConstructionPage() {
  return (
    <div className="relative min-h-screen bg-[var(--background)] flex flex-col items-center justify-center overflow-hidden">
      
      {/* Логотип, который крутится в 3D пространстве */}
      <motion.div
        animate={{ rotateY: 360 }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "linear" 
        }}
        className="relative w-32 h-32 md:w-48 md:h-48 drop-shadow-xl"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <Image
          src="/newlogo.png"
          alt="Perricheno Logo"
          fill
          className="object-contain"
          priority
        />
      </motion.div>

      {/* Маленький текст внизу */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="text-[var(--muted)] text-xs md:text-sm font-medium tracking-[0.3em] uppercase opacity-60">
          under development
        </span>
      </div>
      
    </div>
  );
}
