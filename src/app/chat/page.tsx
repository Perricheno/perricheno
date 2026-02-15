import ChatPage from "@/components/ChatPage";
import { DockSidebar } from "@/components/ui/DockSidebar";

export default function Chat() {
    return (
        <main className="h-screen relative flex flex-col">
            <ChatPage />
            <DockSidebar />
        </main>
    );
}
