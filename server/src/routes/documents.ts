import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, AuthenticatedRequest } from "../middleware/roleAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import https from "https";
import mammoth from "mammoth";
import { Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, ExternalHyperlink, Text } from "docx";
import JsBarcode from "jsbarcode";

// Optional canvas import - server can run without it
let createCanvas: any = null;
try {
  const canvas = require("canvas");
  createCanvas = canvas.createCanvas;
} catch (error) {
  console.warn("Canvas module not available - barcode generation will be disabled");
}

const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads", "documents");
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (error: any) {
    // Directory creation may fail due to permissions - will be created on first upload
    console.warn(`Warning: Could not create documents directory: ${error.message}`);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "text/plain",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, DOC, DOCX, images, and text files are allowed."));
    }
  },
});

/**
 * ============================================
 * CLEAN BARCODE GENERATION FUNCTION
 * ============================================
 * This function generates a barcode image with multiple fallback strategies
 * to ensure 100% reliability. It will NOT return null unless all methods fail.
 */
async function generateBarcodeImage(value: string): Promise<Buffer | null> {
  console.log(`\n🔵 [BARCODE] Starting barcode generation for: "${value}"`);
  
  if (!value || value.trim().length === 0) {
    console.error("❌ [BARCODE] Empty value provided, cannot generate barcode");
    return null;
  }

  // Method 1: Try canvas + JsBarcode (Primary method)
  try {
    console.log("🔵 [BARCODE] Method 1: Attempting canvas + JsBarcode...");
    if (!createCanvas) {
      return res.status(503).json({ error: "Barcode generation is not available - canvas module not installed" });
    }
    const canvas = createCanvas(400, 100);
    JsBarcode(canvas, value, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      margin: 10,
    });
    const buffer = canvas.toBuffer("image/png");
    
    if (buffer && buffer.length > 0) {
      console.log(`✅ [BARCODE] Method 1 SUCCESS! Generated ${buffer.length} bytes`);
      return buffer;
    } else {
      console.warn("⚠️ [BARCODE] Method 1 returned empty buffer");
    }
  } catch (error: any) {
    console.error("❌ [BARCODE] Method 1 FAILED:", error.message);
  }

  // Method 2: Try external barcode service (Fallback)
  try {
    console.log("🔵 [BARCODE] Method 2: Attempting external service (tec-it.com)...");
    const url = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
      value
    )}&code=Code128&translate-esc=false`;

    const buffer = await new Promise<Buffer | null>((resolve) => {
      https
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            console.error(`❌ [BARCODE] Method 2: Service returned status ${res.statusCode}`);
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const result = Buffer.concat(chunks);
            if (result && result.length > 0) {
              console.log(`✅ [BARCODE] Method 2 SUCCESS! Fetched ${result.length} bytes`);
              resolve(result);
            } else {
              console.warn("⚠️ [BARCODE] Method 2: Empty response");
              resolve(null);
            }
          });
        })
        .on("error", (err) => {
          console.error("❌ [BARCODE] Method 2 FAILED:", err.message);
          resolve(null);
        });
    });

    if (buffer) {
      return buffer;
    }
  } catch (error: any) {
    console.error("❌ [BARCODE] Method 2 FAILED:", error.message);
  }

  // Method 3: Try alternative external service
  try {
    console.log("🔵 [BARCODE] Method 3: Attempting alternative service (bwip-js)...");
    const url = `https://api-barcode.herokuapp.com/barcode?text=${encodeURIComponent(value)}&type=code128`;
    
    const buffer = await new Promise<Buffer | null>((resolve) => {
      https
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            console.error(`❌ [BARCODE] Method 3: Service returned status ${res.statusCode}`);
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const result = Buffer.concat(chunks);
            if (result && result.length > 0) {
              console.log(`✅ [BARCODE] Method 3 SUCCESS! Fetched ${result.length} bytes`);
              resolve(result);
            } else {
              console.warn("⚠️ [BARCODE] Method 3: Empty response");
              resolve(null);
            }
          });
        })
        .on("error", (err) => {
          console.error("❌ [BARCODE] Method 3 FAILED:", err.message);
          resolve(null);
        });
    });

    if (buffer) {
      return buffer;
    }
  } catch (error: any) {
    console.error("❌ [BARCODE] Method 3 FAILED:", error.message);
  }

  console.error("❌ [BARCODE] ALL METHODS FAILED! Barcode cannot be generated.");
  return null;
}

// Validation schemas
const createDocumentSchema = z.object({
  documentType: z.enum([
    "offer_letter",
    "joining_letter",
    "noc",
    "warning_letter",
    "experience_letter",
    "appointment_letter",
    "relieving_letter",
    "salary_certificate",
    "bonus_letter",
    "increment_letter",
    "other",
  ]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  recipientId: z.string().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  tags: z.string().optional(),
  status: z.enum(["draft", "sent", "acknowledged", "archived"]).optional(),
});

const updateDocumentSchema = createDocumentSchema.partial();

/**
 * GET /api/documents
 * Get all documents with filters
 * For TELECALLER: Only show documents for clients whose leads are assigned to them
 */
router.get("/", authenticate, authorize("HR_TEAM", "ADMIN", "TELECALLER", "TEAM_LEADER", "COUNSELOR", "FILLING_OFFICER"), async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    const userId = user?.userId || user?.id;
    const userRole = user?.role;

    const { documentType, recipientId, status, search, startDate, endDate } = req.query;

    const where: any = {};

    // For TELECALLER: Filter documents by assigned leads
    if (userRole === "TELECALLER") {
      // Get all leads assigned to this telecaller
      const assignedLeads = await prisma.lead.findMany({
        where: {
          assignedToId: userId,
        },
        select: {
          id: true,
          email: true,
          phone: true,
        },
      });

      if (assignedLeads.length === 0) {
        // No assigned leads, return empty array
        return res.json({ documents: [] });
      }

      // Get lead emails and phones
      const leadEmails = assignedLeads.map(l => l.email).filter(Boolean) as string[];
      const leadPhones = assignedLeads.map(l => l.phone).filter(Boolean) as string[];

      // Find clients that match lead emails or phones
      const matchingClients = await prisma.client.findMany({
        where: {
          OR: [
            ...(leadEmails.length > 0 ? [{ email: { in: leadEmails } }] : []),
            ...(leadPhones.length > 0 ? [{ phone: { in: leadPhones } }] : []),
          ],
        },
        select: {
          email: true,
          phone: true,
        },
      });

      // Combine lead and client emails/phones
      const allEmails = [...leadEmails, ...matchingClients.map(c => c.email).filter(Boolean) as string[]];
      const allPhones = [...leadPhones, ...matchingClients.map(c => c.phone).filter(Boolean) as string[]];

      // Find users (recipients) that match client/lead emails or phones
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            ...(allEmails.length > 0 ? [{ email: { in: allEmails } }] : []),
            ...(allPhones.length > 0 ? [{ phone: { in: allPhones } }] : []),
          ],
        },
        select: {
          id: true,
        },
      });

      const recipientIds = matchingUsers.map(u => u.id);
      
      if (recipientIds.length === 0) {
        // No matching recipients, return empty array
        return res.json({ documents: [] });
      }

      // Filter documents to only those with matching recipients
      where.recipientId = {
        in: recipientIds,
      };
    }

    if (documentType) {
      where.documentType = documentType as string;
    }

    if (recipientId) {
      where.recipientId = recipientId as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      where.OR = [
        { title: { contains: search as string } },
        { description: { contains: search as string } },
        { fileName: { contains: search as string } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ documents });
  } catch (error: any) {
    console.error("Get documents error:", error);
    res.status(500).json({ error: "Failed to fetch documents", details: error.message });
  }
});

/**
 * GET /api/documents/:id
 * Get document by ID
 */
router.get("/:id", authenticate, authorize("HR_TEAM", "ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ document });
  } catch (error: any) {
    console.error("Get document error:", error);
    res.status(500).json({ error: "Failed to fetch document", details: error.message });
  }
});

/**
 * POST /api/documents
 * Create a new document with file upload
 */
router.post(
  "/",
  authenticate,
  authorize("HR_TEAM", "ADMIN"),
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      const body = JSON.parse(req.body.data || "{}");
      const validatedData = createDocumentSchema.parse(body);

      const fileUrl = `/uploads/documents/${req.file.filename}`;
      const fileSize = req.file.size;
      const mimeType = req.file.mimetype;

      const document = await prisma.document.create({
        data: {
          documentType: validatedData.documentType,
          title: validatedData.title,
          description: validatedData.description,
          fileName: req.file.originalname,
          fileUrl,
          fileSize,
          mimeType,
          recipientId: validatedData.recipientId,
          createdById: req.user.userId,
          status: validatedData.status || "draft",
          issuedDate: validatedData.issuedDate ? new Date(validatedData.issuedDate) : null,
          expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : null,
          tags: validatedData.tags,
        },
        include: {
          recipient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json({ document, message: "Document created successfully" });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Create document error:", error);
      res.status(500).json({ error: "Failed to create document", details: error.message });
    }
  }
);

/**
 * PUT /api/documents/:id
 * Update a document
 */
router.put("/:id", authenticate, authorize("HR_TEAM", "ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = updateDocumentSchema.parse(req.body);

    const updateData: any = {};
    if (validatedData.documentType) updateData.documentType = validatedData.documentType;
    if (validatedData.title) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.recipientId !== undefined) updateData.recipientId = validatedData.recipientId;
    if (validatedData.status) updateData.status = validatedData.status;
    if (validatedData.issuedDate) updateData.issuedDate = new Date(validatedData.issuedDate);
    if (validatedData.expiryDate) updateData.expiryDate = new Date(validatedData.expiryDate);
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags;

    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json({ document, message: "Document updated successfully" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Update document error:", error);
    res.status(500).json({ error: "Failed to update document", details: error.message });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete("/:id", authenticate, authorize("HR_TEAM", "ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Delete file from filesystem
    const filePath = path.join(process.cwd(), document.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Document deleted successfully" });
  } catch (error: any) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: "Failed to delete document", details: error.message });
  }
});

/**
 * GET /api/documents/:id/download
 * Download a document file
 */
router.get("/:id/download", authenticate, authorize("HR_TEAM", "ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const filePath = path.join(process.cwd(), document.fileUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath, document.fileName);
  } catch (error: any) {
    console.error("Download document error:", error);
    res.status(500).json({ error: "Failed to download document", details: error.message });
  }
});

/**
 * POST /api/documents/parse-template
 * Parse a DOCX template file to extract placeholders
 */
router.post(
  "/parse-template",
  authenticate,
  authorize("HR_TEAM", "ADMIN"),
  upload.single("template"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Template file is required" });
      }

      const filePath = path.join(process.cwd(), req.file.path);
      
      if (!fs.existsSync(filePath)) {
        throw new Error("Uploaded file not found on server");
      }
      
      const fileBuffer = fs.readFileSync(filePath);
      
      if (fileBuffer.length === 0) {
        throw new Error("Uploaded file is empty");
      }

      // Extract placeholders from DOCX
      let result;
      let text = "";
      
      try {
        // Check file extension
        const isDocx = filePath.toLowerCase().endsWith(".docx");
        const isDoc = filePath.toLowerCase().endsWith(".doc");
        
        if (isDocx) {
          // Try with path first (mammoth prefers path for DOCX)
          try {
            result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
          } catch (pathError: any) {
            console.log("Path method failed, trying buffer:", pathError.message);
            // Fallback to buffer
            result = await mammoth.extractRawText({ buffer: fileBuffer });
            text = result.value;
          }
        } else if (isDoc) {
          throw new Error("Old .doc format is not supported. Please convert your file to .docx format.");
        } else {
          // Unknown format, try mammoth anyway
          result = await mammoth.extractRawText({ buffer: fileBuffer });
          text = result.value;
        }
        
        if (!text || text.trim().length === 0) {
          throw new Error("Document appears to be empty or could not be read.");
        }
      } catch (mammothError: any) {
        console.error("Mammoth parsing error:", mammothError);
        const errorMsg = mammothError.message || "Unknown parsing error";
        throw new Error(`Failed to parse DOCX file: ${errorMsg}. Please ensure the file is a valid DOCX format (not .doc).`);
      }

      // Find all placeholders in format {{placeholder_name}}
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const placeholders: string[] = [];
      let match;

      while ((match = placeholderRegex.exec(text)) !== null) {
        const placeholder = match[1].trim();
        if (!placeholders.includes(placeholder)) {
          placeholders.push(placeholder);
        }
      }

      if (placeholders.length === 0) {
        return res.status(400).json({ 
          error: "No placeholders found", 
          message: "Please add placeholders in format {{placeholder_name}} in your template file" 
        });
      }

      // Don't delete file yet - we'll use it for generation
      res.json({
        placeholders,
        templatePath: req.file.path,
        message: "Template parsed successfully",
      });
    } catch (error: any) {
      console.error("Parse template error:", error);
      // Clean up file if error
      if (req.file && fs.existsSync(path.join(process.cwd(), req.file.path))) {
        try {
          fs.unlinkSync(path.join(process.cwd(), req.file.path));
        } catch (unlinkError) {
          console.error("Failed to cleanup file:", unlinkError);
        }
      }
      res.status(500).json({ 
        error: "Failed to parse template", 
        details: error.message || "Unknown error occurred. Please ensure the file is a valid DOCX format." 
      });
    }
  }
);

/**
 * POST /api/documents/generate
 * Generate a document from template with filled placeholders
 */
router.post(
  "/generate",
  authenticate,
  authorize("HR_TEAM", "ADMIN"),
  upload.single("template"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Template file is required" });
      }

      const body = JSON.parse(req.body.data || "{}");
      let { placeholders, recipientId, title, documentType, description, templatePath } = body;

      if (!placeholders || typeof placeholders !== "object") {
        return res.status(400).json({ error: "Placeholders data is required" });
      }

      // Auto-generate Ref.Code if placeholder exists (case-insensitive)
      const refCodeKeys = Object.keys(placeholders).filter(
        // Normalize: remove all non-alphanumeric characters so "Ref.Code *", "ref-code", "Ref Code" all match
        key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'refcode'
      );
      if (refCodeKeys.length > 0) {
        // Generate unique reference code: DOC-YYYYMMDD-HHMMSS-XXXX
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const refCode = `DOC-${dateStr}-${timeStr}-${randomStr}`;
        
        // Auto-fill all Ref.Code variations
        refCodeKeys.forEach(key => {
          placeholders[key] = refCode;
        });
        console.log(`Auto-generated Ref.Code: ${refCode}`);
      }

      // Use provided template path or current file
      const templateFilePath = templatePath 
        ? path.join(process.cwd(), templatePath)
        : path.join(process.cwd(), req.file.path);
      
      const fileBuffer = fs.readFileSync(templateFilePath);

      // Read DOCX and replace placeholders
      let result;
      let text = "";
      
      try {
        if (templateFilePath.endsWith(".docx")) {
          result = await mammoth.extractRawText({ path: templateFilePath });
          text = result.value;
        } else {
          // For .doc or other formats, read as text
          text = fileBuffer.toString("utf-8");
        }
      } catch (mammothError: any) {
        console.error("Mammoth error:", mammothError);
        try {
          // Fallback: try with buffer
          result = await mammoth.extractRawText({ buffer: fileBuffer });
          text = result.value;
        } catch (bufferError: any) {
          // Last resort: read as text
          text = fileBuffer.toString("utf-8");
          if (!text || text.length < 10) {
            throw new Error("Unable to parse document. Please ensure it's a valid DOCX file.");
          }
        }
      }

      // ============================================
      // STEP 1: Generate barcode image for Ref.Code
      // ============================================
      let barcodeImageBuffer: Buffer | null = null;
      
      if (refCodeKeys.length > 0 && placeholders[refCodeKeys[0]]) {
        const refCodeValue = placeholders[refCodeKeys[0]];
        console.log(`\n🔵 [LOCAL DOCX] Generating barcode for Ref.Code: "${refCodeValue}"`);
        barcodeImageBuffer = await generateBarcodeImage(refCodeValue);
        
        if (barcodeImageBuffer) {
          console.log(`✅ [LOCAL DOCX] Barcode generated successfully (${barcodeImageBuffer.length} bytes)`);
        } else {
          console.error(`❌ [LOCAL DOCX] Barcode generation FAILED for "${refCodeValue}"`);
        }
      } else {
        console.log("ℹ️ [LOCAL DOCX] No Ref.Code found, skipping barcode generation");
      }

      // Replace all placeholders
      Object.keys(placeholders).forEach((key) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        text = text.replace(regex, placeholders[key] || "");
      });

      // Create new DOCX document with replaced text
      // Split text into paragraphs and preserve formatting
      const lines = text.split("\n");
      const paragraphs: Paragraph[] = [];
      let refCodeAdded = false; // Track if we've added Ref.Code paragraph
      
      lines.forEach((line, index) => {
        if (line.trim() === "") {
          paragraphs.push(new Paragraph({
            children: [new TextRun("")],
            spacing: { after: 200 },
          }));
          return;
        }
        
        // Check if line contains Ref.Code value
        const hasRefCode = refCodeKeys.length > 0 && placeholders[refCodeKeys[0]] && line.includes(placeholders[refCodeKeys[0]]);
        
        if (hasRefCode) {
          const refCodeValue = placeholders[refCodeKeys[0]];
          const parts = line.split(refCodeValue);
          
          const paragraphChildren: (TextRun | ImageRun)[] = [];
          
          // Add text before Ref.Code
          if (parts[0]) {
            paragraphChildren.push(new TextRun(parts[0]));
          }
          
          // Add Ref.Code value (bold)
          paragraphChildren.push(new TextRun({
            text: refCodeValue,
            bold: true,
          }));
          
          // Add text after Ref.Code
          if (parts[1]) {
            paragraphChildren.push(new TextRun(parts[1]));
          }
          
          paragraphs.push(new Paragraph({
            children: paragraphChildren,
            spacing: { after: 120 },
          }));
          
          // Always add barcode image after Ref.Code paragraph (if we have barcode)
          if (barcodeImageBuffer && !refCodeAdded) {
            console.log("🔵 [LOCAL DOCX] Embedding barcode image in DOCX after Ref.Code...");
            paragraphs.push(new Paragraph({
              children: [
                new ImageRun({
                  data: barcodeImageBuffer,
                  transformation: {
                    width: 300,
                    height: 75,
                  },
                }),
              ],
              alignment: "center",
              spacing: { after: 240 },
            }));
            refCodeAdded = true; // Mark that we've added barcode
            console.log("✅ [LOCAL DOCX] Barcode image embedded successfully");
          } else if (!barcodeImageBuffer) {
            console.warn("⚠️ [LOCAL DOCX] Barcode buffer not available, skipping image embedding");
          }
        } else {
          // Regular line
          const isHeading = line.length < 50 && !line.includes(".");
          paragraphs.push(new Paragraph({
            children: [new TextRun(line)],
            heading: isHeading && index < 3 ? HeadingLevel.HEADING_1 : undefined,
            spacing: { after: 240 },
          }));
        }
      });
      
      // If Ref.Code exists but wasn't found in any line, add it at the end with barcode
      if (refCodeKeys.length > 0 && placeholders[refCodeKeys[0]] && !refCodeAdded && barcodeImageBuffer) {
        const refCodeValue = placeholders[refCodeKeys[0]];
        console.log(`🔵 [LOCAL DOCX] Ref.Code not found in text, adding at end with barcode: "${refCodeValue}"`);
        
        // Add Ref.Code paragraph
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({
              text: `Ref.Code: ${refCodeValue}`,
              bold: true,
            }),
          ],
          spacing: { after: 120 },
        }));
        
        // Add barcode image
        console.log("🔵 [LOCAL DOCX] Embedding barcode image at end of document...");
        paragraphs.push(new Paragraph({
          children: [
            new ImageRun({
              data: barcodeImageBuffer,
              transformation: {
                width: 300,
                height: 75,
              },
            }),
          ],
          alignment: "center",
          spacing: { after: 240 },
        }));
        console.log("✅ [LOCAL DOCX] Barcode image embedded at end successfully");
      } else if (refCodeKeys.length > 0 && placeholders[refCodeKeys[0]] && !refCodeAdded && !barcodeImageBuffer) {
        console.warn("⚠️ [LOCAL DOCX] Ref.Code found but barcode buffer not available, adding text only");
        const refCodeValue = placeholders[refCodeKeys[0]];
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({
              text: `Ref.Code: ${refCodeValue}`,
              bold: true,
            }),
          ],
          spacing: { after: 120 },
        }));
      }

      const doc = new DocxDocument({
        sections: [
          {
            properties: {},
            children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun("Generated Document")] })],
          },
        ],
      });

      // Generate PDF buffer
      const outputDir = path.join(process.cwd(), "uploads", "documents", "generated");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputFileName = `generated-${Date.now()}.docx`;
      const outputPath = path.join(outputDir, outputFileName);
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(outputPath, buffer);

      // Save generated document to database
      const document = await prisma.document.create({
        data: {
          documentType: documentType || "other",
          title: title || "Generated Document",
          description: description || "Auto-generated from template",
          fileName: outputFileName,
          fileUrl: `/uploads/documents/generated/${outputFileName}`,
          fileSize: fs.statSync(outputPath).size,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          recipientId: recipientId || null,
          createdById: req.user.userId,
          status: "draft",
        },
        include: {
          recipient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Clean up template file if it was temporary
      if (!templatePath && fs.existsSync(templateFilePath)) {
        fs.unlinkSync(templateFilePath);
      }

      res.status(201).json({
        document,
        message: "Document generated successfully",
      });
    } catch (error: any) {
      console.error("Generate document error:", error);
      res.status(500).json({ error: "Failed to generate document", details: error.message });
    }
  }
);

export default router;

