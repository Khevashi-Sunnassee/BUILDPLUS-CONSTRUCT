import { useLocation } from "wouter";
import { ChevronLeft, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
}

export function MobileLayout({ children, title, showBackButton = true }: MobileLayoutProps) {
  const [location, setLocation] = useLocation();
  const isOnline = useOnlineStatus();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/mobile/dashboard");
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#070B12] text-white">
      <header
        className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[#0D1117]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="text-white -ml-2"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        <h1 className="text-white text-lg font-semibold flex-1">
          {title || "BuildPlus"}
        </h1>
        {!isOnline && (
          <div className="flex items-center gap-1 text-red-400 text-xs" data-testid="status-offline">
            <WifiOff className="h-4 w-4" />
            <span>Offline</span>
          </div>
        )}
      </header>
      
      <main 
        className="flex-1 overflow-y-auto overscroll-contain pb-24"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </main>
    </div>
  );
}
