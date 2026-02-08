import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHelpContext } from "./help-provider";

interface PageHelpButtonProps {
  pageHelpKey: string;
  className?: string;
}

export function PageHelpButton({ pageHelpKey, className = "" }: PageHelpButtonProps) {
  const { openDrawer } = useHelpContext();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openDrawer(pageHelpKey)}
          className={className}
          data-testid={`page-help-${pageHelpKey}`}
          aria-label="Page help"
        >
          <Info className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Page help</TooltipContent>
    </Tooltip>
  );
}
