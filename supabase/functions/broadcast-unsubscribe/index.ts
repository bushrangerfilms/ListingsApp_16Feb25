import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    const token = url.searchParams.get('token');

    if (!email || !token) {
      return new Response(renderHtml('Invalid Request', 'Missing required parameters.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Verify HMAC token
    const secret = Deno.env.get('BROADCAST_UNSUBSCRIBE_SECRET') || 'broadcast-unsub-default';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(email));
    const expectedToken = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (token !== expectedToken) {
      return new Response(renderHtml('Invalid Link', 'This unsubscribe link is invalid or has expired.'), {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Insert unsubscribe record
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from('broadcast_unsubscribes')
      .upsert(
        { email: email.toLowerCase(), unsubscribed_at: new Date().toISOString() },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('Error inserting unsubscribe:', error);
      return new Response(
        renderHtml('Error', 'Something went wrong. Please try again later.'),
        { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    console.log(`Broadcast unsubscribe: ${email}`);

    return new Response(
      renderHtml(
        'Unsubscribed',
        `You've been unsubscribed from AutoListing product updates. You'll no longer receive broadcast emails from us.`
      ),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    console.error('Error in broadcast-unsubscribe:', error);
    return new Response(
      renderHtml('Error', 'Something went wrong. Please try again later.'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
});

function renderHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - AutoListing</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
    .card { background: white; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin-bottom: 16px; color: #0f172a; }
    p { font-size: 16px; line-height: 1.6; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
