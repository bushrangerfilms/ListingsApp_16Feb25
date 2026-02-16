import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { Card, CardContent } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import { COMPANY_INFO, getFormattedAddress } from '@/config/company';

export default function TermsConditions() {
  const { organization } = useOrganization();
  const businessName = organization?.business_name || COMPANY_INFO.name;
  const isMarketingSite = !organization;
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title={`Terms & Conditions - ${businessName}`}
        description={`Read our terms and conditions for using ${businessName} website and services.`}
      />
      <PublicHeader />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8 prose prose-slate dark:prose-invert max-w-none">
            <h1>Terms & Conditions</h1>
            <p className="text-muted-foreground">Last updated: December 2024</p>

            <h2>1. Introduction</h2>
            <p>
              These Terms and Conditions ("Terms") govern your use of the {businessName} platform 
              {isMarketingSite && ` operated by ${COMPANY_INFO.legalName}`}. 
              By accessing or using our services, you agree to be bound by these Terms.
            </p>
            {isMarketingSite && (
              <p>
                <strong>Company Information:</strong><br />
                {COMPANY_INFO.legalName}<br />
                Registered in Ireland (CRO: {COMPANY_INFO.croNumber})<br />
                VAT Registration: {COMPANY_INFO.vatNumber}<br />
                Registered Address: {getFormattedAddress()}
              </p>
            )}

            <h2>2. Definitions</h2>
            <ul>
              <li><strong>"Platform"</strong> means the {businessName} website, software, and related services.</li>
              <li><strong>"User"</strong> means any individual or organization accessing the Platform.</li>
              <li><strong>"Subscriber"</strong> means a User who has registered for a paid subscription.</li>
              <li><strong>"Content"</strong> means all data, text, images, and materials uploaded to the Platform.</li>
              <li><strong>"Credits"</strong> means the usage-based billing units for Platform features.</li>
            </ul>

            <h2>3. Account Registration</h2>
            <p>To use certain features of the Platform, you must:</p>
            <ul>
              <li>Create an account with accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be at least 18 years of age or have parental consent</li>
            </ul>
            <p>
              You are responsible for all activities that occur under your account. We reserve the right 
              to suspend or terminate accounts that violate these Terms.
            </p>

            <h2>4. Subscription and Billing</h2>
            <h3>4.1 Free Trial</h3>
            <p>
              New users receive a 14-day free trial with 100 complimentary credits. 
              Trial credits do not carry over to paid subscriptions.
            </p>

            <h3>4.2 Paid Plans</h3>
            <p>
              Subscription fees are charged in advance on a monthly basis. 
              All prices are displayed in Euros (EUR) and are inclusive of Irish VAT at the applicable rate 
              for consumers within Ireland and the EU. Business customers with a valid VAT number may be 
              eligible for reverse-charge treatment.
            </p>

            <h3>4.3 Credits</h3>
            <p>
              Certain features consume credits. Credit costs are displayed before use. 
              Unused monthly credits do not roll over. Additional credit packs may be purchased separately.
            </p>

            <h3>4.4 Cancellation</h3>
            <p>
              You may cancel your subscription at any time. Upon cancellation:
            </p>
            <ul>
              <li>You retain access until the end of your current billing period</li>
              <li>Unused credits are forfeited at the end of the billing period</li>
              <li>Your data is retained for 30 days before archival</li>
            </ul>

            <h3>4.5 Refunds</h3>
            <p>
              Subscription fees are non-refundable except as required by law. 
              If you believe you are entitled to a refund, please contact our support team.
            </p>

            <h2>5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Platform for any unlawful purpose</li>
              <li>Upload false, misleading, or fraudulent property information</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Transmit malware, viruses, or harmful code</li>
              <li>Scrape or collect data without authorization</li>
              <li>Impersonate other users or entities</li>
              <li>Violate the intellectual property rights of others</li>
              <li>Send unsolicited commercial communications (spam)</li>
            </ul>

            <h2>6. Intellectual Property</h2>
            <h3>6.1 Our Intellectual Property</h3>
            <p>
              The Platform, including its design, features, and underlying technology, is owned by 
              {isMarketingSite ? ` ${COMPANY_INFO.legalName}` : ` ${businessName}`} and protected by copyright, 
              trademark, and other intellectual property laws.
            </p>

            <h3>6.2 Your Content</h3>
            <p>
              You retain ownership of Content you upload to the Platform. By uploading Content, you grant 
              us a non-exclusive, worldwide license to use, store, and display that Content for the purpose 
              of providing our services.
            </p>

            <h2>7. Property Listings</h2>
            <p>
              If you use the Platform to manage property listings, you warrant that:
            </p>
            <ul>
              <li>All listing information is accurate and not misleading</li>
              <li>You have the right to market the properties listed</li>
              <li>All images and materials are owned by you or properly licensed</li>
              <li>Listings comply with applicable Irish property and advertising laws</li>
            </ul>

            <h2>8. Data Processing</h2>
            <p>
              Your use of the Platform is also governed by our Privacy Policy. 
              For business users processing personal data through the Platform, 
              we act as a data processor on your behalf.
            </p>

            <h2>9. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access. 
              We may temporarily suspend service for maintenance, updates, or security reasons.
            </p>

            <h2>10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by Irish and EU law:
            </p>
            <ul>
              <li>We are not liable for indirect, incidental, or consequential damages</li>
              <li>Our total liability is limited to the fees paid in the 12 months preceding the claim</li>
              <li>We are not liable for losses arising from user content or third-party actions</li>
            </ul>
            <p>
              Nothing in these Terms excludes or limits liability for death or personal injury 
              caused by negligence, fraud, or any other liability that cannot be excluded by law.
            </p>

            <h2>11. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless {isMarketingSite ? COMPANY_INFO.legalName : businessName} 
              from any claims, damages, or expenses arising from your use of the Platform or violation of these Terms.
            </p>

            <h2>12. Modifications</h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated via email 
              or Platform notification at least 30 days before taking effect. Continued use after changes 
              constitutes acceptance of the updated Terms.
            </p>

            <h2>13. Governing Law and Disputes</h2>
            <p>
              These Terms are governed by {COMPANY_INFO.legal.governingLaw}. 
              Any disputes shall be subject to the exclusive jurisdiction of {COMPANY_INFO.legal.disputeResolution}.
            </p>
            <p>
              For EU consumers: You may also have recourse to the EU Online Dispute Resolution platform 
              at <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                https://ec.europa.eu/consumers/odr
              </a>.
            </p>

            <h2>14. Severability</h2>
            <p>
              If any provision of these Terms is found to be invalid or unenforceable, 
              the remaining provisions shall continue in full force and effect.
            </p>

            <h2>15. Contact Information</h2>
            <p>For questions about these Terms, please contact us:</p>
            <p>
              <strong>Email:</strong> {COMPANY_INFO.contact.email}<br />
              <strong>Address:</strong> {getFormattedAddress()}
            </p>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
