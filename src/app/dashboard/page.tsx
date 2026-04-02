"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { IconUsers, IconCrown, IconBlockquote, IconMoneybag, IconLayoutDashboard, IconMessageCircle, IconTrendingUp, IconX } from '@tabler/icons-react';

export default function AdminDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [actionAmount, setActionAmount] = useState(100000);

    useEffect(() => {
        // Authenticate admin access
        fetch("/api/auth/me")
            .then(res => res.json())
            .then(data => {
                if (data?.user?.isAdmin) {
                    setIsAdmin(true);
                    loadData();
                } else {
                    router.push('/agent');
                }
            })
            .catch(() => router.push('/agent'));
    }, [router]);

    const loadData = () => {
        setLoading(true);
        fetch("/api/admin/stats").then(r => r.json()).then(d => setStats(d.stats));
        fetch("/api/admin/users").then(r => r.json()).then(d => {
            setUsers(d.users || []);
            setLoading(false);
        });
    };

    const searchUsers = () => {
        fetch(`/api/admin/users?search=${encodeURIComponent(search)}`)
            .then(r => r.json())
            .then(d => setUsers(d.users || []));
    };

    const handleAction = async (action: string) => {
        if (!selectedUser) return;
        const res = await fetch("/api/admin/users", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: selectedUser.id, action, amount: actionAmount })
        });
        if (res.ok) {
            setSelectedUser(null);
            loadData();
        } else {
            alert("Action failed");
        }
    };

    if (!isAdmin || loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white font-mono uppercase tracking-widest text-xs">
                {loading ? "Authenticating Authority..." : "Access Denied"}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--background)] font-sans text-black p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-black text-white rounded-2xl flex flex-col items-center justify-center">
                            <IconCrown className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight">God Mode</h1>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Admin Dashboard</p>
                        </div>
                    </div>
                    <button onClick={() => router.push('/agent')} className="px-6 py-3 bg-white border border-gray-200 text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-colors">
                        Exit Node
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                            <IconUsers className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Total Agents</p>
                        <p className="text-4xl font-black">{stats?.totalUsers || 0}</p>
                    </div>
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
                        <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                            <IconTrendingUp className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Tokens Burnt</p>
                        <p className="text-4xl font-black">{stats?.totalUsage?.toLocaleString() || 0}</p>
                    </div>
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-4">
                            <IconMoneybag className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Global Purchases</p>
                        <p className="text-4xl font-black">{stats?.totalTransactions || 0}</p>
                    </div>
                </div>

                {/* Users Vault */}
                <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-lg font-black uppercase tracking-tight">System Users</h2>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Search TG ID..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-black transition-colors"
                            />
                            <button onClick={searchUsers} className="px-4 py-2 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800">
                                Find
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50 text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                    <th className="px-6 py-4">ID / TG</th>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Tier / Status</th>
                                    <th className="px-6 py-4">Balances</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-medium">
                                {users.map(u => (
                                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold">{u.id}</div>
                                            <div className="text-xs text-gray-400">{u.telegram_id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold flex items-center gap-2">
                                                {u.photo_url && <img src={u.photo_url} alt="" className="w-6 h-6 rounded-full" />}
                                                {u.username || "Anonymous"}
                                            </div>
                                            <div className="text-xs text-gray-400">{u.first_name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${u.is_banned ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                {u.is_banned ? 'BANNED' : u.account_tier}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            <div className="font-bold text-gray-800">{u.purchased_chars.toLocaleString()} Chars</div>
                                            <div className="text-gray-500">{u.purchased_reports} Reports</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => setSelectedUser(u)}
                                                className="px-4 py-2 bg-black text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-colors"
                                            >
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Edit Modal */}
                {selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white rounded-[24px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight">Modify Unit</h3>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">ID: {selectedUser.telegram_id}</p>
                                </div>
                                <button onClick={() => setSelectedUser(null)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full border border-gray-200 text-gray-400 hover:text-black">
                                    <IconX className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Amount to Grant</label>
                                    <input 
                                        type="number"
                                        value={actionAmount}
                                        onChange={e => setActionAmount(parseInt(e.target.value) || 0)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:outline-none focus:border-black transition-colors"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => handleAction('grant_chars')} className="py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-800 transition-colors">
                                        + Chars
                                    </button>
                                    <button onClick={() => handleAction('grant_reports')} className="py-3 bg-gray-100 text-black border border-gray-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors">
                                        + Reports
                                    </button>
                                </div>

                                <div className="pt-6 border-t border-gray-100">
                                    <button 
                                        onClick={() => handleAction('toggle_ban')} 
                                        className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors ${
                                            selectedUser.is_banned ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'
                                        }`}
                                    >
                                        {selectedUser.is_banned ? 'RESTORE ACCESS' : 'SUSPEND UNIT & BAN'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
