import { PenTool } from "lucide-react";
import DocumentForm from "@/components/document-form";

export default function NewDocumentPage() {
  return (
    <div className="max-w-4xl mx-auto">
       <div className="mb-8">
            <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                <PenTool className="h-8 w-8 text-primary" />
                New Approval Request
            </h1>
            <p className="text-muted-foreground mt-1">Fill out the form below to start a new approval process.</p>
        </div>
      <DocumentForm />
    </div>
  );
}
