import DashboardPage from "@/components/DashboardPage";
import { DockSidebar } from "@/components/ui/DockSidebar";

export default function Dashboard() {
    return (
        <main className="min-h-screen relative flex flex-col">
            <DashboardPage />
            <DockSidebar />
        </main>
    );
}
