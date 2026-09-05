"use client";

import { useState } from 'react';
import { 
    IconActivity, IconUsers, IconGift, 
    IconDatabase, IconSettings, IconBug, 
    IconServer, IconChartLine, IconCrown,
    IconMessageForward, IconSnowflake, IconCoin, IconCurrencyDollar
} from '@tabler/icons-react';
import { 
    createPromoCode, setSystemConfig, manageUserTokens, 
    generateSecurePromoCode, sendDirectMessage, checkServiceHealth 
} from './actions';

export default function OverseerClient({ initialStats, initialUsers, initialPromos, initialConfig, inferenceLatencies }: any) {
    const [tab, setTab] = useState('Overview');
    
    // Config states
    const [maintenance, setMaintenance] = useState(initialConfig.maintenance_mode === 'true');
    const [activeModel, setActiveModel] = useState(initialConfig.active_model || 'gpt-5.6-terra');
    
    // Promos
    const [promoCode, setPromoCode] = useState('');
    const [promoAmount, setPromoAmount] = useState(100000);
    const [promoUses, setPromoUses] = useState(10);
    const [promoType, setPromoType] = useState('chars');
    const [isSaving, setIsSaving] = useState(false);

    // Direct Messages
    const [dmTarget, setDmTarget] = useState<number | null>(null);
    const [dmMessage, setDmMessage] = useState('');

    // Sidebar TABS
    const TABS = [
        { name: 'Overview', icon: IconActivity },
        { name: 'Users & Economy', icon: IconUsers },
        { name: 'Promo & Referrals', icon: IconGift },
        { name: 'Telemetry (Logs)', icon: IconBug },
        { name: 'System Config', icon: IconSettings },
        { name: 'Service Health', icon: IconServer },
    ];

    const [healthLogs, setHealthLogs] = useState('Welcome to System Matrix. Select a service to begin diagnostic.');
    const [serviceStates, setServiceStates] = useState<any>({});
    const [checkingId, setCheckingId] = useState<string | null>(null);

    const runHealthCheck = async (id: string, action: any) => {
        setCheckingId(id);
        setHealthLogs(prev => `\n[DRV] Initializing ${id.toUpperCase()} check...\n` + prev);
        try {
            const res = await action(id);
            setHealthLogs(prev => `${res.log}\n------------------\n` + prev);
            setServiceStates((prev: any) => ({ ...prev, [id]: res.status }));
        } catch (err: any) {
            setHealthLogs(prev => `CRITICAL: ${err.message}\n` + prev);
            setServiceStates((prev: any) => ({ ...prev, [id]: 'offline' }));
        } finally {
            setCheckingId(null);
        }
    };

    const getStatusColor = (s: string) => {
        if (s === 'online') return 'text-green-500';
        if (s === 'error') return 'text-orange-500';
        if (s === 'offline') return 'text-red-500';
        return 'text-gray-400';
    };

    const generatePromo = async () => {
        setIsSaving(true);
        const code = promoCode.toUpperCase() || ('P_OVERSEER_' + Math.random().toString(36).substring(7).toUpperCase());
        await createPromoCode(code, promoType, promoAmount, promoUses);
        setIsSaving(false);
        setPromoCode('');
    };

    const handleGenerateS512 = async () => {
        setIsSaving(true);
        try {
            const res = await generateSecurePromoCode();
            if (res.code) setPromoCode(res.code);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendDM = async (id: number) => {
        if (!dmMessage.trim()) return;
        setIsSaving(true);
        try {
            await sendDirectMessage(id, dmMessage);
            setDmMessage('');
            setDmTarget(null);
            alert("Message dispatched to user's notification bell.");
        } finally {
            setIsSaving(false);
        }
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
        const base = 'flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium tracking-wide rounded-md transition-colors text-left flex-shrink-0';
        if (tab === name) return base + ' bg-[#ebebeb] text-black shadow-sm';
        return base + ' text-[#666] hover:bg-[#f5f5f5]';
    };

    const getMaintenanceBtnClass = () => {
        const base = 'px-4 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-colors';
        if (maintenance) return base + ' bg-red-50 text-red-500 border border-red-200 hover:bg-red-100';
        return base + ' bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200';
    };

    const getModelBtnClass = (m: string) => {
        const base = 'px-3 py-1.5 border rounded font-bold transition-colors';
        if (activeModel === m) return base + ' bg-[#1a1a1a] text-white border-black';
        return base + ' bg-[#fafafa] text-[#666] border-[#e5e5e5] hover:bg-[#ebebeb]';
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#fbfbfb]">
            {/* Nav Column - Mobile Horizontal, Desktop Vertical */}
            <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-[#e5e5e5] bg-[#fafafa] flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-y-auto no-scrollbar">
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
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                
                {tab === 'Overview' && (
                    <div className="space-y-6 max-w-5xl">
                        <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-[#e5e5e5] pb-2 mb-4">Flight Deck Metrics</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <IconChartLine className="w-3.5 h-3.5" /> Live Inference Latency (ms) - 24h
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
                        <div className="border border-[#e5e5e5] bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto">
                            <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#666] px-4 py-3 border-b border-[#e5e5e5] bg-[#f0f0f0]">
                                Top Token Burners
                            </h3>
                            <table className="w-full text-left border-collapse min-w-[400px]">
                                <tbody className="text-[11px] font-mono text-[#333]">
                                    {[...initialUsers]
                                        .sort((a: any, b: any) => (b.daily_chars_used + b.weekly_chars_used) - (a.daily_chars_used + a.weekly_chars_used))
                                        .slice(0, 5)
                                        .map((u: any, idx: number) => (
                                        <tr key={u.id} className="border-b border-[#e5e5e5] hover:bg-[#fafafa]">
                                            <td className="px-3 py-2 w-8 text-[#999]">#{idx + 1}</td>
                                            <td className="px-3 py-2 font-sans font-medium text-black border-l border-[#e5e5e5]">
                                                {u.username || u.first_name || 'Anon'}
                                                {u.telegram_id === '1153844209' && <IconCrown className="w-3 h-3 inline ml-1 text-yellow-500"/>}
                                            </td>
                                            <td className="px-3 py-2 border-l border-[#e5e5e5] text-right">
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
                        <div className="border border-[#e5e5e5] bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="bg-[#f0f0f0]">
                                    <tr className="text-[9px] uppercase tracking-widest font-bold text-[#666]">
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] w-12">ID</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l">TG ID</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l min-w-[100px]">Name</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l">Purchased</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l">Daily Used</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l">Status</th>
                                        <th className="px-3 py-2 border-b border-[#e5e5e5] border-l w-[280px] text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[11px] font-mono text-[#333]">
                                    {initialUsers.map((u: any) => (
                                        <>
                                        <tr key={u.id} className="border-b border-[#e5e5e5] hover:bg-[#fafafa]">
                                            <td className="px-3 py-2">{u.id}</td>
                                            <td className="px-3 py-2 border-l border-[#e5e5e5] text-blue-600">{u.telegram_id}</td>
                                            <td className="px-3 py-2 border-l border-[#e5e5e5] font-sans font-medium text-black">
                                                {u.username || u.first_name || 'Anon'} 
                                                {u.telegram_id === '1153844209' && <IconCrown className="w-3 h-3 inline ml-1 text-yellow-500"/>}
                                            </td>
                                            <td className="px-3 py-2 border-l border-[#e5e5e5] text-green-700 font-bold">{u.purchased_chars.toLocaleString()}</td>
                                            <td className="px-3 py-2 border-l border-[#e5e5e5]">{u.daily_chars_used.toLocaleString()}</td>
                                            <td className="px-3 py-2 border-l border-[#e5e5e5]">
                                                {u.is_banned 
                                                    ? <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[9px] font-black">FROZEN</span> 
                                                    : <span className="text-[#999]">OK</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2 border-l border-[#e5e5e5]">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => manageUserTokens(u.id, 'grant_chars', 100000)} className="flex items-center gap-1 px-2 py-1 bg-[#f0f0f0] hover:bg-[#e0e0e0] text-[#333] text-[9px] rounded font-bold transition-colors"><IconCurrencyDollar className="w-3 h-3" /> +100k</button>
                                                    <button onClick={() => manageUserTokens(u.id, 'grant_reports', 5)} className="px-2 py-1 bg-green-50 text-green-600 hover:bg-green-100 text-[9px] rounded font-bold transition-colors">+5R</button>
                                                    <button onClick={() => manageUserTokens(u.id, 'toggle_freeze', 0)} className={`px-2 py-1 flex items-center gap-1 text-[9px] rounded font-bold transition-colors ${u.is_banned ? 'bg-orange-50 text-orange-500 hover:bg-orange-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                                                        <IconSnowflake className="w-3 h-3" /> {u.is_banned ? 'UNFREEZE' : 'FREEZE'}
                                                    </button>
                                                    <button onClick={() => setDmTarget(u.id)} className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[9px] rounded font-bold transition-colors flex items-center gap-1">
                                                        <IconMessageForward className="w-3 h-3" /> DM
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* DM Expansion Panel */}
                                        {dmTarget === u.id && (
                                            <tr className="bg-blue-50/30">
                                                <td colSpan={7} className="px-4 py-3 border-b border-[#e5e5e5]">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            autoFocus
                                                            className="flex-1 px-3 py-1.5 text-xs border border-[#ddd] rounded-md outline-none focus:border-blue-500 font-sans"
                                                            placeholder="Type direct message to user's dashboard..."
                                                            value={dmMessage}
                                                            onChange={e => setDmMessage(e.target.value)}
                                                        />
                                                        <button disabled={isSaving} onClick={() => handleSendDM(u.id)} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 transition">Send Msg</button>
                                                        <button onClick={() => setDmTarget(null)} className="px-4 py-1.5 bg-gray-200 text-black text-xs font-bold rounded-md hover:bg-gray-300 transition">Cancel</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'Promo & Referrals' && (
                    <div className="space-y-6 max-w-3xl">
                        <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-[#e5e5e5] pb-2">Promo Code Factory</h2>
                        <div className="flex flex-col md:flex-row gap-4 p-4 border border-[#e5e5e5] bg-white rounded-lg shadow-sm flex-wrap">
                            <div className="space-y-1 flex-1 min-w-[200px]">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-[#666]">Code (blank = auto)</label>
                                <div className="flex gap-1">
                                    <input value={promoCode} onChange={e => setPromoCode(e.target.value)} className="flex-1 text-[11px] px-2 py-1.5 border border-[#ccc] rounded font-mono" placeholder="OVERSEER_VIP" />
                                    <button onClick={handleGenerateS512} className="px-3 bg-gray-100 hover:bg-gray-200 text-[9px] font-bold rounded border border-[#ccc]">S512</button>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="space-y-1 w-24">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#666]">Type</label>
                                    <select value={promoType} onChange={e => setPromoType(e.target.value)} className="w-full text-[11px] px-2 py-1.5 border border-[#ccc] rounded">
                                        <option value="chars">Chars</option>
                                        <option value="reports">Reports</option>
                                    </select>
                                </div>
                                <div className="space-y-1 w-24">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#666]">Amount</label>
                                    <input type="number" value={promoAmount} onChange={e => setPromoAmount(Number(e.target.value))} className="w-full text-[11px] px-2 py-1.5 border border-[#ccc] rounded font-mono" />
                                </div>
                                <div className="space-y-1 w-20">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#666]">Max uses</label>
                                    <input type="number" value={promoUses} onChange={e => setPromoUses(Number(e.target.value))} className="w-full text-[11px] px-2 py-1.5 border border-[#ccc] rounded font-mono" />
                                </div>
                            </div>
                            <div className="pt-4 md:mt-[1px] flex items-end">
                                <button onClick={generatePromo} disabled={isSaving} className="px-6 py-[7px] w-full md:w-auto bg-black text-white text-[10px] uppercase tracking-widest font-bold rounded hover:bg-gray-800 disabled:opacity-50">Mint Code</button>
                            </div>
                        </div>

                        {/* Referral Tree Placeholder */}
                        <div className="p-4 border border-[#e5e5e5] bg-blue-50 text-blue-900 rounded-lg text-xs font-mono shadow-sm">
                            <span className="font-bold">Referral Subsystem:</span> Active. Users refer others to get bonus tokens. Database linked.
                        </div>

                        <div className="border border-[#e5e5e5] bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[300px]">
                                <thead className="bg-[#f0f0f0] border-b border-[#e5e5e5]">
                                    <tr className="text-[9px] uppercase tracking-widest font-bold text-[#666]">
                                        <th className="px-3 py-2">Code Segment</th>
                                        <th className="px-3 py-2 border-l border-[#e5e5e5]">Gift Value</th>
                                        <th className="px-3 py-2 border-l border-[#e5e5e5]">Remaining Uses</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[11px] font-mono text-[#333]">
                                    {initialPromos.map((p: any) => (
                                        <tr key={p.id} className="border-b border-[#e5e5e5] hover:bg-[#fafafa]">
                                            <td className="px-3 py-2 text-green-700 font-bold overflow-hidden text-ellipsis max-w-[150px] whitespace-nowrap">{p.code}</td>
                                            <td className="px-3 py-2 border-l border-[#e5e5e5]">+{p.amount.toLocaleString()} {p.type}</td>
                                            <td className="px-3 py-2 border-l border-[#e5e5e5] text-[#999]">{p.max_uses - p.uses} / {p.max_uses}</td>
                                        </tr>
                                    ))}
                                    {initialPromos.length === 0 && (
                                        <tr><td colSpan={3} className="px-3 py-4 text-center text-[#999]">No active promo codes minted.</td></tr>
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
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-[#e5e5e5] bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow gap-4">
                                <div>
                                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] flex items-center gap-1.5">
                                        <IconServer className="w-3.5 h-3.5"/> Maintenance Operation Mode
                                    </h4>
                                    <p className="text-[10px] text-[#666] mt-1 pr-4">Suspend generation queues for all users via a global maintenance overlay. Platform DB remains active.</p>
                                </div>
                                <button onClick={toggleMaintenance} className={getMaintenanceBtnClass() + " w-full md:w-auto text-center"}>
                                    {maintenance ? 'ACTIVE (LOCKOUT)' : 'PLATFORM OFFLINE'}
                                </button>
                            </div>

                            {/* Model Switcher */}
                            <div className="p-4 border border-[#e5e5e5] bg-white rounded-lg shadow-sm space-y-3">
                                <div>
                                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] flex items-center gap-1.5">
                                        <IconDatabase className="w-3.5 h-3.5"/> Neural Architecture Target Network
                                    </h4>
                                    <p className="text-[10px] text-[#666] mt-0.5">Hot-swap AI language models without container restart.</p>
                                </div>
                                <div className="flex flex-col md:flex-row gap-2 text-[10px] font-mono">
                                    {['gpt-5.6-terra', 'gpt-5.6-luna'].map(m => (
                                        <button 
                                            key={m} 
                                            onClick={async () => { setActiveModel(m); await setSystemConfig('active_model', m); }}
                                            className={getModelBtnClass(m) + " w-full md:w-auto text-left md:text-center"}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* System Health Check */}
                            <div className="p-4 border border-[#e5e5e5] bg-white rounded-lg shadow-sm space-y-3">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#1a1a1a] flex items-center gap-1.5">
                                    <IconActivity className="w-3.5 h-3.5"/> Advanced System Health & Interconnects
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px]">
                                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded border border-green-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> SQLite V-Base 
                                    </div>
                                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded border border-green-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Payment Webhooks
                                    </div>
                                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded border border-green-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> OpenAI LLM API
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {tab === 'Service Health' && (
                    <div className="space-y-6 max-w-5xl h-full flex flex-col">
                        <h2 className="text-[13px] font-bold uppercase tracking-widest border-b border-[#e5e5e5] pb-2 shrink-0">Global Service Health Matrix</h2>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                            {[
                                { id: 'openai', name: 'OpenAI LLM', icon: IconActivity },
                                { id: 'latex', name: 'LaTeX Node', icon: IconServer },
                                { id: 'python', name: 'Python Matrix', icon: IconBug },
                                { id: 'r', name: 'R-Compiler', icon: IconChartLine },
                                { id: 'fx', name: 'Exchange Rates', icon: IconCurrencyDollar },
                                { id: 'stirling', name: 'Stirling PDF', icon: IconDatabase },
                                { id: 'db', name: 'SQLite V-Base', icon: IconDatabase }
                            ].map(s => (
                                <div key={s.id} className="p-3 border border-[#e5e5e5] bg-white rounded-lg shadow-sm flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <s.icon className={`w-4 h-4 ${getStatusColor(serviceStates[s.id])}`} />
                                        <span className={`text-[8px] font-bold uppercase ${getStatusColor(serviceStates[s.id])}`}>
                                            {serviceStates[s.id] || 'UNTIDY'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-black">{s.name}</span>
                                    <button 
                                        disabled={checkingId !== null}
                                        onClick={() => runHealthCheck(s.id, checkServiceHealth)}
                                        className="w-full py-1 bg-gray-100 hover:bg-black hover:text-white transition-colors text-[9px] font-bold uppercase rounded"
                                    >
                                        {checkingId === s.id ? 'TESTING...' : 'RUN TEST'}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex-1 min-h-[300px] bg-[#1a1a1a] rounded-lg border border-black p-4 overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between mb-3 border-b border-[#333] pb-2 shrink-0">
                                <span className="text-[9px] font-bold uppercase tracking-[2px] text-[#666]">Diagnostic Console v4.0</span>
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-500/50" />
                                    <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                                    <div className="w-2 h-2 rounded-full bg-green-500/50" />
                                </div>
                            </div>
                            <pre className="flex-1 overflow-y-auto text-[10px] font-mono text-green-500 leading-relaxed scrollbar-thin scrollbar-thumb-[#333]">
                                {healthLogs}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
