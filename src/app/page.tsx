import HomePage from "@/components/HomePage";
import { DockSidebar } from "@/components/ui/DockSidebar";

export default function Home() {
  return (
    <main className="min-h-screen relative flex flex-col">
      <HomePage />
      <DockSidebar />
    </main>
  );
}
