import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { Card, CardContent } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import { COMPANY_INFO, getFormattedAddress } from '@/config/company';

export default function CookiePolicy() {
  const { organization } = useOrganization();
  const businessName = organization?.business_name || COMPANY_INFO.name;
  const isMarketingSite = !organization;
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title={`Cookie Policy - ${businessName}`}
        description={`Learn about how ${businessName} uses cookies and similar technologies on our website.`}
      />
      <PublicHeader />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8 prose prose-slate dark:prose-invert max-w-none">
            <h1>Cookie Policy</h1>
            <p className="text-muted-foreground">Last updated: December 2024</p>

            <h2>1. What Are Cookies?</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. 
              They help websites remember your preferences and improve your browsing experience. 
              This policy explains how {businessName} uses cookies in compliance with the 
              EU ePrivacy Directive and Irish law.
            </p>

            <h2>2. Cookie Categories</h2>

            <h3>2.1 Strictly Necessary Cookies</h3>
            <p>
              These cookies are essential for the website to function. They cannot be disabled. 
              No consent is required for these cookies under GDPR/ePrivacy.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Cookie Name</th>
                  <th className="text-left py-2">Purpose</th>
                  <th className="text-left py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">sb-*-auth-token</td>
                  <td className="py-2">Authentication session</td>
                  <td className="py-2">Session</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">cookieConsent</td>
                  <td className="py-2">Stores your cookie preferences</td>
                  <td className="py-2">1 year</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">cookiePreferences</td>
                  <td className="py-2">Granular consent choices</td>
                  <td className="py-2">1 year</td>
                </tr>
              </tbody>
            </table>

            <h3>2.2 Functional Cookies</h3>
            <p>
              These cookies enhance functionality and personalization. They require your consent.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Cookie Name</th>
                  <th className="text-left py-2">Purpose</th>
                  <th className="text-left py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">theme</td>
                  <td className="py-2">Light/dark mode preference</td>
                  <td className="py-2">1 year</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">sidebar-state</td>
                  <td className="py-2">Sidebar open/closed state</td>
                  <td className="py-2">Session</td>
                </tr>
              </tbody>
            </table>

            <h3>2.3 Analytics Cookies</h3>
            <p>
              These cookies help us understand how visitors use our website. They require your explicit consent.
            </p>
            <p>
              <em>We currently do not use analytics cookies. If this changes, we will update this policy and request your consent.</em>
            </p>

            <h3>2.4 Marketing Cookies</h3>
            <p>
              These cookies track your browsing activity for advertising purposes.
            </p>
            <p>
              <strong>We do not use marketing or advertising cookies.</strong>
            </p>

            <h2>3. Third-Party Cookies</h2>
            <p>Some features may set cookies from third-party services:</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Provider</th>
                  <th className="text-left py-2">Purpose</th>
                  <th className="text-left py-2">Privacy Policy</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Stripe</td>
                  <td className="py-2">Payment processing</td>
                  <td className="py-2"><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Supabase</td>
                  <td className="py-2">Authentication</td>
                  <td className="py-2"><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a></td>
                </tr>
              </tbody>
            </table>

            <h2>4. Managing Your Cookie Preferences</h2>

            <h3>4.1 Our Cookie Banner</h3>
            <p>
              When you first visit our website, you will see a cookie consent banner. You can:
            </p>
            <ul>
              <li><strong>Accept All:</strong> Enable all cookies including functional cookies</li>
              <li><strong>Reject Non-Essential:</strong> Only strictly necessary cookies will be used</li>
              <li><strong>Manage Preferences:</strong> Choose specific cookie categories to allow</li>
            </ul>
            <p>
              You can change your preferences at any time by clearing your browser cookies 
              for our site, which will trigger the consent banner on your next visit.
            </p>

            <h3>4.2 Browser Settings</h3>
            <p>You can also manage cookies through your browser:</p>
            <ul>
              <li><strong>Chrome:</strong> Settings &gt; Privacy and security &gt; Cookies</li>
              <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies</li>
              <li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
              <li><strong>Edge:</strong> Settings &gt; Cookies and site permissions</li>
            </ul>

            <h2>5. Consent Records</h2>
            <p>
              In accordance with GDPR, we maintain records of your cookie consent choices. 
              These records include the date and time of consent, the categories consented to, 
              and a unique identifier. You may request access to your consent records at any time.
            </p>

            <h2>6. Impact of Rejecting Cookies</h2>
            <p>If you reject non-essential cookies:</p>
            <ul>
              <li>Core website functionality will continue to work</li>
              <li>Some personalization features may be unavailable</li>
              <li>Your preferences may not be remembered between visits</li>
            </ul>

            <h2>7. Updates to This Policy</h2>
            <p>
              We may update this Cookie Policy to reflect changes in our practices or legal requirements. 
              Check this page periodically for updates.
            </p>

            <h2>8. Contact Us</h2>
            <p>For questions about cookies or this policy:</p>
            <p>
              <strong>Email:</strong> {COMPANY_INFO.dpo.email}<br />
              <strong>Address:</strong> {getFormattedAddress()}
            </p>

            <h2>9. More Information</h2>
            <p>
              For more about cookies and how to manage them, visit:{' '}
              <a href="https://www.allaboutcookies.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                www.allaboutcookies.org
              </a>
            </p>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
