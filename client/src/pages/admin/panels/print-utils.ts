import type { PanelWithJob } from "./types";
import { formatNumber } from "./types";

interface PrintPanelListParams {
  filteredPanels: PanelWithJob[];
  filterJobId: string | null;
  jobFilter: string;
  jobs: any[] | undefined;
  statusFilter: string;
  panelTypeFilter: string;
  levelFilter: string;
  factoryFilter: string;
  factories: any[] | undefined;
  reportLogo: string;
  companyName: string;
  getFactoryName: (factoryId: string | null | undefined) => string;
}

export function printPanelList(params: PrintPanelListParams): string | null {
  const {
    filteredPanels, filterJobId, jobFilter, jobs, statusFilter,
    panelTypeFilter, levelFilter, factoryFilter, factories,
    reportLogo, companyName, getFactoryName,
  } = params;

  if (!filteredPanels || filteredPanels.length === 0) return "No panels to print";

  const effectiveJobId = filterJobId || (jobFilter !== "all" ? jobFilter : null);
  const effectiveJob = effectiveJobId ? jobs?.find(j => j.id === effectiveJobId) : null;
  const jobName = effectiveJob ? `${effectiveJob.jobNumber} - ${effectiveJob.name}` : "All Jobs";
  const showJobColumn = !effectiveJobId;
  const dateStr = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      NOT_STARTED: "Not Started",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      ON_HOLD: "On Hold",
      PENDING: "Pending",
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      NOT_STARTED: "#6b7280",
      IN_PROGRESS: "#3b82f6",
      COMPLETED: "#22c55e",
      ON_HOLD: "#f59e0b",
      PENDING: "#a855f7",
    };
    return map[status] || "#6b7280";
  };

  const sortedPanels = [...filteredPanels].sort((a, b) => {
    const buildA = a.building || "";
    const buildB = b.building || "";
    if (buildA !== buildB) return buildA.localeCompare(buildB, undefined, { numeric: true });
    const lvlA = a.level || "";
    const lvlB = b.level || "";
    if (lvlA !== lvlB) return lvlA.localeCompare(lvlB, undefined, { numeric: true });
    return a.panelMark.localeCompare(b.panelMark, undefined, { numeric: true });
  });

  const totalQty = sortedPanels.reduce((sum, p) => sum + (p.qty || 1), 0);
  const totalArea = sortedPanels.reduce((sum, p) => sum + (p.panelArea ? parseFloat(p.panelArea) : 0), 0);
  const totalVolume = sortedPanels.reduce((sum, p) => sum + (p.panelVolume ? parseFloat(p.panelVolume) : 0), 0);
  const totalMass = sortedPanels.reduce((sum, p) => sum + (p.panelMass ? parseFloat(p.panelMass) : 0), 0);

  const activeFilters: string[] = [];
  if (statusFilter !== "all") activeFilters.push(`Status: ${getStatusLabel(statusFilter)}`);
  if (panelTypeFilter !== "all") activeFilters.push(`Type: ${panelTypeFilter}`);
  if (levelFilter !== "all") activeFilters.push(`Level: ${levelFilter}`);
  if (factoryFilter !== "all") {
    const fName = factories?.find(f => f.id === factoryFilter)?.name || factoryFilter;
    activeFilters.push(`Factory: ${fName}`);
  }

  const panelRows = sortedPanels.map((panel, idx) => {
    const jobDisplay = showJobColumn ? `<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;white-space:nowrap;">${panel.job?.jobNumber || "-"}</td>` : "";
    return `<tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f9fafb"};">
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:center;color:#6b7280;">${idx + 1}</td>
      ${jobDisplay}
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;white-space:nowrap;">${getFactoryName(panel.job?.factoryId)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;font-weight:600;font-family:monospace;">${panel.panelMark}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${panel.panelType || "-"}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${panel.building || "-"}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${panel.level || "-"}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:center;">${panel.qty || 1}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${formatNumber(panel.loadWidth)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${formatNumber(panel.loadHeight)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelThickness ? parseFloat(panel.panelThickness).toFixed(0) : "-"}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelArea ? parseFloat(panel.panelArea).toFixed(2) : "-"}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelVolume ? parseFloat(panel.panelVolume).toFixed(3) : "-"}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelMass ? parseFloat(panel.panelMass).toLocaleString("en-AU") : "-"}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:center;font-family:monospace;">${panel.concreteStrengthMpa || "-"}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">
        <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:500;color:#fff;background:${getStatusColor(panel.status)};">${getStatusLabel(panel.status)}</span>
      </td>
    </tr>`;
  }).join("");

  const jobColHeader = showJobColumn ? `<th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Job</th>` : "";

  const printWindow = window.open("", "_blank");
  if (!printWindow) return "popup_blocked";

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Panel List - ${jobName}</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 12mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      color: #1f2937;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table { border-collapse: collapse; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:3px solid #1f2937;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:16px;">
      <img src="${reportLogo}" alt="Company Logo" style="height:48px;width:auto;object-fit:contain;" />
      <div>
        <div style="font-size:18px;font-weight:700;color:#1f2937;">${companyName}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">Panel Register</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:600;color:#1f2937;">${jobName}</div>
      <div style="font-size:10px;color:#6b7280;margin-top:2px;">Generated: ${dateStr} at ${timeStr}</div>
      ${activeFilters.length > 0 ? `<div style="font-size:9px;color:#9ca3af;margin-top:2px;">Filters: ${activeFilters.join(" | ")}</div>` : ""}
    </div>
  </div>

  <div style="display:flex;gap:16px;margin-bottom:12px;">
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#0369a1;">${sortedPanels.length}</div>
      <div style="font-size:9px;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;">Panels</div>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#15803d;">${totalQty}</div>
      <div style="font-size:9px;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;">Total Qty</div>
    </div>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#a16207;">${totalArea.toFixed(2)}</div>
      <div style="font-size:9px;color:#a16207;text-transform:uppercase;letter-spacing:0.5px;">Total m\u00B2</div>
    </div>
    <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#7e22ce;">${totalVolume.toFixed(3)}</div>
      <div style="font-size:9px;color:#7e22ce;text-transform:uppercase;letter-spacing:0.5px;">Total m\u00B3</div>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#c2410c;">${totalMass.toLocaleString("en-AU")}</div>
      <div style="font-size:9px;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px;">Total kg</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;border:1px solid #d1d5db;border-radius:4px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;width:30px;">#</th>
        ${jobColHeader}
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Factory</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Panel Mark</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Type</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Building</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Level</th>
        <th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Qty</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Width (mm)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Height (mm)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Thick (mm)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Area (m\u00B2)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Vol (m\u00B3)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Mass (kg)</th>
        <th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">MPa</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${panelRows}
    </tbody>
    <tfoot>
      <tr style="background:#f3f4f6;font-weight:700;">
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;" colspan="${showJobColumn ? 7 : 6}">TOTALS</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:center;">${totalQty}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;" colspan="3"></td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:right;font-family:monospace;">${totalArea.toFixed(2)}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:right;font-family:monospace;">${totalVolume.toFixed(3)}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:right;font-family:monospace;">${totalMass.toLocaleString("en-AU")}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;" colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:8px;border-top:1px solid #e5e7eb;">
    <div style="font-size:8px;color:#9ca3af;">${companyName} - Confidential</div>
    <div style="font-size:8px;color:#9ca3af;">Page 1 of 1</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`);
  printWindow.document.close();
  return null;
}
