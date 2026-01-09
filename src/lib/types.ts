export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: string;
  signature?: string;
  isAdmin?: boolean;
};

// [수정] Approver 타입에 rejected 상태와 comment(반려 사유) 필드를 추가했습니다.
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
    headerImage?: string;
};

export type ApprovalDocPayload = {
  title: string;
  content: string;
  docType: 'internal' | 'external';
  publishStatus: '공개' | '비공개';
  approvers: Approver[];
  attachments: { name: string; size: number; data: string; }[];
  circulars?: Circular[];
  receiverInfo?: { name: string | undefined, email: string | undefined } | null;
  headerImage?: string;
  footerInfo: {
    address: string;
    phone: string;
    fax: string;
    email: string;
    homepage: string;
  };
};

// [수정] ApprovalDoc 타입에도 rejected 상태를 추가했습니다.
export type ApprovalDoc = ApprovalDocPayload & {
  id: string;
  docNo: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  requesterSignature: string;
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected'; 
  createdAt: any;
  completedAt?: any;
  comment?: string;
};
