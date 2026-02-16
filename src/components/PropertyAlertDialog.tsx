import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePublicListings } from "@/contexts/PublicListingsContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const bedroomOptions = [
  { value: 1, label: "1 Bedroom" },
  { value: 2, label: "2 Bedrooms" },
  { value: 3, label: "3 Bedrooms" },
  { value: 4, label: "4 Bedrooms" },
  { value: 5, label: "5+ Bedrooms" },
];

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().min(1, "Phone number is required").max(20),
  bedrooms: z.array(z.number()).min(1, "Please select at least one bedroom option"),
  comments: z.string().trim().max(1000).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PropertyAlertDialogProps {
  trigger?: React.ReactNode;
  orgSlug?: string;
}

export function PropertyAlertDialog({ trigger, orgSlug }: PropertyAlertDialogProps) {
  const { organization } = useOrganization();
  const { organization: domainOrg, isPublicSite: isDomainBased, loading: domainLoading } = usePublicListings();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Pre-compute the clientSlug to check if form is ready
  const resolvedSlug = isDomainBased 
    ? domainOrg?.slug 
    : (orgSlug || organization?.slug);
  const isSlugLoading = domainLoading || (!resolvedSlug && !domainLoading);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      bedrooms: [],
      comments: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    // Derive clientSlug with precedence:
    // 1. Domain mode: use domainOrg.slug
    // 2. Slug mode: prefer prop, then URL context, then organization context
    let clientSlug: string | undefined;
    
    if (isDomainBased) {
      clientSlug = domainOrg?.slug;
    } else {
      clientSlug = orgSlug || organization?.slug;
    }
    
    if (!clientSlug) {
      toast.error('Organization not found. Please try again.');
      console.error('No client slug for property alert submission', { 
        isDomainBased, 
        domainOrg: domainOrg?.slug, 
        orgSlug,
        organizationSlug: organization?.slug 
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      console.log('[PropertyAlert] Submitting to Edge Function:', {
        ...data,
        clientSlug,
      });
      
      const { data: responseData, error } = await supabase.functions.invoke('submit-property-alert', {
        body: {
          ...data,
          clientSlug,
        },
      });

      console.log('[PropertyAlert] Edge Function response:', { responseData, error });

      if (error) throw error;

      toast.success("Success! We'll notify you about new properties matching your criteria.");
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('[PropertyAlert] Error submitting alert:', error);
      toast.error("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button size="lg">Get Notified</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Get Property Alerts</DialogTitle>
          <DialogDescription>
            Tell us what you're looking for and we'll notify you when matching properties become available.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your.email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="Your phone number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bedrooms"
              render={() => (
                <FormItem>
                  <FormLabel>Number of Bedrooms * (Select all that apply)</FormLabel>
                  <div className="space-y-2">
                    {bedroomOptions.map((option) => (
                      <FormField
                        key={option.value}
                        control={form.control}
                        name="bedrooms"
                        render={({ field }) => (
                          <FormItem
                            key={option.value}
                            className="flex flex-row items-center space-x-2 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(option.value)}
                                onCheckedChange={(checked) => {
                                  const updatedValue = checked
                                    ? [...field.value, option.value]
                                    : field.value.filter((val) => val !== option.value);
                                  field.onChange(updatedValue);
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {option.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Comments</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any specific requirements or preferences?"
                      {...field}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting || isSlugLoading}>
              {isSubmitting ? "Submitting..." : isSlugLoading ? "Loading..." : "Get Notified"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}