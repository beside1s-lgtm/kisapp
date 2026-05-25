'use client';

import { getParentDocuments } from "@/lib/services/documentService";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { Backpack, Loader2, User, Calendar, MapPin, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_MAP = {
  pending: { label: '결재 진행중', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  approved: { label: '결재 완료', color: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: '반려됨', color: 'bg-red-100 text-red-800 border-red-200' },
  recalled: { label: '회수됨', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

export default function ParentsFieldTripPage() {
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.uid && profile?.email) {
            getParentDocuments('field-trip').then(data => {
                setDocs(data);
                setLoading(false);
            });
        } else if (!user || !profile) {
            setLoading(false);
        }
    }, [user, profile]);

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                    <Backpack className="h-8 w-8 text-primary" />
                    체험학습 신청서 조회
                </h1>
                <p className="text-muted-foreground">학부모님이 제출한 교외 체험학습 신청서 목록입니다.</p>
            </div>

            {docs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-muted/20">
                    <Backpack className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">표시할 문서가 없습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map((doc) => {
                        const statusInfo = STATUS_MAP[doc.status] || { label: doc.status, color: 'bg-gray-100 text-gray-800' };
                        const formData = doc.parentFormData;
                        
                        return (
                            <Link href={`/documents/${doc.id}`} key={doc.id} className="group">
                                <Card className="h-full hover:shadow-md transition-all hover:border-primary/50 relative overflow-hidden flex flex-col">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <Badge variant="outline" className={statusInfo.color}>
                                                {statusInfo.label}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(doc.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <CardTitle className="text-lg line-clamp-1">{doc.title}</CardTitle>
                                        <CardDescription className="flex items-center gap-1.5 mt-1">
                                            <User size={14} />
                                            {formData?.gradeClassNumber} {formData?.studentName}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3 flex-1 flex flex-col justify-end">
                                        <div className="space-y-2 text-sm bg-muted/30 p-3 rounded-md">
                                            <div className="flex items-start gap-2">
                                                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="font-medium">신청 기간 ({formData?.tripPeriod?.totalDays || 0}일)</span>
                                                    <span className="text-muted-foreground text-xs">
                                                        {formData?.tripPeriod?.startDate} ~ {formData?.tripPeriod?.endDate}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2 pt-1 border-t border-border/50">
                                                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="font-medium">유형: {formData?.tripType}</span>
                                                    <span className="text-muted-foreground text-xs line-clamp-1">
                                                        장소: {formData?.destination}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end text-sm text-primary font-medium pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            상세 보기 <ChevronRight size={16} className="ml-1" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
