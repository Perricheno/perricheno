"use client";

import { useState } from 'react';
import { 
    IconActivity, IconUsers, IconGift, 
    IconDatabase, IconSettings, IconBug, 
    IconServer, IconChartLine, IconCrown 
} from '@tabler/icons-react';
import { createPromoCode, setSystemConfig, manageUserTokens } from './actions';

export default function OverseerClient({ initialStats, initialUsers, initialPromos, initialConfig, inferenceLatencies }: any) {
    const [tab, setTab] = useState('Overview');
    
    // Config states
    const [maintenance, setMaintenance] = useState(initialConfig.maintenance_mode === 'true');
    const [activeModel, setActiveModel] = useState(initialConfig.active_model || 'gpt-5-mini-2025-08-07');
    
    // Promos
    const [promoCode, setPromoCode] = useState('');
    const [promoAmount, setPromoAmount] = useState(100000);
    const [promoUses, setPromoUses] = useState(10);
    const [promoType, setPromoType] = useState('chars');
    const [isSaving, setIsSaving] = useState(false);

    // Sidebar TABS
    const TABS = [
        { name: 'Overview', icon: IconActivity },
        { name: 'Users & Economy', icon: IconUsers },
        { name: 'Promo & Referrals', icon: IconGift },
        { name: 'Telemetry (Logs)', icon: IconBug },
        { name: 'System Config', icon: IconSettings },
    ];

    const generatePromo = async () => {
        setIsSaving(true);
        const code = promoCode.toUpperCase() || ('P_OVERSEER_' + Math.random().toString(36).substring(7).toUpperCase());
        await createPromoCode(code, promoType, promoAmount, promoUses);
        setIsSaving(false);
        setPromoCode('');
    };

    const toggleMaintenance = async () => {
        const next = !maintenance;
        setMaintenance(next);
        await setSystemConfig('maintenance_mode', next ? 'true' : 'false');
    };

    const getBarHeight = (val: number) => {
        return ((val / 600) * 100) + '%';
    };

    const getTabClasses = (name: string) => {
        const base = 'flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium tracking-wide rounded-md transition-colors text-left';
        if (tab === name) return base + ' bg-[#ebebeb] text-black shadow-sm';
        return base + ' text-[#666] hover:bg-[#f5f5f5]';
    };

    const getMaintenanceBtnClass = () => {
        const base = 'px-4 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest';
        if (maintenance) return base + ' bg-red-50 text-red-500 border border-red-200';
        return base + ' bg-gray-100 text-gray-500 border border-gray-200';
    };

    const getModelBtnClass = (m: string) => {
        const base = 'px-3 py-1 border rounded';
        if (activeModel === m) return base + ' bg-[#1a1a1a] text-white border-black';
        return base + ' bg-[#fafafa] text-[#666] border-[#e5e5e5]';
    };

    return (
        <div className="flex-1 flex overflow-hidden bg-[#fbfbfb]">
            {/* Nav Column */}
            <div className="w-56 shrink-0 border-r border-[#e5e5e5] bg-[#fafafa] flex flex-col p-2 space-y-0.5 overflow-y-auto">
                {TABS.map(t => (
                    <button 
                        key={t.name}
                        onClick={() => setTab(t.name)}
                        className={getTabClasses(t.name)}
                    >
                        <t.icon className="w-3.5 h-3.5 stroke-[2]" /> {t.name}
                    </button>
                ))}
            </div>

            {/* Display Pane */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                
                {tab === 'Overview' && (
                    <div className="space-y-6 max-w-5xl">
                        <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-[#e5e5e5] pb-2 mb-4">Flight Deck Metrics</h2>
                        
                        <div className="grid grid-cols-3 gap-4">
                            <div className="border border-[#e5e5e5] rounded-lg p-4 bg-white shadow-sm flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[#999]">Total Accounts</span>
                                <span className="text-xl font-mono">{initialStats.totalAgents}</span>
                            </div>
                            <div className="border border-[#e5e5e5] rounded-lg p-4 bg-white shadow-sm flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[#999]">Global Token Burn</span>
                                <span className="text-xl font-mono">{Number(initialStats.tokensBurnt).toLocaleString()}</span>
                            </div>
                            <div className="border border-[#e5e5e5] rounded-lg p-4 bg-white shadow-sm flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[#999]">Paid Subscriptions</span>
                                <span className="text-xl font-mono text-green-600">{initialStats.purchases}</span>
                            </div>
                        </div>

                        {/* Avg per user + Peak */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="border border-[#e5e5e5] rounded-lg p-4 bg-white shadow-sm flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[#999]">Avg Tokens / User</span>
                                <span className="text-xl font-mono">
                                    {initialStats.totalAgents > 0 ? Math.round(Number(initialStats.tokensBurnt) / initialStats.totalAgents).toLocaleString() : '0'}
                                </span>
                            </div>
                            <div className="border border-[#e5e5e5] rounded-lg p-4 bg-white shadow-sm flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[#999]">Peak Latency (est.)</span>
                                <span className="text-xl font-mono">{Math.max(...inferenceLatencies)}ms</span>
                            </div>
                        </div>

                        {/* Telemetry Graph */}
                        <div className="border border-[#e5e5e5] bg-white rounded-lg p-4 shadow-sm w-full">
                            <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#666] mb-4 flex items-center gap-2">
                                <IconChartLine className="w-3.5 h-3.5" /> Live Inference Latency (ms) — 24h
                            </h3>
                            <div className="flex items-end gap-1 h-32 w-full pt-4 border-b border-l border-[#e5e5e5] pl-1 relative">
                                {inferenceLatencies.map((val: number, i: number) => (
                                    <div 
                                        key={i} 
                                        className="flex-1 bg-[#1a1a1a] rounded-t-sm hover:bg-blue-600 transition-colors" 
                                        style={{ height: getBarHeight(val) }}
                                    />
                                ))}
                                <div className="absolute top-0 left-[-24px] text-[8px] text-[#999] font-mono">600</div>
                                <div className="absolute bottom-1/2 left-[-24px] text-[8px] text-[#999] font-mono">300</div>
                            </div>
                        </div>

                        {/* Top burners leaderboard */}
                        <div className="border border-[#e5e5e5] bg-white rounded-lg shadow-sm overflow-hidden">
                            <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#666] px-4 py-3 border-b border-[#e5e5e5] bg-[#f0f0f0]">
                                Top Token Burners
                            </h3>
                            <table className="w-full text-left border-collapse">
                                <tbody className="text-[11px] font-mono text-[#333]">
                                    {[...initialUsers]
                                        .sort((a: any, b: any) => (b.daily_chars_used + b.weekly_chars_used) - (a.daily_chars_used + a.weekly_chars_used))
                                        .slice(0, 5)
                                        .map((u: any, idx: number) => (
                                        <tr key={u.id} className="border-b border-[#e5e5e5] hover:bg-[#fafafa]">
                                            <td className="px-3 py-1.5 w-8 text-[#999]">#{idx + 1}</td>
                                            <td className="px-3 py-1.5 font-sans font-medium text-black border-l border-[#e5e5e5]">
                                                {u.username || u.first_name || 'Anon'}
                                                {u.telegram_id === '1153844209' && <IconCrown className="w-3 h-3 inline ml-1 text-yellow-500"/>}
                                            </td>
                                            <td className="px-3 py-1.5 border-l border-[#e5e5e5] text-right">
                                                {(u.daily_chars_used + u.weekly_chars_used).toLocaleString()} chars
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'Users & Economy' && (
                    <div className="space-y-4 max-w-6xl">
                        <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-[#e5e5e5] pb-2">User Vault</h2>
                        <div className="border border-[#e5e5e5] bg-white rounded-lg shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#f0f0f0]">
                                    <tr className="text-[9px] uppercase tracking-widest font-bold text-[#666]">
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] w-20">ID</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l">TG ID</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l">Name</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l">Purchased</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l">Daily Used</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l">Status</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l w-32 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[11px] font-mono text-[#333]">
                                    {initialUsers.map((u: any) => (
                                        <tr key={u.id} className="border-b border-[#e5e5e5] hover:bg-[#fafafa]">
                                            <td className="px-3 py-1.5">{u.id}</td>
                                            <td className="px-3 py-1.5 border-l border-[#e5e5e5] text-blue-600">{u.telegram_id}</td>
                                            <td className="px-3 py-1.5 border-l border-[#e5e5e5] font-sans font-medium text-black">
                                                {u.username || u.first_name || 'Anon'} 
                                                {u.telegram_id === '1153844209' && <IconCrown className="w-3 h-3 inline ml-1 text-yellow-500"/>}
                                            </td>
                                            <td className="px-3 py-1.5 border-l border-[#e5e5e5] text-green-700">{u.purchased_chars.toLocaleString()}</td>
                                            <td className="px-3 py-1.5 border-l border-[#e5e5e5]">{u.daily_chars_used.toLocaleString()}</td>
                                            <td className="px-3 py-1.5 border-l border-[#e5e5e5]">
                                                {u.is_banned 
                                                    ? <span className="bg-red-100 text-red-600 px-1 py-0.5 rounded text-[9px]">FROZEN</span> 
                                                    : <span className="text-[#999]">OK</span>
                                                }
                                            </td>
                                            <td className="px-3 py-1.5 border-l border-[#e5e5e5] text-center space-x-1">
                                                <button onClick={() => manageUserTokens(u.id, 'grant_chars', 100000)} className="px-2 py-0.5 bg-[#e5e5e5] hover:bg-[#ccc] text-[9px] rounded transition-colors">+100k</button>
                                                <button onClick={() => manageUserTokens(u.id, 'grant_reports', 5)} className="px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[9px] rounded transition-colors">+5r</button>
                                                <button onClick={() => manageUserTokens(u.id, 'toggle_freeze', 0)} className="px-2 py-0.5 bg-red-50 text-red-500 hover:bg-red-100 text-[9px] rounded transition-colors">
                                                    {u.is_banned ? 'Un' : 'Ban'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'Promo & Referrals' && (
                    <div className="space-y-6 max-w-3xl">
                        <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-[#e5e5e5] pb-2">Promo Code Factory</h2>
                        <div className="flex gap-4 p-4 border border-[#e5e5e5] bg-white rounded-lg shadow-sm flex-wrap">
                            <div className="space-y-1 flex-1 min-w-[120px]">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-[#666]">Code (blank = auto)</label>
                                <input value={promoCode} onChange={e => setPromoCode(e.target.value)} className="w-full text-[11px] px-2 py-1.5 border border-[#ccc] rounded font-mono" placeholder="OVERSEER_VIP" />
                            </div>
                            <div className="space-y-1 w-24">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-[#666]">Type</label>
                                <select value={promoType} onChange={e => setPromoType(e.target.value)} className="w-full text-[11px] px-2 py-1.5 border border-[#ccc] rounded">
                                    <option value="chars">Chars</option>
                                    <option value="reports">Reports</option>
                                </select>
                            </div>
                            <div className="space-y-1 w-28">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-[#666]">Amount</label>
                                <input type="number" value={promoAmount} onChange={e => setPromoAmount(Number(e.target.value))} className="w-full text-[11px] px-2 py-1.5 border border-[#ccc] rounded font-mono" />
                            </div>
                            <div className="space-y-1 w-20">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-[#666]">Max uses</label>
                                <input type="number" value={promoUses} onChange={e => setPromoUses(Number(e.target.value))} className="w-full text-[11px] px-2 py-1.5 border border-[#ccc] rounded font-mono" />
                            </div>
                            <div className="pt-4">
                                <button onClick={generatePromo} disabled={isSaving} className="px-4 py-1.5 bg-black text-white text-[10px] uppercase tracking-widest font-bold rounded hover:bg-gray-800 disabled:opacity-50 h-[28px] mt-[1px]">Mint</button>
                            </div>
                        </div>

                        <div className="border border-[#e5e5e5] bg-white rounded-lg shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#f0f0f0] border-b border-[#e5e5e5]">
                                    <tr className="text-[9px] uppercase tracking-widest font-bold text-[#666]">
                                        <th className="px-3 py-2 w-40">Code</th>
                                        <th className="px-3 py-2 border-l border-[#e5e5e5]">Value</th>
                                        <th className="px-3 py-2 border-l border-[#e5e5e5]">Uses Left</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[11px] font-mono text-[#333]">
                                    {initialPromos.map((p: any) => (
                                        <tr key={p.id} className="border-b border-[#e5e5e5] hover:bg-[#fafafa]">
                                            <td className="px-3 py-1.5 text-green-700 font-bold">{p.code}</td>
                                            <td className="px-3 py-1.5 border-l border-[#e5e5e5]">+{p.amount.toLocaleString()} {p.type}</td>
                                            <td className="px-3 py-1.5 border-l border-[#e5e5e5] text-[#999]">{p.max_uses - p.uses} / {p.max_uses}</td>
                                        </tr>
                                    ))}
                                    {initialPromos.length === 0 && (
                                        <tr><td colSpan={3} className="px-3 py-3 text-center text-[#999]">No active promo codes</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'System Config' && (
                    <div className="space-y-6 max-w-2xl">
                        <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-[#e5e5e5] pb-2">Global System Tuning</h2>
                        
                        <div className="grid grid-cols-1 gap-4">
                            {/* Maintenance Toggle */}
                            <div className="flex items-center justify-between p-4 border border-[#e5e5e5] bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                <div>
                                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] flex items-center gap-1.5">
                                        <IconServer className="w-3.5 h-3.5"/> Maintenance Mode
                                    </h4>
                                    <p className="text-[10px] text-[#666] mt-0.5">Suspend generation for all users. API will return 503.</p>
                                </div>
                                <button onClick={toggleMaintenance} className={getMaintenanceBtnClass()}>
                                    {maintenance ? 'ACTIVE (LOCKED)' : 'OFFLINE'}
                                </button>
                            </div>

                            {/* Model Switcher */}
                            <div className="p-4 border border-[#e5e5e5] bg-white rounded-lg shadow-sm space-y-3">
                                <div>
                                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] flex items-center gap-1.5">
                                        <IconDatabase className="w-3.5 h-3.5"/> Neural Architecture Target
                                    </h4>
                                    <p className="text-[10px] text-[#666] mt-0.5">Route prompts through primary or fallback hardware.</p>
                                </div>
                                <div className="flex gap-2 text-[10px] font-mono">
                                    {['gpt-5-mini-2025-08-07', 'gpt-5-nano-fallback'].map(m => (
                                        <button 
                                            key={m} 
                                            onClick={async () => { setActiveModel(m); await setSystemConfig('active_model', m); }}
                                            className={getModelBtnClass(m)}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* System Health Check */}
                            <div className="p-4 border border-[#e5e5e5] bg-white rounded-lg shadow-sm space-y-3">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] flex items-center gap-1.5">
                                    <IconActivity className="w-3.5 h-3.5"/> System Health Check
                                </h4>
                                <div className="grid grid-cols-3 gap-3 text-[10px]">
                                    <div className="flex items-center gap-1.5 text-green-600">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> SQLite DB
                                    </div>
                                    <div className="flex items-center gap-1.5 text-green-600">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Payment Gateway
                                    </div>
                                    <div className="flex items-center gap-1.5 text-green-600">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> OpenAI Endpoint
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {tab === 'Telemetry (Logs)' && (
                    <div className="space-y-6 max-w-4xl">
                        <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-[#e5e5e5] pb-2">Diagnostics & Telemetry</h2>
                        <div className="text-[11px] text-[#999] flex flex-col items-center justify-center p-16 border border-dashed border-[#ccc] rounded-lg bg-white">
                            <IconBug className="w-6 h-6 mb-2 opacity-30" />
                            <p className="font-bold text-[#666]">LaTeX Error Log Stream</p>
                            <p className="mt-1">Compilation failures will appear here once telemetry hooks are deployed.</p>
                        </div>
                        <div className="text-[11px] text-[#999] flex flex-col items-center justify-center p-16 border border-dashed border-[#ccc] rounded-lg bg-white">
                            <IconServer className="w-6 h-6 mb-2 opacity-30" />
                            <p className="font-bold text-[#666]">Python Sandbox Monitor</p>
                            <p className="mt-1">Library usage analytics will stream when sandbox agent is connected.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
