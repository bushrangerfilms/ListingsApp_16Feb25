import { useState } from "react";
import { Trash2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const documentTypeLabels = {
  market_report: "Market Report",
  faq: "FAQ",
  company_info: "Company Info",
  custom: "Custom",
};

const statusColors = {
  active: "default",
  processing: "secondary",
  archived: "outline",
  failed: "destructive",
} as const;

export const DocumentsList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("knowledge_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
      toast({
        title: "Document Deleted",
        description: "Knowledge document has been removed",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
          <CardDescription>No documents uploaded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uploaded Documents</CardTitle>
        <CardDescription>
          {documents.length} document{documents.length !== 1 ? "s" : ""} in knowledge base
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{doc.title}</h4>
                    <Badge variant={statusColors[doc.status as keyof typeof statusColors]}>
                      {doc.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{documentTypeLabels[doc.document_type as keyof typeof documentTypeLabels]}</span>
                    <span>•</span>
                    <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                    {doc.tokens_count && (
                      <>
                        <span>•</span>
                        <span>{doc.tokens_count.toLocaleString()} tokens</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
              >
                {deletingId === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
