"use client";

import { useState, useRef, useCallback } from "react";
import { IconPlus, IconTrash, IconUser, IconX, IconBrandGithub, IconBrandLinkedin, IconBrandTwitter } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Project {
    id: string;
    title: string;
    description: string;
    tags: string;
    image: string;
    link?: string;
}

interface Dashboard {
    id: string;
    title: string;
    iframeUrl: string;
}

/* ── Parse iframe src from pasted HTML or plain URL ── */
function parseIframeUrl(input: string): string {
    const trimmed = input.trim();
    // If user pasted full <iframe> tag, extract src
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    if (match) return match[1];
    // Otherwise treat as plain URL
    return trimmed;
}

/* ═══════════════════════════════════════════════
   3D CARD — tilt on hover, idle float, press squeeze
   ═══════════════════════════════════════════════ */
const BalatroCard = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isPressed, setIsPressed] = useState(false);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), { stiffness: 200, damping: 20 });
    const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), { stiffness: 200, damping: 20 });

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
        mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    }, [mouseX, mouseY]);

    const handleMouseLeave = useCallback(() => {
        mouseX.set(0);
        mouseY.set(0);
    }, [mouseX, mouseY]);

    return (
        <motion.div
            className="relative w-full select-none"
            style={{ perspective: 1200 }}
            animate={{ y: [0, -4, 0, 3, 0] }}
            transition={{ y: { duration: 5 + Math.random() * 2, repeat: Infinity, ease: "easeInOut" } }}
        >
            <motion.div
                ref={cardRef}
                className="relative w-full"
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: "preserve-3d",
                }}
                animate={{ scale: isPressed ? 0.97 : 1 }}
                transition={{ scale: { type: "spring", stiffness: 400, damping: 15 } }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onMouseDown={() => setIsPressed(true)}
                onMouseUp={() => setIsPressed(false)}
            >
                <div
                    className="relative w-full rounded-xl p-5 border bg-white/5 border-white/[0.08] backdrop-blur-xl overflow-hidden flex flex-col"
                    style={{ height: 380 }}
                >
                    <div className="flex flex-col h-full">{children}</div>
                </div>
            </motion.div>
        </motion.div>
    );
};

/* ── Animated Read More ── */
const DescriptionWithReadMore = ({ text }: { text: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const shouldTruncate = text.length > 80;

    return (
        <div className="relative">
            <motion.div
                animate={{ height: isExpanded ? "auto" : "2.4em" }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
            >
                <ReactMarkdown>{text}</ReactMarkdown>
            </motion.div>
            {shouldTruncate && (
                <motion.button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="mt-1 text-[11px] text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                    {isExpanded ? "▲ Less" : "▼ More"}
                </motion.button>
            )}
        </div>
    );
};

/* ── Login Modal ── */
const LoginModal = ({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) => {
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");

    const handleLogin = () => {
        if (user === "admin" && pass === "admin") onSuccess();
        else setError("Wrong credentials");
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0, rotateX: -10 }}
                animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                exit={{ scale: 0.9, opacity: 0, rotateX: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-80 rounded-2xl bg-black/70 border border-white/10 backdrop-blur-xl p-6"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold text-sm">Admin Login</h3>
                    <motion.button onClick={onClose} whileHover={{ rotate: 90 }} whileTap={{ scale: 0.8 }} className="text-white/40 hover:text-white">
                        <IconX className="w-4 h-4" />
                    </motion.button>
                </div>
                <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Username"
                    className="w-full mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500 placeholder:text-white/30" />
                <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Password"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="w-full mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500 placeholder:text-white/30" />
                {error && <motion.p initial={{ x: -10 }} animate={{ x: 0 }} className="text-red-400 text-xs mb-2">{error}</motion.p>}
                <motion.button onClick={handleLogin} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="w-full py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    Login
                </motion.button>
            </motion.div>
        </motion.div>
    );
};

const defaultProjects: Project[] = [
    {
        id: "1", title: "Comet Invitation",
        description: "A **3D perspective** card demo inspired by Perplexity.\n\n- 3D Tilt Effect\n- React & Framer Motion",
        tags: "#Frontend #Design #React",
        image: "https://images.unsplash.com/photo-1505506874110-6a7a69069a08?q=80&w=1287&auto=format&fit=crop",
        link: "https://github.com/perricheno"
    },
    {
        id: "2", title: "DevOps Dashboard",
        description: "Real-time **server monitoring** tools.\n\n- CPU/Memory Usage\n- Docker Container Status",
        tags: "#DevOps #React #Grafana",
        image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1170&auto=format&fit=crop",
        link: "https://github.com/perricheno"
    },
    {
        id: "3", title: "Data Analytics Suite",
        description: "Python scripts for **large-scale data analysis** using Pandas and Matplotlib.",
        tags: "#Python #Pandas #DataScience",
        image: "https://images.unsplash.com/photo-1543286386-713df548e9cc?q=80&w=1170&auto=format&fit=crop",
        link: "https://github.com/perricheno"
    },
    {
        id: "4", title: "Cloud Infrastructure",
        description: "Automated **cloud deployments** with Terraform and AWS.",
        tags: "#AWS #Terraform #Cloud",
        image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1172&auto=format&fit=crop",
        link: "https://github.com/perricheno"
    }
];

export function ProjectSection() {
    const [isEditing, setIsEditing] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [projects, setProjects] = useState<Project[]>(defaultProjects);

    const [dashboards, setDashboards] = useState<Dashboard[]>([
        { id: "d1", title: "Kazakhstan Economic Stats", iframeUrl: "https://app.powerbi.com/reportEmbed?reportId=88185ea2-6669-4117-9a08-71891520fb94&autoAuth=true&ctid=158f15f3-83e0-4906-824c-69bdc50d9d61" },
        { id: "d2", title: "Marketing Analytics", iframeUrl: "" },
    ]);
    const [activeDashboard, setActiveDashboard] = useState<string>("d1");
    const [dashboardInput, setDashboardInput] = useState("");

    const handleUpdate = (id: string, field: keyof Project, value: string) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const addProject = () => {
        setProjects(prev => [...prev, {
            id: String(Date.now()), title: "New Project", description: "Description here...",
            tags: "#Tag", image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1170&auto=format&fit=crop", link: ""
        }]);
    };

    const removeProject = (id: string) => setProjects(prev => prev.filter(p => p.id !== id));

    const currentDash = dashboards.find(d => d.id === activeDashboard);

    const embedDashboard = () => {
        if (!dashboardInput.trim()) return;
        const url = parseIframeUrl(dashboardInput);
        setDashboards(prev => prev.map(d => d.id === activeDashboard ? { ...d, iframeUrl: url } : d));
        setDashboardInput("");
    };

    const addDashboardTab = () => {
        const newId = "d" + Date.now();
        setDashboards(prev => [...prev, { id: newId, title: "Dashboard " + (prev.length + 1), iframeUrl: "" }]);
        setActiveDashboard(newId);
    };

    const handleAdminClick = () => {
        if (isEditing) setIsEditing(false);
        else setShowLogin(true);
    };

    return (
        <div className="relative z-10 w-full min-h-screen">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-2xl" />

            {/* Admin button */}
            <motion.button onClick={handleAdminClick}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                className={`fixed top-4 right-4 z-50 p-2 rounded-full border backdrop-blur-md transition-all ${isEditing ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
                    }`}>
                <IconUser className="w-4 h-4" />
            </motion.button>

            <div className="fixed top-4 right-14 z-50"><ThemeToggle /></div>

            <AnimatePresence>
                {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
            </AnimatePresence>

            <div className="relative z-10 max-w-[1600px] mx-auto px-4 py-28">

                {/* HERO */}
                <motion.div className="mb-16" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                    <motion.h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
                        Perricheno&apos;s<br />Projects
                    </motion.h1>
                    <motion.p className="text-white/60 text-lg font-light mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                        Build for AITU by AITU student
                    </motion.p>
                    <motion.p className="text-white/40 text-sm max-w-lg leading-relaxed mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                        Student. Analyst. DevOps enthusiast building digital experiences.
                    </motion.p>
                </motion.div>

                {/* PROJECT CARDS */}
                <div className="flex items-center justify-between mb-6">
                    <motion.h2 className="text-3xl font-bold text-white" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>
                        Projects
                    </motion.h2>
                    {isEditing && (
                        <motion.button onClick={addProject} initial={{ scale: 0 }} animate={{ scale: 1 }}
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                            <IconPlus className="w-3.5 h-3.5" /> Add
                        </motion.button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence>
                        {projects.map((project, i) => (
                            <motion.div key={project.id} className="group"
                                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                                transition={{ delay: 0.1 * i, duration: 0.5, ease: "easeOut" }}
                                layout
                            >
                                <BalatroCard>
                                    {isEditing && (
                                        <motion.button onClick={(e) => { e.stopPropagation(); removeProject(project.id); }}
                                            whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }}
                                            className="absolute top-2 right-2 z-30 p-1 rounded-md bg-red-500/20 border border-red-500/30 text-red-400">
                                            <IconTrash className="w-3 h-3" />
                                        </motion.button>
                                    )}

                                    <div className="text-base font-bold text-white w-full">
                                        {isEditing ? (
                                            <input value={project.title} onChange={(e) => handleUpdate(project.id, "title", e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="bg-transparent border-b border-white/20 w-full outline-none focus:border-emerald-500 text-white text-base" />
                                        ) : project.title}
                                    </div>

                                    <div className="text-white/50 text-xs mt-2 w-full">
                                        {isEditing ? (
                                            <textarea value={project.description} onChange={(e) => handleUpdate(project.id, "description", e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full h-14 bg-white/5 border border-white/10 rounded p-2 text-xs resize-none outline-none focus:border-emerald-500 text-white" />
                                        ) : (
                                            <DescriptionWithReadMore text={project.description} />
                                        )}
                                    </div>

                                    <div className="w-full mt-2 flex-1 min-h-0">
                                        <img src={project.image} height="1000" width="1000"
                                            className="h-full w-full object-cover rounded-lg shadow-lg transition-shadow duration-300 group-hover:shadow-emerald-500/10"
                                            alt={project.title} />
                                        {isEditing && (
                                            <input value={project.image} onChange={(e) => handleUpdate(project.id, "image", e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="mt-1 w-full bg-white/5 border border-white/10 rounded p-1 text-[10px] outline-none focus:border-emerald-500 text-white" placeholder="Image URL..." />
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center mt-3 pt-2">
                                        <div className="text-[11px] text-white/40">
                                            {isEditing ? (
                                                <input value={project.tags} onChange={(e) => handleUpdate(project.id, "tags", e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-transparent border-b border-white/20 outline-none text-white/40 w-24 text-[11px]" />
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {project.tags.split(' ').map((tag, j) => <span key={j} className="text-emerald-400/80">{tag}</span>)}
                                                </div>
                                            )}
                                        </div>
                                        <motion.a href={project.link || "#"} target="__blank" onClick={(e) => e.stopPropagation()}
                                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                            className="px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-white text-[11px] font-medium hover:bg-white/20 transition-all">
                                            {isEditing ? (
                                                <input value={project.link || ""} onChange={(e) => { e.preventDefault(); handleUpdate(project.id, "link", e.target.value); }}
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="bg-transparent outline-none text-white w-16 text-[11px]" placeholder="Link..." />
                                            ) : "View →"}
                                        </motion.a>
                                    </div>
                                </BalatroCard>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* ANALYTICS DASHBOARD — admin-only editing, responsive 16:9 */}
                <motion.div className="mt-20" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                    <h2 className="text-3xl font-bold mb-6 text-white">Analytics Dashboard</h2>

                    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl overflow-hidden">
                        {/* Tabs */}
                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06] overflow-x-auto">
                            {dashboards.map(d => (
                                <motion.button key={d.id} onClick={() => setActiveDashboard(d.id)}
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${activeDashboard === d.id ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400" : "bg-white/5 border border-transparent text-white/50 hover:bg-white/10"
                                        }`}>
                                    {isEditing ? (
                                        <input value={d.title}
                                            onChange={(e) => setDashboards(prev => prev.map(dd => dd.id === d.id ? { ...dd, title: e.target.value } : dd))}
                                            className="bg-transparent outline-none w-28 text-center" onClick={(e) => e.stopPropagation()} />
                                    ) : d.title}
                                </motion.button>
                            ))}
                            {isEditing && (
                                <motion.button onClick={addDashboardTab} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    className="p-1.5 rounded-lg bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all">
                                    <IconPlus className="w-3.5 h-3.5" />
                                </motion.button>
                            )}
                        </div>

                        {/* Dashboard content — edge-to-edge, 16:9 responsive */}
                        {currentDash?.iframeUrl ? (
                            <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                                <iframe
                                    src={currentDash.iframeUrl}
                                    className="absolute inset-0 w-full h-full border-0"
                                    allowFullScreen
                                    title={currentDash.title}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-4">
                                {isEditing ? (
                                    <>
                                        <p className="text-sm">Paste an iframe tag or URL to embed a dashboard</p>
                                        <div className="flex gap-2 w-full max-w-lg px-4">
                                            <input value={dashboardInput} onChange={(e) => setDashboardInput(e.target.value)}
                                                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-emerald-500 placeholder:text-white/15"
                                                placeholder='Paste <iframe> tag or URL (Power BI, Tableau, YouTube...)' />
                                            <motion.button onClick={embedDashboard} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                                                Embed
                                            </motion.button>
                                        </div>
                                    </>
                                ) : (
                                    <motion.p className="text-sm" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity }}>
                                        No dashboard embedded yet
                                    </motion.p>
                                )}
                            </div>
                        )}
                        {/* Admin-only: update existing iframe */}
                        {isEditing && currentDash?.iframeUrl && (
                            <div className="flex gap-2 p-3 border-t border-white/[0.06]">
                                <input value={dashboardInput} onChange={(e) => setDashboardInput(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-emerald-500 placeholder:text-white/15"
                                    placeholder='Replace: paste <iframe> tag or URL...' />
                                <motion.button onClick={embedDashboard} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                                    Update
                                </motion.button>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* CONTACT */}
                <motion.div className="mt-24 border-t border-white/[0.06] pt-10 flex flex-col items-center text-center"
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
                    <h2 className="text-3xl font-bold mb-6 text-white">Let&apos;s Connect</h2>
                    <div className="flex gap-3">
                        {[IconBrandGithub, IconBrandLinkedin, IconBrandTwitter].map((Icon, i) => (
                            <motion.a key={i} href="#"
                                whileHover={{ scale: 1.15, y: -2 }} whileTap={{ scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                className="p-3 rounded-xl bg-white/5 border border-white/[0.06] hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-colors backdrop-blur-sm">
                                <Icon className="w-5 h-5 text-white" />
                            </motion.a>
                        ))}
                    </div>
                    <p className="mt-6 text-white/30 text-sm">© 2024 Perricheno. All rights reserved.</p>
                </motion.div>

            </div>
        </div>
    );
}
