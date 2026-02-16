import { useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type DocumentType = "market_report" | "faq" | "company_info" | "custom";

export const KnowledgeBaseUploader = ({ onUploadComplete }: { onUploadComplete: () => void }) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("custom");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!title) {
        setTitle(e.target.files[0].name);
      }
    }
  };

  const handleUpload = async () => {
    if (!title.trim() || (!content.trim() && !file)) {
      toast({
        title: "Missing Information",
        description: "Please provide a title and either content or a file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's organization ID
      const { data: orgData, error: orgError } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (orgError) throw orgError;
      if (!orgData) throw new Error("No organization found");

      let fileUrl = null;
      let finalContent = content;

      // If file is provided, read its content
      if (file) {
        const text = await file.text();
        finalContent = text;
      }

      // Insert document into database
      const { error } = await supabase
        .from("knowledge_documents")
        .insert({
          organization_id: orgData.organization_id,
          user_id: user.id,
          title,
          content: finalContent,
          document_type: documentType,
          file_url: fileUrl,
          status: "active",
          tokens_count: Math.ceil(finalContent.length / 4), // Rough token estimate
        });

      if (error) throw error;

      toast({
        title: "Document Uploaded",
        description: "Knowledge document has been added successfully",
      });

      // Reset form
      setTitle("");
      setContent("");
      setFile(null);
      setDocumentType("custom");
      onUploadComplete();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="doc-type">Document Type</Label>
          <Select value={documentType} onValueChange={(val) => setDocumentType(val as DocumentType)}>
            <SelectTrigger id="doc-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="market_report">Market Report</SelectItem>
              <SelectItem value="faq">FAQ</SelectItem>
              <SelectItem value="company_info">Company Information</SelectItem>
              <SelectItem value="custom">Custom Knowledge</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="doc-title">Document Title</Label>
          <Input
            id="doc-title"
            placeholder="e.g., Waterford Market Report Q4 2024"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="doc-file">Upload File (Optional)</Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
            <input
              id="doc-file"
              type="file"
              accept=".txt,.md,.pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="doc-file" className="cursor-pointer">
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    TXT, MD, PDF, DOC, DOCX
                  </p>
                </div>
              )}
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="doc-content">Or Paste Content Directly</Label>
          <Textarea
            id="doc-content"
            placeholder="Paste your knowledge content here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            disabled={!!file}
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              Content will be read from the uploaded file
            </p>
          )}
        </div>

        <Button onClick={handleUpload} disabled={isUploading} className="w-full">
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
