import { format } from "date-fns";
import { PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";
import type { ActivityStage } from "@shared/schema";
import { type ActivityWithAssignees, isOverdue, formatStatusLabel } from "@/lib/activity-constants";

interface PDFExportOptions {
  activities: ActivityWithAssignees[];
  activitiesByStage: Map<string, ActivityWithAssignees[]>;
  orderedStageIds: string[];
  stageMap: Map<string, ActivityStage>;
  users: Record<string, unknown>[];
  job: Record<string, unknown> | undefined;
  reportLogo: string | null;
  companyName: string;
  printIncludeTasks: boolean;
  jobId: string;
}

export async function exportActivitiesToPDF(options: PDFExportOptions): Promise<void> {
  const {
    activitiesByStage, orderedStageIds, stageMap,
    users, job, reportLogo, companyName, printIncludeTasks,
  } = options;

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

  if (reportLogo) {
    try {
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
    } catch (err) {
      console.warn("Failed to load logo for PDF:", err);
    }
  }

  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(companyName || "BuildPlus Ai", headerTextX, margin + 2);

  pdf.setFontSize(20);
  pdf.setTextColor(107, 114, 128);
  pdf.text("PROJECT ACTIVITIES", headerTextX, margin + 12);

  const jobTitle = job ? `${job.jobNumber || ""} - ${job.name || ""}`.trim() : "";
  if (jobTitle) {
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(31, 41, 55);
    pdf.text(jobTitle, headerTextX, margin + 18);
  }

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

  pdf.setDrawColor(229, 231, 235);
  pdf.line(margin, margin + 24, pageWidth - margin, margin + 24);
  currentY = margin + 32;

  const checkPageBreak = (requiredHeight: number) => {
    if (currentY + requiredHeight > pageHeight - margin - 5) {
      pdf.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  const drawCheckbox = (x: number, y: number, size: number = 3.5) => {
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, size, size, "S");
    pdf.setLineWidth(0.2);
  };

  const sortCol = 12;
  const activityCol = 70;
  const statusCol = 24;
  const daysCol = 14;
  const predCol = 12;
  const relCol = 12;
  const startCol = 24;
  const endCol = 24;
  const remainingCol = contentWidth - sortCol - activityCol - statusCol - daysCol - predCol - relCol - startCol - endCol;
  const assigneeCol = remainingCol;

  const colWidths = [sortCol, activityCol, statusCol, daysCol, predCol, relCol, startCol, endCol, assigneeCol];
  const colHeaders = ["#", "Activity", "Status", "Days", "Pred", "Rel", "Start", "End", "Assignees"];

  const drawTableHeaders = () => {
    pdf.setFillColor(75, 85, 99);
    pdf.rect(margin, currentY, contentWidth, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    let hx = margin;
    colHeaders.forEach((header, i) => {
      pdf.text(header, hx + 2, currentY + 5.5);
      hx += colWidths[i];
    });
    currentY += 8;
  };

  const taskColWidths = [8, 80, 24, 24, 30];
  const taskHeaders = ["", "Task", "Status", "Due Date", "Assignee"];

  const drawTaskHeaders = () => {
    pdf.setFillColor(107, 114, 128);
    const taskTotalWidth = taskColWidths.reduce((a, b) => a + b, 0);
    const taskStartX = margin + sortCol + 8;
    pdf.rect(taskStartX, currentY, taskTotalWidth, 6, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(6.5);
    pdf.setFont("helvetica", "bold");
    let hx = taskStartX;
    taskHeaders.forEach((header, i) => {
      if (i === 0) { hx += taskColWidths[i]; return; }
      pdf.text(header, hx + 2, currentY + 4);
      hx += taskColWidths[i];
    });
    currentY += 6;
  };

  const printedActivityIds = new Set<string>();
  for (const stageId of orderedStageIds) {
    const stageActs = activitiesByStage.get(stageId) || [];
    stageActs.forEach(a => printedActivityIds.add(a.id));
  }

  let taskDataCache: Map<string, Record<string, unknown>[]> | null = null;
  if (printIncludeTasks) {
    taskDataCache = new Map();
    const fetchPromises = Array.from(printedActivityIds).map(async (actId) => {
      try {
        const res = await fetch(PROJECT_ACTIVITIES_ROUTES.ACTIVITY_TASKS(actId), { credentials: "include" });
        if (res.ok) {
          const tasks = await res.json();
          taskDataCache!.set(actId, tasks);
        }
      } catch (err) {
        console.warn(`Failed to fetch tasks for activity ${actId}:`, err);
      }
    });
    await Promise.all(fetchPromises);
  }

  for (const stageId of orderedStageIds) {
    const stage = stageMap.get(stageId);
    const stageActivities = (activitiesByStage.get(stageId) || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (stageActivities.length === 0) continue;

    checkPageBreak(25);

    pdf.setFillColor(249, 250, 251);
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(margin, currentY, contentWidth, 9, 2, 2, "FD");
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    const stageName = (stage?.name || "Ungrouped").toUpperCase();
    pdf.text(stageName, margin + 5, currentY + 6.5);
    const stageNameWidth = pdf.getTextWidth(stageName);
    const stageDone = stageActivities.filter(a => a.status === "DONE").length;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(107, 114, 128);
    pdf.text(`(${stageDone}/${stageActivities.length} done)`, margin + 5 + stageNameWidth + 4, currentY + 6.5);
    currentY += 13;

    drawTableHeaders();

    let rowIndex = 0;
    for (const activity of stageActivities) {
      const titleLines: string[] = pdf.splitTextToSize(activity.name, activityCol - 4);
      const lineHeight = 4;
      const rowHeight = Math.max(7, titleLines.length * lineHeight + 3);

      checkPageBreak(rowHeight);

      if (rowIndex % 2 === 0) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
      }

      if (activity.status === "DONE") {
        pdf.setFillColor(220, 252, 231);
        pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
      } else if (isOverdue(activity)) {
        pdf.setFillColor(254, 226, 226);
        pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
      }

      let rx = margin;

      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(activity.sortOrder ?? ""), rx + 2, currentY + 4.5);
      rx += sortCol;

      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(titleLines, rx + 2, currentY + 4.5);
      rx += activityCol;

      pdf.setFontSize(7);
      pdf.text(formatStatusLabel(activity.status), rx + 2, currentY + 4.5);
      rx += statusCol;

      pdf.setTextColor(107, 114, 128);
      pdf.text(activity.estimatedDays != null ? String(activity.estimatedDays) : "-", rx + 2, currentY + 4.5);
      rx += daysCol;

      pdf.text(activity.predecessorSortOrder != null ? String(activity.predecessorSortOrder) : "-", rx + 2, currentY + 4.5);
      rx += predCol;

      pdf.text(activity.relationship || "-", rx + 2, currentY + 4.5);
      rx += relCol;

      pdf.setTextColor(31, 41, 55);
      pdf.text(activity.startDate ? format(new Date(activity.startDate), "dd/MM/yyyy") : "-", rx + 2, currentY + 4.5);
      rx += startCol;

      pdf.text(activity.endDate ? format(new Date(activity.endDate), "dd/MM/yyyy") : "-", rx + 2, currentY + 4.5);
      rx += endCol;

      const assigneeNames = activity.assignees?.map(a => {
        const u = users?.find((u: Record<string, unknown>) => u.id === a.userId);
        const name = u?.name as string | undefined;
        return name?.split(" ")[0] || "";
      }).filter(Boolean).join(", ") || "-";
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(7);
      const maxAssLen = Math.floor((assigneeCol - 4) / 1.8);
      const assigneeText = assigneeNames.length > maxAssLen ? assigneeNames.substring(0, maxAssLen - 2) + "..." : assigneeNames;
      pdf.text(assigneeText, rx + 2, currentY + 4.5);

      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      currentY += rowHeight;
      rowIndex++;

      if (printIncludeTasks && taskDataCache) {
        const actTasks = taskDataCache.get(activity.id) || [];
        if (actTasks.length > 0) {
          checkPageBreak(12);
          drawTaskHeaders();

          for (let ti = 0; ti < actTasks.length; ti++) {
            const task = actTasks[ti] as Record<string, unknown>;
            const taskRowHeight = 6;
            checkPageBreak(taskRowHeight);

            const taskStartX = margin + sortCol + 8;
            if (ti % 2 === 0) {
              pdf.setFillColor(245, 245, 245);
              pdf.rect(taskStartX, currentY, taskColWidths.reduce((a: number, b: number) => a + b, 0), taskRowHeight, "F");
            }

            let tx = taskStartX;
            drawCheckbox(tx + 2, currentY + 1.5, 3);
            if (task.status === "DONE") {
              pdf.setDrawColor(100, 100, 100);
              pdf.setLineWidth(0.3);
              const cbx = tx + 2, cby = currentY + 1.5, cbs = 3;
              pdf.line(cbx, cby, cbx + cbs, cby + cbs);
              pdf.line(cbx + cbs, cby, cbx, cby + cbs);
              pdf.setLineWidth(0.2);
            }
            tx += taskColWidths[0];

            pdf.setTextColor(task.status === "DONE" ? 156 : 55, task.status === "DONE" ? 163 : 65, task.status === "DONE" ? 175 : 81);
            pdf.setFontSize(7);
            pdf.setFont("helvetica", "normal");
            const taskTitle = (task.title as string || "").length > 45 ? (task.title as string).substring(0, 42) + "..." : (task.title as string || "");
            pdf.text(taskTitle, tx + 2, currentY + 4);
            tx += taskColWidths[1];

            pdf.setFontSize(6.5);
            pdf.text(formatStatusLabel(task.status as string), tx + 2, currentY + 4);
            tx += taskColWidths[2];

            pdf.text(task.dueDate ? format(new Date(task.dueDate as string), "dd/MM/yy") : "-", tx + 2, currentY + 4);
            tx += taskColWidths[3];

            const taskAssignees = (task.assignees as Array<{ user?: { name?: string }; userId?: string }> | undefined)
              ?.map((a) => a.user?.name?.split(" ")[0] || "").filter(Boolean).join(", ") || "-";
            const taskAssText = taskAssignees.length > 18 ? taskAssignees.substring(0, 15) + "..." : taskAssignees;
            pdf.text(taskAssText, tx + 2, currentY + 4);

            currentY += taskRowHeight;
          }
          currentY += 2;
        }
      }
    }
    currentY += 6;
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

  const filename = `Activities-${job?.jobNumber || options.jobId}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  pdf.save(filename);
}
