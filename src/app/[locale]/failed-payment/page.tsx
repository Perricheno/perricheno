import Link from 'next/link';
import { IconX, IconRefresh } from '@tabler/icons-react';

export default function FailedPayment() {
    return (
        <div className="min-h-screen bg-[#FBFBFC] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
            <div className="absolute inset-0 z-0 opacity-40">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[400px] bg-gradient-to-b from-red-100 to-transparent blur-3xl opacity-50" />
            </div>

            <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-2xl border border-gray-100 max-w-md w-full text-center relative z-10 animate-in zoom-in-95 fade-in duration-500">
                <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-500/30">
                    <IconX className="w-12 h-12 text-white" stroke={3} />
                </div>
                
                <h1 className="text-3xl font-black mb-3 tracking-tight text-black">Payment Failed</h1>
                <p className="text-[#A1A1AA] font-medium text-sm mb-10 leading-relaxed">
                    Something went wrong while processing your payment. You were not charged, and no subscription was activated. 
                </p>

                <div className="flex flex-col gap-3">
                    <Link href="/billings">
                        <button className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-[#222] transition-all shadow-xl active:scale-95 group">
                            <IconRefresh className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" /> Try Again
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
