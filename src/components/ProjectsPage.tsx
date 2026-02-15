"use client";

import { useState, useRef, useCallback } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { useAdmin } from "@/components/AdminContext";
import { AdminBar } from "@/components/AdminBar";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Project {
    id: string;
    title: string;
    description: string;
    tags: string;
    image: string;
    link?: string;
}

/* ── 3D Card ── */
const Card3D = ({ children }: { children: React.ReactNode }) => {
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
        mouseX.set(0); mouseY.set(0);
    }, [mouseX, mouseY]);

    return (
        <motion.div className="relative w-full select-none" style={{ perspective: 1200 }}
            animate={{ y: [0, -4, 0, 3, 0] }}
            transition={{ y: { duration: 5 + Math.random() * 2, repeat: Infinity, ease: "easeInOut" } }}>
            <motion.div ref={cardRef} className="relative w-full"
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                animate={{ scale: isPressed ? 0.97 : 1 }}
                transition={{ scale: { type: "spring", stiffness: 400, damping: 15 } }}
                onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
                onMouseDown={() => setIsPressed(true)} onMouseUp={() => setIsPressed(false)}>
                <div className="relative w-full rounded-xl p-5 border bg-white/5 border-white/[0.08] backdrop-blur-xl overflow-hidden flex flex-col" style={{ height: 380 }}>
                    <div className="flex flex-col h-full">{children}</div>
                </div>
            </motion.div>
        </motion.div>
    );
};

/* ── Read More ── */
const DescriptionWithReadMore = ({ text }: { text: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const shouldTruncate = text.length > 80;
    return (
        <div className="relative">
            <motion.div animate={{ height: isExpanded ? "auto" : "2.4em" }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
                <ReactMarkdown>{text}</ReactMarkdown>
            </motion.div>
            {shouldTruncate && (
                <motion.button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="mt-1 text-[11px] text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    {isExpanded ? "▲ Less" : "▼ More"}
                </motion.button>
            )}
        </div>
    );
};

const defaultProjects: Project[] = [
    { id: "1", title: "Comet Invitation", description: "A **3D perspective** card demo inspired by Perplexity.\n\n- 3D Tilt Effect\n- React & Framer Motion", tags: "#Frontend #Design #React", image: "https://images.unsplash.com/photo-1505506874110-6a7a69069a08?q=80&w=1287&auto=format&fit=crop", link: "https://github.com/perricheno" },
    { id: "2", title: "DevOps Dashboard", description: "Real-time **server monitoring** tools.\n\n- CPU/Memory Usage\n- Docker Container Status", tags: "#DevOps #React #Grafana", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1170&auto=format&fit=crop", link: "https://github.com/perricheno" },
    { id: "3", title: "Data Analytics Suite", description: "Python scripts for **large-scale data analysis** using Pandas and Matplotlib.", tags: "#Python #Pandas #DataScience", image: "https://images.unsplash.com/photo-1543286386-713df548e9cc?q=80&w=1170&auto=format&fit=crop", link: "https://github.com/perricheno" },
    { id: "4", title: "Cloud Infrastructure", description: "Automated **cloud deployments** with Terraform and AWS.", tags: "#AWS #Terraform #Cloud", image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1172&auto=format&fit=crop", link: "https://github.com/perricheno" },
];

export default function ProjectsPage() {
    const { isEditing } = useAdmin();
    const [projects, setProjects] = useState<Project[]>(defaultProjects);

    const handleUpdate = (id: string, field: keyof Project, value: string) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };
    const addProject = () => {
        setProjects(prev => [...prev, { id: String(Date.now()), title: "New Project", description: "Description here...", tags: "#Tag", image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1170&auto=format&fit=crop", link: "" }]);
    };
    const removeProject = (id: string) => setProjects(prev => prev.filter(p => p.id !== id));

    return (
        <div className="relative z-10 w-full min-h-screen">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-2xl" />
            <AdminBar />

            <div className="relative z-10 max-w-[1600px] mx-auto px-4 py-28 md:pl-24">
                <div className="flex items-center justify-between mb-8">
                    <motion.h1 className="text-4xl md:text-5xl font-bold text-white" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        Projects
                    </motion.h1>
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
                                layout>
                                <Card3D>
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
                                        ) : <DescriptionWithReadMore text={project.description} />}
                                    </div>
                                    <div className="w-full mt-2 flex-1 min-h-0">
                                        <img src={project.image} height="1000" width="1000" className="h-full w-full object-cover rounded-lg shadow-lg transition-shadow duration-300 group-hover:shadow-emerald-500/10" alt={project.title} />
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
                                        <motion.a href={project.link || "#"} target="_blank" onClick={(e) => e.stopPropagation()}
                                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                            className="px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-white text-[11px] font-medium hover:bg-white/20 transition-all">
                                            {isEditing ? (
                                                <input value={project.link || ""} onChange={(e) => { e.preventDefault(); handleUpdate(project.id, "link", e.target.value); }}
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="bg-transparent outline-none text-white w-16 text-[11px]" placeholder="Link..." />
                                            ) : "View →"}
                                        </motion.a>
                                    </div>
                                </Card3D>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
