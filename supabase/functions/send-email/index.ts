import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { Resend } from 'https://esm.sh/resend@4.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

// CORS headers set per-request in handler

interface SendEmailRequest {
  templateKey: string;
  to: string;
  variables: Record<string, any>;
  organizationId?: string;
  cc?: string[];
  attachments?: any[];
}

interface OrganizationEmailConfig {
  from_email: string | null;
  from_name: string | null;
  business_name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  business_address: string | null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templateKey, to, variables, organizationId, cc, attachments }: SendEmailRequest = await req.json();

    console.log('Send email request:', { templateKey, to, organizationId, variableKeys: Object.keys(variables) });

    if (!templateKey || !to) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: templateKey and to are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Rate limit: 200 emails per hour per organization
    if (organizationId) {
      const rateCheck = await checkRateLimit(supabase, organizationId, {
        feature: 'send-email',
        maxRequests: 200,
        windowMinutes: 60,
      });
      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({ error: 'Email rate limit exceeded', resetTime: rateCheck.resetTime }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch organization config for branding and sender identity
    let orgConfig: OrganizationEmailConfig | null = null;
    if (organizationId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('from_email, from_name, business_name, logo_url, primary_color, secondary_color, business_address')
        .eq('id', organizationId)
        .single();
      orgConfig = org;
      console.log('Organization config loaded:', orgConfig?.business_name);
    }

    // Template fallback: Try org-specific first, then platform default (org_id = NULL)
    let template = null;
    
    if (organizationId) {
      // First try org-specific template
      const { data: orgTemplate } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .maybeSingle();
      template = orgTemplate;
      if (template) {
        console.log('Using org-specific template:', template.template_name);
      }
    }
    
    // Fallback to platform default template
    if (!template) {
      const { data: defaultTemplate, error: defaultError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', templateKey)
        .is('organization_id', null)
        .eq('is_active', true)
        .maybeSingle();
      
      if (defaultError) {
        console.error('Error fetching default template:', defaultError);
      }
      template = defaultTemplate;
      if (template) {
        console.log('Using platform default template:', template.template_name);
      }
    }

    if (!template) {
      console.error('Template not found (no org or default):', templateKey);
      return new Response(
        JSON.stringify({ error: `Email template '${templateKey}' not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate property image section HTML if property_image is provided
    let propertyImageSection = '';
    if (variables.property_image) {
      propertyImageSection = `
        <div style="margin:15px 0;text-align:center;">
          <img src="${variables.property_image}" alt="Property" style="max-width:100%;height:auto;border-radius:8px;max-height:300px;object-fit:cover;" />
        </div>
      `;
    }

    // Inject org branding variables
    const brandingVars = {
      org_name: orgConfig?.business_name || 'AutoListing',
      logo_url: orgConfig?.logo_url || '',
      primary_color: orgConfig?.primary_color || '#2563eb',
      secondary_color: orgConfig?.secondary_color || '#64748b',
      org_address: orgConfig?.business_address || '',
      property_image_section: propertyImageSection,
      ...variables,
    };

    let subject = template.subject;
    let bodyHtml = template.body_html;

    // Replace all {variableName} placeholders with actual values (including branding)
    for (const [key, value] of Object.entries(brandingVars)) {
      const placeholder = `{${key}}`;
      const replacementValue = value !== null && value !== undefined ? String(value) : '';
      subject = subject.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementValue);
      bodyHtml = bodyHtml.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementValue);
    }
    
    // Handle conditional blocks like {{#if logo_url}}...{{/if}}
    bodyHtml = bodyHtml.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, content) => {
      const varValue = brandingVars[varName];
      return varValue ? content : '';
    });

    console.log('Variables replaced, preparing to send email via Resend');

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);
    
    // Use org-specific sender or fall back to platform defaults
    const fromEmail = orgConfig?.from_email || Deno.env.get('FROM_EMAIL') || 'noreply@autolisting.io';
    const fromName = orgConfig?.from_name || orgConfig?.business_name || Deno.env.get('FROM_NAME') || 'AutoListing';
    const siteUrl = Deno.env.get('SITE_URL') || supabaseUrl;
    
    console.log('Sending from:', `${fromName} <${fromEmail}>`);
    console.log('Sending to:', to);

    // Add tracking pixel and tracked links if queueId is provided
    // Also add unsubscribe link
    if (variables.queueId) {
      const trackingPixelUrl = `${siteUrl}/functions/v1/track-email-event?queueId=${variables.queueId}&event=opened`;
      
      // Add unsubscribe footer with preferences link (using org-specific branding)
      const preferencesUrl = `${siteUrl}/email-preferences?token=${variables.preferencesToken || ''}`;
      const unsubscribeFooter = `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
          <p>You're receiving this email because you signed up for updates from ${fromName}.</p>
          <p style="margin-top: 10px;">
            <a href="${preferencesUrl}" style="color: #6b7280; text-decoration: underline;">Manage your email preferences</a> or 
            <a href="${preferencesUrl}" style="color: #6b7280; text-decoration: underline;">unsubscribe</a>
          </p>
        </div>
        <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />
      `;
      
      bodyHtml += unsubscribeFooter;
      
      // Wrap links with tracking (simple implementation)
      bodyHtml = bodyHtml.replace(
        /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi,
        (match: string, attrs: string, url: string) => {
          // Skip if already a tracking URL or preferences URL
          if (url.includes('track-email-event') || url.includes('email-preferences')) {
            return match;
          }
          const trackedUrl = `${siteUrl}/functions/v1/track-email-event?queueId=${variables.queueId}&event=clicked&redirect=${encodeURIComponent(url)}`;
          return `<a ${attrs.replace(url, trackedUrl)}>`;
        }
      );
    }

    // Send email via Resend
    const emailData: any = {
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      html: bodyHtml,
    };

    if (cc && cc.length > 0) {
      emailData.cc = cc;
    }

    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments;
    }

    const { data: emailResult, error: emailError } = await resend.emails.send(emailData);

    if (emailError) {
      console.error('Resend error:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email sent successfully:', emailResult?.id);

    // Update last_sent_at timestamp on template
    await supabase
      .from('email_templates')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', template.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        emailId: emailResult?.id,
        template: template.template_name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in send-email:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
