import { Timestamp } from "firebase/firestore";

export type User = {
    uid: string;
    email: string;
    name: string;
    role: string;
    photoURL?: string;
};

export type UserProfile = {
    uid: string; // The Firebase Auth user ID. This is set upon first login.
    name: string;
    role: string;
    email: string; // This is the unique identifier for documents in 'users' collection.
    signature: string;
    isAdmin: boolean;
};

export type Approver = {
    email: string;
    name: string;
    role: string;
    type: 'normal' | 'final' | 'proxy';
    status: 'pending' | 'approved';
    signature?: string;
    approvedAt?: string | null;
    approverName?: string;
};

export type Circular = {
    name: string;
    email: string;
    role: string;
};

export type Attachment = {
    name: string;
    size: number;
    data: string; // base64
};

export type ApprovalDoc = {
    id: string;
    title: string;
    content: string;
    approvers: Approver[];
    circulars: Circular[];
    attachments: Attachment[];
    currentStep: number;
    requesterId: string;
    requesterName: string;
    requesterEmail: string;
    requesterRole: string;
    requesterSignature: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Timestamp | string;
    completedAt?: Timestamp | string | null;
    docNo: string;
    publishStatus: '공개' | '비공개';
    docType: 'internal' | 'external';
    receiverInfo?: { name: string; email: string } | null;
    headerImage: string;
    footerInfo: {
        address: string;
        phone: string;
        fax: string;
        email: string;
        homepage: string;
    }
};

export type ApprovalDocPayload = Omit<ApprovalDoc, 'id' | 'requesterId' | 'requesterName' | 'requesterEmail' | 'requesterRole' | 'requesterSignature' | 'currentStep' | 'status' | 'createdAt' | 'completedAt' | 'docNo'>;

export type DocConfig = {
    nextNumber?: number;
    headerImage?: string;
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
    homepage?: string;
};

export type Language = 'ko' | 'en' | 'vi';
