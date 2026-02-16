import { Link } from 'react-router-dom';
import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { Card, CardContent } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import { COMPANY_INFO, getFormattedAddress } from '@/config/company';

export default function PrivacyPolicy() {
  const { organization } = useOrganization();
  const businessName = organization?.business_name || COMPANY_INFO.name;
  const contactEmail = organization?.contact_email || COMPANY_INFO.contact.email;
  const isMarketingSite = !organization;
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title={`Privacy Policy - ${businessName}`}
        description={`Read our privacy policy to understand how ${businessName} collects, uses, and protects your personal data in compliance with GDPR.`}
      />
      <PublicHeader />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8 prose prose-slate dark:prose-invert max-w-none">
            <h1>Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: December 2024</p>

            <h2>1. Introduction</h2>
            <p>
              {isMarketingSite ? COMPANY_INFO.legalName : businessName} ("we", "us", "our") is committed to 
              protecting your personal data and respecting your privacy in accordance with the General Data 
              Protection Regulation (GDPR) and the Irish Data Protection Act 2018.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, store, and protect your personal data when 
              you use our website and services.
            </p>

            <h2>2. Data Controller</h2>
            <p>The data controller responsible for your personal data is:</p>
            <p>
              <strong>{isMarketingSite ? COMPANY_INFO.legalName : businessName}</strong><br />
              {isMarketingSite && (
                <>
                  Registered in Ireland (CRO: {COMPANY_INFO.croNumber})<br />
                </>
              )}
              Address: {isMarketingSite ? getFormattedAddress() : (organization?.business_address || getFormattedAddress())}<br />
              Email: {contactEmail}
            </p>
            {isMarketingSite && (
              <p>
                <strong>Data Protection Officer:</strong> {COMPANY_INFO.dpo.name}<br />
                <strong>DPO Contact:</strong> {COMPANY_INFO.dpo.email}
              </p>
            )}

            <h2>3. What Personal Data We Collect</h2>
            <p>We collect and process the following categories of personal data:</p>
            
            <h3>3.1 Information You Provide</h3>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, password, organization name</li>
              <li><strong>Billing Information:</strong> Payment card details (processed by Stripe), billing address, VAT number</li>
              <li><strong>Property Information:</strong> Property addresses, descriptions, images, valuations</li>
              <li><strong>Communications:</strong> Emails, support requests, feedback</li>
            </ul>

            <h3>3.2 Information Collected Automatically</h3>
            <ul>
              <li><strong>Technical Data:</strong> IP address, browser type and version, device information, operating system</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent on platform, click patterns</li>
              <li><strong>Cookies:</strong> See our <Link to="/cookie-policy" className="text-primary hover:underline">Cookie Policy</Link> for details</li>
            </ul>

            <h2>4. Legal Basis for Processing (GDPR Article 6)</h2>
            <p>We process your personal data based on the following legal grounds:</p>
            <ul>
              <li><strong>Contract Performance (Art. 6(1)(b)):</strong> Processing necessary to provide our services to you</li>
              <li><strong>Legitimate Interests (Art. 6(1)(f)):</strong> Improving our services, fraud prevention, security</li>
              <li><strong>Legal Obligation (Art. 6(1)(c)):</strong> Compliance with tax, accounting, and regulatory requirements</li>
              <li><strong>Consent (Art. 6(1)(a)):</strong> Marketing communications (where applicable)</li>
            </ul>

            <h2>5. How We Use Your Data</h2>
            <p>We use your personal data to:</p>
            <ul>
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send billing notifications</li>
              <li>Respond to your enquiries and provide customer support</li>
              <li>Send service-related communications (account updates, security alerts)</li>
              <li>Analyse usage patterns to improve user experience</li>
              <li>Prevent fraud and ensure platform security</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>6. Data Sharing and Third Parties</h2>
            <p>We may share your personal data with:</p>
            <ul>
              <li><strong>Supabase:</strong> Database hosting and authentication (EU servers)</li>
              <li><strong>Stripe:</strong> Payment processing (PCI-DSS compliant)</li>
              <li><strong>Google (Gemini AI):</strong> AI-powered features (with appropriate safeguards)</li>
              <li><strong>Resend:</strong> Email delivery services</li>
            </ul>
            <p>
              All third-party processors are bound by data processing agreements and are required to 
              protect your data in accordance with GDPR requirements.
            </p>
            <p>
              We do not sell your personal data to third parties.
            </p>

            <h2>7. International Data Transfers</h2>
            <p>
              Some of our service providers may transfer data outside the European Economic Area (EEA). 
              Where this occurs, we ensure appropriate safeguards are in place, including:
            </p>
            <ul>
              <li>EU-US Data Privacy Framework certification</li>
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
              <li>Binding Corporate Rules where applicable</li>
            </ul>

            <h2>8. Data Retention</h2>
            <p>We retain your personal data for the following periods:</p>
            <ul>
              <li><strong>Account Data:</strong> Duration of account plus 6 months after deletion</li>
              <li><strong>Billing Records:</strong> 7 years (Irish tax law requirement)</li>
              <li><strong>Property Listings:</strong> Duration of subscription plus 30-day grace period</li>
              <li><strong>Support Communications:</strong> 2 years</li>
              <li><strong>Usage Analytics:</strong> 26 months (aggregated/anonymized thereafter)</li>
            </ul>

            <h2>9. Your Rights Under GDPR</h2>
            <p>As a data subject, you have the following rights:</p>
            <ul>
              <li><strong>Right of Access (Art. 15):</strong> Request a copy of your personal data</li>
              <li><strong>Right to Rectification (Art. 16):</strong> Correct inaccurate or incomplete data</li>
              <li><strong>Right to Erasure (Art. 17):</strong> Request deletion of your personal data ("right to be forgotten")</li>
              <li><strong>Right to Restrict Processing (Art. 18):</strong> Limit how we use your data</li>
              <li><strong>Right to Data Portability (Art. 20):</strong> Receive your data in a machine-readable format</li>
              <li><strong>Right to Object (Art. 21):</strong> Object to processing based on legitimate interests</li>
              <li><strong>Right to Withdraw Consent (Art. 7):</strong> Withdraw consent at any time (where processing is based on consent)</li>
              <li><strong>Rights Related to Automated Decision-Making (Art. 22):</strong> Not be subject to solely automated decisions with legal effects</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us at <a href={`mailto:${COMPANY_INFO.dpo.email}`} className="text-primary hover:underline">{COMPANY_INFO.dpo.email}</a>.
              We will respond within 30 days as required by GDPR.
            </p>

            <h2>10. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to protect your personal data:</p>
            <ul>
              <li>Encryption in transit (TLS 1.3) and at rest</li>
              <li>Secure authentication with password hashing</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls and audit logging</li>
              <li>Employee training on data protection</li>
            </ul>

            <h2>11. Children's Privacy</h2>
            <p>
              Our services are not intended for individuals under 18 years of age. 
              We do not knowingly collect personal data from children. If you believe we have 
              inadvertently collected data from a child, please contact us immediately.
            </p>

            <h2>12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material 
              changes by email or prominent notice on our platform at least 30 days before the changes 
              take effect. The "Last updated" date at the top indicates when changes were made.
            </p>

            <h2>13. Complaints</h2>
            <p>
              If you are not satisfied with our response to a privacy concern, you have the right 
              to lodge a complaint with the Irish Data Protection Commission:
            </p>
            <p>
              <strong>{COMPANY_INFO.legal.dataProtectionAuthority.name}</strong><br />
              {COMPANY_INFO.legal.dataProtectionAuthority.address}<br />
              Website: <a href={COMPANY_INFO.legal.dataProtectionAuthority.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {COMPANY_INFO.legal.dataProtectionAuthority.website}
              </a>
            </p>

            <h2>14. Contact Us</h2>
            <p>For questions about this Privacy Policy or our data practices, please contact:</p>
            <p>
              <strong>Email:</strong> {COMPANY_INFO.dpo.email}<br />
              <strong>Address:</strong> {getFormattedAddress()}
            </p>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
