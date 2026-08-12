import {
  AIMatchingAnalysis,
  Application,
} from "../entities/Application.entity";

export type ApplicationAiAnalysisResult = {
  score: number;
  details: AIMatchingAnalysis | null;
  analyzedAt: Date | null;
};

export interface TriggerAIAnalysisResult {
  message: string;
  analysis?: ApplicationAiAnalysisResult;
}

export interface MyApplicationsResult {
  applications: Application[];
  total: number;
  page: number;
  totalPages: number;
}
