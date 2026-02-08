import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHelpButton } from "@/components/help/page-help-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, BookOpen, Clock, Tag } from "lucide-react";
import { useHelpContext } from "@/components/help/help-provider";
import type { HelpEntry } from "@shared/schema";
import { HELP_ROUTES } from "@shared/api-routes";

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { openDrawer } = useHelpContext();

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => setDebouncedQuery(value), 300);
  };

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: [HELP_ROUTES.CATEGORIES],
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<HelpEntry[]>({
    queryKey: [HELP_ROUTES.SEARCH, debouncedQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("query", debouncedQuery);
      if (selectedCategory) params.set("category", selectedCategory);
      const res = await fetch(`${HELP_ROUTES.SEARCH}?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const { data: recentEntries = [], isLoading: recentLoading } = useQuery<HelpEntry[]>({
    queryKey: [HELP_ROUTES.RECENT],
  });

  const showRecent = !debouncedQuery && !selectedCategory;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-help-center-title">Help Center</h1>
        <PageHelpButton pageHelpKey="page.help-center" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search help articles..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
          data-testid="input-help-search"
        />
      </div>

      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={selectedCategory === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(null)}
            data-testid="badge-category-all"
          >
            All
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              data-testid={`badge-category-${cat}`}
            >
              <Tag className="h-3 w-3 mr-1" />
              {cat}
            </Badge>
          ))}
        </div>
      )}

      {(debouncedQuery || selectedCategory) && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {searchLoading ? "Searching..." : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
          </h2>
          {searchLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : searchResults.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No help articles found. Try different search terms.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {searchResults.map((entry) => (
                <HelpResultCard key={entry.id} entry={entry} onOpen={openDrawer} />
              ))}
            </div>
          )}
        </div>
      )}

      {showRecent && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recently Updated</h2>
          </div>
          {recentLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : recentEntries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No help articles available yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <HelpResultCard key={entry.id} entry={entry} onOpen={openDrawer} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function HelpResultCard({ entry, onOpen }: { entry: HelpEntry; onOpen: (key: string) => void }) {
  return (
    <Card className="hover-elevate cursor-pointer" onClick={() => onOpen(entry.key)} data-testid={`help-result-${entry.key}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-medium">{entry.title}</h3>
              <Badge variant="secondary" className="text-[10px]">{entry.scope}</Badge>
              {entry.category && <Badge variant="outline" className="text-[10px]">{entry.category}</Badge>}
            </div>
            {entry.shortText && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.shortText}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="flex-shrink-0" tabIndex={-1}>
            Read
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
