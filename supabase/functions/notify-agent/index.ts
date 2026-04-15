import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyAgentRequest {
  leadInfo: {
    name: string;
    email?: string;
    phone?: string;
    lead_type: 'buyer' | 'seller' | 'unknown';
  };
  qualifiedData?: {
    budget_min?: number;
    budget_max?: number;
    bedrooms?: number[];
    location?: string;
    timeline?: string;
    property_address?: string;
    notes?: string;
  };
  agentRequest: {
    urgency: 'low' | 'medium' | 'high';
    reason?: string;
  };
  conversationHistory: Array<{ role: string; content: string }>;
  crmProfileId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadInfo, qualifiedData, agentRequest, conversationHistory, crmProfileId }: NotifyAgentRequest = await req.json();

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const agentEmail = Deno.env.get('ADMIN_EMAIL') || Deno.env.get('FROM_EMAIL');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://pepzeqiupmucxiulfzld.supabase.co';

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    if (!agentEmail) {
      throw new Error('Agent email not configured');
    }

    // Format urgency badge
    const urgencyColors = {
      high: '#ef4444',
      medium: '#f59e0b',
      low: '#10b981'
    };

    // Format conversation transcript
    const conversationTranscript = conversationHistory
      .map((msg, idx) => `<p style="margin: 8px 0;"><strong>${msg.role === 'user' ? 'Customer' : 'AI Assistant'}:</strong> ${msg.content}</p>`)
      .join('');

    // Format property preferences
    let preferencesHtml = '';
    if (leadInfo.lead_type === 'buyer' && qualifiedData) {
      preferencesHtml = `
        <h3 style="color: #1f2937; margin-top: 24px;">Property Preferences:</h3>
        <ul style="color: #4b5563;">
          ${qualifiedData.budget_min || qualifiedData.budget_max ? `<li><strong>Budget:</strong> €${qualifiedData.budget_min?.toLocaleString() || '?'} - €${qualifiedData.budget_max?.toLocaleString() || '?'}</li>` : ''}
          ${qualifiedData.bedrooms ? `<li><strong>Bedrooms:</strong> ${qualifiedData.bedrooms.join(', ')}</li>` : ''}
          ${qualifiedData.location ? `<li><strong>Location:</strong> ${qualifiedData.location}</li>` : ''}
          ${qualifiedData.timeline ? `<li><strong>Timeline:</strong> ${qualifiedData.timeline}</li>` : ''}
          ${qualifiedData.notes ? `<li><strong>Additional Notes:</strong> ${qualifiedData.notes}</li>` : ''}
        </ul>
      `;
    } else if (leadInfo.lead_type === 'seller' && qualifiedData) {
      preferencesHtml = `
        <h3 style="color: #1f2937; margin-top: 24px;">Property Details:</h3>
        <ul style="color: #4b5563;">
          ${qualifiedData.property_address ? `<li><strong>Property Address:</strong> ${qualifiedData.property_address}</li>` : ''}
          ${qualifiedData.timeline ? `<li><strong>Timeline:</strong> ${qualifiedData.timeline}</li>` : ''}
          ${qualifiedData.notes ? `<li><strong>Additional Notes:</strong> ${qualifiedData.notes}</li>` : ''}
        </ul>
      `;
    }

    // CRM profile link
    const crmLinkHtml = crmProfileId ? `
      <p style="margin-top: 24px;">
        <a href="${siteUrl}/admin/crm" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
          View in CRM
        </a>
      </p>
    ` : '';

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🔔 New Agent Contact Request</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Via AI Assistant Widget</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <div style="background-color: white; padding: 24px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <h2 style="color: #1f2937; margin: 0; flex-grow: 1;">Lead Information</h2>
              <span style="background-color: ${urgencyColors[agentRequest.urgency]}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                ${agentRequest.urgency} Priority
              </span>
            </div>
            
            <table style="width: 100%; color: #4b5563;">
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Name:</td>
                <td style="padding: 8px 0;">${leadInfo.name}</td>
              </tr>
              ${leadInfo.email ? `
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Email:</td>
                <td style="padding: 8px 0;"><a href="mailto:${leadInfo.email}" style="color: #2563eb;">${leadInfo.email}</a></td>
              </tr>
              ` : ''}
              ${leadInfo.phone ? `
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Phone:</td>
                <td style="padding: 8px 0;"><a href="tel:${leadInfo.phone}" style="color: #2563eb;">${leadInfo.phone}</a></td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Type:</td>
                <td style="padding: 8px 0; text-transform: capitalize;">${leadInfo.lead_type}</td>
              </tr>
              ${agentRequest.reason ? `
              <tr>
                <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Reason:</td>
                <td style="padding: 8px 0;">${agentRequest.reason}</td>
              </tr>
              ` : ''}
            </table>

            ${preferencesHtml}
            ${crmLinkHtml}
          </div>

          <div style="background-color: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="color: #1f2937; margin-top: 0;">Conversation Transcript:</h3>
            <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; max-height: 400px; overflow-y: auto; border-left: 4px solid #2563eb;">
              ${conversationTranscript}
            </div>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 24px; text-align: center;">
            This lead was automatically captured by the AI Assistant and saved to your CRM.
          </p>
        </div>
      </div>
    `;

    const { error } = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('FROM_NAME') ? `${Deno.env.get('FROM_NAME')} <${Deno.env.get('FROM_EMAIL')}>` : `Bridge Auctioneers <${Deno.env.get('FROM_EMAIL')}>`,
        to: [agentEmail],
        subject: `🔔 ${agentRequest.urgency.toUpperCase()} Priority: ${leadInfo.name} requests agent contact (${leadInfo.lead_type})`,
        html: emailHtml,
      }),
    }).then(res => res.json());

    if (error) {
      console.error('Error sending agent notification:', error);
      throw error;
    }

    console.log('Agent notification sent successfully to:', agentEmail);

    return new Response(
      JSON.stringify({ success: true, message: 'Agent notification sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-agent function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
