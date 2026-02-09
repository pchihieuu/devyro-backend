import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIMatchingAnalysis } from "../entities/Application.entity";
import { Job } from "../entities/Job.entity";
import { config } from "../config/env.config";

interface ResumeData {
  url: string;
  text?: string;
}

/**
 * Configuration constants
 */
const GEMINI_CONFIG = {
  TIMEOUT_MS: 60000, 
  MAX_RETRIES: 2, 
  RETRY_DELAY_MS: 1000, 
  MAX_RESUME_LENGTH: 10000, 
  MAX_JOB_DESC_LENGTH: 3000,
} as const;

/**
 * Custom error classes
 */
class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiTimeoutError";
  }
}

class GeminiAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "GeminiAPIError";
  }
}

export class GeminiAIMatchingService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = config.gemini.apiKey;

    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    this.genAI = new GoogleGenerativeAI(apiKey);

    
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1, 
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192, 
        responseMimeType: "application/json",
      },
    });

    
  }

  /**
   * Analyze resume against job description with retry logic
   */
  async analyzeResumeJobMatch(
    resume: ResumeData,
    job: Job
  ): Promise<AIMatchingAnalysis> {
    console.log("\n=== GEMINI AI ANALYSIS START ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log(`Job: ${job.title}`);
    console.log(
      `Resume text length: ${resume.text?.length || 0} characters`
    );

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= GEMINI_CONFIG.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          console.log(
            `Retry attempt ${attempt}/${GEMINI_CONFIG.MAX_RETRIES}`
          );
          await this.delay(GEMINI_CONFIG.RETRY_DELAY_MS);
        }

        return await this.performAnalysis(resume, job);
      } catch (error: any) {
        lastError = error;

        // Retry only on timeout errors
        if (
          error instanceof GeminiTimeoutError &&
          attempt < GEMINI_CONFIG.MAX_RETRIES
        ) {
          console.warn(`Timeout on attempt ${attempt}, retrying...`);
          continue;
        }

        break;
      }
    }

    // All retries failed
    throw lastError || new Error("Analysis failed");
  }

  /**
   * Perform the actual analysis (separated for retry logic)
   */
  private async performAnalysis(
    resume: ResumeData,
    job: Job
  ): Promise<AIMatchingAnalysis> {
    try {
      // Extract and validate resume text
      const resumeText = await this.extractResumeText(resume);

      if (!resumeText || resumeText.length < 50) {
        console.error("Resume text too short:", resumeText?.length);
        throw new Error("Resume text is too short or empty");
      }

      console.log(`Resume text extracted: ${resumeText.length} chars`);

      // Truncate text if too long (giảm token để nhanh hơn)
      const truncatedResume = this.truncateText(
        resumeText,
        GEMINI_CONFIG.MAX_RESUME_LENGTH
      );
      const truncatedJobDesc = this.truncateText(
        job.description,
        GEMINI_CONFIG.MAX_JOB_DESC_LENGTH
      );

      if (truncatedResume.length < resumeText.length) {
        console.warn(
          `Resume truncated from ${resumeText.length} to ${truncatedResume.length} chars`
        );
      }

      // Construct the analysis prompt
      const prompt = this.buildAnalysisPrompt(truncatedResume, {
        ...job,
        description: truncatedJobDesc,
      });
      console.log(`Prompt built: ${prompt.length} chars`);

      console.log("Calling Gemini API...");
      const startTime = Date.now();

      // Call Gemini API with improved timeout handling
      const result = await this.callGeminiWithTimeout(prompt);

      const duration = Date.now() - startTime;
      console.log(`API responded in ${duration}ms`);

      const response = await result.response;
      const analysisText = response.text();
      console.log(`Response text extracted: ${analysisText.length} chars`);

      if (analysisText.length < 200) {
        throw new Error(
          `Response too short (${analysisText.length} chars) - likely truncated`
        );
      }

      // Check if response looks complete (has closing brace)
      if (!analysisText.includes("}")) {
        console.warn("Response may be truncated - no closing brace found");
      }

      console.log(`Response preview: ${analysisText.substring(0, 100)}...`);
      console.log(
        `Response end: ...${analysisText.substring(Math.max(0, analysisText.length - 100))}`
      );

      // Parse AI response
      const analysis = this.parseAIResponse(analysisText);
      console.log("Response parsed successfully");
      console.log(`Final score: ${analysis.score}/100`);

      console.log("=== GEMINI AI ANALYSIS SUCCESS ===\n");
      return analysis;
    } catch (error: any) {
      console.error("\n=== GEMINI AI ANALYSIS FAILED ===");
      console.error("Error type:", error.constructor.name);
      console.error("Error message:", error.message);
      console.error("===================================\n");

      // Handle specific errors
      if (error.message?.includes("Timeout")) {
        throw new GeminiTimeoutError(
          `Gemini API timed out after ${GEMINI_CONFIG.TIMEOUT_MS / 1000}s`
        );
      }

      if (error.message?.includes("API key") || error.code === 400) {
        throw new GeminiAPIError("Invalid API key", 400);
      }

      if (
        error.message?.includes("quota") ||
        error.message?.includes("rate limit") ||
        error.code === 429
      ) {
        throw new GeminiAPIError("API quota exceeded", 429);
      }

      if (error.status === 404 || error.message?.includes("not found")) {
        throw new GeminiAPIError("Model not available", 404);
      }

      throw new Error(`Failed to analyze resume: ${error.message}`);
    }
  }

  /**
   * Call Gemini API with timeout
   */
  private async callGeminiWithTimeout(prompt: string): Promise<any> {
    try {
      return await Promise.race([
        this.model.generateContent(prompt),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Timeout after ${GEMINI_CONFIG.TIMEOUT_MS / 1000}s`)
              ),
            GEMINI_CONFIG.TIMEOUT_MS
          )
        ),
      ]);
    } catch (error: any) {
      console.error("Gemini API call failed:");
      console.error("  Error name:", error.name);
      console.error("  Error message:", error.message);
      throw error;
    }
  }

  /**
   * Build optimized analysis prompt (shorter for faster response)
   */
  private buildAnalysisPrompt(resumeText: string, job: Job): string {
    // Even more concise prompt to avoid truncation
    const prompt = `You are an HR analyst. Analyze this resume-job match and return ONLY a valid, complete JSON object.

JOB POSTING:
Title: ${job.title}
Category: ${job.category}
Level: ${job.level || "Not specified"}
Key Requirements: ${this.truncateText(job.requirement, 500)}

CANDIDATE RESUME:
${resumeText}

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON (no markdown, no backticks, no extra text)
2. Keep arrays concise (max 3-4 items each)
3. Keep text fields brief but informative
4. Ensure JSON is complete with all closing brackets

JSON SCHEMA:
{
  "score": <number 0-100>,
  "strengths": [<max 3 strings>],
  "weaknesses": [<max 3 strings>],
  "recommendations": [<max 3 strings>],
  "skillsMatch": {
    "matched": [<strings>],
    "missing": [<strings>],
    "matchPercentage": <number 0-100>
  },
  "experienceMatch": {
    "summary": "<brief text>",
    "yearsRequired": <number or null>,
    "yearsCandidate": <number or null>,
    "isMatch": <boolean>
  },
  "educationMatch": {
    "summary": "<brief text>",
    "isMatch": <boolean>
  },
  "overallAssessment": "<brief overall summary>"
}

SCORING GUIDE:
90-100: Excellent fit
75-89: Good fit  
60-74: Potential fit
<60: Poor fit

Return the complete JSON now:`;

    return prompt;
  }

  /**
   * Parse AI response with better error handling
   */
  private parseAIResponse(responseText: string): AIMatchingAnalysis {
    try {
      console.log("Parsing AI response...");
      console.log(`Full response length: ${responseText.length} chars`);

      // Extract JSON
      let startJson = responseText.indexOf("{");
      let endJson = responseText.lastIndexOf("}");

      if (startJson === -1) {
        console.error("No opening brace found in response");
        console.error("Response:", responseText);
        throw new Error("AI response did not contain valid JSON");
      }

      // If no closing brace, try to repair JSON
      if (endJson === -1 || endJson < startJson) {
        console.warn(
          "Response appears truncated, attempting to repair JSON..."
        );

        // Try to find where it got cut off and add closing braces
        let repairedJson = responseText.substring(startJson);

        // Count opening and closing braces to determine what's missing
        const openBraces = (repairedJson.match(/\{/g) || []).length;
        const closeBraces = (repairedJson.match(/\}/g) || []).length;
        const openBrackets = (repairedJson.match(/\[/g) || []).length;
        const closeBrackets = (repairedJson.match(/\]/g) || []).length;

        // Add missing closures
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          repairedJson += "]";
        }
        for (let i = 0; i < openBraces - closeBraces; i++) {
          repairedJson += "}";
        }

        console.log(`Repaired JSON length: ${repairedJson.length} chars`);
        endJson = repairedJson.length - 1;
        responseText = repairedJson;
      }

      const cleanedText = responseText.substring(startJson, endJson + 1);
      console.log(`Cleaned JSON length: ${cleanedText.length} chars`);

      const parsed = JSON.parse(cleanedText);

      console.log("JSON parsed successfully");

      // Validate required fields
      if (typeof parsed.score !== "number") {
        console.warn("Score is not a number, using 0");
        parsed.score = 0;
      }

      // Normalize and validate data with better defaults
      const analysis: AIMatchingAnalysis = {
        score:
          typeof parsed.score === "number"
            ? Math.min(100, Math.max(0, Math.round(parsed.score)))
            : 0,

        strengths: this.normalizeStringArray(
          parsed.strengths,
          "No strengths identified"
        ),

        weaknesses: this.normalizeStringArray(
          parsed.weaknesses,
          "No weaknesses identified"
        ),

        recommendations: this.normalizeStringArray(
          parsed.recommendations,
          "Manual review recommended"
        ),

        skillsMatch: {
          matched: Array.isArray(parsed.skillsMatch?.matched)
            ? parsed.skillsMatch.matched.filter(
                (s: any) => typeof s === "string" && s.trim()
              )
            : [],
          missing: Array.isArray(parsed.skillsMatch?.missing)
            ? parsed.skillsMatch.missing.filter(
                (s: any) => typeof s === "string" && s.trim()
              )
            : [],
          matchPercentage:
            typeof parsed.skillsMatch?.matchPercentage === "number"
              ? Math.min(
                  100,
                  Math.max(0, Math.round(parsed.skillsMatch.matchPercentage))
                )
              : 0,
        },

        experienceMatch: {
          summary: String(
            parsed.experienceMatch?.summary || "Not assessed"
          ).substring(0, 500),
          yearsRequired:
            typeof parsed.experienceMatch?.yearsRequired === "number"
              ? parsed.experienceMatch.yearsRequired
              : null,
          yearsCandidate:
            typeof parsed.experienceMatch?.yearsCandidate === "number"
              ? parsed.experienceMatch.yearsCandidate
              : null,
          isMatch: Boolean(parsed.experienceMatch?.isMatch),
        },

        educationMatch: {
          summary: String(
            parsed.educationMatch?.summary || "Not assessed"
          ).substring(0, 500),
          isMatch: Boolean(parsed.educationMatch?.isMatch),
        },

        overallAssessment: String(
          parsed.overallAssessment ||
            "Analysis completed based on available information"
        ).substring(0, 1000),
      };

      console.log(`Final validated score: ${analysis.score}/100`);
      return analysis;
    } catch (error: any) {
      console.error("Failed to parse response:", error.message);
      console.error("Full response text:", responseText);
      throw new Error(`Invalid AI response format: ${error.message}`);
    }
  }

  /**
   * Normalize string array with fallback
   */
  private normalizeStringArray(arr: any, fallback: string): string[] {
    if (!Array.isArray(arr)) {
      return [fallback];
    }

    const filtered = arr
      .filter((item: any) => typeof item === "string" && item.trim())
      .map((item: string) => item.trim().substring(0, 200)) // Max 200 chars per item
      .slice(0, 5); // Max 5 items

    return filtered.length > 0 ? filtered : [fallback];
  }

  /**
   * Extract resume text
   */
  private async extractResumeText(resume: ResumeData): Promise<string> {
    if (resume.text && resume.text.length > 50) {
      console.log(
        `Using provided resume text (${resume.text.length} chars)`
      );
      return resume.text;
    }

    console.log("Resume text not available, using URL placeholder");
    return `Resume URL: ${resume.url}\n\nNote: PDF text extraction failed. Please review manually.`;
  }

  /**
   * Truncate text to max length (keep beginning and end)
   */
  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }

    // Keep first 70% and last 30%
    const keepStart = Math.floor(maxLength * 0.7);
    const keepEnd = Math.floor(maxLength * 0.3);

    const start = text.substring(0, keepStart);
    const end = text.substring(text.length - keepEnd);

    return `${start}\n\n[... content truncated ...]\n\n${end}`;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get matching score label
   */
  getMatchingLabel(score: number): string {
    if (score >= 90) return "Excellent Match";
    if (score >= 75) return "Good Match";
    if (score >= 60) return "Fair Match";
    if (score >= 40) return "Weak Match";
    return "Poor Match";
  }

  /**
   * Get matching color for UI
   */
  getMatchingColor(score: number): string {
    if (score >= 90) return "green";
    if (score >= 75) return "blue";
    if (score >= 60) return "yellow";
    if (score >= 40) return "orange";
    return "red";
  }
}

export const geminiAIMatchingService = new GeminiAIMatchingService();
