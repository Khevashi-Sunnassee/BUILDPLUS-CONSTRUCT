import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileText,
  Upload,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, getCsrfToken, apiRequest } from "@/lib/queryClient";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_ROUTES, JOBS_ROUTES, PANELS_ROUTES, PROCUREMENT_ROUTES, TASKS_ROUTES } from "@shared/api-routes";
import {
  uploadFormSchema,
  formatFileSize,
  type UploadFormValues,
  type DocumentTypeConfig,
  type DocumentDiscipline,
  type DocumentCategory,
  type DocumentTypeStatus,
  type Job,
  type PanelRegister,
  type Supplier,
  type PurchaseOrder,
  type Task,
} from "./types";

interface DuplicateInfo {
  id: string;
  title: string;
  version: string;
  revision: string;
  documentNumber: string;
  status: string;
}

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDocumentDialog({ open, onOpenChange }: UploadDocumentDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const uploadForm = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      title: "",
      documentNumber: "",
      revision: "",
      description: "",
      typeId: "",
      disciplineId: "",
      categoryId: "",
      documentTypeStatusId: "",
      jobId: "",
      panelId: "",
      supplierId: "",
      purchaseOrderId: "",
      taskId: "",
      tags: "",
      isConfidential: false,
    },
  });

  const selectedUploadTypeId = uploadForm.watch("typeId");

  const { data: documentTypes = [] } = useQuery<DocumentTypeConfig[]>({
    queryKey: [DOCUMENT_ROUTES.TYPES_ACTIVE],
  });

  const { data: disciplines = [] } = useQuery<DocumentDiscipline[]>({
    queryKey: [DOCUMENT_ROUTES.DISCIPLINES_ACTIVE],
  });

  const { data: categories = [] } = useQuery<DocumentCategory[]>({
    queryKey: [DOCUMENT_ROUTES.CATEGORIES_ACTIVE],
  });

  const { data: uploadTypeStatuses = [] } = useQuery<DocumentTypeStatus[]>({
    queryKey: [DOCUMENT_ROUTES.TYPE_STATUSES(selectedUploadTypeId || ""), selectedUploadTypeId],
    enabled: !!selectedUploadTypeId,
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: panels = [] } = useQuery<PanelRegister[]>({
    queryKey: [PANELS_ROUTES.LIST],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS],
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: [TASKS_ROUTES.LIST],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.UPLOAD, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      const wasSupersede = variables.get("supersedeDocumentId");
      toast({
        title: "Success",
        description: wasSupersede
          ? "Document uploaded as new version (previous version superseded)"
          : "Document uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
      onOpenChange(false);
      setSelectedFile(null);
      uploadForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const buildFormData = (values: UploadFormValues): FormData => {
    const formData = new FormData();
    formData.append("file", selectedFile!);
    formData.append("title", values.title);
    if (values.documentNumber) formData.append("documentNumber", values.documentNumber);
    if (values.revision) formData.append("revision", values.revision);
    if (values.description) formData.append("description", values.description);
    if (values.typeId) formData.append("typeId", values.typeId);
    if (values.disciplineId) formData.append("disciplineId", values.disciplineId);
    if (values.categoryId) formData.append("categoryId", values.categoryId);
    if (values.documentTypeStatusId) formData.append("documentTypeStatusId", values.documentTypeStatusId);
    if (values.jobId) formData.append("jobId", values.jobId);
    if (values.panelId) formData.append("panelId", values.panelId);
    if (values.supplierId) formData.append("supplierId", values.supplierId);
    if (values.purchaseOrderId) formData.append("purchaseOrderId", values.purchaseOrderId);
    if (values.taskId) formData.append("taskId", values.taskId);
    if (values.tags) formData.append("tags", values.tags);
    formData.append("isConfidential", String(values.isConfidential));
    return formData;
  };

  const handleUpload = async (values: UploadFormValues) => {
    if (!selectedFile) {
      toast({ title: "Error", description: "Please select a file", variant: "destructive" });
      return;
    }

    const docNumber = values.documentNumber?.trim();
    if (docNumber) {
      setCheckingDuplicate(true);
      try {
        const response = await apiRequest("POST", DOCUMENT_ROUTES.CHECK_DUPLICATES, {
          documentNumbers: [docNumber],
        });
        const data = await response.json();

        if (data.duplicates && data.duplicates[docNumber] && data.duplicates[docNumber].length > 0) {
          const existing = data.duplicates[docNumber][0];
          setDuplicateInfo(existing);
          setPendingFormData(buildFormData(values));
          setDuplicateDialogOpen(true);
          setCheckingDuplicate(false);
          return;
        }
      } catch {
      }
      setCheckingDuplicate(false);
    }

    const formData = buildFormData(values);
    uploadMutation.mutate(formData);
  };

  const handleSupersede = () => {
    if (!pendingFormData || !duplicateInfo) return;
    pendingFormData.append("supersedeDocumentId", duplicateInfo.id);
    setDuplicateDialogOpen(false);
    setDuplicateInfo(null);
    uploadMutation.mutate(pendingFormData);
    setPendingFormData(null);
  };

  const handleCancelDuplicate = () => {
    setDuplicateDialogOpen(false);
    setDuplicateInfo(null);
    setPendingFormData(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Upload a new document to the register</DialogDescription>
          </DialogHeader>
          <Form {...uploadForm}>
            <form onSubmit={uploadForm.handleSubmit(handleUpload)} className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Click to select a file or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">Max file size: 50MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      if (!uploadForm.getValues("title")) {
                        uploadForm.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={uploadForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Document title" data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="documentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. DOC-001" data-testid="input-document-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="revision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Revision</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. A" data-testid="input-revision" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Optional description" rows={2} data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="typeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {documentTypes.slice().sort((a, b) => (a.typeName || '').localeCompare(b.typeName || '')).map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.prefix} - {type.typeName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="disciplineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discipline</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-discipline">
                            <SelectValue placeholder="Select discipline" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {disciplines.slice().sort((a, b) => (a.disciplineName || '').localeCompare(b.disciplineName || '')).map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.shortForm || d.disciplineName} - {d.disciplineName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.slice().sort((a, b) => (a.categoryName || '').localeCompare(b.categoryName || '')).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.categoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedUploadTypeId && uploadTypeStatuses.length > 0 && (
                  <FormField
                    control={uploadForm.control}
                    name="documentTypeStatusId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-document-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {uploadTypeStatuses.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                  {s.statusName}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={uploadForm.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-job">
                            <SelectValue placeholder="Select job" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {jobs.slice().sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || '') || (a.name || '').localeCompare(b.name || '')).map((job) => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.jobNumber} - {job.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="panelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Panel</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-panel">
                            <SelectValue placeholder="Select panel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {panels.slice().sort((a, b) => (a.panelMark || '').localeCompare(b.panelMark || '')).map((panel) => (
                            <SelectItem key={panel.id} value={panel.id}>
                              {panel.panelMark}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-supplier">
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="purchaseOrderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Order</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-purchase-order">
                            <SelectValue placeholder="Select purchase order" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {purchaseOrders.slice().sort((a, b) => (a.poNumber || '').localeCompare(b.poNumber || '')).map((po) => (
                            <SelectItem key={po.id} value={po.id}>
                              {po.poNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="taskId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task">
                            <SelectValue placeholder="Select task" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tasks.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '')).map((task) => (
                            <SelectItem key={task.id} value={task.id}>
                              {task.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Comma-separated tags" data-testid="input-tags" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="isConfidential"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 pt-6">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-confidential" />
                      </FormControl>
                      <FormLabel className="!mt-0">Confidential</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploadMutation.isPending || checkingDuplicate || !selectedFile} data-testid="button-submit-upload">
                  {(uploadMutation.isPending || checkingDuplicate) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {checkingDuplicate ? "Checking..." : "Upload"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Duplicate Document Found
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  A document with the same document number already exists in the register.
                </p>
                {duplicateInfo && (
                  <div className="rounded-md border p-3 space-y-1 bg-muted/50">
                    <div className="font-medium text-sm text-foreground">{duplicateInfo.title}</div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-muted-foreground">Doc #: {duplicateInfo.documentNumber}</span>
                      <Badge variant="outline" className="text-xs">v{duplicateInfo.version}{duplicateInfo.revision}</Badge>
                      <Badge variant="secondary" className="text-xs">{duplicateInfo.status}</Badge>
                    </div>
                  </div>
                )}
                <p className="text-sm">
                  Would you like to <strong>supersede</strong> the existing document with this new upload, or <strong>cancel</strong> the upload?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelDuplicate} data-testid="button-cancel-duplicate">
              Cancel Upload
            </Button>
            <Button onClick={handleSupersede} data-testid="button-supersede-document">
              Supersede Existing
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
