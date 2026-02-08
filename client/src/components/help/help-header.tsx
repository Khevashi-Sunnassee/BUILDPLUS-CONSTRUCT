import { PageHelpButton } from "./page-help-button";
import type { ReactNode } from "react";

interface HelpHeaderProps {
  title: string;
  pageHelpKey: string;
  children?: ReactNode;
  className?: string;
}

export function HelpHeader({ title, pageHelpKey, children, className = "" }: HelpHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-2 flex-wrap ${className}`}>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <PageHelpButton pageHelpKey={pageHelpKey} />
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
