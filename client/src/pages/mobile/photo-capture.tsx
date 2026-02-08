import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { JOBS_ROUTES, DOCUMENT_ROUTES } from "@shared/api-routes";
import { getCsrfToken } from "@/lib/queryClient";
import { compressImage } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Camera,
  ChevronLeft,
  Upload,
  Loader2,
  ImagePlus,
  X,
  CheckCircle,
  Briefcase,
  Ruler,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface Job {
  id: string;
  name: string;
  jobNumber: string;
  status: string;
}

interface Discipline {
  id: string;
  disciplineName: string;
  shortForm: string | null;
  color: string | null;
  isActive: boolean;
}

export default function MobilePhotoCaptue() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [showJobPicker, setShowJobPicker] = useState(false);

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: disciplines = [], isLoading: disciplinesLoading } = useQuery<Discipline[]>({
    queryKey: [DOCUMENT_ROUTES.DISCIPLINES_ACTIVE],
  });

  const activeJobs = jobs.filter(j => j.status === "ACTIVE" || j.status === "CONTRACTED");
  const filteredJobs = activeJobs.filter(j =>
    jobSearch === "" ||
    j.name.toLowerCase().includes(jobSearch.toLowerCase()) ||
    j.jobNumber.toLowerCase().includes(jobSearch.toLowerCase())
  );

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const selectedDiscipline = disciplines.find(d => d.id === selectedDisciplineId);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressed = await compressImage(file);
    setSelectedFile(compressed);

    const url = URL.createObjectURL(compressed);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setUploadSuccess(false);

    if (!title) {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
      setTitle(nameWithoutExt);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "No photo selected" });
      return;
    }
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Please enter a title" });
      return;
    }
    if (!selectedJobId) {
      toast({ variant: "destructive", title: "Please select a job" });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title.trim());
      formData.append("jobId", selectedJobId);
      if (selectedDisciplineId) {
        formData.append("disciplineId", selectedDisciplineId);
      }

      const now = new Date();
      const description = `Photo captured on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;
      formData.append("description", description);

      const response = await fetch(DOCUMENT_ROUTES.UPLOAD, {
        method: "POST",
        body: formData,
        headers: {
          "x-csrf-token": getCsrfToken(),
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }

      setUploadSuccess(true);
      toast({ title: "Photo uploaded to document register" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTitle("");
    setUploadSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div
        className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white -ml-2"
            onClick={() => setLocation("/mobile/more")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold" data-testid="text-page-title">
              Add Photo
            </h1>
            <p className="text-xs text-white/50">Capture and register site photos</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 space-y-4">
        {uploadSuccess ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-white">Photo Uploaded</h2>
              <p className="text-sm text-white/50 mt-1">
                Added to document register for{" "}
                <span className="text-white/70">{selectedJob?.jobNumber}</span>
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                className="border-white/20 text-white"
                onClick={handleReset}
                data-testid="button-take-another"
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Another
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white"
                onClick={() => setLocation("/mobile/documents")}
                data-testid="button-view-documents"
              >
                View Documents
              </Button>
            </div>
          </div>
        ) : (
          <>
            {!previewUrl ? (
              <div className="space-y-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex w-full items-center gap-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-left active:scale-[0.99]"
                  data-testid="button-take-photo"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
                    <Camera className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Take Photo</div>
                    <div className="text-xs text-white/50">Use your camera</div>
                  </div>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99]"
                  data-testid="button-choose-photo"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                    <ImagePlus className="h-6 w-6 text-white/70" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Choose from Gallery</div>
                    <div className="text-xs text-white/50">Select existing photo</div>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full max-h-[300px] object-contain bg-black"
                    data-testid="img-preview"
                  />
                  <button
                    onClick={handleReset}
                    className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                    data-testid="button-remove-photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/60">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Photo title"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/60 flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    Job <span className="text-red-400">*</span>
                  </label>
                  {jobsLoading ? (
                    <Skeleton className="h-11 rounded-lg bg-white/10" />
                  ) : showJobPicker ? (
                    <div className="space-y-2">
                      <Input
                        value={jobSearch}
                        onChange={(e) => setJobSearch(e.target.value)}
                        placeholder="Search jobs..."
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                        autoFocus
                        data-testid="input-job-search"
                      />
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                        {filteredJobs.length === 0 ? (
                          <div className="p-3 text-sm text-white/40 text-center">No jobs found</div>
                        ) : (
                          filteredJobs.map((job) => (
                            <button
                              key={job.id}
                              onClick={() => {
                                setSelectedJobId(job.id);
                                setShowJobPicker(false);
                                setJobSearch("");
                              }}
                              className="w-full flex items-center gap-3 p-3 text-left border-b border-white/5 last:border-0 active:bg-white/10"
                              data-testid={`job-option-${job.id}`}
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                                <Briefcase className="h-4 w-4 text-blue-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-white truncate">{job.jobNumber}</div>
                                <div className="text-xs text-white/50 truncate">{job.name}</div>
                              </div>
                              {selectedJobId === job.id && (
                                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/50 w-full"
                        onClick={() => { setShowJobPicker(false); setJobSearch(""); }}
                        data-testid="button-cancel-job-search"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowJobPicker(true)}
                      className="w-full flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left active:scale-[0.99]"
                      data-testid="button-select-job"
                    >
                      {selectedJob ? (
                        <>
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                            <Briefcase className="h-4 w-4 text-blue-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white truncate">
                              {selectedJob.jobNumber}
                            </div>
                            <div className="text-xs text-white/50 truncate">{selectedJob.name}</div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedJobId(""); }}
                            className="text-white/40"
                            data-testid="button-clear-job"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                            <Briefcase className="h-4 w-4 text-white/40" />
                          </div>
                          <span className="text-sm text-white/40">Select a job</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/60 flex items-center gap-1">
                    <Ruler className="h-3 w-3" />
                    Discipline
                  </label>
                  {disciplinesLoading ? (
                    <Skeleton className="h-11 rounded-lg bg-white/10" />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {disciplines.filter(d => d.isActive).map((disc) => {
                        const isSelected = selectedDisciplineId === disc.id;
                        return (
                          <button
                            key={disc.id}
                            onClick={() => setSelectedDisciplineId(isSelected ? "" : disc.id)}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.97] ${
                              isSelected
                                ? "text-white"
                                : "border border-white/10 bg-white/5 text-white/60"
                            }`}
                            style={isSelected ? { backgroundColor: disc.color || "#6366f1" } : undefined}
                            data-testid={`discipline-option-${disc.id}`}
                          >
                            {disc.shortForm || disc.disciplineName}
                          </button>
                        );
                      })}
                      {disciplines.filter(d => d.isActive).length === 0 && (
                        <div className="text-sm text-white/40">No disciplines configured</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedDiscipline && (
                  <div className="text-xs text-white/40">
                    Selected: {selectedDiscipline.disciplineName}
                    {selectedDiscipline.shortForm ? ` (${selectedDiscipline.shortForm})` : ""}
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    className="w-full"
                    onClick={handleUpload}
                    disabled={isUploading || !selectedFile || !title.trim() || !selectedJobId}
                    data-testid="button-upload"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload to Document Register
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-camera"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-gallery"
      />

      <MobileBottomNav />
    </div>
  );
}
