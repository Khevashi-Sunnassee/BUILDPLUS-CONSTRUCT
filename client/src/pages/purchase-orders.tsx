import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import DOMPurify from "dompurify";
import * as pdfjsLib from "pdfjs-dist";
import { format, parseISO } from "date-fns";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHelpButton } from "@/components/help/page-help-button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Eye, Edit, Paperclip, Search, X, Mail, Send, Loader2, Printer, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PurchaseOrder, PurchaseOrderItem, User, Supplier } from "@shared/schema";
import { PROCUREMENT_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";

interface PurchaseOrderWithDetails extends PurchaseOrder {
  requestedBy: User;
  supplier?: Supplier | null;
  approvedBy?: User | null;
  items?: PurchaseOrderItem[];
  attachmentCount?: number;
}

type StatusFilter = "ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "RECEIVED" | "RECEIVED_IN_PART";

function isLightOnTransparent(img: HTMLImageElement): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let transparentPixels = 0;
  let lightPixels = 0;
  let totalVisiblePixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 30) {
      transparentPixels++;
    } else {
      totalVisiblePixels++;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
      if (luminance > 200) lightPixels++;
    }
  }
  const totalPixels = data.length / 4;
  const hasSignificantTransparency = transparentPixels / totalPixels > 0.3;
  const mostlyLight = totalVisiblePixels > 0 && lightPixels / totalVisiblePixels > 0.6;
  return hasSignificantTransparency && mostlyLight;
}

function invertLogoForPrint(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 30) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = img.width;
  resultCanvas.height = img.height;
  const rCtx = resultCanvas.getContext("2d");
  if (!rCtx) return canvas.toDataURL("image/png");
  rCtx.fillStyle = "#FFFFFF";
  rCtx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
  rCtx.drawImage(canvas, 0, 0);
  return resultCanvas.toDataURL("image/png");
}

function compressLogoForPdf(logoBase64: string, maxWidth = 200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (isLightOnTransparent(img)) {
        const inverted = invertLogoForPrint(img);
        if (inverted) {
          const invertedImg = new Image();
          invertedImg.onload = () => {
            const scale = Math.min(maxWidth / invertedImg.width, 1);
            const w = Math.round(invertedImg.width * scale);
            const h = Math.round(invertedImg.height * scale);
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(logoBase64); return; }
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(invertedImg, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", quality));
          };
          invertedImg.onerror = () => resolve(logoBase64);
          invertedImg.src = inverted;
          return;
        }
      }
      const scale = Math.min(maxWidth / img.width, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(logoBase64); return; }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(logoBase64);
    img.src = logoBase64;
  });
}

function htmlToPlainTextLines(html: string): string[] {
  const div = document.createElement("div");
  div.innerHTML = DOMPurify.sanitize(html);
  const text = div.innerText || div.textContent || "";
  return text.split("\n").filter((line) => line.trim() !== "");
}

async function generatePoPdf(
  po: PurchaseOrderWithDetails,
  lineItems: PurchaseOrderItem[],
  settings?: { logoBase64: string | null; companyName: string } | null,
  compressedLogo?: string | null,
  poTermsData?: { poTermsHtml: string; includePOTerms: boolean } | null
) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  const checkPageBreak = (requiredHeight: number) => {
    if (currentY + requiredHeight > pageHeight - margin) {
      pdf.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  let headerTextX = margin;
  const logoHeight = 20;
  const logoToUse = compressedLogo || settings?.logoBase64;

  if (logoToUse) {
    try {
      const fmt = logoToUse.includes("image/jpeg") ? "JPEG" : "PNG";
      pdf.addImage(logoToUse, fmt, margin, 5, 25, logoHeight);
      headerTextX = margin + 30;
    } catch (e) {
      // skip logo
    }
  }

  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(settings?.companyName || "BuildPlusAI", headerTextX, 12);

  pdf.setFontSize(20);
  pdf.setTextColor(107, 114, 128);
  pdf.text("PURCHASE ORDER", headerTextX, 22);

  pdf.setFillColor(249, 250, 251);
  pdf.setDrawColor(229, 231, 235);
  pdf.roundedRect(pageWidth - margin - 55, 5, 55, 22, 2, 2, "FD");
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("PO Number", pageWidth - margin - 50, 12);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(31, 41, 55);
  pdf.text(po.poNumber || "", pageWidth - margin - 50, 21);

  pdf.setDrawColor(229, 231, 235);
  pdf.line(margin, 32, pageWidth - margin, 32);
  currentY = 40;

  const statusColors: Record<string, { bg: number[]; text: number[] }> = {
    DRAFT: { bg: [156, 163, 175], text: [255, 255, 255] },
    SUBMITTED: { bg: [59, 130, 246], text: [255, 255, 255] },
    APPROVED: { bg: [249, 115, 22], text: [255, 255, 255] },
    REJECTED: { bg: [239, 68, 68], text: [255, 255, 255] },
    RECEIVED: { bg: [22, 163, 74], text: [255, 255, 255] },
    RECEIVED_IN_PART: { bg: [21, 128, 61], text: [255, 255, 255] },
  };
  const statusStyle = statusColors[po.status] || statusColors.DRAFT;
  pdf.setFillColor(statusStyle.bg[0], statusStyle.bg[1], statusStyle.bg[2]);
  const statusLabels: Record<string, string> = {
    SUBMITTED: "Submitted - Pending Approval",
    RECEIVED_IN_PART: "Received in Part",
  };
  const statusText = statusLabels[po.status] || po.status.charAt(0) + po.status.slice(1).toLowerCase();
  const statusWidth = pdf.getTextWidth(statusText) + 8;
  pdf.roundedRect(margin, currentY, statusWidth, 7, 1.5, 1.5, "F");
  pdf.setTextColor(statusStyle.text[0], statusStyle.text[1], statusStyle.text[2]);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text(statusText, margin + 4, currentY + 5);

  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Date: ${format(new Date(po.createdAt), "dd MMMM yyyy")}`, pageWidth - margin - 40, currentY + 5);
  currentY += 15;

  const colWidth = (contentWidth - 10) / 2;

  pdf.setFillColor(249, 250, 251);
  pdf.roundedRect(margin, currentY, colWidth, 45, 2, 2, "F");
  pdf.setDrawColor(229, 231, 235);
  pdf.roundedRect(margin, currentY, colWidth, 45, 2, 2, "S");
  pdf.setTextColor(75, 85, 99);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("SUPPLIER", margin + 5, currentY + 8);
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(11);
  pdf.text(po.supplierName || "-", margin + 5, currentY + 16);
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  let supplierY = currentY + 23;
  if (po.supplierContact) { pdf.text(po.supplierContact, margin + 5, supplierY); supplierY += 5; }
  if (po.supplierPhone) { pdf.text(po.supplierPhone, margin + 5, supplierY); supplierY += 5; }
  if (po.supplierEmail) { pdf.text(po.supplierEmail, margin + 5, supplierY); }

  const rightColX = margin + colWidth + 10;
  pdf.setFillColor(249, 250, 251);
  pdf.roundedRect(rightColX, currentY, colWidth, 45, 2, 2, "F");
  pdf.setDrawColor(229, 231, 235);
  pdf.roundedRect(rightColX, currentY, colWidth, 45, 2, 2, "S");
  pdf.setTextColor(75, 85, 99);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("DELIVER TO", rightColX + 5, currentY + 8);
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const deliveryAddress = po.deliveryAddress || "-";
  const deliveryLines = pdf.splitTextToSize(deliveryAddress, colWidth - 10);
  pdf.text(deliveryLines, rightColX + 5, currentY + 16);
  if (po.requiredByDate) {
    pdf.setTextColor(239, 68, 68);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Required by: ${format(new Date(po.requiredByDate), "dd/MM/yyyy")}`, rightColX + 5, currentY + 38);
  }
  currentY += 55;

  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("ORDER ITEMS", margin, currentY);
  currentY += 8;

  const tableColWidths = [15, 25, 70, 18, 18, 22, 22];
  const tableHeaders = ["#", "Code", "Description", "Qty", "UoM", "Unit $", "Total $"];

  const drawTableHeaders = () => {
    pdf.setFillColor(75, 85, 99);
    pdf.rect(margin, currentY, contentWidth, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    let headerX = margin;
    tableHeaders.forEach((header, i) => {
      const align = i >= 3 ? "right" : "left";
      if (align === "right") {
        pdf.text(header, headerX + tableColWidths[i] - 2, currentY + 5.5, { align: "right" });
      } else {
        pdf.text(header, headerX + 2, currentY + 5.5);
      }
      headerX += tableColWidths[i];
    });
    currentY += 8;
  };

  drawTableHeaders();

  const rowHeight = 7;
  let rowsOnCurrentPage = 0;

  lineItems.forEach((item, index) => {
    if (currentY + rowHeight > pageHeight - margin - 15) {
      pdf.addPage();
      currentY = margin + 10;
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "italic");
      pdf.text(`${po.poNumber} - Order Items (continued)`, margin, currentY);
      currentY += 8;
      drawTableHeaders();
      rowsOnCurrentPage = 0;
    }
    if (rowsOnCurrentPage % 2 === 0) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
    }
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    let rowX = margin;
    const desc = item.description || "";
    const rowData = [
      String(index + 1),
      item.itemCode || "-",
      desc.length > 40 ? desc.substring(0, 38) + "..." : desc,
      item.quantity?.toString() || "0",
      item.unitOfMeasure || "-",
      parseFloat(item.unitPrice || "0").toFixed(2),
      parseFloat(item.lineTotal || "0").toFixed(2),
    ];
    rowData.forEach((data, i) => {
      const align = i >= 3 ? "right" : "left";
      if (align === "right") {
        pdf.text(data, rowX + tableColWidths[i] - 2, currentY + 5, { align: "right" });
      } else {
        pdf.text(data, rowX + 2, currentY + 5);
      }
      rowX += tableColWidths[i];
    });
    pdf.setDrawColor(229, 231, 235);
    pdf.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);
    currentY += rowHeight;
    rowsOnCurrentPage++;
  });

  currentY += 5;

  const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.lineTotal?.toString() || "0") || 0), 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;
  const totalsWidth = 70;
  const totalsX = pageWidth - margin - totalsWidth;
  pdf.setFillColor(249, 250, 251);
  pdf.roundedRect(totalsX, currentY, totalsWidth, 28, 2, 2, "F");
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(107, 114, 128);
  pdf.text("Subtotal:", totalsX + 5, currentY + 7);
  pdf.text("GST (10%):", totalsX + 5, currentY + 14);
  pdf.setTextColor(31, 41, 55);
  pdf.text(`$${subtotal.toFixed(2)}`, totalsX + totalsWidth - 5, currentY + 7, { align: "right" });
  pdf.text(`$${gst.toFixed(2)}`, totalsX + totalsWidth - 5, currentY + 14, { align: "right" });
  pdf.setDrawColor(75, 85, 99);
  pdf.setLineWidth(0.5);
  pdf.line(totalsX + 5, currentY + 17, totalsX + totalsWidth - 5, currentY + 17);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(31, 41, 55);
  pdf.text("TOTAL:", totalsX + 5, currentY + 24);
  pdf.text(`$${total.toFixed(2)}`, totalsX + totalsWidth - 5, currentY + 24, { align: "right" });
  currentY += 35;

  if (po.notes) {
    checkPageBreak(25);
    pdf.setFillColor(254, 249, 195);
    pdf.roundedRect(margin, currentY, contentWidth, 20, 2, 2, "F");
    pdf.setDrawColor(250, 204, 21);
    pdf.roundedRect(margin, currentY, contentWidth, 20, 2, 2, "S");
    pdf.setTextColor(133, 77, 14);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("NOTES:", margin + 5, currentY + 6);
    pdf.setFont("helvetica", "normal");
    const notesLines = pdf.splitTextToSize(po.notes, contentWidth - 10);
    pdf.text(notesLines.slice(0, 2), margin + 5, currentY + 12);
    currentY += 25;
  }

  if (po.status === "APPROVED" && po.approvedBy) {
    checkPageBreak(20);
    pdf.setFillColor(220, 252, 231);
    pdf.roundedRect(margin, currentY, contentWidth, 15, 2, 2, "F");
    pdf.setTextColor(22, 101, 52);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("APPROVED", margin + 5, currentY + 6);
    pdf.setFont("helvetica", "normal");
    const approvedByName = po.approvedBy.name || po.approvedBy.email;
    const approvedDate = po.approvedAt ? format(new Date(po.approvedAt), "dd/MM/yyyy HH:mm") : "";
    pdf.text(`By: ${approvedByName}  |  Date: ${approvedDate}`, margin + 5, currentY + 11);
  }

  if (po.status === "REJECTED") {
    checkPageBreak(25);
    pdf.setFillColor(254, 226, 226);
    pdf.roundedRect(margin, currentY, contentWidth, 20, 2, 2, "F");
    pdf.setTextColor(153, 27, 27);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("REJECTED", margin + 5, currentY + 6);
    pdf.setFont("helvetica", "normal");
    if (po.rejectionReason) {
      const reasonLines = pdf.splitTextToSize(`Reason: ${po.rejectionReason}`, contentWidth - 10);
      pdf.text(reasonLines.slice(0, 2), margin + 5, currentY + 12);
    }
  }

  if (poTermsData?.includePOTerms && poTermsData.poTermsHtml) {
    const termsLines = htmlToPlainTextLines(poTermsData.poTermsHtml);
    if (termsLines.length > 0) {
      const lastContentPage = pdf.getNumberOfPages();
      pdf.setPage(lastContentPage);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
      pdf.setTextColor(120, 120, 120);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "italic");
      pdf.text("This Purchase Order is subject to Terms & Conditions. See attached page.", margin, pageHeight - 16);

      pdf.addPage();
      let tcY = 20;
      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Terms & Conditions", margin, tcY);
      tcY += 10;
      pdf.setDrawColor(59, 130, 246);
      pdf.setLineWidth(0.5);
      pdf.line(margin, tcY, margin + 40, tcY);
      tcY += 8;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 60);
      const tcContentWidth = pageWidth - margin * 2;
      for (const line of termsLines) {
        const wrapped = pdf.splitTextToSize(line, tcContentWidth);
        const lineHeight = wrapped.length * 4.5;
        if (tcY + lineHeight > pageHeight - 15) {
          pdf.addPage();
          tcY = 20;
        }
        pdf.text(wrapped, margin, tcY);
        tcY += lineHeight + 2;
      }
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setTextColor(156, 163, 175);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, pageHeight - 8);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  return pdf;
}

interface SendPOEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrderWithDetails | null;
}

function SendPOEmailDialog({ open, onOpenChange, po }: SendPOEmailDialogProps) {
  const { toast } = useToast();
  const [toEmail, setToEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [sendCopy, setSendCopy] = useState(false);
  const [pdfPageImages, setPdfPageImages] = useState<string[]>([]);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<"email" | "pdf">("pdf");

  const { data: poDetail } = useQuery<PurchaseOrderWithDetails>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, po?.id],
    queryFn: () => fetch(PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(po!.id), { credentials: "include" }).then(r => r.json()),
    enabled: open && !!po?.id,
  });

  const { data: settings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });

  const { data: poTermsData } = useQuery<{ poTermsHtml: string; includePOTerms: boolean }>({
    queryKey: [SETTINGS_ROUTES.PO_TERMS],
    enabled: open,
  });

  useEffect(() => {
    if (open && po) {
      const supplierEmail = po.supplierEmail || po.supplier?.email || "";
      setToEmail(supplierEmail);
      setCcEmail("");
      const companyName = settings?.companyName || "BuildPlusAI";
      setSubject(`Purchase Order ${po.poNumber} from ${companyName}`);
      const totalFormatted = formatCurrency(po.total);
      setMessage(
        `Hi,\n\nPlease find attached Purchase Order ${po.poNumber} for ${totalFormatted}.\n\nIf you have any questions regarding this order, please contact us.\n\nKind regards,\n${companyName}`
      );
      setAttachPdf(true);
      setSendCopy(false);
      setActivePreviewTab("pdf");
      setPdfPageImages([]);
      setPdfBase64(null);
      setPdfLoading(true);
    }
  }, [open, po, settings]);

  useEffect(() => {
    if (open && poDetail && poDetail.items) {
      setPdfLoading(true);
      (async () => {
        try {
          let compressedLogo: string | null = null;
          if (settings?.logoBase64) {
            compressedLogo = await compressLogoForPdf(settings.logoBase64);
          }
          const pdf = await generatePoPdf(poDetail, poDetail.items || [], settings, compressedLogo, poTermsData);
          const base64String = pdf.output("datauristring").split(",")[1] || "";
          setPdfBase64(base64String);

          const arrayBuffer = pdf.output("arraybuffer");
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const pages: string[] = [];
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const scale = 2;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport } as any).promise;
              pages.push(canvas.toDataURL("image/png"));
            }
          }
          setPdfPageImages(pages);
        } catch (e) {
          console.error("PDF generation error:", e);
        } finally {
          setPdfLoading(false);
        }
      })();
    }
  }, [open, poDetail, settings]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!po) throw new Error("No purchase order selected");
      const res = await apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_SEND_EMAIL(po.id), {
        to: toEmail,
        cc: ccEmail || undefined,
        subject,
        message,
        attachPdf,
        sendCopy,
        pdfBase64: attachPdf ? pdfBase64 : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: `Purchase order email sent to ${toEmail}` });
      onOpenChange(false);
    },
    onError: (err: any) => {
      let errorMsg = err.message || "An error occurred";
      try {
        const jsonMatch = errorMsg.match(/\d+:\s*(\{.*\})/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          errorMsg = parsed.error || errorMsg;
        }
      } catch {}
      toast({ title: "Failed to send email", description: errorMsg, variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!toEmail.trim()) {
      toast({ title: "Email required", description: "Please enter a recipient email address", variant: "destructive" });
      return;
    }
    sendMutation.mutate();
  };

  if (!po) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[85vh] p-0 gap-0 overflow-hidden" data-testid="dialog-send-po-email">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2" data-testid="text-dialog-title">
            <Mail className="h-5 w-5" />
            Send Purchase Order
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden" style={{ minHeight: "500px" }}>
          <div className="w-[420px] flex-shrink-0 border-r overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">To</Label>
              <Input
                id="email-to"
                type="email"
                placeholder="recipient@example.com"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                data-testid="input-email-to"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-cc">Cc</Label>
              <Input
                id="email-cc"
                type="email"
                placeholder="cc@example.com"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                data-testid="input-email-cc"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="input-email-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-message">Message</Label>
              <Textarea
                id="email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="resize-none text-sm"
                data-testid="input-email-message"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="attach-pdf"
                  checked={attachPdf}
                  onCheckedChange={(v) => setAttachPdf(!!v)}
                  data-testid="checkbox-attach-pdf"
                />
                <Label htmlFor="attach-pdf" className="text-sm cursor-pointer">Attach PDF to email</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-copy"
                  checked={sendCopy}
                  onCheckedChange={(v) => setSendCopy(!!v)}
                  data-testid="checkbox-send-copy"
                />
                <Label htmlFor="send-copy" className="text-sm cursor-pointer">Send myself a copy</Label>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-email">
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sendMutation.isPending} data-testid="button-send-email">
                {sendMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send email
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
            <div className="flex border-b px-4">
              <button
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activePreviewTab === "email"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActivePreviewTab("email")}
                data-testid="tab-email-preview"
              >
                Email Preview
              </button>
              <button
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activePreviewTab === "pdf"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActivePreviewTab("pdf")}
                data-testid="tab-pdf-preview"
              >
                PO PDF
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {activePreviewTab === "email" ? (
                <Card className="max-w-md mx-auto" data-testid="card-email-preview">
                  <CardContent className="p-6 space-y-4">
                    <div className="text-center space-y-1">
                      <p className="text-lg font-semibold">
                        {settings?.companyName || "BuildPlusAI"}
                      </p>
                      <p className="text-2xl font-bold">{formatCurrency(po.total)}</p>
                      <p className="text-sm text-muted-foreground">
                        {po.poNumber}
                      </p>
                    </div>
                    <Separator />
                    <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {message}
                    </div>
                    {attachPdf && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border text-sm">
                        <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{po.poNumber}.pdf</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full overflow-auto" data-testid="div-pdf-preview">
                  {pdfLoading || pdfPageImages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Generating PDF preview...
                    </div>
                  ) : (
                    <div className="space-y-2" data-testid="div-pdf-pages">
                      {pdfPageImages.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt={`Page ${i + 1}`}
                          className="w-full rounded-md border shadow-sm"
                          data-testid={`img-pdf-page-${i}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "$0.00";
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

export default function PurchaseOrdersPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedPOForEmail, setSelectedPOForEmail] = useState<PurchaseOrderWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPO, setDeletingPO] = useState<PurchaseOrderWithDetails | null>(null);

  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrderWithDetails[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS],
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary" data-testid={`badge-status-draft`}>Draft</Badge>;
      case "SUBMITTED":
        return <Badge className="bg-blue-600" data-testid={`badge-status-submitted`}>Submitted</Badge>;
      case "APPROVED":
        return <Badge className="bg-orange-500" data-testid={`badge-status-approved`}>Approved</Badge>;
      case "REJECTED":
        return <Badge variant="destructive" data-testid={`badge-status-rejected`}>Rejected</Badge>;
      case "RECEIVED":
        return <Badge className="bg-green-600" data-testid={`badge-status-received`}>Received</Badge>;
      case "RECEIVED_IN_PART":
        return <Badge className="bg-green-700" data-testid={`badge-status-received-in-part`}>Received in Part</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-unknown`}>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return "-";
    try {
      const date = typeof dateString === "string" ? parseISO(dateString) : dateString;
      return format(date, "dd/MM/yyyy");
    } catch {
      return "-";
    }
  };

  const getSupplierDisplay = (po: PurchaseOrderWithDetails): string => {
    if (po.supplier?.name) return po.supplier.name;
    if (po.supplierName) return po.supplierName;
    return "-";
  };

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      if (statusFilter !== "ALL" && po.status !== statusFilter) return false;
      if (supplierFilter !== "all") {
        if (!po.supplierId && !po.supplierName) return false;
        if (po.supplierId !== supplierFilter) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const poNumber = po.poNumber?.toLowerCase() || "";
        const supplierName = (po.supplier?.name || po.supplierName || "").toLowerCase();
        const projectName = ((po as any).projectName || "").toLowerCase();
        const capexId = ((po as any).capexRequestId || "").toLowerCase();
        if (!poNumber.includes(query) && !supplierName.includes(query) && !projectName.includes(query) && !capexId.includes(query)) return false;
      }
      return true;
    });
  }, [purchaseOrders, statusFilter, supplierFilter, searchQuery]);

  const clearFilters = () => {
    setSearchQuery("");
    setSupplierFilter("all");
    setStatusFilter("ALL");
  };

  const hasActiveFilters = searchQuery.trim() || supplierFilter !== "all" || statusFilter !== "ALL";

  const handleOpenEmailDialog = useCallback((po: PurchaseOrderWithDetails) => {
    setSelectedPOForEmail(po);
    setEmailDialogOpen(true);
  }, []);

  const { data: settings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });

  const { data: poTermsData } = useQuery<{ poTermsHtml: string; includePOTerms: boolean }>({
    queryKey: [SETTINGS_ROUTES.PO_TERMS],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      toast({ title: "Purchase order deleted" });
      setDeleteDialogOpen(false);
      setDeletingPO(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const handlePrint = useCallback(async (po: PurchaseOrderWithDetails) => {
    try {
      const detailRes = await fetch(PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(po.id), { credentials: "include" });
      if (!detailRes.ok) throw new Error("Failed to load purchase order details");
      const poDetail = await detailRes.json();
      let compressedLogo: string | null = null;
      if (settings?.logoBase64) {
        compressedLogo = await compressLogoForPdf(settings.logoBase64);
      }
      const pdf = await generatePoPdf(poDetail, poDetail.items || [], settings, compressedLogo, poTermsData);
      pdf.autoPrint();
      const pdfDataUri = pdf.output("dataurlnewwindow");
      if (!pdfDataUri) {
        const pdfBlob = pdf.output("blob");
        const url = URL.createObjectURL(pdfBlob);
        window.open(url);
      }
    } catch (error) {
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    }
  }, [settings, poTermsData, toast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle data-testid="text-page-title">Purchase Orders</CardTitle>
              <PageHelpButton pageHelpKey="page.purchase-orders" />
            </div>
            <CardDescription>Manage and track purchase orders</CardDescription>
          </div>
          <Link href="/purchase-orders/new">
            <Button data-testid="button-create-po">
              <Plus className="mr-2 h-4 w-4" />
              Create New PO
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search PO number, supplier, or project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-po"
              />
            </div>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-supplier-filter">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {[...suppliers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="btn-clear-filters">
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>

          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)} className="mb-6">
            <TabsList className="flex-wrap" data-testid="tabs-status-filter">
              <TabsTrigger value="ALL" data-testid="tab-all">All ({purchaseOrders.length})</TabsTrigger>
              <TabsTrigger value="DRAFT" data-testid="tab-draft">Draft</TabsTrigger>
              <TabsTrigger value="SUBMITTED" data-testid="tab-submitted">Submitted</TabsTrigger>
              <TabsTrigger value="APPROVED" data-testid="tab-approved">Approved</TabsTrigger>
              <TabsTrigger value="RECEIVED_IN_PART" data-testid="tab-received-in-part">Received in Part</TabsTrigger>
              <TabsTrigger value="RECEIVED" data-testid="tab-received">Received</TabsTrigger>
              <TabsTrigger value="REJECTED" data-testid="tab-rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
              {hasActiveFilters ? (
                <>
                  <p>No purchase orders match your filters</p>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
                    Clear all filters
                  </Button>
                </>
              ) : (
                "No purchase orders found"
              )}
            </div>
          ) : (
            <>
            <p className="text-sm text-muted-foreground mb-3">
              Showing {filteredOrders.length} of {purchaseOrders.length} purchase orders
            </p>
            <Table data-testid="table-purchase-orders">
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="th-po-number">PO Number</TableHead>
                  <TableHead data-testid="th-supplier">Supplier</TableHead>
                  <TableHead data-testid="th-requested-by">Requested By</TableHead>
                  <TableHead data-testid="th-total">Total</TableHead>
                  <TableHead data-testid="th-status">Status</TableHead>
                  <TableHead data-testid="th-created-date">Created Date</TableHead>
                  <TableHead data-testid="th-due-date">Due Date</TableHead>
                  <TableHead data-testid="th-actions">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((po) => (
                  <TableRow key={po.id} data-testid={`row-po-${po.id}`}>
                    <TableCell data-testid={`cell-po-number-${po.id}`}>
                      <span className="font-medium">{po.poNumber}</span>
                    </TableCell>
                    <TableCell data-testid={`cell-supplier-${po.id}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{getSupplierDisplay(po)}</span>
                        {(po as any).capexRequestId && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-capex-${po.id}`}>CAPEX</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-requested-by-${po.id}`}>
                      {po.requestedBy?.name || po.requestedBy?.email || "-"}
                    </TableCell>
                    <TableCell data-testid={`cell-total-${po.id}`}>
                      {formatCurrency(po.total)}
                    </TableCell>
                    <TableCell data-testid={`cell-status-${po.id}`}>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(po.status)}
                        {(po.attachmentCount ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground" data-testid={`badge-attachments-${po.id}`}>
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="text-xs">{po.attachmentCount}</span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-created-date-${po.id}`}>
                      {formatDate(po.createdAt)}
                    </TableCell>
                    <TableCell data-testid={`cell-due-date-${po.id}`}>
                      {formatDate(po.requiredByDate)}
                    </TableCell>
                    <TableCell data-testid={`cell-actions-${po.id}`}>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => navigate(`/purchase-orders/${po.id}`)}
                              data-testid={`button-view-${po.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View</TooltipContent>
                        </Tooltip>
                        {(po.status === "APPROVED" || po.status === "RECEIVED" || po.status === "RECEIVED_IN_PART") && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenEmailDialog(po)}
                                data-testid={`button-email-${po.id}`}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send Email</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handlePrint(po)}
                              data-testid={`button-print-${po.id}`}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Print</TooltipContent>
                        </Tooltip>
                        {po.status === "DRAFT" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => navigate(`/purchase-orders/${po.id}`)}
                                data-testid={`button-edit-${po.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        )}
                        {po.status !== "APPROVED" && po.status !== "RECEIVED" && po.status !== "RECEIVED_IN_PART" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setDeletingPO(po);
                                  setDeleteDialogOpen(true);
                                }}
                                data-testid={`button-delete-${po.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </CardContent>
      </Card>

      <SendPOEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        po={selectedPOForEmail}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-po">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingPO?.poNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPO && deleteMutation.mutate(deletingPO.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
