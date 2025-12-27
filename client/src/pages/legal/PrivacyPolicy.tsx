import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const LOGO_URL = "/attached_assets/F2BAC948-A0A6-4DA7-BB2F-FF58C5F37F7E_1766875595613.png";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <img src={LOGO_URL} alt="NextScene" className="h-16 cursor-pointer" style={{ clipPath: 'inset(20% 0 20% 0)' }} />
          </Link>
          <Link href="/">
            <span className="text-white/60 hover:text-white text-sm flex items-center gap-2 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-white/50 mb-12">Last updated: December 2024</p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">1. Introduction</h2>
            <p className="text-white/70 leading-relaxed">
              NextMonth Ltd ("we", "us", or "our"), company number 16464586, registered at 44 Orchard Way, Banbury, United Kingdom, OX16 0HA, operates the NextScene platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
            <p className="text-white/70 leading-relaxed mt-4">
              We are committed to protecting your privacy and ensuring compliance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">2. Data Controller</h2>
            <p className="text-white/70 leading-relaxed">
              NextMonth Ltd is the data controller responsible for your personal data. If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-white/70 leading-relaxed mt-4">
              Email: <a href="mailto:hello@nextmonth.io" className="text-purple-400 hover:text-purple-300">hello@nextmonth.io</a><br />
              Address: 44 Orchard Way, Banbury, United Kingdom, OX16 0HA
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">3. Information We Collect</h2>
            <h3 className="text-xl font-medium mb-3 text-white/90">3.1 Information You Provide</h3>
            <ul className="list-disc list-inside text-white/70 space-y-2">
              <li>Account information (username, email address, password)</li>
              <li>Profile information you choose to provide</li>
              <li>Content you upload or create using our service</li>
              <li>Communications you send to us</li>
              <li>Payment information (processed securely by Stripe)</li>
            </ul>

            <h3 className="text-xl font-medium mb-3 mt-6 text-white/90">3.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside text-white/70 space-y-2">
              <li>Device and browser information</li>
              <li>IP address and approximate location</li>
              <li>Usage data and analytics</li>
              <li>Cookies and similar technologies (see our Cookie Policy)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">4. Legal Basis for Processing</h2>
            <p className="text-white/70 leading-relaxed">We process your personal data under the following legal bases:</p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li><strong>Contract:</strong> To provide our services to you</li>
              <li><strong>Legitimate interests:</strong> To improve our services and communicate with you</li>
              <li><strong>Consent:</strong> For marketing communications and optional features</li>
              <li><strong>Legal obligation:</strong> To comply with applicable laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">5. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-white/70 space-y-2">
              <li>To provide, maintain, and improve our services</li>
              <li>To process transactions and manage subscriptions</li>
              <li>To communicate with you about your account and our services</li>
              <li>To provide customer support</li>
              <li>To detect, prevent, and address technical issues or fraud</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">6. Data Sharing and Disclosure</h2>
            <p className="text-white/70 leading-relaxed">We may share your information with:</p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li><strong>Service providers:</strong> Third parties who help us operate our service (e.g., hosting, payment processing, analytics)</li>
              <li><strong>Legal requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-4">
              We do not sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">7. International Data Transfers</h2>
            <p className="text-white/70 leading-relaxed">
              Your data may be transferred to and processed in countries outside the UK. When we transfer data internationally, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses approved by the UK Information Commissioner's Office.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">8. Data Retention</h2>
            <p className="text-white/70 leading-relaxed">
              We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, including to satisfy legal, accounting, or reporting requirements. When you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">9. Your Rights Under GDPR</h2>
            <p className="text-white/70 leading-relaxed">Under UK GDPR, you have the following rights:</p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li><strong>Right of access:</strong> Request a copy of your personal data</li>
              <li><strong>Right to rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Right to erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Right to restrict processing:</strong> Request limitation of processing</li>
              <li><strong>Right to data portability:</strong> Receive your data in a portable format</li>
              <li><strong>Right to object:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Rights related to automated decision-making:</strong> Not be subject to automated decisions</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-4">
              To exercise any of these rights, please contact us at <a href="mailto:hello@nextmonth.io" className="text-purple-400 hover:text-purple-300">hello@nextmonth.io</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">10. Data Security</h2>
            <p className="text-white/70 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">11. Children's Privacy</h2>
            <p className="text-white/70 leading-relaxed">
              Our service is not directed to children under 13 years of age. We do not knowingly collect personal data from children under 13. If you become aware that a child has provided us with personal data, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">12. Changes to This Policy</h2>
            <p className="text-white/70 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">13. Complaints</h2>
            <p className="text-white/70 leading-relaxed">
              If you have concerns about how we handle your personal data, please contact us first at <a href="mailto:hello@nextmonth.io" className="text-purple-400 hover:text-purple-300">hello@nextmonth.io</a>. You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">14. Contact Us</h2>
            <p className="text-white/70 leading-relaxed">
              For any questions or concerns about this Privacy Policy, please contact us at:
            </p>
            <p className="text-white/70 leading-relaxed mt-4">
              NextMonth Ltd<br />
              44 Orchard Way<br />
              Banbury, United Kingdom<br />
              OX16 0HA<br />
              Email: <a href="mailto:hello@nextmonth.io" className="text-purple-400 hover:text-purple-300">hello@nextmonth.io</a>
            </p>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/10 bg-black">
        <div className="max-w-4xl mx-auto text-center text-white/50 text-sm">
          © {new Date().getFullYear()} NextMonth Ltd. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
