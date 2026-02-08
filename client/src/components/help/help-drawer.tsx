import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, BookOpen, ChevronRight } from "lucide-react";
import { useHelpContext, useHelp } from "./help-provider";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { HelpEntry } from "@shared/schema";

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return <h3 key={i} className="text-sm font-semibold mt-4 mb-1">{line.slice(4)}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={i} className="text-base font-semibold mt-4 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith("# ")) {
          return <h1 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(2)}</h1>;
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 ml-2 my-0.5">
              <span className="text-muted-foreground mt-0.5">&#8226;</span>
              <span className="text-sm">{formatInline(line.slice(2))}</span>
            </div>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        return <p key={i} className="text-sm my-1">{formatInline(line)}</p>;
      })}
    </div>
  );
}

function formatInline(text: string): string | (string | JSX.Element)[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function HelpDrawer() {
  const { drawerOpen, drawerKey, closeDrawer, openDrawer } = useHelpContext();
  const { data: entry, isLoading } = useHelp(drawerKey);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const { toast } = useToast();

  const { data: related } = useQuery<HelpEntry[]>({
    queryKey: ["/api/help/search", "related", entry?.category],
    queryFn: async () => {
      if (!entry?.category) return [];
      const params = new URLSearchParams({ category: entry.category, limit: "5" });
      const res = await fetch(`/api/help/search?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.filter((r: HelpEntry) => r.key !== drawerKey);
    },
    enabled: !!entry?.category && drawerOpen,
    staleTime: 5 * 60 * 1000,
  });

  const handleFeedbackSubmit = async () => {
    try {
      await apiRequest("POST", "/api/help/feedback", {
        helpEntryId: entry?.id,
        helpKey: drawerKey,
        comment: feedbackText,
        pageUrl: window.location.pathname,
      });
      setFeedbackSent(true);
      setFeedbackText("");
      toast({ title: "Feedback sent", description: "Thank you for your feedback." });
    } catch {
      toast({ title: "Error", description: "Failed to send feedback.", variant: "destructive" });
    }
  };

  return (
    <Sheet open={drawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="help-drawer">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            {isLoading ? "Loading..." : entry?.title || "Help"}
          </SheetTitle>
        </SheetHeader>

        {entry ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{entry.scope}</Badge>
              {entry.category && <Badge variant="outline">{entry.category}</Badge>}
            </div>

            {entry.shortText && (
              <p className="text-sm text-muted-foreground">{entry.shortText}</p>
            )}

            {entry.bodyMd && (
              <>
                <Separator />
                <MarkdownContent content={entry.bodyMd} />
              </>
            )}

            {related && related.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Related Articles</h4>
                  <div className="space-y-1">
                    {related.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => openDrawer(r.key)}
                        className="flex items-center gap-2 w-full text-left text-sm text-muted-foreground hover:text-foreground p-1.5 rounded-md hover-elevate"
                        data-testid={`help-related-${r.key}`}
                      >
                        <ChevronRight className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{r.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />
            {!showFeedback && !feedbackSent ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFeedback(true)}
                data-testid="help-feedback-toggle"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Report unclear docs
              </Button>
            ) : feedbackSent ? (
              <p className="text-sm text-muted-foreground">Thank you for your feedback!</p>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="What was unclear or missing?"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="text-sm"
                  rows={3}
                  data-testid="help-feedback-text"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleFeedbackSubmit}
                    disabled={!feedbackText.trim()}
                    data-testid="help-feedback-submit"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Send
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowFeedback(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          !isLoading && (
            <p className="mt-4 text-sm text-muted-foreground">
              No help content found for this topic. An administrator can add it via the Help Management page.
            </p>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}
