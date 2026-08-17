
'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { StudentPageContent } from './student-page-content';

export default function StudentPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20 bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <StudentPageContent />
        </Suspense>
    );
}
