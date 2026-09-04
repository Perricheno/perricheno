import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX, IconUser, IconCreditCard, IconHistory, IconChartPie, IconDatabase, IconLayoutDashboard } from '@tabler/icons-react';

interface BillingLimits {
    free: { daily_chars: number; weekly_chars: number; reports: number; daily_visuals?: number; };
    plus?: { daily_chars: number; weekly_chars: number; reports: number; daily_visuals?: number; };
    pro?: { daily_chars: number; weekly_chars: number; reports: number; daily_visuals?: number; };
    ultra?: { daily_chars: number; weekly_chars: number; reports: number; daily_visuals?: number; };
}

interface UserInfo {
    id: number;
    telegram_id: string;
    username: string | null;
    first_name: string | null;
    photo_url: string | null;
    created_at: string;
    daily_chars_used: number;
    weekly_chars_used: number;
    purchased_chars: number;
    daily_visuals_used: number;
    purchased_visuals: number;
    daily_reports_used: number;
    purchased_reports: number;
    plan_tier: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    totalSessions: number;
}

export function AgentBillingModal({ isOpen, onClose, totalSessions }: Props) {
    const [activeTab, setActiveTab] = useState<'profile' | 'billing'>('billing');
    const [user, setUser] = useState<UserInfo | null>(null);
    const [limits, setLimits] = useState<BillingLimits | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                setLimits(data.limits);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            loadData();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCheckout = async (packId: string) => {
        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packId })
            });
            const data = await res.json();
            if (data.url) {
                window.open(data.url, '_blank');
            } else if (data.fallback_url) {
                // If Shop ID is missing, fallback to generic page
                window.open(data.fallback_url, '_blank');
            } else {
                alert('Checkout failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('Checkout error.');
        }
    };

    const renderProgressBar = (label: string, used: number, max: number, purchased: number) => {
        const dailyRemaining = Math.max(0, max - used);
        const totalRemaining = dailyRemaining + purchased;
        const totalMax = max + purchased;
        const percentage = Math.min(100, Math.max(0, (used / max) * 100)); // Just showing daily usage progression

        return (
            <div className="bg-[#FAFAFA] border border-gray-100 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between text-sm font-bold">
                    <span className="uppercase tracking-widest text-[#A1A1AA] text-[10px]">{label} Daily Quota</span>
                    <span className="text-black">{used.toLocaleString()} / {max.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-orange-400' : 'bg-black'}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                {purchased > 0 && (
                    <div className="flex items-center gap-2 pt-2 text-xs font-bold text-green-600">
                        <IconDatabase className="w-4 h-4" />
                        +{purchased.toLocaleString()} purchased roll-over tokens available
                    </div>
                )}
                {purchased === 0 && remainingText(dailyRemaining)}
            </div>
        );
    };

    const remainingText = (rem: number) => (
        <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest text-right">
            {rem > 0 ? `${rem.toLocaleString()} remaining today` : 'Limit exhausted! Buy packs.'}
        </p>
    );

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
                
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-3xl bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[85vh] md:h-[600px]">
                    
                    {/* Sidebar */}
                    <div className="w-full md:w-64 bg-[#FBFBFC] border-b md:border-b-0 md:border-r border-gray-100 shrink-0 flex flex-col p-6">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden">
                                {user?.photo_url ? <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover"/> : <IconUser className="w-6 h-6" />}
                            </div>
                            <div className="overflow-hidden">
                                <h3 className="font-black text-black truncate">{user?.first_name || 'User'}</h3>
                                <p className="text-[10px] text-[#A1A1AA] font-bold uppercase tracking-widest truncate">{user?.plan_tier || 'Free'} Tier</p>
                            </div>
                        </div>

                        <div className="space-y-2 flex-1">
                            <button onClick={() => setActiveTab('billing')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'billing' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:bg-gray-100 hover:text-black'}`}>
                                <IconCreditCard className="w-4 h-4" /> Quota & Plans
                            </button>
                            <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:bg-gray-100 hover:text-black'}`}>
                                <IconLayoutDashboard className="w-4 h-4" /> Analytics
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-white flex flex-col relative">
                        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-black bg-gray-50 hover:bg-gray-100 rounded-full transition-all z-10">
                            <IconX className="w-5 h-5" />
                        </button>

                        <div className="flex-1 overflow-auto p-8 md:p-10">
                            {loading || !user || !limits ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-black border-t-transparent animate-spin rounded-full" />
                                </div>
                            ) : (
                                activeTab === 'billing' ? (
                                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div>
                                            <h2 className="text-2xl font-black text-black mb-1">Compute Usage</h2>
                                            <p className="text-sm font-medium text-gray-400 mb-6 tracking-wide">Track your generation tokens. Limits reset based on schedule.</p>
                                            <div className="space-y-4">
                                                {renderProgressBar('Daily Characters', user.daily_chars_used, limits.free.daily_chars || 100000, user.purchased_chars)}
                                                {renderProgressBar('Weekly Characters', user.weekly_chars_used || 0, limits.free.weekly_chars || 500000, 0)}
                                                {renderProgressBar('Daily Visuals', user.daily_visuals_used, limits.free.daily_visuals || 150, user.purchased_visuals)}
                                            </div>
                                        </div>

                                        <div className="border border-gray-100 pt-8 mt-10 rounded-3xl p-6 bg-gradient-to-br from-gray-50 to-white shadow-sm ring-1 ring-gray-100">
                                            <h2 className="text-xl font-black text-black mb-1">Buy Resource Packs</h2>
                                            <p className="text-[12px] font-medium text-gray-500 mb-6">Need more power? Purchased tokens roll over until consumed.</p>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <button onClick={() => handleCheckout('data_scientist')} className="block group bg-white border border-gray-200 rounded-2xl p-5 hover:border-black transition-all hover:shadow-xl hover:-translate-y-1 text-left w-full text-black cursor-pointer">
                                                    <h3 className="text-sm font-black mb-2 text-black">Data Scientist Pack</h3>
                                                    <p className="text-xs text-gray-400 mb-4 whitespace-nowrap overflow-hidden text-ellipsis">2M Chars + 50 Visuals</p>
                                                    <div className="bg-black text-white text-[10px] font-black uppercase tracking-widest text-center py-2.5 rounded-lg group-hover:bg-[#1A1A1A]">Buy Now</div>
                                                </button>
                                                <button onClick={() => handleCheckout('researcher')} className="block group bg-black border border-black rounded-2xl p-5 hover:shadow-2xl hover:-translate-y-1 transition-all text-left w-full cursor-pointer text-white">
                                                    <h3 className="text-sm font-black mb-2 text-white">Researcher Bundle</h3>
                                                    <p className="text-xs text-gray-400 mb-4 whitespace-nowrap overflow-hidden text-ellipsis">5M Chars + 150 Visuals</p>
                                                    <div className="bg-white text-black text-[10px] font-black uppercase tracking-widest text-center py-2.5 rounded-lg group-hover:bg-gray-100">Buy Now</div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <h2 className="text-2xl font-black text-black mb-6">User Analytics</h2>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-[#FAFAFA] border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                                                <IconHistory className="w-8 h-8 text-black mb-3" stroke={1.5} />
                                                <div className="text-3xl font-black text-black mb-1">{totalSessions}</div>
                                                <div className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Total Projects</div>
                                            </div>
                                            <div className="bg-[#FAFAFA] border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                                                <IconChartPie className="w-8 h-8 text-black mb-3" stroke={1.5} />
                                                <div className="text-3xl font-black text-black mb-1">{user.daily_visuals_used + user.purchased_visuals /* estimate total since we only track daily cleanly right now */}</div>
                                                <div className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">Visuals Generated</div>
                                            </div>
                                        </div>

                                        <div className="bg-[#FAFAFA] border border-gray-100 rounded-2xl p-6">
                                            <h3 className="text-sm font-black text-black mb-4">Account Details</h3>
                                            <div className="space-y-3 whitespace-nowrap overflow-hidden">
                                                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-50">
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Telegram ID</span>
                                                    <span className="text-sm font-mono text-black">{user.telegram_id || 'Unknown'}</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-50">
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Join Date</span>
                                                    <span className="text-sm font-bold text-black">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
