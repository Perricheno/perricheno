import Link from 'next/link';
import { Construction, ArrowLeft, Wrench, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'В разработке | Perricheno',
  description: 'Эта страница сейчас находится в стадии разработки.',
};

export default function UnderConstructionPage() {
  return (
    <div className="min-h-screen bg-[#00170F] text-[#E0F2E9] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background glowing effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

      <div className="z-10 flex flex-col items-center text-center max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700">
        
        {/* Icon Container */}
        <div className="relative group">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl group-hover:bg-emerald-400/30 transition-all duration-500" />
          <div className="w-24 h-24 bg-[#002115] border border-emerald-500/30 rounded-3xl flex items-center justify-center relative overflow-hidden backdrop-blur-sm">
            <Construction className="w-12 h-12 text-emerald-400 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
            <Sparkles className="w-4 h-4 text-emerald-300 absolute top-4 right-4 animate-pulse" />
            <Wrench className="w-4 h-4 text-emerald-600/50 absolute bottom-4 left-4" />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-500">
            Страница в разработке
          </h1>
          <p className="text-emerald-400/80 text-lg md:text-xl max-w-lg mx-auto leading-relaxed">
            Мы активно работаем над этим разделом, чтобы сделать его идеальным. Скоро здесь появится что-то потрясающее!
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 transition-all duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:-translate-y-0.5 font-medium">
            <ArrowLeft className="w-5 h-5" />
            <span>Вернуться на главную</span>
          </Link>
        </div>
        
      </div>
      
      {/* Decorative grid pattern */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98111_1px,transparent_1px),linear-gradient(to_bottom,#10b98111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      
    </div>
  );
}
