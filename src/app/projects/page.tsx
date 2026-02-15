import ProjectsPage from "@/components/ProjectsPage";
import { DockSidebar } from "@/components/ui/DockSidebar";

export default function Projects() {
    return (
        <main className="min-h-screen relative flex flex-col">
            <ProjectsPage />
            <DockSidebar />
        </main>
    );
}
