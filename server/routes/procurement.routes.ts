import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { InsertItem } from "@shared/schema";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ============== Suppliers ==============
router.get("/api/procurement/suppliers", requireAuth, async (req, res) => {
  try {
    const suppliersData = await storage.getAllSuppliers();
    res.json(suppliersData);
  } catch (error: any) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({ error: error.message || "Failed to fetch suppliers" });
  }
});

router.get("/api/procurement/suppliers/active", requireAuth, async (req, res) => {
  try {
    const suppliersData = await storage.getActiveSuppliers();
    res.json(suppliersData);
  } catch (error: any) {
    console.error("Error fetching active suppliers:", error);
    res.status(500).json({ error: error.message || "Failed to fetch suppliers" });
  }
});

router.get("/api/procurement/suppliers/:id", requireAuth, async (req, res) => {
  try {
    const supplier = await storage.getSupplier(String(req.params.id));
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  } catch (error: any) {
    console.error("Error fetching supplier:", error);
    res.status(500).json({ error: error.message || "Failed to fetch supplier" });
  }
});

router.post("/api/procurement/suppliers", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const supplier = await storage.createSupplier(req.body);
    res.json(supplier);
  } catch (error: any) {
    console.error("Error creating supplier:", error);
    res.status(500).json({ error: error.message || "Failed to create supplier" });
  }
});

router.patch("/api/procurement/suppliers/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const supplier = await storage.updateSupplier(String(req.params.id), req.body);
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  } catch (error: any) {
    console.error("Error updating supplier:", error);
    res.status(500).json({ error: error.message || "Failed to update supplier" });
  }
});

router.delete("/api/procurement/suppliers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteSupplier(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({ error: error.message || "Failed to delete supplier" });
  }
});

// ============== Item Categories ==============
router.get("/api/procurement/item-categories", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getAllItemCategories();
    res.json(categories);
  } catch (error: any) {
    console.error("Error fetching item categories:", error);
    res.status(500).json({ error: error.message || "Failed to fetch categories" });
  }
});

router.get("/api/procurement/item-categories/active", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getActiveItemCategories();
    res.json(categories);
  } catch (error: any) {
    console.error("Error fetching active item categories:", error);
    res.status(500).json({ error: error.message || "Failed to fetch categories" });
  }
});

router.get("/api/procurement/item-categories/:id", requireAuth, async (req, res) => {
  try {
    const category = await storage.getItemCategory(String(req.params.id));
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error: any) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: error.message || "Failed to fetch category" });
  }
});

router.post("/api/procurement/item-categories", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const category = await storage.createItemCategory(req.body);
    res.json(category);
  } catch (error: any) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: error.message || "Failed to create category" });
  }
});

router.patch("/api/procurement/item-categories/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const category = await storage.updateItemCategory(String(req.params.id), req.body);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error: any) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: error.message || "Failed to update category" });
  }
});

router.delete("/api/procurement/item-categories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteItemCategory(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: error.message || "Failed to delete category" });
  }
});

// ============== Items ==============
router.get("/api/procurement/items", requireAuth, async (req, res) => {
  try {
    const itemsData = await storage.getAllItems();
    res.json(itemsData);
  } catch (error: any) {
    console.error("Error fetching items:", error);
    res.status(500).json({ error: error.message || "Failed to fetch items" });
  }
});

router.get("/api/procurement/items/active", requireAuth, async (req, res) => {
  try {
    const itemsData = await storage.getActiveItems();
    res.json(itemsData);
  } catch (error: any) {
    console.error("Error fetching active items:", error);
    res.status(500).json({ error: error.message || "Failed to fetch items" });
  }
});

router.get("/api/procurement/items/:id", requireAuth, async (req, res) => {
  try {
    const item = await storage.getItem(String(req.params.id));
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error: any) {
    console.error("Error fetching item:", error);
    res.status(500).json({ error: error.message || "Failed to fetch item" });
  }
});

router.post("/api/procurement/items", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const item = await storage.createItem(req.body);
    res.json(item);
  } catch (error: any) {
    console.error("Error creating item:", error);
    res.status(500).json({ error: error.message || "Failed to create item" });
  }
});

router.patch("/api/procurement/items/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const item = await storage.updateItem(String(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error: any) {
    console.error("Error updating item:", error);
    res.status(500).json({ error: error.message || "Failed to update item" });
  }
});

router.delete("/api/procurement/items/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteItem(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: error.message || "Failed to delete item" });
  }
});

// Item Import from Excel
router.post("/api/procurement/items/import", requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

    if (rows.length === 0) {
      return res.status(400).json({ error: "No data found in Excel file" });
    }

    const categories = await storage.getAllItemCategories();
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

    const itemsToImport: InsertItem[] = [];
    const categoriesToCreate: string[] = [];

    for (const row of rows) {
      const categoryName = row["Category"] || row["category"] || "";
      
      if (categoryName && !categoryMap.has(categoryName.toLowerCase())) {
        if (!categoriesToCreate.includes(categoryName)) {
          categoriesToCreate.push(categoryName);
        }
      }
    }

    for (const catName of categoriesToCreate) {
      try {
        const newCat = await storage.createItemCategory({ name: catName, isActive: true });
        categoryMap.set(catName.toLowerCase(), newCat.id);
      } catch (error) {
        console.error(`Error creating category ${catName}:`, error);
      }
    }

    for (const row of rows) {
      const productId = row["Product Id"] || row["product_id"] || row["ProductId"] || "";
      const description = row["Product Description"] || row["Description"] || row["description"] || row["Name"] || row["name"] || "";
      const categoryName = row["Category"] || row["category"] || "";
      const unitPrice = parseFloat(row["Avg Unit Price Aud"] || row["Unit Price"] || row["unit_price"] || "0") || null;
      const hsCode = row["Hs Code Guess"] || row["HS Code"] || row["hs_code"] || "";
      const adRisk = row["Ad Risk"] || row["AD Risk"] || row["ad_risk"] || "";
      const adReferenceUrl = row["Ad Reference Url"] || row["ad_reference_url"] || "";
      const complianceNotes = row["Compliance Notes"] || row["compliance_notes"] || "";
      const supplierShortlist = row["Supplier Shortlist"] || row["supplier_shortlist"] || "";
      const sources = row["Sources"] || row["sources"] || "";

      if (!description) continue;

      const categoryId = categoryName ? categoryMap.get(categoryName.toLowerCase()) || null : null;

      itemsToImport.push({
        code: productId,
        name: description,
        description: description,
        categoryId,
        unitPrice: unitPrice?.toString() || null,
        hsCode,
        adRisk,
        adReferenceUrl,
        complianceNotes,
        supplierShortlist,
        sources,
        isActive: true,
      });
    }

    const result = await storage.bulkImportItems(itemsToImport);

    res.json({
      success: true,
      message: `Import completed: ${result.created} items created, ${result.updated} items updated`,
      created: result.created,
      updated: result.updated,
      categoriesCreated: categoriesToCreate.length,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error("Error importing items:", error);
    res.status(500).json({ error: error.message || "Failed to import items" });
  }
});

// ============== Purchase Orders ==============
router.get("/api/purchase-orders", requireAuth, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    let orders;
    if (status) {
      orders = await storage.getPurchaseOrdersByStatus(status);
    } else {
      orders = await storage.getAllPurchaseOrders();
    }
    res.json(orders);
  } catch (error: any) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({ error: error.message || "Failed to fetch purchase orders" });
  }
});

router.get("/api/purchase-orders/my", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const orders = await storage.getPurchaseOrdersByUser(userId);
    res.json(orders);
  } catch (error: any) {
    console.error("Error fetching my purchase orders:", error);
    res.status(500).json({ error: error.message || "Failed to fetch purchase orders" });
  }
});

router.get("/api/purchase-orders/next-number", requireAuth, async (req, res) => {
  try {
    const poNumber = await storage.getNextPONumber();
    res.json({ poNumber });
  } catch (error: any) {
    console.error("Error getting next PO number:", error);
    res.status(500).json({ error: error.message || "Failed to get next PO number" });
  }
});

router.get("/api/purchase-orders/:id", requireAuth, async (req, res) => {
  try {
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order) return res.status(404).json({ error: "Purchase order not found" });
    res.json(order);
  } catch (error: any) {
    console.error("Error fetching purchase order:", error);
    res.status(500).json({ error: error.message || "Failed to fetch purchase order" });
  }
});

router.post("/api/purchase-orders", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const { items: lineItems, ...poData } = req.body;
    const poNumber = await storage.getNextPONumber();
    if (poData.supplierId === "") {
      poData.supplierId = null;
    }
    const order = await storage.createPurchaseOrder(
      { ...poData, poNumber, requestedById: userId },
      lineItems || []
    );
    res.json(order);
  } catch (error: any) {
    console.error("Error creating purchase order:", error);
    res.status(500).json({ error: error.message || "Failed to create purchase order" });
  }
});

router.patch("/api/purchase-orders/:id", requireAuth, async (req, res) => {
  try {
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order) return res.status(404).json({ error: "Purchase order not found" });
    
    const userId = (req.session as any).userId;
    if (order.requestedById !== userId && order.status !== "DRAFT") {
      return res.status(403).json({ error: "Cannot edit this purchase order" });
    }
    
    const { items: lineItems, ...poData } = req.body;
    if (poData.supplierId === "") {
      poData.supplierId = null;
    }
    const updated = await storage.updatePurchaseOrder(String(req.params.id), poData, lineItems);
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating purchase order:", error);
    res.status(500).json({ error: error.message || "Failed to update purchase order" });
  }
});

router.post("/api/purchase-orders/:id/submit", requireAuth, async (req, res) => {
  try {
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order) return res.status(404).json({ error: "Purchase order not found" });
    
    const userId = (req.session as any).userId;
    if (order.requestedById !== userId) {
      return res.status(403).json({ error: "Only the requester can submit this PO" });
    }
    
    if (order.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft POs can be submitted" });
    }

    const submitted = await storage.submitPurchaseOrder(String(req.params.id));
    res.json(submitted);
  } catch (error: any) {
    console.error("Error submitting purchase order:", error);
    res.status(500).json({ error: error.message || "Failed to submit purchase order" });
  }
});

router.post("/api/purchase-orders/:id/approve", requireAuth, async (req, res) => {
  try {
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order) return res.status(404).json({ error: "Purchase order not found" });
    
    if (order.status !== "SUBMITTED") {
      return res.status(400).json({ error: "Only submitted POs can be approved" });
    }

    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.poApprover && user.role !== "ADMIN") {
      return res.status(403).json({ error: "You are not authorized to approve purchase orders" });
    }

    if (user.role !== "ADMIN" && user.poApprovalLimit) {
      const orderTotal = parseFloat(order.total || "0");
      const limit = parseFloat(user.poApprovalLimit);
      if (orderTotal > limit) {
        return res.status(403).json({ 
          error: `PO total ($${orderTotal.toFixed(2)}) exceeds your approval limit ($${limit.toFixed(2)})` 
        });
      }
    }

    const approved = await storage.approvePurchaseOrder(String(req.params.id), userId);
    res.json(approved);
  } catch (error: any) {
    console.error("Error approving purchase order:", error);
    res.status(500).json({ error: error.message || "Failed to approve purchase order" });
  }
});

router.post("/api/purchase-orders/:id/reject", requireAuth, async (req, res) => {
  try {
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order) return res.status(404).json({ error: "Purchase order not found" });
    
    if (order.status !== "SUBMITTED") {
      return res.status(400).json({ error: "Only submitted POs can be rejected" });
    }

    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.poApprover && user.role !== "ADMIN") {
      return res.status(403).json({ error: "You are not authorized to reject purchase orders" });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const rejected = await storage.rejectPurchaseOrder(String(req.params.id), userId, reason);
    res.json(rejected);
  } catch (error: any) {
    console.error("Error rejecting purchase order:", error);
    res.status(500).json({ error: error.message || "Failed to reject purchase order" });
  }
});

router.delete("/api/purchase-orders/:id", requireAuth, async (req, res) => {
  try {
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order) return res.status(404).json({ error: "Purchase order not found" });
    
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    
    if (order.requestedById !== userId && user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Cannot delete this purchase order" });
    }
    
    if (order.status !== "DRAFT" && user?.role !== "ADMIN") {
      return res.status(400).json({ error: "Only draft POs can be deleted" });
    }

    await storage.deletePurchaseOrder(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting purchase order:", error);
    res.status(500).json({ error: error.message || "Failed to delete purchase order" });
  }
});

// ==================== PO Attachments ====================

router.get("/api/purchase-orders/:id/attachments", requireAuth, async (req, res) => {
  try {
    const attachments = await storage.getPurchaseOrderAttachments(String(req.params.id));
    res.json(attachments);
  } catch (error: any) {
    console.error("Error fetching PO attachments:", error);
    res.status(500).json({ error: error.message || "Failed to fetch attachments" });
  }
});

router.post("/api/purchase-orders/:id/attachments", requireAuth, upload.array("files", 10), async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const poId = String(req.params.id);
    const order = await storage.getPurchaseOrder(poId);
    if (!order) return res.status(404).json({ error: "Purchase order not found" });

    const fs = await import("fs/promises");
    const path = await import("path");
    const uploadsDir = path.join(process.cwd(), "uploads", "po-attachments");
    await fs.mkdir(uploadsDir, { recursive: true });

    const attachments = [];
    for (const file of files) {
      const timestamp = Date.now();
      const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileName = `${poId}_${timestamp}_${safeFileName}`;
      const filePath = path.join(uploadsDir, fileName);
      
      await fs.writeFile(filePath, file.buffer);

      const attachment = await storage.createPurchaseOrderAttachment({
        purchaseOrderId: poId,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath,
        uploadedById: userId,
      });
      attachments.push(attachment);
    }

    res.status(201).json(attachments);
  } catch (error: any) {
    console.error("Error uploading PO attachments:", error);
    res.status(500).json({ error: error.message || "Failed to upload attachments" });
  }
});

router.get("/api/po-attachments/:id/download", requireAuth, async (req, res) => {
  try {
    const attachment = await storage.getPurchaseOrderAttachment(String(req.params.id));
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });

    const fs = await import("fs");
    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${attachment.originalName}"`);
    res.setHeader("Content-Type", attachment.mimeType);
    fs.createReadStream(attachment.filePath).pipe(res);
  } catch (error: any) {
    console.error("Error downloading attachment:", error);
    res.status(500).json({ error: error.message || "Failed to download attachment" });
  }
});

router.delete("/api/po-attachments/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    const attachment = await storage.getPurchaseOrderAttachment(String(req.params.id));
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });

    const order = await storage.getPurchaseOrder(attachment.purchaseOrderId);
    if (!order) return res.status(404).json({ error: "Purchase order not found" });

    if (attachment.uploadedById !== userId && order.requestedById !== userId && user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Cannot delete this attachment" });
    }

    const fs = await import("fs/promises");
    try {
      await fs.unlink(attachment.filePath);
    } catch (e) {
      console.warn("Could not delete file from disk:", e);
    }

    await storage.deletePurchaseOrderAttachment(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ error: error.message || "Failed to delete attachment" });
  }
});

export const procurementRouter = router;
