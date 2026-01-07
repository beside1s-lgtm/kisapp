'use client';

import { ApprovalDoc } from '@/lib/types';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ChevronRight, EyeOff, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

type DocumentListProps = {
  documents: ApprovalDoc[];
};

export function DocumentList({ documents }: DocumentListProps) {
  const router = useRouter();

  if (documents.length === 0) {
    return (
        <div className="py-20 text-center text-muted-foreground font-bold border-2 border-dashed rounded-lg">
            No documents to display.
        </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <Card
          key={doc.id}
          onClick={() => router.push(`/documents/${doc.id}`)}
          className="hover:border-primary hover:shadow-lg cursor-pointer transition-all group"
        >
            <div className="p-6 flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge variant={doc.status === 'approved' ? 'default' : 'secondary'} 
                            className={doc.status === 'approved' ? 'bg-accent text-accent-foreground' : ''}>
                            {doc.status === 'approved' ? 'Approved' : 'In Progress'}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground uppercase">{doc.docNo}</span>
                        {doc.publishStatus === '비공개' && (
                            <Badge variant="outline" className="text-xs">
                                <EyeOff size={12} className="inline mr-1" /> Private
                            </Badge>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{doc.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium mt-2">
                        <span className="flex items-center gap-1.5"><User size={14} /> {doc.requesterName} ({doc.requesterRole})</span>
                        <span>•</span>
                        <span>{doc.createdAt ? format(new Date(doc.createdAt as string), 'MMMM d, yyyy') : 'N/A'}</span>
                    </div>
                </div>
                 <ChevronRight size={20} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
        </Card>
      ))}
    </div>
  );
}
