import { format } from "date-fns";
import type { LineItem, PurchaseOrderWithDetails } from "./types";

function compressLogoForPdf(logoBase64: string, maxWidth = 200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
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

export async function generatePurchaseOrderPdf(
  existingPO: PurchaseOrderWithDetails,
  lineItems: LineItem[],
  settings: { logoBase64: string | null; companyName: string } | undefined,
  poTermsSettings: { poTermsHtml: string; includePOTerms: boolean } | undefined,
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
  const maxLogoHeight = 20;
  const maxLogoWidth = 40;

  if (settings?.logoBase64) {
    try {
      const compressedLogo = await compressLogoForPdf(settings.logoBase64);
      const fmt = compressedLogo.includes("image/jpeg") ? "JPEG" : "PNG";
      const dims = await new Promise<{w: number; h: number}>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: maxLogoWidth, h: maxLogoHeight });
        img.src = compressedLogo;
      });
      const aspect = dims.w / dims.h;
      let logoW = maxLogoHeight * aspect;
      let logoH = maxLogoHeight;
      if (logoW > maxLogoWidth) {
        logoW = maxLogoWidth;
        logoH = maxLogoWidth / aspect;
      }
      pdf.addImage(compressedLogo, fmt, margin, 5, logoW, logoH);
      headerTextX = margin + logoW + 5;
    } catch (e) {
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
  pdf.text(existingPO.poNumber || "", pageWidth - margin - 50, 21);

  pdf.setDrawColor(229, 231, 235);
  pdf.line(margin, 32, pageWidth - margin, 32);

  currentY = 40;

  const statusColors: Record<string, { bg: number[]; text: number[] }> = {
    DRAFT: { bg: [156, 163, 175], text: [255, 255, 255] },
    SUBMITTED: { bg: [59, 130, 246], text: [255, 255, 255] },
    APPROVED: { bg: [34, 197, 94], text: [255, 255, 255] },
    REJECTED: { bg: [239, 68, 68], text: [255, 255, 255] },
    RECEIVED: { bg: [4, 120, 87], text: [255, 255, 255] },
    RECEIVED_IN_PART: { bg: [217, 119, 6], text: [255, 255, 255] },
  };
  const statusStyle = statusColors[existingPO.status] || statusColors.DRAFT;
  pdf.setFillColor(statusStyle.bg[0], statusStyle.bg[1], statusStyle.bg[2]);
  const statusLabels: Record<string, string> = {
    SUBMITTED: "Submitted - Pending Approval",
    RECEIVED_IN_PART: "Received in Part",
  };
  const statusText = statusLabels[existingPO.status] || existingPO.status.charAt(0) + existingPO.status.slice(1).toLowerCase();
  const statusWidth = pdf.getTextWidth(statusText) + 8;
  pdf.roundedRect(margin, currentY, statusWidth, 7, 1.5, 1.5, "F");
  pdf.setTextColor(statusStyle.text[0], statusStyle.text[1], statusStyle.text[2]);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text(statusText, margin + 4, currentY + 5);

  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Date: ${format(new Date(existingPO.createdAt), "dd MMMM yyyy")}`, pageWidth - margin - 40, currentY + 5);

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
  pdf.text(existingPO.supplierName || "-", margin + 5, currentY + 16);

  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  let supplierY = currentY + 23;
  if (existingPO.supplierContact) {
    pdf.text(existingPO.supplierContact, margin + 5, supplierY);
    supplierY += 5;
  }
  if (existingPO.supplierPhone) {
    pdf.text(existingPO.supplierPhone, margin + 5, supplierY);
    supplierY += 5;
  }
  if (existingPO.supplierEmail) {
    pdf.text(existingPO.supplierEmail, margin + 5, supplierY);
    supplierY += 5;
  }

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
  const deliveryAddress = existingPO.deliveryAddress || "-";
  const deliveryLines = pdf.splitTextToSize(deliveryAddress, colWidth - 10);
  pdf.text(deliveryLines, rightColX + 5, currentY + 16);

  if ((existingPO as any).projectName) {
    pdf.setTextColor(75, 85, 99);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Project: ${(existingPO as any).projectName}`, rightColX + 5, currentY + 30);
  }

  if (existingPO.requiredByDate) {
    pdf.setTextColor(239, 68, 68);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Required by: ${format(new Date(existingPO.requiredByDate), "dd/MM/yyyy")}`, rightColX + 5, currentY + 38);
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
      pdf.text(`${existingPO.poNumber} - Order Items (continued)`, margin, currentY);
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
    const rowData = [
      String(index + 1),
      item.itemCode || "-",
      item.description.length > 40 ? item.description.substring(0, 38) + "..." : item.description,
      item.quantity,
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

  const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.lineTotal) || 0), 0);
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

  if (existingPO.notes) {
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
    const notesLines = pdf.splitTextToSize(existingPO.notes, contentWidth - 10);
    pdf.text(notesLines.slice(0, 2), margin + 5, currentY + 12);

    currentY += 25;
  }

  if (existingPO.status === "APPROVED" && existingPO.approvedBy) {
    checkPageBreak(20);

    pdf.setFillColor(220, 252, 231);
    pdf.roundedRect(margin, currentY, contentWidth, 15, 2, 2, "F");

    pdf.setTextColor(22, 101, 52);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("APPROVED", margin + 5, currentY + 6);

    pdf.setFont("helvetica", "normal");
    const approvedByName = existingPO.approvedBy.name || existingPO.approvedBy.email;
    const approvedDate = existingPO.approvedAt ? format(new Date(existingPO.approvedAt), "dd/MM/yyyy HH:mm") : "";
    pdf.text(`By: ${approvedByName}  |  Date: ${approvedDate}`, margin + 5, currentY + 11);
  }

  if (existingPO.status === "REJECTED") {
    checkPageBreak(25);

    pdf.setFillColor(254, 226, 226);
    pdf.roundedRect(margin, currentY, contentWidth, 20, 2, 2, "F");

    pdf.setTextColor(153, 27, 27);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("REJECTED", margin + 5, currentY + 6);

    pdf.setFont("helvetica", "normal");
    if (existingPO.rejectionReason) {
      const reasonLines = pdf.splitTextToSize(`Reason: ${existingPO.rejectionReason}`, contentWidth - 10);
      pdf.text(reasonLines.slice(0, 2), margin + 5, currentY + 12);
    }
  }

  if (poTermsSettings?.includePOTerms && poTermsSettings?.poTermsHtml) {
    const termsText = poTermsSettings.poTermsHtml
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
          pdf.text(`${existingPO.poNumber} - Terms and Conditions (continued)`, margin, currentY);
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

  pdf.save(`${existingPO.poNumber || "PurchaseOrder"}.pdf`);
}
