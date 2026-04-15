import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedbackAttachment {
  filename: string;
  content: string; // base64 encoded
  type: string;
}

interface SendFeedbackRequest {
  type: 'idea' | 'bug' | 'improvement' | 'general';
  message: string;
  attachments?: FeedbackAttachment[];
  userEmail: string;
  organizationName: string;
  organizationSlug: string;
  userAgent: string;
  url: string;
}

const typeLabels: Record<string, string> = {
  idea: 'Feature Idea',
  bug: 'Bug Report',
  improvement: 'Improvement',
  general: 'General Feedback',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      type,
      message,
      attachments = [],
      userEmail,
      organizationName,
      organizationSlug,
      userAgent,
      url,
    }: SendFeedbackRequest = await req.json();

    console.log('Feedback received:', { type, userEmail, organizationSlug, attachmentCount: attachments.length });

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);
    
    // Use verified sender email from environment
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@autolisting.io';
    const fromName = 'AutoListing Feedback';
    
    const typeLabel = typeLabels[type] || 'Feedback';
    const subject = `[AutoListing Feedback] ${typeLabel} from ${organizationName || 'Unknown Org'}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9, #2563eb); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; }
          .message-box { background: white; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 15px 0; }
          .meta { font-size: 13px; color: #64748b; }
          .meta-row { display: flex; margin: 5px 0; }
          .meta-label { font-weight: 600; min-width: 120px; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
          .badge-idea { background: #dbeafe; color: #1d4ed8; }
          .badge-bug { background: #fee2e2; color: #b91c1c; }
          .badge-improvement { background: #fef3c7; color: #b45309; }
          .badge-general { background: #e5e7eb; color: #374151; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">New Feedback Received</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">AutoListing.io Platform</p>
          </div>
          <div class="content">
            <div style="margin-bottom: 15px;">
              <span class="badge badge-${type}">${typeLabel}</span>
            </div>
            
            <div class="meta">
              <div class="meta-row">
                <span class="meta-label">From:</span>
                <span>${userEmail}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Organization:</span>
                <span>${organizationName} (${organizationSlug})</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Page:</span>
                <span>${url}</span>
              </div>
            </div>
            
            <div class="message-box">
              <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Message:</h3>
              <p style="margin: 0; white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </div>
            
            ${attachments.length > 0 ? `
              <p style="font-size: 13px; color: #64748b; margin-top: 15px;">
                <strong>${attachments.length} attachment(s)</strong> included with this feedback.
              </p>
            ` : ''}
            
            <div class="meta" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
              <div class="meta-row">
                <span class="meta-label">User Agent:</span>
                <span style="word-break: break-all;">${userAgent}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Sent:</span>
                <span>${new Date().toISOString()}</span>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData: any = {
      from: `${fromName} <${fromEmail}>`,
      to: ['peter@streamlinedai.tech'],
      subject: subject,
      html: htmlBody,
      reply_to: userEmail,
    };

    if (attachments.length > 0) {
      emailData.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        type: att.type,
      }));
    }

    const { data: emailResult, error: emailError } = await resend.emails.send(emailData);

    if (emailError) {
      console.error('Resend error:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send feedback', details: emailError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Feedback email sent successfully:', emailResult?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Feedback sent successfully',
        emailId: emailResult?.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in send-feedback:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
