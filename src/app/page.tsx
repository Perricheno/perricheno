import { ProjectSection } from "@/components/ProjectSection";
import { DockSidebar } from "@/components/ui/DockSidebar";

export default function Home() {
  return (
    <main className="min-h-screen relative flex flex-col">
      <ProjectSection />

      {/* Sidebar Navigation */}
      <DockSidebar />

    </main>
  );
}
