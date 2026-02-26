export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: string;
  signature?: string;
  isAdmin?: boolean;
};

export type Approver = {
  name: string;
  email: string;
  role: string;
  type: 'normal' | 'final' | 'proxy';
  status: 'pending' | 'approved' | 'rejected'; 
  approverName?: string;
  signature?: string;
  approvedAt?: string;
  comment?: string; 
};

export type Attachment = {
  name: string;
  data: string;
};

export type Circular = {
    name: string;
    email: string;
};

export type DocConfig = {
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
    homepage?: string;
    nextNumber?: number;
    nextFamilyNumber?: number; 
};

export type ApprovalDocPayload = {
  title: string;
  content: string;
  docType: 'internal' | 'external';
  category?: 'draft' | 'family'; 
  // [수정] 실제 사용되는 값인 한글로 타입 변경 ('public' | 'private' -> '공개' | '비공개')
  publishStatus: '공개' | '비공개'; 
  approvers: Approver[];
  attachments: Attachment[];
  circulars?: Circular[];
  receiverInfo?: { name: string; email?: string };
  headerImage?: string;
  footerInfo?: {
      address: string;
      phone: string;
      fax: string;
      email: string;
      homepage: string;
  };
};

export type ApprovalDoc = ApprovalDocPayload & {
  id: string;
  docNo: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  requesterSignature: string;
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected' | 'recalled';
  createdAt: any;
  completedAt?: any;
  updatedAt?: any;
};