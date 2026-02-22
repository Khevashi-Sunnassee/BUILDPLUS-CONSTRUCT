import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  Clock,
  Activity,
  Shield,
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Code,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EXTERNAL_API_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";
import { useDocumentTitle } from "@/hooks/use-document-title";

type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdById: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiLog = {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

const AVAILABLE_PERMISSIONS = [
  { value: "*", label: "Full Access", description: "Access to all endpoints" },
  { value: "read:jobs", label: "Read Jobs", description: "View job data" },
  { value: "read:cost-codes", label: "Read Cost Codes", description: "View cost code data" },
  { value: "read:documents", label: "Read Documents", description: "View document metadata" },
  { value: "read:job-types", label: "Read Job Types", description: "View job type data" },
  { value: "read:company", label: "Read Company", description: "View company info" },
  { value: "write:markups", label: "Write Markups", description: "Submit markup data" },
  { value: "write:estimates", label: "Write Estimates", description: "Submit estimate data" },
];

export default function ExternalApiPage() {
  useDocumentTitle("External API Keys | Admin");
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["*"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showDocsPanel, setShowDocsPanel] = useState(false);

  const { data: apiKeys, isLoading } = useQuery<ApiKeyRecord[]>({
    queryKey: [EXTERNAL_API_ROUTES.KEYS],
  });

  const { data: logs } = useQuery<ApiLog[]>({
    queryKey: [EXTERNAL_API_ROUTES.KEY_LOGS(expandedLogId || "")],
    enabled: !!expandedLogId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; permissions: string[] }) => {
      const res = await apiRequest("POST", EXTERNAL_API_ROUTES.KEYS, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [EXTERNAL_API_ROUTES.KEYS] });
      setCreatedKey(data.rawKey);
      setShowKey(true);
      setNewKeyName("");
      setNewKeyPermissions(["*"]);
      toast({ title: "API key created", description: "Copy your key now - it won't be shown again." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", EXTERNAL_API_ROUTES.KEY_BY_ID(id), { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXTERNAL_API_ROUTES.KEYS] });
      toast({ title: "API key updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", EXTERNAL_API_ROUTES.KEY_BY_ID(id));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXTERNAL_API_ROUTES.KEYS] });
      setShowDeleteDialog(false);
      setDeleteTargetId(null);
      toast({ title: "API key deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handlePermissionToggle = (permission: string) => {
    if (permission === "*") {
      setNewKeyPermissions(newKeyPermissions.includes("*") ? [] : ["*"]);
      return;
    }
    if (newKeyPermissions.includes("*")) {
      setNewKeyPermissions([permission]);
      return;
    }
    setNewKeyPermissions(
      newKeyPermissions.includes(permission)
        ? newKeyPermissions.filter((p) => p !== permission)
        : [...newKeyPermissions, permission]
    );
  };

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return "text-green-600 dark:text-green-400";
    if (code >= 400 && code < 500) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Key className="h-6 w-6" />
            External API Keys
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for external application integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDocsPanel(!showDocsPanel)}
            data-testid="button-toggle-docs"
          >
            <Code className="h-4 w-4 mr-1" />
            API Docs
          </Button>
          <PageHelpButton pageHelpKey="external-api" />
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-api-key">
            <Plus className="h-4 w-4 mr-1" />
            Create API Key
          </Button>
        </div>
      </div>

      {showDocsPanel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              API Documentation
            </CardTitle>
            <CardDescription>
              Quick reference for external API endpoints
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Authentication</h3>
              <div className="bg-muted rounded-lg p-3 font-mono text-sm">
                <p>Authorization: Bearer bp_your_api_key_here</p>
                <p className="text-muted-foreground mt-1">// or use X-API-Key header</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Read Endpoints (GET)</h3>
              <div className="space-y-2">
                {[
                  { path: "/api/v1/external/health", desc: "Health check", perm: "any" },
                  { path: "/api/v1/external/jobs", desc: "List all jobs", perm: "read:jobs" },
                  { path: "/api/v1/external/jobs/:id", desc: "Get job by ID", perm: "read:jobs" },
                  { path: "/api/v1/external/cost-codes", desc: "List cost codes", perm: "read:cost-codes" },
                  { path: "/api/v1/external/documents", desc: "List documents", perm: "read:documents" },
                  { path: "/api/v1/external/job-types", desc: "List job types", perm: "read:job-types" },
                  { path: "/api/v1/external/company", desc: "Get company info", perm: "read:company" },
                ].map((ep) => (
                  <div key={ep.path} className="flex items-center justify-between bg-muted rounded px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-mono text-xs">
                        GET
                      </Badge>
                      <code className="font-mono">{ep.path}</code>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{ep.desc}</span>
                      <Badge variant="secondary" className="text-xs">{ep.perm}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Write Endpoints (PUT)</h3>
              <div className="space-y-2">
                {[
                  { path: "/api/v1/external/jobs/:id/markups", desc: "Submit markups for job", perm: "write:markups" },
                  { path: "/api/v1/external/estimates", desc: "Submit an estimate", perm: "write:estimates" },
                ].map((ep) => (
                  <div key={ep.path} className="flex items-center justify-between bg-muted rounded px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono text-xs">
                        PUT
                      </Badge>
                      <code className="font-mono">{ep.path}</code>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{ep.desc}</span>
                      <Badge variant="secondary" className="text-xs">{ep.perm}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Example: Node.js Client</h3>
              <div className="bg-muted rounded-lg p-3 font-mono text-sm whitespace-pre overflow-x-auto">
{`const API_BASE = "https://your-app.replit.app";
const API_KEY = "bp_your_key_here";

const response = await fetch(\`\${API_BASE}/api/v1/external/jobs\`, {
  headers: { "Authorization": \`Bearer \${API_KEY}\` }
});
const { data } = await response.json();`}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : apiKeys && apiKeys.length > 0 ? (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <Collapsible
              key={key.id}
              open={expandedLogId === key.id}
              onOpenChange={(open) => setExpandedLogId(open ? key.id : null)}
            >
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${key.isActive ? "bg-green-500/10" : "bg-gray-500/10"}`}>
                        <Key className={`h-5 w-5 ${key.isActive ? "text-green-600 dark:text-green-400" : "text-gray-500"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" data-testid={`text-key-name-${key.id}`}>{key.name}</span>
                          <Badge
                            variant={key.isActive ? "default" : "secondary"}
                            className={key.isActive ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" : ""}
                            data-testid={`badge-key-status-${key.id}`}
                          >
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                            <Badge variant="destructive" className="text-xs" data-testid={`badge-key-expired-${key.id}`}>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expired
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="font-mono">{key.keyPrefix}...</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last used: {formatDate(key.lastUsedAt)}
                          </span>
                          <span>
                            Created: {formatDate(key.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-1 mr-3">
                        {(key.permissions as string[]).map((p) => (
                          <Badge key={p} variant="outline" className="text-xs" data-testid={`badge-permission-${key.id}-${p}`}>
                            {p === "*" ? "Full Access" : p}
                          </Badge>
                        ))}
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`button-logs-${key.id}`}>
                          <Activity className="h-4 w-4 mr-1" />
                          Logs
                          {expandedLogId === key.id ? (
                            <ChevronDown className="h-4 w-4 ml-1" />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMutation.mutate({ id: key.id, isActive: !key.isActive })}
                        data-testid={`button-toggle-${key.id}`}
                      >
                        {key.isActive ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteTargetId(key.id);
                          setShowDeleteDialog(true);
                        }}
                        data-testid={`button-delete-${key.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CollapsibleContent>
                  <div className="border-t px-6 pb-4 pt-3">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      <Activity className="h-4 w-4" />
                      Recent API Requests
                    </h4>
                    {logs && logs.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Path</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Response Time</TableHead>
                            <TableHead>IP</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-xs">
                                {new Date(log.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {log.method}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[300px] truncate">
                                {log.path}
                              </TableCell>
                              <TableCell>
                                <span className={`font-mono font-semibold ${getStatusColor(log.statusCode)}`}>
                                  {log.statusCode}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs">
                                {log.responseTimeMs ? `${log.responseTimeMs}ms` : "-"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {log.ipAddress || "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No API requests logged yet
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Create an API key to allow external applications (like an estimating app) to securely access your BuildPlus data.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-key">
              <Plus className="h-4 w-4 mr-1" />
              Create Your First API Key
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for external application access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Key Name</Label>
              <Input
                placeholder="e.g., Estimating App"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                data-testid="input-key-name"
              />
            </div>
            <div>
              <Label className="mb-2 block">Permissions</Label>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.value}
                    className="flex items-start gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={
                        newKeyPermissions.includes(perm.value) ||
                        (perm.value !== "*" && newKeyPermissions.includes("*"))
                      }
                      disabled={perm.value !== "*" && newKeyPermissions.includes("*")}
                      onCheckedChange={() => handlePermissionToggle(perm.value)}
                      data-testid={`checkbox-permission-${perm.value}`}
                    />
                    <div>
                      <div className="text-sm font-medium">{perm.label}</div>
                      <div className="text-xs text-muted-foreground">{perm.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button
              onClick={() => {
                createMutation.mutate({ name: newKeyName, permissions: newKeyPermissions });
                setShowCreateDialog(false);
              }}
              disabled={!newKeyName.trim() || newKeyPermissions.length === 0 || createMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdKey} onOpenChange={() => { setCreatedKey(null); setShowKey(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              This key will only be displayed once. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={createdKey || ""}
                readOnly
                className="font-mono text-sm"
                data-testid="input-created-key"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKey(!showKey)}
                data-testid="button-toggle-key-visibility"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(createdKey || "")}
                data-testid="button-copy-key"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
              Store this key securely. You will not be able to view it again after closing this dialog.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setCreatedKey(null); setShowKey(false); }} data-testid="button-close-key-dialog">
              I've Saved My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this API key. Any applications using this key will immediately lose access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Delete Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
