import type { ExecutionResult } from "../execution/results";
export interface LearningActivity {
  id: string;
  version: number;
  kind: "prediction" | "code";
  title: string;
  context: string;
  task: string;
  rules: string[];
  starter: string;
  harnessExcerpt: string;
}
export interface Prediction {
  status: number;
  stock: number;
  orders: number;
}
export interface Draft {
  source: string;
  prediction: Partial<Prediction> | null;
  justification: string;
}
export interface Feedback {
  message: string;
  comparisons: {
    label: string;
    expected: number;
    actual: number;
    matches: boolean;
  }[];
}
export interface Submission {
  id: string;
  number: number;
  source: string;
  digest: string;
  draftRevision: number;
  prediction: Prediction | null;
  justification: string;
  activityVersion: number;
  harnessDigest: string;
  conditions: Record<string, number>;
  createdAt: string;
  result: ExecutionResult | null;
  feedback: Feedback | null;
}
export interface Attempt {
  id: string;
  activityId: string;
  activityVersion: number;
  status: "open" | "completed";
  revision: number;
  draft: Draft;
  reflection: string;
  submissions: Submission[];
}
