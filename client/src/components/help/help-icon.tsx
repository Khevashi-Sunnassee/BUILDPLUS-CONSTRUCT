import { HelpCircle, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useHelp, useHelpContext } from "./help-provider";

interface HelpIconProps {
  helpKey: string;
  variant?: "question" | "info";
  className?: string;
}

export function HelpIcon({ helpKey, variant = "question", className = "" }: HelpIconProps) {
  const { data: entry, isLoading } = useHelp(helpKey);
  const { openDrawer } = useHelpContext();
  const Icon = variant === "info" ? Info : HelpCircle;

  if (isLoading || !entry) {
    return (
      <span className={`inline-flex items-center text-muted-foreground/40 ${className}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }

  const tooltip = entry.shortText || entry.title;
  const hasBody = !!entry.bodyMd;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-help ${className}`}
          data-testid={`help-icon-${helpKey}`}
          aria-label={`Help: ${entry.title}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" side="top" align="start">
        <p className="text-sm font-medium mb-1">{entry.title}</p>
        <p className="text-xs text-muted-foreground">{tooltip}</p>
        {hasBody && (
          <Button
            variant="link"
            size="sm"
            className="mt-1 h-auto p-0 text-xs"
            onClick={() => openDrawer(helpKey)}
            data-testid={`help-learn-more-${helpKey}`}
          >
            Learn more
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
