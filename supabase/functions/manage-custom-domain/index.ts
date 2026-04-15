import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { getCorsHeaders } from '../_shared/cors.ts';

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_PROJECT_ID = '469dd6ee-631f-431a-9544-4a4d777de9c0';
const RAILWAY_ENVIRONMENT_ID = 'fbebd813-d22f-44dc-ad08-9c3c69d4be48';
const RAILWAY_SERVICE_ID = 'faff9c68-096e-4708-9079-0f2dda3df800';

interface RailwayDnsRecord {
  hostlabel: string;
  requiredValue: string;
  currentValue: string;
  status: string;
}

interface RailwayDomainStatus {
  dnsRecords: RailwayDnsRecord[];
  certificateStatus: string;
}

async function railwayQuery(query: string, variables?: Record<string, unknown>): Promise<any> {
  const token = Deno.env.get('RAILWAY_API_TOKEN');
  if (!token) throw new Error('RAILWAY_API_TOKEN not configured');

  const res = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();
  if (data.errors?.length) {
    console.error('[RAILWAY] GraphQL errors:', JSON.stringify(data.errors));
    throw new Error(data.errors[0].message);
  }
  return data.data;
}

async function handleCreate(
  supabase: any,
  organizationId: string,
  domain: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // Validate domain format
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    return new Response(
      JSON.stringify({ error: 'Invalid domain format. Enter just the domain (e.g. youragency.com).' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Check domain not claimed by another org
  const { data: existing } = await supabase
    .from('organizations')
    .select('id, business_name')
    .or(`custom_domain.eq.${domain},domain.eq.${domain}`)
    .neq('id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ error: 'This domain is already in use by another organization.' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Call Railway API to create custom domain
  console.log('[RAILWAY] Creating custom domain:', domain);
  let railwayData: any;
  try {
    railwayData = await railwayQuery(
      `mutation($input: CustomDomainCreateInput!) {
        customDomainCreate(input: $input) {
          id
          domain
          status {
            dnsRecords { hostlabel requiredValue currentValue status }
            certificateStatus
          }
        }
      }`,
      {
        input: {
          domain,
          projectId: RAILWAY_PROJECT_ID,
          environmentId: RAILWAY_ENVIRONMENT_ID,
          serviceId: RAILWAY_SERVICE_ID,
        },
      },
    );
  } catch (err: any) {
    console.error('[RAILWAY] Create failed:', err.message);
    return new Response(
      JSON.stringify({ error: 'Failed to register domain with hosting provider. Please try again or contact support.' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const created = railwayData.customDomainCreate;
  const dnsRecords = created.status?.dnsRecords || [];

  // Extract CNAME target from DNS records
  const cnameRecord = dnsRecords.find((r: RailwayDnsRecord) => r.requiredValue?.endsWith('.up.railway.app'));
  const cnameTarget = cnameRecord?.requiredValue || '';

  // Store in organizations table
  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      custom_domain: domain,
      custom_domain_cname_target: cnameTarget,
      custom_domain_verification_token: created.id, // Railway domain ID for later queries
      custom_domain_status: 'pending',
    })
    .eq('id', organizationId);

  if (updateError) {
    console.error('[DB] Update failed:', updateError);
    // Try to clean up Railway domain
    try { await railwayQuery(`mutation { customDomainDelete(id: "${created.id}") }`); } catch {}
    return new Response(
      JSON.stringify({ error: 'Failed to save domain configuration.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  console.log('[SUCCESS] Domain created:', domain, 'CNAME target:', cnameTarget);

  return new Response(
    JSON.stringify({
      success: true,
      domain,
      cnameTarget,
      dnsRecords: dnsRecords.map((r: RailwayDnsRecord) => ({
        hostlabel: r.hostlabel,
        requiredValue: r.requiredValue,
        status: r.status,
      })),
      railwayDomainId: created.id,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

async function handleVerify(
  supabase: any,
  organizationId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // Get org's current domain config
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('custom_domain, custom_domain_cname_target, custom_domain_verification_token, custom_domain_status')
    .eq('id', organizationId)
    .single();

  if (orgError || !org?.custom_domain) {
    return new Response(
      JSON.stringify({ error: 'No custom domain configured.' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (org.custom_domain_status === 'verified') {
    return new Response(
      JSON.stringify({ status: 'verified', domain: org.custom_domain }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const railwayDomainId = org.custom_domain_verification_token;
  if (!railwayDomainId) {
    return new Response(
      JSON.stringify({ error: 'Domain configuration incomplete. Please remove and re-add your domain.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Query Railway for domain status
  let domainData: any;
  try {
    domainData = await railwayQuery(
      `query($id: String!, $projectId: String!) {
        customDomain(id: $id, projectId: $projectId) {
          id
          domain
          status {
            dnsRecords { hostlabel requiredValue currentValue status }
            certificateStatus
          }
        }
      }`,
      { id: railwayDomainId, projectId: RAILWAY_PROJECT_ID },
    );
  } catch (err: any) {
    console.error('[RAILWAY] Verify query failed:', err.message);
    return new Response(
      JSON.stringify({ status: 'pending', message: 'Unable to check status right now. Please try again.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const domainStatus = domainData.customDomain?.status;
  const dnsRecords = domainStatus?.dnsRecords || [];
  const allDnsPropagated = dnsRecords.every((r: RailwayDnsRecord) => r.status === 'DNS_RECORD_STATUS_PROPAGATED');
  const certValid = domainStatus?.certificateStatus === 'CERTIFICATE_STATUS_TYPE_VALID';

  if (allDnsPropagated && certValid) {
    // Domain is fully verified — update status and set the domain column for domainDetection.ts
    await supabase
      .from('organizations')
      .update({
        custom_domain_status: 'verified',
        domain: org.custom_domain,
      })
      .eq('id', organizationId);

    console.log('[SUCCESS] Domain verified:', org.custom_domain);

    return new Response(
      JSON.stringify({ status: 'verified', domain: org.custom_domain }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Determine more specific status
  const dnsConfigured = dnsRecords.some((r: RailwayDnsRecord) => r.currentValue && r.currentValue !== '');
  const newStatus = dnsConfigured ? 'dns_configured' : 'pending';

  if (org.custom_domain_status !== newStatus) {
    await supabase
      .from('organizations')
      .update({ custom_domain_status: newStatus })
      .eq('id', organizationId);
  }

  return new Response(
    JSON.stringify({
      status: newStatus,
      domain: org.custom_domain,
      dnsRecords: dnsRecords.map((r: RailwayDnsRecord) => ({
        hostlabel: r.hostlabel,
        requiredValue: r.requiredValue,
        currentValue: r.currentValue,
        status: r.status,
      })),
      certificateStatus: domainStatus?.certificateStatus,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

async function handleDelete(
  supabase: any,
  organizationId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // Get org's current domain config
  const { data: org } = await supabase
    .from('organizations')
    .select('custom_domain, custom_domain_verification_token, domain')
    .eq('id', organizationId)
    .single();

  if (!org?.custom_domain) {
    return new Response(
      JSON.stringify({ success: true, message: 'No domain to remove.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Delete from Railway
  const railwayDomainId = org.custom_domain_verification_token;
  if (railwayDomainId) {
    try {
      await railwayQuery(`mutation { customDomainDelete(id: "${railwayDomainId}") }`);
      console.log('[RAILWAY] Domain deleted:', org.custom_domain);
    } catch (err: any) {
      console.error('[RAILWAY] Delete failed (continuing cleanup):', err.message);
    }
  }

  // Clear DB fields
  const clearDomain = org.domain === org.custom_domain ? null : org.domain;
  await supabase
    .from('organizations')
    .update({
      custom_domain: null,
      custom_domain_cname_target: null,
      custom_domain_verification_token: null,
      custom_domain_status: null,
      domain: clearDomain,
    })
    .eq('id', organizationId);

  console.log('[SUCCESS] Domain removed for org:', organizationId);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, organizationId, domain } = await req.json();

    if (!action || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, organizationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Auth: verify the user is authenticated
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user auth via their JWT
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify user has admin role on this org
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const { data: membership } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    const isSuperAdmin = roleData?.role === 'super_admin';
    if (!membership && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'You do not have access to this organization.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Billing gate: check account_status is 'active' (paid plan)
    if (action === 'create') {
      const { data: orgBilling } = await supabase
        .from('organizations')
        .select('account_status')
        .eq('id', organizationId)
        .single();

      if (!orgBilling || (orgBilling.account_status !== 'active' && !isSuperAdmin)) {
        return new Response(
          JSON.stringify({ error: 'Custom domains are available on paid plans. Please upgrade to continue.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Route to action handler
    switch (action) {
      case 'create':
        if (!domain) {
          return new Response(
            JSON.stringify({ error: 'Domain is required.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        return handleCreate(supabase, organizationId, domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''), corsHeaders);

      case 'verify':
        return handleVerify(supabase, organizationId, corsHeaders);

      case 'delete':
        return handleDelete(supabase, organizationId, corsHeaders);

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
  } catch (error) {
    console.error('[ERROR] Unexpected:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
    );
  }
});
