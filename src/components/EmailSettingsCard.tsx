import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { updateOrganizationProfile } from "@/lib/organizationHelpers";
import { Loader2, Mail, Plus, X, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const emailSettingsSchema = z.object({
  from_email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  from_name: z.string().max(100).optional().or(z.literal("")),
  notification_emails: z.array(z.object({
    email: z.string().email("Must be a valid email")
  })).optional(),
});

type EmailSettingsFormData = z.infer<typeof emailSettingsSchema>;

interface EmailSettings {
  from_email: string | null;
  from_name: string | null;
  notification_emails: string[] | null;
}

interface EmailSettingsCardProps {
  organizationId: string;
}

export function EmailSettingsCard({ organizationId }: EmailSettingsCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);

  const form = useForm<EmailSettingsFormData>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      from_email: "",
      from_name: "",
      notification_emails: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "notification_emails",
  });

  useEffect(() => {
    const fetchEmailSettings = async () => {
      if (!organizationId) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', organizationId)
          .single();

        if (error) throw error;

        const emailData = data as unknown as EmailSettings & Record<string, unknown>;
        
        setEmailSettings({
          from_email: emailData.from_email || null,
          from_name: emailData.from_name || null,
          notification_emails: (emailData.notification_emails as string[]) || null,
        });
        
        form.reset({
          from_email: emailData.from_email || "",
          from_name: emailData.from_name || "",
          notification_emails: ((emailData.notification_emails as string[]) || []).map((email: string) => ({ email })),
        });
      } catch (error) {
        console.error('Error fetching email settings:', error);
        toast({
          title: "Failed to load email settings",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmailSettings();
  }, [organizationId]);

  const onSubmit = async (data: EmailSettingsFormData) => {
    if (!organizationId) return;

    setIsSaving(true);

    try {
      // Auto-add any email that's typed in the input field but not yet added
      const input = document.querySelector('[data-testid="input-add-notification-email"]') as HTMLInputElement;
      const pendingEmail = input?.value.trim();
      
      let notificationEmails = data.notification_emails?.map(item => item.email).filter(Boolean) || [];
      
      if (pendingEmail) {
        const emailSchema = z.string().email();
        const result = emailSchema.safeParse(pendingEmail);
        
        if (result.success && !notificationEmails.includes(pendingEmail)) {
          notificationEmails = [...notificationEmails, pendingEmail];
          append({ email: pendingEmail });
          input.value = '';
        }
      }
      
      await updateOrganizationProfile(organizationId, {
        from_email: data.from_email || null,
        from_name: data.from_name || null,
        notification_emails: notificationEmails,
      });

      toast({
        title: "Email settings updated",
        description: "Your email configuration has been saved successfully",
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update email settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="loader-email-settings" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>

          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>How your outbound emails are sent</AlertTitle>
              <AlertDescription className="space-y-2 pt-1">
                <p className="text-sm">
                  Lead replies, enquiry notifications, valuation requests and property alerts all use this sender identity:
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>
                    <strong>From address:</strong> if you've connected a custom domain on the{" "}
                    <strong>Website</strong> tab, emails send from{" "}
                    <code className="text-xs">noreply@em.&lt;yourdomain&gt;</code>. Otherwise they
                    send from the platform default, <code className="text-xs">noreply@mail.autolisting.io</code>.
                  </li>
                  <li>
                    <strong>Display name:</strong> the name below — shown alongside the from address.
                  </li>
                  <li>
                    <strong>Reply-to:</strong> your organisation's Contact Email — so when a lead
                    hits reply, it lands in your inbox, not ours.
                  </li>
                </ul>
                <p className="text-sm pt-1">
                  To send from your own domain, connect a custom domain on the{" "}
                  <strong>Website</strong> tab — branded email DNS is configured in the same flow.
                </p>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Display Name</h4>
              <p className="text-sm text-muted-foreground">
                The name recipients see next to the from address.
              </p>

              <FormField
                control={form.control}
                name="from_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your Business Name"
                        {...field}
                        data-testid="input-from-name"
                      />
                    </FormControl>
                    <FormDescription>
                      Appears alongside the from address (e.g. "Your Business"
                      &lt;noreply@em.youragency.com&gt;). Falls back to your organisation's
                      business name if left blank.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div>
                <h4 className="text-sm font-medium">Notification Recipients</h4>
                <p className="text-sm text-muted-foreground">
                  Email addresses that will receive notifications for new enquiries, valuations, and property alerts.
                </p>
              </div>

              <div className="space-y-2">
                {fields.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-1">
                        <Badge 
                          variant="secondary" 
                          className="pl-3 pr-1 py-1.5 gap-1"
                          data-testid={`badge-notification-email-${index}`}
                        >
                          <span className="text-xs">{form.watch(`notification_emails.${index}.email`)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => remove(index)}
                            data-testid={`button-remove-email-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                        <input 
                          type="hidden" 
                          {...form.register(`notification_emails.${index}.email`)} 
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Add notification email..."
                    className="flex-1"
                    data-testid="input-add-notification-email"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        const email = input.value.trim();
                        if (!email) return;
                        
                        const emailSchema = z.string().email();
                        const result = emailSchema.safeParse(email);
                        
                        if (!result.success) {
                          toast({
                            title: "Invalid email address",
                            description: "Please enter a valid email address",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        const existingEmails = form.getValues('notification_emails')?.map(item => item.email) || [];
                        if (existingEmails.includes(email)) {
                          toast({
                            title: "Email already added",
                            description: "This email is already in the notification list",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        append({ email });
                        input.value = '';
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const input = document.querySelector('[data-testid="input-add-notification-email"]') as HTMLInputElement;
                      const email = input?.value.trim();
                      if (!email) return;
                      
                      const emailSchema = z.string().email();
                      const result = emailSchema.safeParse(email);
                      
                      if (!result.success) {
                        toast({
                          title: "Invalid email address",
                          description: "Please enter a valid email address",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      const existingEmails = form.getValues('notification_emails')?.map(item => item.email) || [];
                      if (existingEmails.includes(email)) {
                        toast({
                          title: "Email already added",
                          description: "This email is already in the notification list",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      append({ email });
                      input.value = '';
                    }}
                    data-testid="button-add-notification-email"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter or click + to add an email address
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={isSaving} data-testid="button-save-email-settings">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Email Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
