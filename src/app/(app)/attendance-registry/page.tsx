'use client';

import { getAttendanceDocuments } from "@/lib/services/documentService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { CalendarCheck, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function AttendanceRegistryPage() {
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.uid && profile?.email) {
            getAttendanceDocuments(profile.email, !!profile.isAdmin).then(data => {
                setDocs(data);
                setLoading(false);
            });
        } else if (!user || !profile) {
            setLoading(false);
        }
    }, [user, profile]);

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <div className="mb-8">
                <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                    <CalendarCheck className="h-8 w-8 text-primary" />
                    출결문서 보관함
                </h1>
                <p className="text-muted-foreground mt-1">결재가 완료된 학부모 출결 관련 문서(결석계 및 체험학습 신청서) 기록입니다.</p>
            </div>
            <DocumentList documents={docs} />
        </div>
    );
}
