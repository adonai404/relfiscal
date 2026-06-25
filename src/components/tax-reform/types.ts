export type TaxReformUrgency = "critical" | "important" | "informational";
export type TaxReformTaskStatus = "pending" | "completed" | "overdue" | "paused" | "waiting";

export interface TaxReformCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaxReformMonth {
  id: string;
  label: string;
  year: number;
  month: number;
  position: number;
  created_at: string;
}

export interface TaxReformChange {
  id: string;
  month_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  exact_date: string;
  urgency: TaxReformUrgency;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  tax_reform_categories?: TaxReformCategory | null;
}

export interface TaxReformChecklistItem {
  id: string;
  change_id: string;
  text: string;
  checked: boolean;
  position: number;
  created_at: string;
}

export interface TaxReformTask {
  id: string;
  change_id: string;
  title: string;
  status: TaxReformTaskStatus;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaxReformAttachment {
  id: string;
  change_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_mime: string | null;
  created_at: string;
}
