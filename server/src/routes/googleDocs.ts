import { Router } from "express";
import { authenticate, authorize, AuthenticatedRequest } from "../middleware/roleAuth";
import { google } from "googleapis";
import { Readable } from "stream";
import { prisma } from "../lib/prisma";
import JsBarcode from "jsbarcode";
// Optional canvas import - server can run without it
let createCanvas: any = null;
try {
  const canvas = require("canvas");
  createCanvas = canvas.createCanvas;
} catch (error) {
  console.warn("Canvas module not available - some features will be disabled");
}
import path from "path";
import fs from "fs";
import https from "https";
import { PDFDocument, StandardFonts } from "pdf-lib";

const router = Router();

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

// Google OAuth2 configuration
const getOAuth2Client = () => {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/google-docs/oauth/callback";

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
  }

  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
};

// Helper functions to encrypt/decrypt tokens (simple base64 for now, use proper encryption in production)
const encryptToken = (token: string): string => {
  return Buffer.from(token).toString('base64');
};

const decryptToken = (encrypted: string): string => {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
};

// Helper function to get and refresh tokens from database
const getTokensFromDB = async (userId: string) => {
  const tokenRecord = await prisma.googleToken.findUnique({
    where: { userId },
  });

  if (!tokenRecord) {
    return null;
  }

  // Decrypt tokens
  const tokens = {
    access_token: decryptToken(tokenRecord.accessToken),
    refresh_token: tokenRecord.refreshToken ? decryptToken(tokenRecord.refreshToken) : undefined,
    token_type: tokenRecord.tokenType || 'Bearer',
    expiry_date: tokenRecord.expiryDate ? tokenRecord.expiryDate.getTime() : undefined,
    scope: tokenRecord.scope || '',
  };

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);

  // Check if token needs refresh
  let finalTokens = tokens;
  if (tokenRecord.expiryDate && new Date(tokenRecord.expiryDate) < new Date()) {
    try {
      // Refresh token if expired
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update tokens with refreshed credentials
      finalTokens = {
        access_token: credentials.access_token || tokens.access_token,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        token_type: credentials.token_type || tokens.token_type,
        expiry_date: credentials.expiry_date || tokens.expiry_date,
        scope: credentials.scope || tokens.scope,
      };
      
      // Update in database
      const newExpiryDate = credentials.expiry_date 
        ? new Date(credentials.expiry_date) 
        : credentials.expires_in 
          ? new Date(Date.now() + credentials.expires_in * 1000)
          : null;

      await prisma.googleToken.update({
        where: { userId },
        data: {
          accessToken: encryptToken(finalTokens.access_token || ''),
          refreshToken: finalTokens.refresh_token ? encryptToken(finalTokens.refresh_token) : tokenRecord.refreshToken,
          expiryDate: newExpiryDate,
          updatedAt: new Date(),
        },
      });

      oauth2Client.setCredentials(finalTokens);
    } catch (refreshError: any) {
      console.error("Token refresh error:", refreshError);
      console.error("Refresh error details:", {
        message: refreshError.message,
        code: refreshError.code,
        response: refreshError.response?.data,
      });
      // If refresh fails, delete token
      await prisma.googleToken.deleteMany({ where: { userId } });
      throw new Error("Token expired or invalid. Please reconnect to Google.");
    }
  }

  return { tokens: finalTokens, oauth2Client };
};

/**
 * GET /api/google-docs/auth-url
 * Get Google OAuth authorization URL
 */
router.get(
  "/auth-url",
  authenticate,
  authorize("HR_TEAM", "ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const oauth2Client = getOAuth2Client();
      const SCOPES = [
        "https://www.googleapis.com/auth/documents.readonly",
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive.file",
      ];

      // Get user ID from request
      const userId = req.user?.userId || req.user?.id;
      
      if (!userId) {
        console.error("No user ID found in request:", req.user);
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      console.log("Generating OAuth URL for user ID:", userId);
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "select_account consent", // Force account selection and consent
        state: userId,
        include_granted_scopes: true,
      });
      
      console.log("OAuth URL generated with state:", userId);

      console.log("Generated OAuth URL with scopes:", SCOPES);
      res.json({ authUrl });
    } catch (error: any) {
      console.error("Get auth URL error:", error);
      res.status(500).json({ error: error.message || "Failed to generate auth URL" });
    }
  }
);

/**
 * GET /api/google-docs/oauth/callback
 * Handle OAuth callback and store tokens
 */
router.get("/oauth/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    console.log("OAuth callback received:", { 
      hasCode: !!code, 
      state: state, 
      hasError: !!error,
      query: req.query 
    });

    // Check for OAuth errors
    if (error) {
      console.error("OAuth error:", error);
      const errorDescription = req.query.error_description || "Unknown OAuth error";
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/dashboard/documents?google_auth=error&message=${encodeURIComponent(
          `OAuth Error: ${error}. ${errorDescription}. Please ensure you are added as a test user in Google Cloud Console.`
        )}`
      );
    }

    if (!code) {
      console.error("No authorization code provided");
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/dashboard/documents?google_auth=error&message=${encodeURIComponent(
          "Authorization code not provided"
        )}`
      );
    }

    const oauth2Client = getOAuth2Client();
    console.log("Exchanging authorization code for tokens...");
    const { tokens } = await oauth2Client.getToken(code as string);
    console.log("Tokens received successfully");

    // Store tokens in database
    let userId = state as string;
    
    console.log("State parameter:", state);
    console.log("Extracted userId:", userId);
    
    // If state is not provided or invalid
    if (!userId || userId === "default" || userId.trim() === "") {
      console.error("Invalid or missing state parameter:", state);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/dashboard/documents?google_auth=error&message=${encodeURIComponent(
          "Invalid session. Please login and try connecting again."
        )}`
      );
    }
    
    // Verify user exists in database
    console.log("Checking user existence for ID:", userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error("User not found for userId:", userId);
      console.error("State parameter was:", state);
      console.error("Available users (first 5):", await prisma.user.findMany({ 
        take: 5, 
        select: { id: true, email: true } 
      }));
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/dashboard/documents?google_auth=error&message=${encodeURIComponent(
          "User not found. Please login again and try connecting."
        )}`
      );
    }
    
    console.log("✓ User found:", user.email, "ID:", userId);
    
    // Calculate expiry date (if expires_in is provided)
    const expiryDate = tokens.expiry_date 
      ? new Date(tokens.expiry_date) 
      : tokens.expires_in 
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

    // Upsert token in database
    await prisma.googleToken.upsert({
      where: { userId },
      update: {
        accessToken: encryptToken(tokens.access_token || ''),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        tokenType: tokens.token_type || 'Bearer',
        expiryDate,
        scope: Array.isArray(tokens.scope) ? tokens.scope.join(' ') : tokens.scope || '',
        updatedAt: new Date(),
      },
      create: {
        userId,
        accessToken: encryptToken(tokens.access_token || ''),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        tokenType: tokens.token_type || 'Bearer',
        expiryDate,
        scope: Array.isArray(tokens.scope) ? tokens.scope.join(' ') : tokens.scope || '',
      },
    });

    oauth2Client.setCredentials(tokens);

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/dashboard/documents?google_auth=success`);
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/dashboard/documents?google_auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /api/google-docs/status
 * Check if user is connected to Google
 */
router.get(
  "/status",
  authenticate,
  authorize("HR_TEAM", "ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.userId || "default";
      
      // Get token from database
      const tokenRecord = await prisma.googleToken.findUnique({
        where: { userId },
      });

      if (!tokenRecord) {
        return res.json({ connected: false });
      }

      // Verify token is still valid
      try {
        const tokenData = await getTokensFromDB(userId);
        if (!tokenData) {
          return res.json({ connected: false, expired: true });
        }
        
        const { oauth2Client } = tokenData;
        const drive = google.drive({ version: "v3", auth: oauth2Client });
        await drive.files.list({ pageSize: 1 });
        res.json({ connected: true });
      } catch (error) {
        // Token expired or invalid
        await prisma.googleToken.deleteMany({ where: { userId } });
        res.json({ connected: false, expired: true });
      }
    } catch (error: any) {
      console.error("Check status error:", error);
      res.status(500).json({ error: error.message || "Failed to check status" });
    }
  }
);

/**
 * POST /api/google-docs/disconnect
 * Disconnect Google account
 */
router.post(
  "/disconnect",
  authenticate,
  authorize("HR_TEAM", "ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.userId || "default";
      
      // Delete token from database
      await prisma.googleToken.deleteMany({
        where: { userId },
      });
      
      res.json({ message: "Disconnected successfully" });
    } catch (error: any) {
      console.error("Disconnect error:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect" });
    }
  }
);

/**
 * GET /api/google-docs/documents
 * List Google Docs documents
 */
router.get(
  "/documents",
  authenticate,
  authorize("HR_TEAM", "ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    console.log("=== GET /api/google-docs/documents called ===");
    console.log("User ID:", req.user?.id);
    
    try {
      const userId = req.user?.userId || "default";
      
      const tokenData = await getTokensFromDB(userId);
      if (!tokenData) {
        console.log("❌ No tokens found for user:", userId);
        return res.status(401).json({ error: "Not connected to Google. Please connect first." });
      }
      
      console.log("✓ Tokens found, setting up OAuth client...");
      const { oauth2Client, tokens: tokenDataTokens } = tokenData;

      const drive = google.drive({ version: "v3", auth: oauth2Client });
      console.log("✓ Drive client initialized");
      
      // Try to list Google Docs - include both owned and shared files
      try {
        console.log("Fetching Google Docs for user:", userId);
        console.log("OAuth tokens available:", !!tokenDataTokens);
        
        // First, try to get all files to see what we have access to
        console.log("Step 1: Checking all files access...");
        const allFilesResponse = await drive.files.list({
          q: "trashed=false",
          fields: "files(id, name, mimeType, modifiedTime)",
          pageSize: 20,
        });
        
        const allFiles = allFilesResponse.data.files || [];
        console.log("Total files found:", allFiles.length);
        console.log("File types:", allFiles.map(f => ({
          name: f.name,
          mimeType: f.mimeType,
          isGoogleDoc: f.mimeType === "application/vnd.google-apps.document"
        })));
        
        // Filter Google Docs from all files
        const googleDocs = allFiles.filter(f => f.mimeType === "application/vnd.google-apps.document");
        console.log("Google Docs found in all files:", googleDocs.length);

        // Now get Google Docs specifically with query
        console.log("Step 2: Querying Google Docs specifically...");
        let response;
        try {
          response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.document' and trashed=false",
            fields: "files(id, name, modifiedTime, createdTime, webViewLink, owners, mimeType)",
            orderBy: "modifiedTime desc",
            pageSize: 100,
          });
          
          console.log("Query result - Google Docs count:", response.data.files?.length || 0);
          
          // If query returns empty but we found docs in all files, use those
          if ((!response.data.files || response.data.files.length === 0) && googleDocs.length > 0) {
            console.log("Query returned empty, using filtered results from all files");
            response.data.files = googleDocs.map(f => ({
              id: f.id,
              name: f.name,
              modifiedTime: f.modifiedTime,
              createdTime: f.modifiedTime, // Fallback
              mimeType: f.mimeType
            }));
          }
        } catch (queryError: any) {
          console.error("Query error:", queryError.message);
          // If query fails but we have docs from all files, use those
          if (googleDocs.length > 0) {
            console.log("Using filtered results from all files due to query error");
            response = {
              data: {
                files: googleDocs.map(f => ({
                  id: f.id,
                  name: f.name,
                  modifiedTime: f.modifiedTime,
                  createdTime: f.modifiedTime,
                  mimeType: f.mimeType
                }))
              }
            };
          } else {
            throw queryError;
          }
        }

        let documents = response.data.files || [];
        console.log("Final Google Docs count (before filtering):", documents.length);
        
        // Filter out generated documents (those already saved in our database)
        // Get all Google Doc IDs from tags field (format: google-doc-id:XXXXX)
        const savedGoogleDocs = await prisma.document.findMany({
          where: {
            createdById: userId,
            OR: [
              { tags: { contains: "google-doc-id:" } },
              { mimeType: "application/vnd.google-apps.document" },
            ],
          },
          select: {
            tags: true,
            fileUrl: true,
          },
        });
        
        // Extract Google Doc IDs from tags or fileUrl
        const generatedDocIds = new Set<string>();
        savedGoogleDocs.forEach(doc => {
          // Check tags first (new format)
          if (doc.tags) {
            const match = doc.tags.match(/google-doc-id:([a-zA-Z0-9_-]+)/);
            if (match) {
              generatedDocIds.add(match[1]);
            }
          }
          // Fallback: check fileUrl (old format)
          if (doc.fileUrl) {
            const match = doc.fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)\//);
            if (match) {
              generatedDocIds.add(match[1]);
            }
          }
        });
        
        console.log("Generated document IDs to exclude:", Array.from(generatedDocIds));
        
        // Filter out generated documents - only show original templates
        documents = documents.filter(doc => !generatedDocIds.has(doc.id!));
        
        console.log("Final Google Docs count (after filtering):", documents.length);
        console.log("Google Docs list:", documents.map(f => ({ 
          id: f.id, 
          name: f.name,
          modified: f.modifiedTime 
        })));

        if (documents.length === 0) {
          console.log("⚠️ No Google Docs found!");
          console.log("Possible reasons:");
          console.log("1. User has no Google Docs in Drive");
          console.log("2. OAuth scope 'drive.readonly' not granted");
          console.log("3. Files are in trash");
          console.log("4. Permission issue");
        }

        res.json({ documents });
      } catch (driveError: any) {
        console.error("Drive API error details:", {
          message: driveError.message,
          code: driveError.code,
          errors: driveError.errors,
          response: driveError.response?.data
        });
        
        // More specific error messages
        if (driveError.code === 403) {
          throw new Error("Permission denied. Please ensure Drive API access is granted.");
        } else if (driveError.code === 401) {
          throw new Error("Authentication failed. Please reconnect to Google.");
        }
        
        throw driveError;
      }
    } catch (error: any) {
      console.error("List documents error:", error);
      res.status(500).json({ error: error.message || "Failed to list documents" });
    }
  }
);

/**
 * GET /api/google-docs/document/:id
 * Get a specific Google Doc and extract placeholders
 */
router.get(
  "/document/:id",
  authenticate,
  authorize("HR_TEAM", "ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId || "default";
      
      const tokenData = await getTokensFromDB(userId);
      if (!tokenData) {
        return res.status(401).json({ error: "Not connected to Google. Please connect first." });
      }
      
      const { oauth2Client } = tokenData;

      const docs = google.docs({ version: "v1", auth: oauth2Client });
      const doc = await docs.documents.get({ documentId: id });

      // Extract text from document
      let text = "";
      if (doc.data.body?.content) {
        const extractText = (content: any[]): string => {
          let result = "";
          for (const element of content) {
            if (element.paragraph) {
              if (element.paragraph.elements) {
                for (const elem of element.paragraph.elements) {
                  if (elem.textRun?.content) {
                    result += elem.textRun.content;
                  }
                }
              }
            } else if (element.table) {
              // Handle tables if needed
              if (element.table.tableRows) {
                for (const row of element.table.tableRows) {
                  if (row.tableCells) {
                    for (const cell of row.tableCells) {
                      if (cell.content) {
                        result += extractText(cell.content);
                      }
                    }
                  }
                }
              }
            }
          }
          return result;
        };
        text = extractText(doc.data.body.content);
      }

      // Find placeholders in format {{placeholder_name}}
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const placeholders: string[] = [];
      let match;

      while ((match = placeholderRegex.exec(text)) !== null) {
        const placeholder = match[1].trim();
        if (!placeholders.includes(placeholder)) {
          placeholders.push(placeholder);
        }
      }

      res.json({
        documentId: id,
        title: doc.data.title,
        placeholders,
        text,
      });
    } catch (error: any) {
      console.error("Get document error:", error);
      res.status(500).json({ error: error.message || "Failed to get document" });
    }
  }
);

/**
 * POST /api/google-docs/generate
 * Generate a document in Google Docs from template with filled placeholders
 */
router.post(
  "/generate",
  authenticate,
  authorize("HR_TEAM", "ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      console.log("\n" + "=".repeat(80));
      console.log("🚀 [GOOGLE DOCS GENERATE] NEW REQUEST RECEIVED");
      console.log("=".repeat(80));
      
      let { 
        documentId, 
        placeholderValues, 
        newDocumentName,
        documentType,
        description,
        recipientId,
      } = req.body;

      console.log("📥 [REQUEST] Full request body:", JSON.stringify(req.body, null, 2));
      console.log("📥 [REQUEST] Document Type received:", documentType);
      console.log("📥 [REQUEST] Placeholder values keys:", Object.keys(placeholderValues || {}));

      if (!documentId || !placeholderValues) {
        return res.status(400).json({ error: "Document ID and placeholder values are required" });
      }

      // Auto-generate Ref.Code if placeholder exists (case-insensitive)
      console.log("\n🔵 [REFCODE DETECTION] Checking for Ref.Code placeholder...");
      console.log("🔵 [REFCODE DETECTION] All placeholder keys:", Object.keys(placeholderValues));
      
      const refCodeKeys = Object.keys(placeholderValues).filter(
        // Normalize: remove all non-alphanumeric characters so "Ref.Code *", "ref-code", "Ref Code" all match
        key => {
          const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          const isMatch = normalized === 'refcode';
          if (isMatch) {
            console.log(`✅ [REFCODE DETECTION] Found Ref.Code key: "${key}" (normalized: "${normalized}")`);
          }
          return isMatch;
        }
      );
      
      console.log(`🔵 [REFCODE DETECTION] Total Ref.Code keys found: ${refCodeKeys.length}`);
      
      if (refCodeKeys.length > 0) {
        // Generate unique reference code: DOC-YYYYMMDD-HHMMSS-XXXX
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const refCode = `DOC-${dateStr}-${timeStr}-${randomStr}`;
        
        // Auto-fill all Ref.Code variations
        refCodeKeys.forEach(key => {
          placeholderValues[key] = refCode;
        });
        console.log(`✅ [REFCODE DETECTION] Auto-generated Ref.Code: ${refCode}`);
      } else {
        console.warn("⚠️ [REFCODE DETECTION] No Ref.Code placeholder found in placeholders!");
      }

      const userId = req.user?.userId || "default";
      
      const tokenData = await getTokensFromDB(userId);
      if (!tokenData) {
        return res.status(401).json({ error: "Not connected to Google. Please connect first." });
      }
      
      const { oauth2Client } = tokenData;

      const docs = google.docs({ version: "v1", auth: oauth2Client });
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      // ============================================
      // STEP 1: Generate barcode image (ALWAYS, even without Ref.Code placeholder)
      // ============================================
      console.log("\n🔵 [BARCODE STEP] Starting barcode generation check...");
      
      // Check if includeBarcode flag is sent from frontend (default: true)
      const includeBarcode = req.body.includeBarcode !== false; // Default to true if not specified
      console.log(`🔵 [BARCODE STEP] includeBarcode flag: ${includeBarcode}`);
      
      let barcodeImageBuffer: Buffer | null = null;
      let barcodeValue: string | null = null;
      
      if (includeBarcode) {
        // Determine barcode value: use Ref.Code if available, otherwise generate unique code
        if (refCodeKeys.length > 0 && placeholderValues[refCodeKeys[0]]) {
          barcodeValue = placeholderValues[refCodeKeys[0]];
          console.log(`🔵 [BARCODE STEP] Using Ref.Code value for barcode: "${barcodeValue}"`);
        } else {
          // Generate unique barcode value even if no Ref.Code placeholder
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
          const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
          barcodeValue = `DOC-${dateStr}-${timeStr}-${randomStr}`;
          console.log(`🔵 [BARCODE STEP] No Ref.Code found, generating unique barcode value: "${barcodeValue}"`);
        }
        
        console.log(`\n🔵 [GOOGLE DOCS] Generating barcode for: "${barcodeValue}"`);
        barcodeImageBuffer = await generateBarcodeImage(barcodeValue);
        
        if (barcodeImageBuffer) {
          console.log(`✅ [GOOGLE DOCS] Barcode generated successfully (${barcodeImageBuffer.length} bytes)`);
        } else {
          console.error(`❌ [GOOGLE DOCS] Barcode generation FAILED for "${barcodeValue}"`);
        }
      } else {
        console.log("ℹ️ [GOOGLE DOCS] Barcode generation skipped (includeBarcode = false)");
      }

      // Get the template document
      const templateDoc = await docs.documents.get({ documentId });

      // Create a copy of the template
      const copyResponse = await drive.files.copy({
        fileId: documentId,
        requestBody: {
          name: newDocumentName || `Generated Document - ${new Date().toISOString()}`,
        },
      });

      const newDocId = copyResponse.data.id;
      if (!newDocId) {
        throw new Error("Failed to create document copy");
      }

      // Get the new document
      const newDoc = await docs.documents.get({ documentId: newDocId });

      // ============================================
      // STEP 2: Replace all placeholders in Google Doc
      // ============================================
      // NOTE: We skip barcode image insertion in Google Docs (unreliable).
      // Instead, we'll overlay the barcode directly on the PDF (more reliable).
      console.log("\n🔵 [GOOGLE DOCS] Replacing placeholders in document...");
      
      const textRequests: any[] = [];

      // Extract all text and find placeholders
      const extractPlaceholders = (content: any[]): Array<{ placeholder: string }> => {
        const placeholders: Array<{ placeholder: string }> = [];
        const seen = new Set<string>();

        for (const element of content) {
          if (element.paragraph) {
            if (element.paragraph.elements) {
              for (const elem of element.paragraph.elements) {
                if (elem.textRun?.content) {
                  const text = elem.textRun.content;
                  const placeholderRegex = /\{\{([^}]+)\}\}/g;
                  let match;

                  while ((match = placeholderRegex.exec(text)) !== null) {
                    const placeholder = match[1].trim();
                    if (!seen.has(placeholder)) {
                      placeholders.push({ placeholder });
                      seen.add(placeholder);
                    }
                  }
                }
              }
            }
          }
        }
        return placeholders;
      };

      if (newDoc.data.body?.content) {
        const placeholders = extractPlaceholders(newDoc.data.body.content);
        console.log(`🔵 [GOOGLE DOCS] Found ${placeholders.length} unique placeholders`);

        // Create replacement requests
        for (const { placeholder } of placeholders) {
          const replacementValue = placeholderValues[placeholder] || "";
          console.log(`  → Replacing {{${placeholder}}} with: "${replacementValue.substring(0, 50)}${replacementValue.length > 50 ? '...' : ''}"`);

          textRequests.push({
            replaceAllText: {
              containsText: {
                text: `{{${placeholder}}}`,
                matchCase: false,
              },
              replaceText: replacementValue,
            },
          });
        }
      }

      // Execute text replacements
      if (textRequests.length > 0) {
        console.log(`🔵 [GOOGLE DOCS] Executing ${textRequests.length} text replacement(s)...`);
        await docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: {
            requests: textRequests,
          },
        });
        console.log("✅ [GOOGLE DOCS] Text replacements completed");
      }

      // Note: We create a Google Doc temporarily to fill placeholders, then export as PDF
      // The Google Doc will remain in Drive but we save the PDF locally
      const documentUrl = `https://docs.google.com/document/d/${newDocId}/edit`;

      // Convert Google Doc to PDF and save to our system
      try {
        // Export Google Doc as PDF
        let pdfResponse;
        try {
          pdfResponse = await drive.files.export(
            {
              fileId: newDocId,
              mimeType: "application/pdf",
            },
            {
              responseType: "arraybuffer",
            }
          );
        } catch (exportError: any) {
          console.error("❌ [PDF EXPORT] Error:", exportError.message);
          console.error("❌ [PDF EXPORT] Error code:", exportError.code);
          console.error("❌ [PDF EXPORT] Error details:", exportError.response?.data);
          
          // Handle rate limit error specifically
          if (exportError.code === 429 || exportError.message?.includes("rate limit") || exportError.message?.includes("User rate limit exceeded")) {
            console.error("❌ [PDF EXPORT] Google API Rate Limit Exceeded!");
            console.error("💡 [PDF EXPORT] Please wait 5-10 minutes before trying again.");
            console.error("💡 [PDF EXPORT] Or use Local DOCX template (doesn't use Google API).");
            throw new Error("Google API rate limit exceeded. Please wait 5-10 minutes or use Local DOCX template instead.");
          }
          
          // If export fails due to auth, try to refresh token and retry
          if (exportError.code === 401 || exportError.message?.includes("Authentication required")) {
            console.log("🔵 [PDF EXPORT] Authentication error, attempting token refresh...");
            const tokenData = await getTokensFromDB(req.user!.userId);
            if (tokenData) {
              const { oauth2Client: refreshedClient } = tokenData;
              const refreshedDrive = google.drive({ version: "v3", auth: refreshedClient });
              
              // Retry export with refreshed token
              pdfResponse = await refreshedDrive.files.export(
                {
                  fileId: newDocId,
                  mimeType: "application/pdf",
                },
                {
                  responseType: "arraybuffer",
                }
              );
            } else {
              throw new Error("Authentication failed. Please reconnect to Google.");
            }
          } else {
            throw exportError;
          }
        }

        // ============================================
        // STEP 3: Overlay barcode on PDF (MOST RELIABLE METHOD)
        // ============================================
        const originalPdfBuffer = Buffer.from(pdfResponse.data as ArrayBuffer);
        console.log(`\n🔵 [PDF OVERLAY] Original PDF size: ${originalPdfBuffer.length} bytes`);

        let finalPdfBuffer = originalPdfBuffer;
        
        if (barcodeImageBuffer) {
          console.log("🔵 [PDF OVERLAY] Starting barcode overlay on PDF...");
          try {
            // Load PDF document
            const pdfDoc = await PDFDocument.load(originalPdfBuffer);
            const pages = pdfDoc.getPages();
            console.log(`🔵 [PDF OVERLAY] PDF has ${pages.length} page(s)`);

            if (pages.length > 0) {
              // Embed barcode PNG once (reuse for all pages)
              console.log("🔵 [PDF OVERLAY] Embedding barcode PNG...");
              const pngImage = await pdfDoc.embedPng(barcodeImageBuffer);
              const scale = 0.5; // Slightly smaller for better fit
              const pngDims = pngImage.scale(scale);
              console.log(`🔵 [PDF OVERLAY] Barcode image dimensions: ${pngDims.width} x ${pngDims.height}`);

              // Get barcode value (use Ref.Code if available, otherwise use generated value)
              let barcodeValue: string | null = null;
              if (refCodeKeys.length > 0 && placeholderValues[refCodeKeys[0]]) {
                barcodeValue = placeholderValues[refCodeKeys[0]];
              } else if (includeBarcode) {
                // Generate unique barcode value if no Ref.Code
                const now = new Date();
                const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
                const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
                const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
                barcodeValue = `DOC-${dateStr}-${timeStr}-${randomStr}`;
              }
              
              let font: any = null;
              if (barcodeValue) {
                font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                console.log(`🔵 [PDF OVERLAY] Barcode value: "${barcodeValue}"`);
              }

              // Process each page
              for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const pageWidth = page.getWidth();
                const pageHeight = page.getHeight();
                const isFirstPage = i === 0;
                const isLastPage = i === pages.length - 1;

                console.log(`🔵 [PDF OVERLAY] Processing page ${i + 1}/${pages.length} (${isFirstPage ? 'FIRST' : isLastPage ? 'LAST' : 'MIDDLE'})`);

                if (isFirstPage) {
                  // FIRST PAGE: Add barcode at TOP center
                  console.log(`🔵 [PDF OVERLAY] Adding barcode at TOP of first page...`);
                  
                  const marginTop = 50; // Top margin (50 points from top)
                  const xPosition = (pageWidth - pngDims.width) / 2;
                  // In PDF coordinates, (0,0) is bottom-left, so top = pageHeight - margin - height
                  const yPosition = pageHeight - marginTop - pngDims.height;

                  // Draw barcode image at top center
                  page.drawImage(pngImage, {
                    x: xPosition,
                    y: yPosition,
                    width: pngDims.width,
                    height: pngDims.height,
                  });

                  // Draw barcode value text below the barcode (if available)
                  if (barcodeValue && font) {
                    const fontSize = 12;
                    const textWidth = font.widthOfTextAtSize(barcodeValue, fontSize);
                    const textXPosition = (pageWidth - textWidth) / 2;
                    // Below barcode = yPosition - textHeight (but we need to account for text baseline)
                    const textYPosition = yPosition - 15; // Below barcode with spacing

                    page.drawText(barcodeValue, {
                      x: textXPosition,
                      y: textYPosition,
                      size: fontSize,
                      font,
                    });
                    console.log(`🔵 [PDF OVERLAY] Barcode value text drawn at top: x=${textXPosition.toFixed(2)}, y=${textYPosition.toFixed(2)}`);
                  }

                  console.log(`✅ [PDF OVERLAY] Barcode added to TOP of first page`);
                } else {
                  // ALL OTHER PAGES: Add barcode at BOTTOM center
                  console.log(`🔵 [PDF OVERLAY] Adding barcode at BOTTOM of page ${i + 1}...`);
                  
                  const marginBottom = 30;
                  const xPosition = (pageWidth - pngDims.width) / 2;
                  const yPosition = marginBottom;

                  // Draw barcode image at bottom center
                  page.drawImage(pngImage, {
                    x: xPosition,
                    y: yPosition,
                    width: pngDims.width,
                    height: pngDims.height,
                  });

                  // Draw barcode value text above the barcode (if available)
                  if (barcodeValue && font) {
                    const fontSize = 12;
                    const textWidth = font.widthOfTextAtSize(barcodeValue, fontSize);
                    const textXPosition = (pageWidth - textWidth) / 2;
                    const textYPosition = yPosition + pngDims.height + 5; // Above barcode

                    page.drawText(barcodeValue, {
                      x: textXPosition,
                      y: textYPosition,
                      size: fontSize,
                      font,
                    });
                    console.log(`🔵 [PDF OVERLAY] Barcode value text drawn at bottom: x=${textXPosition.toFixed(2)}, y=${textYPosition.toFixed(2)}`);
                  }

                  console.log(`✅ [PDF OVERLAY] Barcode added to BOTTOM of page ${i + 1}`);
                }
              }

              // Save updated PDF
              console.log("🔵 [PDF OVERLAY] Saving updated PDF...");
              const updatedBytes = await pdfDoc.save();
              finalPdfBuffer = Buffer.from(updatedBytes);
              console.log(`✅ [PDF OVERLAY] SUCCESS! Updated PDF size: ${finalPdfBuffer.length} bytes`);
            } else {
              console.warn("⚠️ [PDF OVERLAY] PDF has no pages, skipping overlay");
            }
          } catch (overlayError: any) {
            console.error("❌ [PDF OVERLAY] FAILED to overlay barcode:", overlayError.message);
            console.error("❌ [PDF OVERLAY] Error stack:", overlayError.stack);
            console.warn("⚠️ [PDF OVERLAY] Continuing with original PDF (without barcode)");
            // Continue with original PDF if overlay fails
            finalPdfBuffer = originalPdfBuffer;
          }
        } else {
          console.warn("⚠️ [PDF OVERLAY] No barcode image buffer available, skipping overlay");
        }

        // Save (possibly updated) PDF to uploads folder
        const outputDir = path.join(process.cwd(), "uploads", "documents", "generated");
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const pdfFileName = `generated-${Date.now()}.pdf`;
        const pdfPath = path.join(outputDir, pdfFileName);
        fs.writeFileSync(pdfPath, finalPdfBuffer);

        // Save PDF document to database (not the Google Doc)
        // Store Google Doc ID in tags for filtering (not in description)
        console.log("=== SAVING DOCUMENT TO DATABASE ===");
        console.log("Document Type before processing:", documentType);
        console.log("Document Type is empty string?", documentType === "");
        console.log("Document Type is null/undefined?", !documentType);
        
        // Use the documentType if provided and not empty, otherwise default to "offer_letter"
        // Frontend should always send documentType, but if it's missing, use "offer_letter" instead of "other"
        const finalDocumentType = (documentType && documentType.trim() !== "" && documentType !== "other") 
          ? documentType 
          : (documentType || "offer_letter");
        console.log("Final document type to save:", finalDocumentType);
        
        const savedDocument = await prisma.document.create({
          data: {
            documentType: finalDocumentType,
            title: newDocumentName || templateDoc.data.title || "Generated Document",
            description: description || "Generated from Google Docs template",
            fileName: pdfFileName,
            fileUrl: `/uploads/documents/generated/${pdfFileName}`,
            fileSize: fs.statSync(pdfPath).size,
            mimeType: "application/pdf",
            recipientId: recipientId || null,
            createdById: req.user!.userId,
            status: "draft",
            tags: `google-doc-id:${newDocId}`, // Store Google Doc ID in tags for filtering (hidden from user)
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

        console.log("\n" + "=".repeat(80));
        console.log("✅ [GOOGLE DOCS GENERATE] REQUEST COMPLETED SUCCESSFULLY");
        console.log("=".repeat(80));
        console.log(`📄 PDF saved: ${pdfFileName}`);
        console.log(`📊 PDF size: ${(finalPdfBuffer.length / 1024).toFixed(2)} KB`);
        console.log(`🔵 Barcode was ${barcodeImageBuffer ? 'GENERATED' : 'NOT GENERATED'}`);
        if (barcodeImageBuffer) {
          console.log(`🔵 Barcode size: ${(barcodeImageBuffer.length / 1024).toFixed(2)} KB`);
        }
        console.log("=".repeat(80) + "\n");

        res.json({
          documentId: newDocId,
          documentUrl,
          pdfUrl: `/uploads/documents/generated/${pdfFileName}`,
          message: "Document generated successfully as PDF",
          savedDocument,
        });
      } catch (saveError: any) {
        console.error("Failed to convert/save generated document:", saveError);
        // Even if PDF conversion fails, return success for Google Docs generation
        res.json({
          documentId: newDocId,
          documentUrl,
          message: "Document generated successfully (PDF conversion failed)",
        });
      }
    } catch (error: any) {
      console.error("\n" + "=".repeat(80));
      console.error("❌ [GOOGLE DOCS GENERATE] REQUEST FAILED");
      console.error("=".repeat(80));
      console.error("❌ Error message:", error.message);
      console.error("❌ Error code:", error.code);
      console.error("=".repeat(80) + "\n");
      
      // Provide helpful error messages
      let errorMessage = error.message || "Failed to generate document";
      let statusCode = 500;
      
      if (error.message?.includes("rate limit")) {
        statusCode = 429;
        errorMessage = "Google API rate limit exceeded. Please wait 5-10 minutes before trying again, or use Local DOCX template instead.";
      }
      
      res.status(statusCode).json({ 
        error: errorMessage,
        hint: error.message?.includes("rate limit") 
          ? "Tip: Use 'Upload Template' tab to upload a local DOCX file - it doesn't use Google API and won't hit rate limits."
          : undefined
      });
    }
  }
);

export default router;

