import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Archive, History, Search, BookOpen, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { HelpEntry, HelpEntryVersion } from "@shared/schema";

const SCOPES = ["PAGE", "FIELD", "ACTION", "COLUMN", "ERROR", "GENERAL"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

interface FormData {
  key: string;
  scope: string;
  title: string;
  shortText: string;
  bodyMd: string;
  keywords: string;
  category: string;
  pageRoute: string;
  status: string;
  rank: number;
}

const emptyForm: FormData = {
  key: "", scope: "GENERAL", title: "", shortText: "", bodyMd: "",
  keywords: "", category: "", pageRoute: "", status: "PUBLISHED", rank: 0,
};

export default function AdminHelpPage() {
  const [editEntry, setEditEntry] = useState<HelpEntry | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<HelpEntry | null>(null);
  const [filter, setFilter] = useState("");
  const { toast } = useToast();

  const { data: entries = [], isLoading } = useQuery<HelpEntry[]>({
    queryKey: ["/api/help/admin/list"],
  });

  const { data: versions = [] } = useQuery<HelpEntryVersion[]>({
    queryKey: ["/api/help/admin", historyEntry?.id, "versions"],
    queryFn: async () => {
      if (!historyEntry?.id) return [];
      const res = await fetch(`/api/help/admin/${historyEntry.id}/versions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!historyEntry?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await apiRequest("POST", "/api/help/admin", {
        ...data,
        keywords: data.keywords ? data.keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
        category: data.category || null,
        pageRoute: data.pageRoute || null,
        rank: Number(data.rank) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help/admin/list"] });
      setDialogOpen(false);
      setFormData(emptyForm);
      toast({ title: "Help entry created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      await apiRequest("PUT", `/api/help/admin/${id}`, {
        ...data,
        keywords: data.keywords ? data.keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
        category: data.category || null,
        pageRoute: data.pageRoute || null,
        rank: Number(data.rank) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help/admin/list"] });
      setDialogOpen(false);
      setEditEntry(null);
      setFormData(emptyForm);
      toast({ title: "Help entry updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/help/admin/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/help/admin/list"] });
      toast({ title: "Help entry archived" });
    },
  });

  const openCreate = () => {
    setEditEntry(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (entry: HelpEntry) => {
    setEditEntry(entry);
    setFormData({
      key: entry.key,
      scope: entry.scope,
      title: entry.title,
      shortText: entry.shortText || "",
      bodyMd: entry.bodyMd || "",
      keywords: (entry.keywords || []).join(", "),
      category: entry.category || "",
      pageRoute: entry.pageRoute || "",
      status: entry.status,
      rank: entry.rank,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.key || !formData.title) {
      toast({ title: "Key and title are required", variant: "destructive" });
      return;
    }
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filtered = entries.filter((e) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return e.key.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || (e.category || "").toLowerCase().includes(q);
  });

  const statusColor = (s: string) => {
    if (s === "PUBLISHED") return "default" as const;
    if (s === "DRAFT") return "secondary" as const;
    return "outline" as const;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-help-title">Help Management</h1>
        </div>
        <Button onClick={openCreate} data-testid="button-create-help">
          <Plus className="h-4 w-4 mr-1.5" />
          New Entry
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by key, title, or category..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-10"
          data-testid="input-admin-help-filter"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Key</th>
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-left p-3 font-medium">Scope</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">V</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id} className="border-b hover-elevate" data-testid={`row-help-${entry.key}`}>
                      <td className="p-3 font-mono text-xs max-w-[200px] truncate">{entry.key}</td>
                      <td className="p-3 max-w-[200px] truncate">{entry.title}</td>
                      <td className="p-3"><Badge variant="secondary" className="text-[10px]">{entry.scope}</Badge></td>
                      <td className="p-3 text-muted-foreground text-xs">{entry.category || "-"}</td>
                      <td className="p-3"><Badge variant={statusColor(entry.status)} className="text-[10px]">{entry.status}</Badge></td>
                      <td className="p-3 text-muted-foreground text-xs">{entry.version}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(entry)} data-testid={`button-edit-${entry.key}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setHistoryEntry(entry)} data-testid={`button-history-${entry.key}`}>
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          {entry.status !== "ARCHIVED" && (
                            <Button variant="ghost" size="icon" onClick={() => archiveMutation.mutate(entry.id)} data-testid={`button-archive-${entry.key}`}>
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">No help entries found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEntry ? "Edit Help Entry" : "Create Help Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Key *</Label>
                <Input
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="page.dashboard"
                  disabled={!!editEntry}
                  data-testid="input-help-key"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Scope</Label>
                <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v })}>
                  <SelectTrigger data-testid="select-help-scope"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Dashboard Overview"
                data-testid="input-help-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Short Text (tooltip)</Label>
              <Input
                value={formData.shortText}
                onChange={(e) => setFormData({ ...formData, shortText: e.target.value })}
                placeholder="A brief summary shown in tooltips"
                data-testid="input-help-short-text"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body (Markdown)</Label>
              <Textarea
                value={formData.bodyMd}
                onChange={(e) => setFormData({ ...formData, bodyMd: e.target.value })}
                placeholder="## Overview\n\nDetailed help content in markdown format..."
                rows={10}
                className="font-mono text-sm"
                data-testid="input-help-body"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Dashboard"
                  data-testid="input-help-category"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Page Route</Label>
                <Input
                  value={formData.pageRoute}
                  onChange={(e) => setFormData({ ...formData, pageRoute: e.target.value })}
                  placeholder="/dashboard"
                  data-testid="input-help-route"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Keywords (comma separated)</Label>
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="home, overview, stats"
                  data-testid="input-help-keywords"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-help-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-help"
              >
                {editEntry ? "Save Changes" : "Create Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyEntry} onOpenChange={(o) => !o && setHistoryEntry(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History: {historyEntry?.key}</DialogTitle>
          </DialogHeader>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No previous versions found.</p>
          ) : (
            <div className="space-y-3 mt-2">
              {versions.map((v) => {
                const snap = v.snapshot as any;
                return (
                  <Card key={v.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px]">v{v.version}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{snap?.title}</p>
                      {snap?.shortText && <p className="text-xs text-muted-foreground mt-1">{snap.shortText}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
