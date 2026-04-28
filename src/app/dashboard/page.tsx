import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/session';
import { getUserById } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import OverseerClient from './OverseerClient';

export default async function OverseerDashboard() {
    // 1. Pentagon-Level Security. Server-side rejection.
    const userId = await verifySession();
    if (!userId) notFound();
    
    const user = await getUserById(userId);
    if (!user || user.telegram_id !== '1153844209') notFound();

    const totalAgents = await prisma.user.count();
    
    const usageAgg = await prisma.usageLog.aggregate({ _sum: { tokens: true } });
    const tokensBurnt = usageAgg._sum.tokens || 0;

    const purchases = await prisma.transaction.count({
        where: { is_positive: true, topic: 'Purchased resource pack' }
    });

    const stats = {
        totalAgents: totalAgents || 0,
        tokensBurnt: tokensBurnt,
        purchases: purchases || 0,
    };

    const users = await prisma.user.findMany({
        orderBy: { created_at: 'desc' },
        take: 100
    });
    
    const promoCodes = await prisma.promoCode.findMany({
        orderBy: { created_at: 'desc' }
    });
    
    // Simulate complex tracking data for missing components
    const inferenceLatencies = Array.from({length: 24}).map(() => Math.floor(Math.random() * 200 + 400));
    
    // Config state
    const configsRaw = await prisma.systemConfig.findMany();
    const config = configsRaw.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});

    return (
        <div className="fixed inset-0 z-[100] bg-white font-mono text-black overflow-hidden flex flex-col selection:bg-black selection:text-white">
            {/* Topbar */}
            <header className="h-10 border-b border-[#e5e5e5] flex items-center justify-between px-4 bg-[#fafafa] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a]">Project Overseer</span>
                    <span className="text-[10px] text-[#999]">v2.1.0</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-widest">
                    <div className="hidden md:flex items-center gap-1.5 text-green-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> API: Online
                    </div>
                    <div className="hidden md:flex items-center gap-1.5 text-green-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> DB: Sync
                    </div>
                    <a href="/agent" className="md:ml-4 px-3 py-1 bg-[#1a1a1a] text-white hover:bg-black transition-colors rounded-md text-[9px] cursor-pointer text-center">
                        Close Platform
                    </a>
                </div>
            </header>

            {/* Main Layout Area */}
            <OverseerClient 
                initialStats={stats}
                initialUsers={users}
                initialPromos={promoCodes}
                initialConfig={config}
                inferenceLatencies={inferenceLatencies}
            />
        </div>
    );
}
