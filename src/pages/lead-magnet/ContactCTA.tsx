import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Download, Phone, Loader2 } from "lucide-react";

interface ContactCTAOrg {
  business_name?: string | null;
}

interface ContactCTAProps {
  org: ContactCTAOrg | null;
  onDownloadPDF: () => void;
  onContactAgent: () => void;
  downloading?: boolean;
  downloadLabel?: string;
  downloadDescription?: string;
}

export function ContactCTA({
  org,
  onDownloadPDF,
  onContactAgent,
  downloading = false,
  downloadLabel = "Download Your Report",
  downloadDescription = "Save a copy of your results as a PDF",
}: ContactCTAProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold">{downloadLabel}</h3>
              <p className="text-sm text-muted-foreground">{downloadDescription}</p>
            </div>
            <Button
              variant="outline"
              onClick={onDownloadPDF}
              disabled={downloading}
              data-testid="button-download-pdf"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {downloading ? "Preparing..." : "Download PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 text-center">
          <Phone className="h-10 w-10 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">Ready to Take the Next Step?</h3>
          <p className="text-muted-foreground mb-4">
            Request a call back from {org?.business_name || "our team"} for a personal consultation
          </p>
          <Button onClick={onContactAgent} data-testid="button-contact">
            Request a Call Back
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
