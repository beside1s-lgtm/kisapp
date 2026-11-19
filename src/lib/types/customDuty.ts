import type { Attachment } from '@/lib/types';

export type CustomDutyModuleKey = 'custom_table' | 'checklist' | 'approval_history';

export type CustomDutyStatus = 'empty' | 'requested' | 'in_progress' | 'upgraded';

export type FeatureUpgradeRequestStatus = 'pending' | 'in_review' | 'upgraded' | 'rejected';

export interface CustomDutyStandardDoc {
  id: string;
  templateKey: string;
  title: string;
  description?: string;
  content: string;
  docType?: 'internal' | 'external';
  attachments: Attachment[];
  isDefault?: boolean;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
}

export interface CustomDutyChecklistItem {
  id: string;
  title: string;
  timing?: string;
  done?: boolean;
}

export interface CustomDutyTableRow {
  id: string;
  [columnKey: string]: string;
}

export interface CustomDutyWorkspace {
  id: string;
  kind: 'custom_duty_workspace';
  dutyName: string;
  deptName?: string;
  description?: string;
  ownerEmails: string[];
  status: CustomDutyStatus;
  standardDocs: CustomDutyStandardDoc[];
  referenceFiles: Attachment[];
  enabledModules: CustomDutyModuleKey[];
  customTableColumns: string[];
  customTableRows: CustomDutyTableRow[];
  customChecklist: CustomDutyChecklistItem[];
  upgradedRoute?: string;
  upgradedSummary?: string;
  upgradedAt?: string;
  upgradedBy?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface CustomFeatureUpgradeRequest {
  id: string;
  kind: 'custom_feature_request';
  workspaceId: string;
  dutyName: string;
  deptName?: string;
  requesterEmail: string;
  requesterName: string;
  requestTitle: string;
  requestDescription: string;
  desiredModules?: CustomDutyModuleKey[];
  desiredColumnsText?: string;
  uploadedDocs: CustomDutyStandardDoc[];
  attachments: Attachment[];
  status: FeatureUpgradeRequestStatus;
  adminNotes?: string;
  upgradedRoute?: string;
  handledBy?: string;
  handledByName?: string;
  handledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StandardDocTemplateOverride {
  id: string;
  kind: 'standard_doc_template';
  templateKey: string;
  templateName: string;
  dutyName?: string;
  title: string;
  content: string;
  docType?: 'internal' | 'external' | 'teacher-afterschool' | 'volunteer';
  includeAttachments: boolean;
  attachments: Attachment[];
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
}

export interface ResolvedCustomDuty {
  dutyName: string;
  workspaceId: string;
  deptName?: string;
  href: string;
  source: 'customRole' | 'deptTask' | 'memberDuty' | 'baseRole';
  ownerEmails: string[];
}
