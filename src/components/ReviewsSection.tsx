import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface Testimonial {
  id: string;
  author_name: string;
  author_role: string | null;
  content: string;
  rating: number | null;
  is_featured: boolean;
}

interface ReviewsSectionProps {
  organizationSlug?: string;
}

export function ReviewsSection({ organizationSlug }: ReviewsSectionProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTestimonials() {
      console.log('[ReviewsSection] organizationSlug:', organizationSlug);
      
      if (!organizationSlug) {
        console.log('[ReviewsSection] No slug provided, skipping fetch');
        setLoading(false);
        return;
      }

      try {
        console.log('[ReviewsSection] Fetching testimonials for:', organizationSlug);
        const { data, error } = await supabase.functions.invoke('get-testimonials', {
          body: { clientSlug: organizationSlug }
        });

        if (error) {
          console.error('[ReviewsSection] Error fetching testimonials:', error);
        } else if (data?.success) {
          console.log('[ReviewsSection] Received', data.testimonials.length, 'testimonials');
          setTestimonials(data.testimonials);
        }
      } catch (error) {
        console.error('[ReviewsSection] Error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTestimonials();
  }, [organizationSlug]);

  if (loading) {
    return (
      <section className="bg-background py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center mb-12">
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-5 w-32 mb-4" />
                  <Skeleton className="h-20 w-full mb-4" />
                  <Skeleton className="h-5 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section className="bg-background py-16" data-testid="reviews-section">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">What Our Clients Say</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Don't just take our word for it - hear from our satisfied clients
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="hover:shadow-lg transition-shadow" data-testid={`testimonial-card-${testimonial.id}`}>
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating || 5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 italic" data-testid={`testimonial-content-${testimonial.id}`}>
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-semibold text-foreground" data-testid={`testimonial-author-${testimonial.id}`}>
                    — {testimonial.author_name}
                  </p>
                  {testimonial.author_role && (
                    <p className="text-sm text-muted-foreground">{testimonial.author_role}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
