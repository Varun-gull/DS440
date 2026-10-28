export type EmailStatus = "applied" | "interviewing" | "offer" | "rejected";
export type TrackedApplication = {
  id: string;
  company: string;
  role: string;
  status: string;
  updated_at: string;
};

export type EmailInput = {
  subject: string;
  sender: string;
  body: string;
  receivedAt: string;
};

export type EmailAnalysis = {
  status: EmailStatus | null;
  confidence: "high" | "review" | "unknown";
  evidence: string;
  company: string;
  role: string;
  actionDateText: string;
  candidates: Array<{ applicationId: string; company: string; role: string; score: number }>;
  suggestedApplicationId: string | null;
  explanation: string;
};

export type EmailUpdate = {
  id: string;
  source: "gmail" | "paste";
  subject: string;
  sender: string;
  received_at: string;
  proposed_status: EmailStatus;
  evidence: string;
  extracted_company: string;
  extracted_role: string;
  action_date_text: string;
  confidence: string;
  suggested_application_id: string | null;
  application_id: string | null;
  previous_status: string | null;
  decision: "pending" | "confirmed" | "dismissed";
  reviewed_at: string | null;
  created_at: string;
};

export type ScannerState = {
  signedIn: boolean;
  databaseReady: boolean;
  gmailReady: boolean;
  missingSettings: string[];
  connection: { email: string; lastScannedAt: string | null; hasMore: boolean; scanDays: number; reconnectRequired: boolean } | null;
  applications: TrackedApplication[];
  updates: EmailUpdate[];
  error?: string;
};
