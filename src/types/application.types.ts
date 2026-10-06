import { AIMatchingAnalysis } from "../entities/Application.entity";

export type ApplicationAiAnalysisResult = {
  score: number;
  details: AIMatchingAnalysis | null;
  analyzedAt: Date | null;
};

export interface TriggerAIAnalysisResult {
  message: string;
  analysis?: ApplicationAiAnalysisResult;
}
