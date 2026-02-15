import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface MultiFileDropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
  uploadingLabel?: string;
  testId?: string;
  compact?: boolean;
}

export function MultiFileDropZone({
  onFiles,
  disabled = false,
  accept,
  label = "Drag and drop files here, or",
  hint = "PDF, Word, Excel, Images supported",
  uploadingLabel = "Uploading...",
  testId = "dropzone-files",
  compact = false,
}: MultiFileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (disabled) return;

    const droppedFiles: File[] = [];

    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) droppedFiles.push(file);
        }
      }
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        droppedFiles.push(e.dataTransfer.files[i]);
      }
    }

    if (droppedFiles.length > 0) {
      onFiles(droppedFiles);
    }
  }, [onFiles, disabled]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFiles(files);
    }
    e.target.value = "";
  }, [onFiles, disabled]);

  if (compact) {
    return (
      <div
        className={`border-2 border-dashed rounded-md p-3 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        data-testid={testId}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={accept}
          disabled={disabled}
          onChange={handleFileSelect}
          data-testid={`${testId}-input`}
        />
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" />
          <span>{disabled ? uploadingLabel : label}</span>
        </div>
        {hint && (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-testid={testId}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept={accept}
        disabled={disabled}
        onChange={handleFileSelect}
        data-testid={`${testId}-input`}
      />
      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground mb-2">
        {disabled ? uploadingLabel : label}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        data-testid={`${testId}-browse`}
      >
        Browse Files
      </Button>
      {hint && (
        <p className="text-xs text-muted-foreground mt-2">{hint}</p>
      )}
    </div>
  );
}
