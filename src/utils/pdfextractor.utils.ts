import axios, { AxiosError } from "axios";

/**
 * PDF Parse Types
 */
interface PDFData {
  numpages: number;
  numrender: number;
  info: any;
  metadata: any;
  text: string;
  version: string;
}

type PDFParseFunction = (dataBuffer: Buffer, options?: any) => Promise<PDFData>;

/**
 * Resume Section Structure
 */
export interface ResumeSections {
  education?: string;
  experience?: string;
  skills?: string;
  summary?: string;
}

/**
 * PDF Extraction Result
 */
export interface PDFExtractionResult {
  text: string;
  metadata: {
    pages: number;
    byteSize: number;
    extractedAt: Date;
  };
}

/**
 * Constants
 */
const PDF_CONSTANTS = {
  DOWNLOAD_TIMEOUT: 30000,
  MIN_TEXT_LENGTH: 50,
  MIN_VALIDATION_LENGTH: 100,
  MIN_WORD_COUNT: 20,
  MAX_SECTION_LENGTH: {
    EDUCATION: 500,
    EXPERIENCE: 800,
    SKILLS: 300,
    SUMMARY: 400,
  },
} as const;

/**
 * Error Classes
 */
export class PDFExtractionError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "PDFExtractionError";
  }
}

export class PDFDownloadError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "PDFDownloadError";
  }
}

/**
 * Lazy load pdf-parse module
 */
class PDFParseLoader {
  private static instance: PDFParseFunction | null = null;
  private static loadAttempted = false;

  static get(): PDFParseFunction {
    if (this.loadAttempted && !this.instance) {
      throw new Error("pdf-parse module is not available");
    }

    if (!this.instance) {
      this.loadAttempted = true;
      this.instance = this.loadModule();
    }

    return this.instance;
  }

  private static loadModule(): PDFParseFunction {
    try {
      
      return require("pdf-parse");
    } catch (e1) {
      try {
      
        return require("pdf-parse/lib/pdf-parse.js");
      } catch (e2) {
        console.error("Failed to load pdf-parse module:", e2);
        throw new Error("pdf-parse module could not be loaded");
      }
    }
  }
}

/**
 * Download PDF from URL
 */
async function downloadPDF(url: string): Promise<Buffer> {
  try {
    console.log("Downloading PDF from:", url);

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: PDF_CONSTANTS.DOWNLOAD_TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (Job Portal Resume Analyzer)",
        Accept: "application/pdf",
      },
      maxContentLength: 10 * 1024 * 1024, // 10MB max
    });

    const buffer = Buffer.from(response.data);
    console.log(`PDF downloaded: ${buffer.length} bytes`);

    return buffer;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.code === "ECONNABORTED") {
        throw new PDFDownloadError("PDF download timeout", 408);
      }
      if (axiosError.response?.status) {
        throw new PDFDownloadError(
          `Failed to download PDF: HTTP ${axiosError.response.status}`,
          axiosError.response.status
        );
      }
    }
    throw new PDFDownloadError(`Failed to download PDF: ${(error as Error).message}`);
  }
}

/**
 * Parse PDF buffer to extract text
 */
async function parsePDFBuffer(buffer: Buffer): Promise<PDFData> {
  try {
    console.log(`Parsing PDF... (${buffer.length} bytes)`);

    const pdfParse = PDFParseLoader.get();
    const data = await pdfParse(buffer);

    if (!data || !data.text) {
      throw new Error("PDF parsing returned empty text");
    }

    console.log(`PDF parsed: ${data.numpages} pages, ${data.text.length} chars`);
    return data;
  } catch (error) {
    throw new PDFExtractionError(
      `Failed to parse PDF: ${(error as Error).message}`,
      error as Error
    );
  }
}

/**
 * Extract text from PDF URL (Main function)
 */
export async function extractPDFText(pdfUrl: string): Promise<string> {
  try {
    // Validate URL
    if (!pdfUrl || !isValidPDFUrl(pdfUrl)) {
      throw new Error("Invalid PDF URL provided");
    }

    // Download PDF
    const pdfBuffer = await downloadPDF(pdfUrl);

    // Parse PDF
    const pdfData = await parsePDFBuffer(pdfBuffer);

    // Validate extracted text
    if (pdfData.text.length < PDF_CONSTANTS.MIN_TEXT_LENGTH) {
      console.warn(`Extracted text too short: ${pdfData.text.length} chars`);
      return createPlaceholderText(pdfUrl, "Text too short after extraction");
    }

    return pdfData.text;
  } catch (error) {
    console.error("PDF extraction failed:", error);

    if (
      error instanceof PDFExtractionError ||
      (error as Error).message?.includes("pdf-parse")
    ) {
      console.warn("Using URL placeholder due to parsing error");
      return createPlaceholderText(pdfUrl, "PDF parsing failed");
    }

    // Throw for critical errors (download, network, etc.)
    throw error;
  }
}

/**
 * Extract text with full metadata
 */
export async function extractPDFTextWithMetadata(
  pdfUrl: string
): Promise<PDFExtractionResult> {
  const pdfBuffer = await downloadPDF(pdfUrl);
  const pdfData = await parsePDFBuffer(pdfBuffer);

  return {
    text: pdfData.text,
    metadata: {
      pages: pdfData.numpages,
      byteSize: pdfBuffer.length,
      extractedAt: new Date(),
    },
  };
}

/**
 * Clean and normalize extracted text
 */
export function cleanResumeText(text: string): string {
  if (!text) return "";

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ") 
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/\t+/g, " ") 
    .trim();
}

/**
 * Validate resume content quality
 */
export function validateResumeContent(text: string): boolean {
  if (!text || text.length < PDF_CONSTANTS.MIN_VALIDATION_LENGTH) {
    return false;
  }

  const words = text.split(/\s+/).filter(Boolean);
  const hasMinWords = words.length >= PDF_CONSTANTS.MIN_WORD_COUNT;

  // Check for common resume indicators
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
  const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
  const hasCommonSections = /(experience|education|skills?|summary)/i.test(text);

  return hasMinWords && (hasEmail || hasPhone || hasCommonSections);
}

/**
 * Extract key sections from resume text
 */
export function extractResumeSections(text: string): ResumeSections {
  if (!text) return {};

  const sections: ResumeSections = {};

  // Section patterns (case-insensitive)
  const patterns = {
    summary: {
      regex: /(summary|objective|profile)[\s\S]{0,400}/i,
      maxLength: PDF_CONSTANTS.MAX_SECTION_LENGTH.SUMMARY,
    },
    education: {
      regex: /education[\s\S]{0,500}/i,
      maxLength: PDF_CONSTANTS.MAX_SECTION_LENGTH.EDUCATION,
    },
    experience: {
      regex: /(experience|employment|work history)[\s\S]{0,800}/i,
      maxLength: PDF_CONSTANTS.MAX_SECTION_LENGTH.EXPERIENCE,
    },
    skills: {
      regex: /(skills?|technical skills|competencies)[\s\S]{0,300}/i,
      maxLength: PDF_CONSTANTS.MAX_SECTION_LENGTH.SKILLS,
    },
  };

  // Extract each section
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern.regex);
    if (match) {
      sections[key as keyof ResumeSections] = match[0]
        .substring(0, pattern.maxLength)
        .trim();
    }
  }

  return sections;
}

/**
 * Extract contact information from resume
 */
export function extractContactInfo(text: string): {
  email?: string;
  phone?: string;
  linkedin?: string;
} {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);

  return {
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
    linkedin: linkedinMatch?.[0],
  };
}

/**
 * Calculate resume quality score (0-100)
 */
export function calculateResumeQualityScore(text: string): number {
  if (!text) return 0;

  let score = 0;

  // Length check (max 20 points)
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  score += Math.min(20, (wordCount / 200) * 20);

  // Has contact info (20 points)
  const contact = extractContactInfo(text);
  if (contact.email) score += 10;
  if (contact.phone) score += 10;

  // Has key sections (40 points)
  const sections = extractResumeSections(text);
  if (sections.experience) score += 15;
  if (sections.education) score += 15;
  if (sections.skills) score += 10;

  // Formatting quality (20 points)
  const hasProperFormatting = text.includes("\n") && !text.match(/\n{5,}/);
  if (hasProperFormatting) score += 20;

  return Math.min(100, Math.round(score));
}

/**
 * Helper: Validate PDF URL
 */
function isValidPDFUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
      (url.toLowerCase().endsWith(".pdf") || url.includes("/raw/upload/"))
    );
  } catch {
    return false;
  }
}

/**
 * Helper: Create placeholder text
 */
function createPlaceholderText(url: string, reason: string): string {
  return `Resume PDF URL: ${url}

[PDF Text Extraction Failed]
Reason: ${reason}

Note: Please review the resume file manually or re-upload a valid PDF.`;
}