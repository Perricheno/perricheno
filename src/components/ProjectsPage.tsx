"use client";

import { useState } from "react";
import Link from "next/link";
import { IconPlus, IconTrash, IconArrowUpRight, IconArrowLeft } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { useAdmin } from "@/components/AdminContext";
import MinimalSidebar from "@/components/MinimalSidebar";

interface Project {
    id: string;
    title: string;
    description: string;
    tags: string;
    image: string;
    link?: string;
}

const defaultProjects: Project[] = [
    { id: "1", title: "Comet Invitation", description: "A 3D perspective card demo inspired by Perplexity.\n\n- 3D Tilt Effect\n- React & Framer Motion", tags: "#Frontend #Design #React", image: "https://images.unsplash.com/photo-1505506874110-6a7a69069a08?q=80&w=1287&auto=format&fit=crop", link: "https://github.com/perricheno" },
    { id: "2", title: "DevOps Dashboard", description: "Real-time server monitoring tools.\n\n- CPU/Memory Usage\n- Docker Container Status", tags: "#DevOps #React #Grafana", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1170&auto=format&fit=crop", link: "https://github.com/perricheno" },
    { id: "3", title: "Data Analytics Suite", description: "Python scripts for large-scale data analysis using Pandas and Matplotlib.", tags: "#Python #Pandas #DataScience", image: "https://images.unsplash.com/photo-1543286386-713df548e9cc?q=80&w=1170&auto=format&fit=crop", link: "https://github.com/perricheno" },
    { id: "4", title: "Cloud Infrastructure", description: "Automated cloud deployments with Terraform and AWS.", tags: "#AWS #Terraform #Cloud", image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1172&auto=format&fit=crop", link: "https://github.com/perricheno" },
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
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pl-0 md:pl-64 pb-20 md:pb-0 transition-all">
            <MinimalSidebar />
            
            <div className="max-w-[1600px] mx-auto px-6 py-20 md:py-28">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-100 mb-6 transition-opacity">
                            <IconArrowLeft className="w-4 h-4" /> Back to Home
                        </Link>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
                            Projects.
                        </h1>
                        <p className="text-xl opacity-60">Selected works and experiments.</p>
                    </div>
                    
                    {isEditing && (
                        <button onClick={addProject}
                            className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] text-sm font-bold hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors">
                            <IconPlus className="w-4 h-4" /> Add Project
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-[var(--border)] border border-[var(--border)]">
                    {projects.map((project, i) => (
                        <div key={project.id} className="group relative bg-[var(--background)] flex flex-col h-full hover:bg-[var(--muted)] transition-colors">
                            {isEditing && (
                                <button onClick={(e) => { e.stopPropagation(); removeProject(project.id); }}
                                    className="absolute top-2 right-2 z-30 p-2 bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <IconTrash className="w-4 h-4" />
                                </button>
                            )}
                            
                            {/* Image Aspect Ratio Container 16:9 */}
                            <div className="relative aspect-video w-full overflow-hidden border-b border-[var(--border)] grayscale group-hover:grayscale-0 transition-all duration-500">
                                <img src={project.image} className="object-cover w-full h-full" alt={project.title} />
                                {isEditing && (
                                    <input value={project.image} onChange={(e) => handleUpdate(project.id, "image", e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1" placeholder="Image URL..." />
                                )}
                            </div>

                            <div className="p-6 flex flex-col flex-1">
                                <div className="mb-4">
                                    {isEditing ? (
                                        <input value={project.title} onChange={(e) => handleUpdate(project.id, "title", e.target.value)}
                                            className="bg-transparent border-b border-[var(--border)] w-full font-bold text-lg mb-2" />
                                    ) : (
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg leading-tight">{project.title}</h3>
                                            {project.link && (
                                                <a href={project.link} target="_blank" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <IconArrowUpRight className="w-5 h-5 stroke-1" />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className="text-sm opacity-60 line-clamp-3 mb-4">
                                        {isEditing ? (
                                            <textarea value={project.description} onChange={(e) => handleUpdate(project.id, "description", e.target.value)}
                                                className="w-full bg-transparent border border-[var(--border)] p-2 text-xs h-20" />
                                        ) : (
                                            <ReactMarkdown>{project.description}</ReactMarkdown>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-auto">
                                    {isEditing ? (
                                        <input value={project.tags} onChange={(e) => handleUpdate(project.id, "tags", e.target.value)}
                                            className="bg-transparent border-b border-[var(--border)] w-full text-xs opacity-50" />
                                    ) : (
                                        <div className="flex flex-wrap gap-2 text-xs font-mono opacity-40">
                                            {project.tags.split(' ').map((tag, j) => <span key={j}>{tag}</span>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
