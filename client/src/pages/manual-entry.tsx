import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  Plus,
  Clock,
  FolderOpen,
  FileText,
  Save,
  ArrowLeft,
  ClipboardList,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import type { Job, PanelRegister, WorkType } from "@shared/schema";

const manualEntrySchema = z.object({
  logDay: z.string().min(1, "Date is required"),
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  panelRegisterId: z.string().optional(),
  workTypeId: z.string().optional(),
  app: z.enum(["revit", "acad"]),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  fileName: z.string().optional(),
  filePath: z.string().optional(),
  revitViewName: z.string().optional(),
  revitSheetNumber: z.string().optional(),
  revitSheetName: z.string().optional(),
  acadLayoutName: z.string().optional(),
  panelMark: z.string().optional(),
  drawingCode: z.string().optional(),
  notes: z.string().optional(),
});

type ManualEntryForm = z.infer<typeof manualEntrySchema>;

interface Project {
  id: string;
  name: string;
  code: string | null;
}

interface PanelWithJob extends PanelRegister {
  job: Job;
}

export default function ManualEntryPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [addNewPanel, setAddNewPanel] = useState(false);
  const [newPanelMark, setNewPanelMark] = useState("");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: panels } = useQuery<PanelWithJob[]>({
    queryKey: ["/api/panels"],
  });

  const { data: workTypes } = useQuery<WorkType[]>({
    queryKey: ["/api/work-types"],
  });

  const filteredPanels = panels?.filter(p => 
    !selectedJobId || selectedJobId === "none" || p.jobId === selectedJobId
  );

  const form = useForm<ManualEntryForm>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      logDay: today,
      app: "revit",
      startTime: "09:00",
      endTime: "09:30",
      projectId: "",
      jobId: "",
      panelRegisterId: "",
      workTypeId: "",
      fileName: "",
      filePath: "",
      revitViewName: "",
      revitSheetNumber: "",
      revitSheetName: "",
      acadLayoutName: "",
      panelMark: "",
      drawingCode: "",
      notes: "",
    },
  });

  const watchedPanelRegisterId = form.watch("panelRegisterId");

  useEffect(() => {
    if (watchedPanelRegisterId && watchedPanelRegisterId !== "none") {
      const panel = panels?.find(p => p.id === watchedPanelRegisterId);
      if (panel && panel.drawingCode) {
        form.setValue("drawingCode", panel.drawingCode);
      }
    }
  }, [watchedPanelRegisterId, panels, form]);

  const createEntryMutation = useMutation({
    mutationFn: async (data: ManualEntryForm) => {
      const res = await apiRequest("POST", "/api/manual-entry", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.newPanelCreated) {
        toast({ 
          title: "Time entry created", 
          description: `Panel "${newPanelMark}" has been added to the Panel Register.`
        });
      } else {
        toast({ title: "Time entry created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/daily-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
      navigate("/daily-reports");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ManualEntryForm) => {
    const submitData = {
      ...data,
      projectId: data.projectId === "none" ? undefined : data.projectId,
      jobId: data.jobId === "none" ? undefined : data.jobId,
      panelRegisterId: addNewPanel ? undefined : (data.panelRegisterId === "none" ? undefined : data.panelRegisterId),
      workTypeId: data.workTypeId && data.workTypeId !== "none" ? parseInt(data.workTypeId) : undefined,
      createNewPanel: addNewPanel && newPanelMark ? true : undefined,
      newPanelMark: addNewPanel && newPanelMark ? newPanelMark : undefined,
    };
    createEntryMutation.mutate(submitData as ManualEntryForm);
  };

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId === "none" ? null : jobId);
    form.setValue("jobId", jobId);
    form.setValue("panelRegisterId", "");
    form.setValue("panelMark", "");
    form.setValue("drawingCode", "");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      NOT_STARTED: "outline",
      IN_PROGRESS: "default",
      COMPLETED: "secondary",
      ON_HOLD: "destructive",
    };
    return <Badge variant={variants[status] || "default"} className="ml-2 text-xs">{status.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/daily-reports")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-manual-entry-title">
            Manual Time Entry
          </h1>
          <p className="text-muted-foreground">
            Log time manually when the add-in is not available
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            New Time Entry
          </CardTitle>
          <CardDescription>
            Enter your time worked with the same detail as the automatic tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="logDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-log-day" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-start-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-end-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="app"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-app">
                            <SelectValue placeholder="Select application" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="revit">Revit</SelectItem>
                          <SelectItem value="acad">AutoCAD</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-project">
                            <SelectValue placeholder="Select project (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No project</SelectItem>
                          {projects?.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.code ? `${project.code} - ${project.name}` : project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Panel Register Selection
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Link this entry to a panel from the register for automatic tracking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="add-new-panel" 
                      checked={addNewPanel}
                      onCheckedChange={(checked) => {
                        setAddNewPanel(checked === true);
                        if (checked) {
                          form.setValue("panelRegisterId", "");
                        } else {
                          setNewPanelMark("");
                        }
                      }}
                      disabled={!selectedJobId || selectedJobId === "none"}
                      data-testid="checkbox-add-new-panel"
                    />
                    <label 
                      htmlFor="add-new-panel" 
                      className={`text-sm font-medium leading-none ${(!selectedJobId || selectedJobId === "none") ? 'text-muted-foreground' : 'cursor-pointer'}`}
                    >
                      Add new panel to register
                    </label>
                  </div>

                  {addNewPanel && newPanelMark && (
                    <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        Panel "<strong>{newPanelMark}</strong>" will be automatically added to the Panel Register for this job when you save this entry.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="jobId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            Job
                          </FormLabel>
                          <Select onValueChange={handleJobChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-job">
                                <SelectValue placeholder="Select job (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No job selected</SelectItem>
                              {jobs?.filter(j => j.status === "ACTIVE").map((job) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobNumber} - {job.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">Select job to filter panels</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!addNewPanel ? (
                      <FormField
                        control={form.control}
                        name="panelRegisterId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <ClipboardList className="h-3 w-3" />
                              Panel
                            </FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ""}
                              disabled={!selectedJobId || selectedJobId === "none"}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-panel">
                                  <SelectValue placeholder={selectedJobId ? "Select panel" : "Select job first"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No panel selected</SelectItem>
                                {filteredPanels?.filter(p => p.status !== "COMPLETED").map((panel) => (
                                  <SelectItem key={panel.id} value={panel.id}>
                                    <div className="flex items-center">
                                      {panel.panelMark}
                                      {panel.description && <span className="text-muted-foreground ml-1">- {panel.description}</span>}
                                      {getStatusBadge(panel.status)}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-xs">Auto-fills drawing code when selected</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="space-y-2">
                        <FormLabel className="flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" />
                          New Panel Mark
                        </FormLabel>
                        <Input 
                          placeholder="e.g., PM-001" 
                          value={newPanelMark}
                          onChange={(e) => setNewPanelMark(e.target.value)}
                          disabled={!selectedJobId || selectedJobId === "none"}
                          data-testid="input-new-panel-mark"
                        />
                        <p className="text-xs text-muted-foreground">Enter the panel mark for the new panel</p>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="workTypeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            Work Type
                          </FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-work-type">
                                <SelectValue placeholder="Select work type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No work type</SelectItem>
                              {workTypes?.map((wt) => (
                                <SelectItem key={wt.id} value={String(wt.id)}>
                                  {wt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">Categorize the type of drafting work</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <FormField
                control={form.control}
                name="drawingCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drawing Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., DWG-001" {...field} data-testid="input-drawing-code" />
                    </FormControl>
                    <FormDescription>Drawing reference code (auto-filled when panel selected)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional notes about this time entry..." 
                        className="resize-none"
                        {...field} 
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate("/daily-reports")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEntryMutation.isPending}
                  data-testid="button-save-entry"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createEntryMutation.isPending ? "Saving..." : "Save Entry"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
