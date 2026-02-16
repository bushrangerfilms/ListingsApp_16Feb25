import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Send, BarChart3, FileText } from "lucide-react";

const sections = [
  { 
    id: "enquiries", 
    label: "Enquiries & Requests", 
    icon: MessageSquare, 
    path: "/admin/communications",
    description: "View and manage property enquiries, valuation requests, and property alerts"
  },
  { 
    id: "sequences", 
    label: "Email Sequences", 
    icon: Send, 
    path: "/admin/communications",
    description: "Create and manage automated email sequences for buyers and sellers"
  },
  { 
    id: "analytics", 
    label: "Email Analytics", 
    icon: BarChart3, 
    path: "/admin/communications",
    description: "Track performance metrics for email sequences and campaigns"
  },
  { 
    id: "templates", 
    label: "Email Templates", 
    icon: FileText, 
    path: "/admin/email-templates",
    description: "Manage email templates for customer communications"
  },
];

export default function AdminCommunicationsHub() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Communications Hub</h1>
        <p className="text-muted-foreground">Manage enquiries, email sequences, and communications</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card
            key={section.id}
            className="cursor-pointer hover-elevate transition-colors"
            onClick={() => navigate(section.path)}
            data-testid={`card-${section.id}`}
          >
            <CardHeader className="flex flex-row items-start gap-4">
              <section.icon className="h-6 w-6 text-primary mt-1" />
              <div>
                <CardTitle className="text-lg">{section.label}</CardTitle>
                <CardDescription className="mt-1">
                  {section.description}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
