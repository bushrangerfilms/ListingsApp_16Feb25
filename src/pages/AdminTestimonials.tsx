import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Pencil, Trash2, Star, GripVertical } from "lucide-react";

interface Testimonial {
  id: string;
  author_name: string;
  author_role: string | null;
  content: string;
  rating: number | null;
  is_featured: boolean;
  display_order: number;
  is_active: boolean;
}

const testimonialSchema = z.object({
  author_name: z.string().min(1, "Author name is required").max(100),
  author_role: z.string().max(100).optional(),
  content: z.string().min(10, "Content must be at least 10 characters").max(500),
  rating: z.coerce.number().min(1).max(5),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type TestimonialFormData = z.infer<typeof testimonialSchema>;

export default function AdminTestimonials() {
  const { organization, loading: orgLoading } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  const form = useForm<TestimonialFormData>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: {
      author_name: "",
      author_role: "",
      content: "",
      rating: 5,
      is_featured: false,
      is_active: true,
    },
  });

  const fetchTestimonials = async () => {
    if (!targetOrg) return;
    
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .eq('organization_id', targetOrg.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setTestimonials(data || []);
    } catch (error) {
      console.error('[AdminTestimonials] Error fetching testimonials:', error);
      toast({
        title: "Error",
        description: "Failed to load testimonials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetOrg) {
      fetchTestimonials();
    }
  }, [targetOrg]);

  const openNewDialog = () => {
    setEditingTestimonial(null);
    form.reset({
      author_name: "",
      author_role: "",
      content: "",
      rating: 5,
      is_featured: false,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (testimonial: Testimonial) => {
    setEditingTestimonial(testimonial);
    form.reset({
      author_name: testimonial.author_name,
      author_role: testimonial.author_role || "",
      content: testimonial.content,
      rating: testimonial.rating || 5,
      is_featured: testimonial.is_featured,
      is_active: testimonial.is_active,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: TestimonialFormData) => {
    if (!targetOrg) return;

    setSaving(true);
    try {
      if (editingTestimonial) {
        const { error } = await supabase
          .from('testimonials')
          .update({
            author_name: data.author_name,
            author_role: data.author_role || null,
            content: data.content,
            rating: data.rating,
            is_featured: data.is_featured,
            is_active: data.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTestimonial.id);

        if (error) throw error;

        toast({
          title: "Testimonial updated",
          description: "The testimonial has been updated successfully",
        });
      } else {
        const maxOrder = testimonials.length > 0 
          ? Math.max(...testimonials.map(t => t.display_order)) + 1 
          : 1;

        const { error } = await supabase
          .from('testimonials')
          .insert({
            organization_id: targetOrg.id,
            author_name: data.author_name,
            author_role: data.author_role || null,
            content: data.content,
            rating: data.rating,
            is_featured: data.is_featured,
            is_active: data.is_active,
            display_order: maxOrder,
          });

        if (error) throw error;

        toast({
          title: "Testimonial created",
          description: "The new testimonial has been added",
        });
      }

      setDialogOpen(false);
      fetchTestimonials();
    } catch (error) {
      console.error('[AdminTestimonials] Error saving testimonial:', error);
      toast({
        title: "Error",
        description: "Failed to save testimonial",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const { error } = await supabase
        .from('testimonials')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;

      toast({
        title: "Testimonial deleted",
        description: "The testimonial has been removed",
      });

      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchTestimonials();
    } catch (error) {
      console.error('[AdminTestimonials] Error deleting testimonial:', error);
      toast({
        title: "Error",
        description: "Failed to delete testimonial",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (testimonial: Testimonial) => {
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({ is_active: !testimonial.is_active })
        .eq('id', testimonial.id);

      if (error) throw error;

      setTestimonials(prev => 
        prev.map(t => t.id === testimonial.id ? { ...t, is_active: !t.is_active } : t)
      );
    } catch (error) {
      console.error('[AdminTestimonials] Error toggling active:', error);
      toast({
        title: "Error",
        description: "Failed to update testimonial",
        variant: "destructive",
      });
    }
  };

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Organization Found</CardTitle>
          <CardDescription>You are not associated with any organization</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Testimonials</h2>
          <p className="text-muted-foreground">Manage client testimonials shown on your public listings page</p>
        </div>
        <Button onClick={openNewDialog} data-testid="button-add-testimonial">
          <Plus className="h-4 w-4 mr-2" />
          Add Testimonial
        </Button>
      </div>

      {testimonials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No testimonials yet</h3>
            <p className="text-muted-foreground mb-4">Add testimonials from your satisfied clients to build trust with potential buyers and sellers.</p>
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Testimonial
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className={!testimonial.is_active ? "opacity-60" : ""} data-testid={`testimonial-item-${testimonial.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-muted-foreground cursor-grab">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-semibold" data-testid={`testimonial-author-${testimonial.id}`}>{testimonial.author_name}</span>
                      {testimonial.author_role && (
                        <span className="text-sm text-muted-foreground">({testimonial.author_role})</span>
                      )}
                      <div className="flex gap-0.5">
                        {[...Array(testimonial.rating || 5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                        ))}
                      </div>
                      {testimonial.is_featured && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Featured</span>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-2" data-testid={`testimonial-content-${testimonial.id}`}>
                      "{testimonial.content}"
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={testimonial.is_active}
                      onCheckedChange={() => toggleActive(testimonial)}
                      data-testid={`toggle-active-${testimonial.id}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(testimonial)} data-testid={`button-edit-${testimonial.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive"
                      onClick={() => {
                        setDeletingId(testimonial.id);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-${testimonial.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTestimonial ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
            <DialogDescription>
              {editingTestimonial 
                ? "Update the testimonial details below" 
                : "Add a new client testimonial to display on your public listings page"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="author_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Author Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} data-testid="input-author-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="author_role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role / Relationship (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Property Seller" {...field} data-testid="input-author-role" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Testimonial Content</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Share what the client said about their experience..." 
                        className="min-h-[100px]"
                        {...field} 
                        data-testid="input-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rating</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                      <FormControl>
                        <SelectTrigger data-testid="select-rating">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="5">5 Stars</SelectItem>
                        <SelectItem value="4">4 Stars</SelectItem>
                        <SelectItem value="3">3 Stars</SelectItem>
                        <SelectItem value="2">2 Stars</SelectItem>
                        <SelectItem value="1">1 Star</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-6">
                <FormField
                  control={form.control}
                  name="is_featured"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-featured"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Featured</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-active"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Active</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} data-testid="button-save-testimonial">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingTestimonial ? "Update" : "Add"} Testimonial
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Testimonial</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this testimonial? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
