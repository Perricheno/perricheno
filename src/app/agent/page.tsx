import { DockSidebar } from "@/components/ui/DockSidebar";
import { motion } from "framer-motion";
import { IconBrain, IconFileText, IconPresentation, IconCalendarStats, IconRobot, IconMath } from "@tabler/icons-react";

export default function AgentPage() {
    const features = [
        { title: "Overleaf Integration", icon: IconMath, desc: "Seamless LaTeX editing & sync" },
        { title: "AI Reports", icon: IconFileText, desc: "Generate academic reports in seconds" },
        { title: "Presentations", icon: IconPresentation, desc: "Turn data into slides automatically" },
        { title: "Task Scheduling", icon: IconCalendarStats, desc: "Smart agent-managed calendar" },
    ];

    return (
        <div className="relative z-10 w-full min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
            <div className="absolute inset-0 bg-black/80 radial-gradient-mask" />

            <DockSidebar />

            <div className="relative z-20 max-w-4xl mx-auto px-6 text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-6">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Developing
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 mb-6">
                        Perricheno Agent
                    </h1>

                    <p className="text-xl text-white/40 mb-12 max-w-2xl mx-auto">
                        Your autonomous academic assistant. Capable of writing code, managing tasks, and conducting research.
                        <span className="block mt-2 text-emerald-400/60 font-mono text-sm">Coming Soon...</span>
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    {features.map((f, i) => (
                        <div key={i} className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.06] transition-colors group">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                                <f.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-1">{f.title}</h3>
                            <p className="text-white/40 text-sm">{f.desc}</p>
                        </div>
                    ))}
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-16">
                    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] inline-block">
                        <p className="text-white/20 text-xs font-mono">System Status: <span className="text-emerald-500">Online</span> • v0.1.0-alpha</p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
