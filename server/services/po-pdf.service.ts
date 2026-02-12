import jsPDF from "jspdf";
import { format } from "date-fns";
import type { PurchaseOrderWithDetails } from "../storage";
import type { PurchaseOrderItem } from "@shared/schema";

export function generatePurchaseOrderPdf(
  po: PurchaseOrderWithDetails,
  lineItems: PurchaseOrderItem[],
  settings?: { logoBase64: string | null; companyName: string | null } | null,
  termsData?: { poTermsHtml: string | null; includePOTerms: boolean } | null,
): Buffer {
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
  const maxLogoHeight = 20;
  const maxLogoWidth = 40;

  if (settings?.logoBase64) {
    try {
      const fmt = settings.logoBase64.includes("image/jpeg") ? "JPEG" : "PNG";
      let logoW = maxLogoWidth;
      let logoH = maxLogoHeight;
      try {
        const imgProps = pdf.getImageProperties(settings.logoBase64);
        if (imgProps.width && imgProps.height) {
          const aspect = imgProps.width / imgProps.height;
          logoW = maxLogoHeight * aspect;
          logoH = maxLogoHeight;
          if (logoW > maxLogoWidth) {
            logoW = maxLogoWidth;
            logoH = maxLogoWidth / aspect;
          }
        }
      } catch (_dimErr) {
        // fallback to max dimensions
      }
      pdf.addImage(settings.logoBase64, fmt, margin, 5, logoW, logoH);
      headerTextX = margin + logoW + 5;
    } catch (_e) {
      // skip logo
    }
  }

  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(settings?.companyName || "BuildPlus Ai", headerTextX, 12);

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
    PENDING: { bg: [59, 130, 246], text: [255, 255, 255] },
    APPROVED: { bg: [34, 197, 94], text: [255, 255, 255] },
    REJECTED: { bg: [239, 68, 68], text: [255, 255, 255] },
    ORDERED: { bg: [147, 51, 234], text: [255, 255, 255] },
    RECEIVED: { bg: [34, 197, 94], text: [255, 255, 255] },
  };
  const statusStyle = statusColors[po.status] || statusColors.DRAFT;
  pdf.setFillColor(statusStyle.bg[0], statusStyle.bg[1], statusStyle.bg[2]);
  const statusText = po.status.charAt(0) + po.status.slice(1).toLowerCase();
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

  const tableColWidths = [12, 22, 60, 18, 18, 25, 25];
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

  if (termsData?.includePOTerms && termsData.poTermsHtml) {
    const termsText = termsData.poTermsHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li>/gi, "  - ")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (termsText.length > 0) {
      pdf.addPage();
      currentY = margin;

      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("TERMS AND CONDITIONS", margin, currentY);
      currentY += 8;

      pdf.setDrawColor(59, 130, 246);
      pdf.setLineWidth(0.5);
      pdf.line(margin, currentY, margin + 50, currentY);
      currentY += 8;

      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");

      const tcFullWidth = pageWidth - margin * 2;
      const termsLines = pdf.splitTextToSize(termsText, tcFullWidth);
      const lineHeight = 4;

      for (let i = 0; i < termsLines.length; i++) {
        if (currentY + lineHeight > pageHeight - margin - 10) {
          pdf.addPage();
          currentY = margin;

          pdf.setTextColor(107, 114, 128);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "italic");
          pdf.text(`${po.poNumber} - Terms and Conditions (continued)`, margin, currentY);
          currentY += 10;

          pdf.setTextColor(60, 60, 60);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
        }
        pdf.text(termsLines[i], margin, currentY);
        currentY += lineHeight;
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

  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
