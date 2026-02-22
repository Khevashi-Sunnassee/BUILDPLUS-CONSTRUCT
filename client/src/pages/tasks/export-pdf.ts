import { format } from "date-fns";
import type { Task, TaskGroup, TaskTypeFilter, Job } from "./types";
import { STATUS_CONFIG } from "./types";

interface ExportPDFOptions {
  filteredGroups: TaskGroup[];
  reportLogo: string | null;
  companyName: string;
  taskTypeFilter: TaskTypeFilter;
  jobFilter: string;
  jobs: Job[];
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    NOT_STARTED: "Not Started",
    IN_PROGRESS: "In Progress",
    STUCK: "Stuck",
    DONE: "Done",
    ON_HOLD: "On Hold",
  };
  return labels[status] || status.replace(/_/g, " ");
}

function formatPriority(priority: string | null): string {
  if (!priority) return "-";
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

export async function exportTasksToPDF({
  filteredGroups,
  reportLogo,
  companyName,
  taskTypeFilter,
  jobFilter,
  jobs,
}: ExportPDFOptions): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  const logoHeight = 20;
  let headerTextX = margin;

  try {
    if (reportLogo) {
      const img = document.createElement("img");
      img.src = reportLogo;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
      if (img.naturalWidth && img.naturalHeight) {
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        const lw = Math.min(25, logoHeight * aspectRatio);
        const lh = lw / aspectRatio;
        pdf.addImage(reportLogo, "PNG", margin, margin - 5, lw, lh, undefined, "FAST");
        headerTextX = margin + 30;
      }
    }
  } catch (_e) {
    /* logo load failed, continue without it */
  }

  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(companyName || "BuildPlus Ai", headerTextX, margin + 2);

  pdf.setFontSize(20);
  pdf.setTextColor(107, 114, 128);
  pdf.text("TASK LIST", headerTextX, margin + 12);

  pdf.setFillColor(249, 250, 251);
  pdf.setDrawColor(229, 231, 235);
  pdf.roundedRect(pageWidth - margin - 55, margin - 5, 55, 22, 2, 2, "FD");
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Generated", pageWidth - margin - 50, margin + 2);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(31, 41, 55);
  pdf.text(format(new Date(), "dd/MM/yyyy"), pageWidth - margin - 50, margin + 10);

  const filterLabels: string[] = [];
  if (taskTypeFilter !== "all") {
    const typeLabels: Record<string, string> = { personal: "Personal Tasks", activity: "Job Programme Activity Tasks", email: "Email Actions" };
    filterLabels.push(typeLabels[taskTypeFilter] || taskTypeFilter);
  }
  if (jobFilter !== "all") {
    filterLabels.push(jobFilter === "none" ? "No Job Assigned" : (jobs.find(j => j.id === jobFilter)?.name || ""));
  }
  if (filterLabels.length > 0) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(107, 114, 128);
    pdf.text(`Filter: ${filterLabels.join(" | ")}`, pageWidth - margin - 50, margin + 16);
  }

  pdf.setDrawColor(229, 231, 235);
  pdf.line(margin, margin + 20, pageWidth - margin, margin + 20);
  currentY = margin + 28;

  const checkPageBreak = (requiredHeight: number): boolean => {
    if (currentY + requiredHeight > pageHeight - margin - 5) {
      pdf.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  const checkboxCol = 8;
  const taskCol = 82;
  const statusCol = 28;
  const priorityCol = 22;
  const assigneeCol = 38;
  const dueDateCol = 28;
  const jobCol = contentWidth - checkboxCol - taskCol - statusCol - priorityCol - assigneeCol - dueDateCol;
  const colWidths = [checkboxCol, taskCol, statusCol, priorityCol, assigneeCol, dueDateCol, jobCol];
  const colHeaders = ["", "Task", "Status", "Priority", "Assignee", "Due Date", "Job"];

  const drawCheckbox = (x: number, y: number, size: number = 3.5) => {
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, size, size, "S");
    pdf.setLineWidth(0.2);
  };

  const drawTableHeaders = () => {
    pdf.setFillColor(75, 85, 99);
    pdf.rect(margin, currentY, contentWidth, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    let hx = margin;
    colHeaders.forEach((header, i) => {
      if (i === 0) {
        hx += colWidths[i];
        return;
      }
      pdf.text(header, hx + 3, currentY + 5.5);
      hx += colWidths[i];
    });
    currentY += 8;
  };

  for (const group of filteredGroups) {
    if (group.tasks.length === 0) continue;

    checkPageBreak(25);

    pdf.setFillColor(249, 250, 251);
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(margin, currentY, contentWidth, 9, 2, 2, "FD");
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(group.name.toUpperCase(), margin + 5, currentY + 6.5);
    const groupNameWidth = pdf.getTextWidth(group.name.toUpperCase());
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(107, 114, 128);
    pdf.text(`(${group.tasks.length} task${group.tasks.length !== 1 ? "s" : ""})`, margin + 5 + groupNameWidth + 4, currentY + 6.5);
    currentY += 13;

    drawTableHeaders();

    let rowIndex = 0;
    const drawTask = (task: Task, indent: number = 0) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const taskTextX = margin + colWidths[0] + 3 + indent;
      const taskColWidth = colWidths[1] - 6 - indent;
      const titlePrefix = indent > 0 ? "  " : "";
      const titleLines: string[] = pdf.splitTextToSize(titlePrefix + task.title, taskColWidth);
      const lineHeight = 4;
      const rowHeight = Math.max(7, titleLines.length * lineHeight + 3);

      checkPageBreak(rowHeight);

      if (rowIndex % 2 === 0) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
      }

      drawCheckbox(margin + 2.5, currentY + 2);

      if (indent > 0) {
        pdf.setTextColor(107, 114, 128);
      } else {
        pdf.setTextColor(31, 41, 55);
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(titleLines, taskTextX, currentY + 4.5);

      let rx = margin + colWidths[0] + colWidths[1];

      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(formatStatus(task.status), rx + 3, currentY + 4.5);
      rx += colWidths[2];

      pdf.text(formatPriority(task.priority), rx + 3, currentY + 4.5);
      rx += colWidths[3];

      pdf.setTextColor(107, 114, 128);
      const assignees = task.assignees?.map(a => a.user?.name?.split(" ")[0] || "").filter(Boolean).join(", ") || "-";
      const maxAssLen = Math.floor((colWidths[4] - 6) / 1.8);
      const assigneeText = assignees.length > maxAssLen ? assignees.substring(0, maxAssLen - 2) + "..." : assignees;
      pdf.text(assigneeText, rx + 3, currentY + 4.5);
      rx += colWidths[4];

      pdf.setTextColor(31, 41, 55);
      pdf.text(task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : "-", rx + 3, currentY + 4.5);
      rx += colWidths[5];

      const jobText = task.job ? `${task.job.jobNumber || task.job.name || ""}` : "-";
      const maxJobLen = Math.floor((colWidths[6] - 6) / 1.8);
      pdf.text(jobText.length > maxJobLen ? jobText.substring(0, maxJobLen - 2) + "..." : jobText, rx + 3, currentY + 4.5);

      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      currentY += rowHeight;
      rowIndex++;

      if (task.subtasks && task.subtasks.length > 0) {
        for (const subtask of task.subtasks) {
          drawTask(subtask, 6);
        }
      }
    };

    for (const task of group.tasks) {
      drawTask(task);
    }

    currentY += 8;
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setTextColor(156, 163, 175);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${companyName} - Confidential`, margin, pageHeight - 8);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  pdf.save(`BuildPlus-Tasks-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
