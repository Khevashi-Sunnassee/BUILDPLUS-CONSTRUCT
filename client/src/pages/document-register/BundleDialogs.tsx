import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QRCodeSVG } from "qrcode.react";
import {
  FileText,
  Loader2,
  Trash2,
  Package,
  FolderOpen,
  QrCode,
  Copy,
  ExternalLink,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import {
  bundleFormSchema,
  formatDate,
  type BundleFormValues,
  type DocumentBundle,
  type DocumentWithDetails,
} from "./types";

interface CreateBundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: DocumentWithDetails[];
  selectedDocIds: Set<string>;
  initialSelectedDocs: string[];
  onBundleCreated: (bundle: DocumentBundle) => void;
}

export function CreateBundleDialog({
  open,
  onOpenChange,
  documents,
  selectedDocIds,
  initialSelectedDocs,
  onBundleCreated,
}: CreateBundleDialogProps) {
  const { toast } = useToast();
  const [selectedDocsForBundle, setSelectedDocsForBundle] = useState<string[]>(initialSelectedDocs);
  const [isTenderPackage, setIsTenderPackage] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedDocsForBundle(initialSelectedDocs);
      setIsTenderPackage(false);
      bundleForm.reset({
        bundleName: "",
        description: "",
        allowGuestAccess: true,
        expiresAt: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const getTenderPackageName = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `Tender Package_${dd}-${mm}-${yyyy}`;
  };

  const bundleForm = useForm<BundleFormValues>({
    resolver: zodResolver(bundleFormSchema),
    defaultValues: {
      bundleName: "",
      description: "",
      allowGuestAccess: true,
      expiresAt: "",
    },
  });

  const handleTenderToggle = (checked: boolean) => {
    setIsTenderPackage(checked);
    if (checked) {
      bundleForm.setValue("bundleName", getTenderPackageName());
    } else {
      bundleForm.setValue("bundleName", "");
    }
  };

  const createBundleMutation = useMutation({
    mutationFn: async (data: BundleFormValues & { documentIds: string[] }) => {
      const response = await apiRequest("POST", DOCUMENT_ROUTES.BUNDLES, data);
      return response.json() as Promise<DocumentBundle>;
    },
    onSuccess: (bundle) => {
      toast({ title: "Success", description: "Document bundle created successfully" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.BUNDLES] });
      onOpenChange(false);
      onBundleCreated(bundle);
      setSelectedDocsForBundle([]);
      setIsTenderPackage(false);
      bundleForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sortedDocuments = documents
    .filter((doc) => selectedDocsForBundle.includes(doc.id))
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Document Bundle</DialogTitle>
          <DialogDescription>
            Create a bundle of documents that can be shared via QR code
          </DialogDescription>
        </DialogHeader>
        <Form {...bundleForm}>
          <form onSubmit={bundleForm.handleSubmit((data) => {
            createBundleMutation.mutate({
              ...data,
              documentIds: selectedDocsForBundle,
            });
          })} className="space-y-4">

            <div className="flex items-center gap-2">
              <Switch
                checked={isTenderPackage}
                onCheckedChange={handleTenderToggle}
                data-testid="switch-tender-package"
              />
              <Label className="!mt-0">Submit as tender package</Label>
            </div>

            <FormField
              control={bundleForm.control}
              name="bundleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bundle Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter bundle name"
                      readOnly={isTenderPackage}
                      className={isTenderPackage ? "bg-muted cursor-not-allowed" : ""}
                      data-testid="input-bundle-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={bundleForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Leave blank to auto-generate with AI based on selected documents" data-testid="input-bundle-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={bundleForm.control}
              name="allowGuestAccess"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-guest-access"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Allow guest access via QR code</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={bundleForm.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiration Date (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-bundle-expires" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Documents ({selectedDocsForBundle.length} selected)</Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                {sortedDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No documents selected</p>
                ) : sortedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 p-2 rounded"
                    data-testid={`bundle-doc-${doc.id}`}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{doc.title}</span>
                    <Badge variant="outline" className="text-xs">{doc.revision}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createBundleMutation.isPending || selectedDocsForBundle.length === 0}
                data-testid="button-create-bundle-submit"
              >
                {createBundleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Bundle
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface BundleViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: DocumentBundle | null;
}

export function BundleViewDialog({ open, onOpenChange, bundle }: BundleViewDialogProps) {
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bundle Created Successfully</DialogTitle>
          <DialogDescription>
            {bundle?.bundleName}
          </DialogDescription>
        </DialogHeader>

        {bundle && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 p-6 bg-muted rounded-lg">
              <QRCodeSVG
                value={`${window.location.origin}/bundle/${bundle.qrCodeId}`}
                size={200}
                level="H"
                includeMargin
                data-testid="qr-code-display"
              />
              <p className="text-sm text-muted-foreground text-center">
                Scan this QR code to access the bundle
              </p>
            </div>

            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/bundle/${bundle.qrCodeId}`}
                  data-testid="input-bundle-link"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/bundle/${bundle.qrCodeId}`);
                    toast({ title: "Copied!", description: "Link copied to clipboard" });
                  }}
                  data-testid="button-copy-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(`/bundle/${bundle.qrCodeId}`, "_blank")}
                  data-testid="button-open-bundle"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bundle Details</Label>
              <div className="text-sm space-y-1">
                <p><strong>Documents:</strong> {bundle.items?.length || 0} files</p>
                <p><strong>Guest Access:</strong> {bundle.allowGuestAccess ? "Enabled" : "Disabled"}</p>
                {bundle.expiresAt && (
                  <p><strong>Expires:</strong> {formatDate(bundle.expiresAt)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} data-testid="button-close-bundle-view">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BundlesListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BundlesListDialog({ open, onOpenChange }: BundlesListDialogProps) {
  const { toast } = useToast();
  const [selectedBundleForQR, setSelectedBundleForQR] = useState<DocumentBundle | null>(null);
  const [selectedBundleForView, setSelectedBundleForView] = useState<DocumentBundle | null>(null);
  const [deleteBundleDialogOpen, setDeleteBundleDialogOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<DocumentBundle | null>(null);

  const { data: bundles = [], isLoading: bundlesLoading } = useQuery<DocumentBundle[]>({
    queryKey: [DOCUMENT_ROUTES.BUNDLES],
    enabled: open,
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      await apiRequest("DELETE", DOCUMENT_ROUTES.BUNDLE_BY_ID(bundleId), {});
    },
    onSuccess: () => {
      toast({ title: "Bundle deleted" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.BUNDLES] });
      setDeleteBundleDialogOpen(false);
      setBundleToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Document Bundles
            </DialogTitle>
            <DialogDescription>
              All document bundles with their contents and sharing options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {bundlesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : bundles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No bundles created yet</p>
                <p className="text-sm mt-1">Create a bundle to share documents via QR code</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bundle Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Files</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundles.map((bundle) => (
                      <TableRow key={bundle.id} data-testid={`bundle-row-${bundle.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{bundle.bundleName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <p className="text-sm text-muted-foreground truncate">
                            {bundle.description || "No description"}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" data-testid={`badge-file-count-${bundle.id}`}>
                            {bundle.items?.length || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {bundle.allowGuestAccess ? (
                              <Badge variant="outline" className="text-green-600">Guest</Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600">Restricted</Badge>
                            )}
                            {bundle.expiresAt && new Date(bundle.expiresAt) < new Date() && (
                              <Badge variant="destructive">Expired</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(bundle.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setSelectedBundleForView(bundle)}
                              title="View documents"
                              data-testid={`button-view-bundle-${bundle.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setSelectedBundleForQR(bundle)}
                              title="Show QR code"
                              data-testid={`button-qr-bundle-${bundle.id}`}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setBundleToDelete(bundle);
                                setDeleteBundleDialogOpen(true);
                              }}
                              title="Delete bundle"
                              data-testid={`button-delete-bundle-${bundle.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBundleForView} onOpenChange={() => setSelectedBundleForView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {selectedBundleForView?.bundleName}
            </DialogTitle>
            {selectedBundleForView?.description && (
              <DialogDescription>{selectedBundleForView.description}</DialogDescription>
            )}
          </DialogHeader>
          {selectedBundleForView && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary">
                  {selectedBundleForView.items?.length || 0} documents
                </Badge>
                {selectedBundleForView.allowGuestAccess ? (
                  <Badge variant="outline" className="text-green-600">Guest Access Enabled</Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-600">Restricted Access</Badge>
                )}
                {selectedBundleForView.expiresAt && (
                  <span className="text-xs text-muted-foreground">
                    Expires: {formatDate(selectedBundleForView.expiresAt)}
                  </span>
                )}
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedBundleForView.items?.length > 0 ? (
                      selectedBundleForView.items.map((item) => (
                        <TableRow key={item.id} data-testid={`bundle-doc-row-${item.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">
                                {item.document?.title || "Unknown Document"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {(item.document as any)?.revision || "\u2014"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(item.addedAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No documents in this bundle
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBundleForView(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBundleForQR} onOpenChange={() => setSelectedBundleForQR(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">{selectedBundleForQR?.bundleName}</DialogTitle>
            <DialogDescription className="text-center">
              Scan this QR code to access the bundle
            </DialogDescription>
          </DialogHeader>
          {selectedBundleForQR && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-background p-4 rounded-md">
                <QRCodeSVG
                  value={`${window.location.origin}/bundle/${selectedBundleForQR.qrCodeId}`}
                  size={250}
                  level="H"
                />
              </div>
              <div className="flex items-center gap-2 w-full">
                <Input
                  value={`${window.location.origin}/bundle/${selectedBundleForQR.qrCodeId}`}
                  readOnly
                  className="text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/bundle/${selectedBundleForQR.qrCodeId}`);
                    toast({ title: "Copied", description: "Link copied to clipboard" });
                  }}
                  data-testid="button-copy-qr-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                <p><strong>{selectedBundleForQR.items?.length || 0}</strong> documents in this bundle</p>
                {selectedBundleForQR.expiresAt && (
                  <p>Expires: {formatDate(selectedBundleForQR.expiresAt)}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => window.open(`/bundle/${selectedBundleForQR?.qrCodeId}`, "_blank")}
              data-testid="button-open-bundle-external"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Bundle
            </Button>
            <Button onClick={() => setSelectedBundleForQR(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteBundleDialogOpen} onOpenChange={setDeleteBundleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bundle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the bundle "{bundleToDelete?.bundleName}" and remove all document associations. The documents themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bundleToDelete && deleteBundleMutation.mutate(bundleToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-bundle"
            >
              {deleteBundleMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
