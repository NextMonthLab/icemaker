import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const LOGO_URL = "/logo.png";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <img src={LOGO_URL} alt="NextMonth" className="h-8 cursor-pointer" />
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
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-white/50 mb-12">Last updated: December 2024</p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">1. Agreement to Terms</h2>
            <p className="text-white/70 leading-relaxed">
              These Terms of Service ("Terms") constitute a legally binding agreement between you and NextMonth Ltd ("Company", "we", "us", or "our"), company number 16464586, registered at 44 Orchard Way, Banbury, United Kingdom, OX16 0HA, concerning your access to and use of the NextMonth platform and services.
            </p>
            <p className="text-white/70 leading-relaxed mt-4">
              By accessing or using our service, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">2. Description of Service</h2>
            <p className="text-white/70 leading-relaxed">
              NextMonth is a content transformation platform that converts scripts, documents, websites, and other structured content into interactive, cinematic story experiences. Our service includes AI-generated visuals, character chat functionality, and content distribution features.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">3. User Accounts</h2>
            <p className="text-white/70 leading-relaxed">
              To use certain features of our service, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update any changes to your information</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-4">
              You must be at least 13 years old to use our service. If you are under 18, you must have parental consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">4. Subscriptions and Payments</h2>
            <h3 className="text-xl font-medium mb-3 text-white/90">4.1 Billing</h3>
            <p className="text-white/70 leading-relaxed">
              Some features require a paid subscription. By subscribing, you agree to pay the applicable fees. All payments are processed securely through Stripe.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6 text-white/90">4.2 Automatic Renewal</h3>
            <p className="text-white/70 leading-relaxed">
              Subscriptions automatically renew unless cancelled before the renewal date. You can cancel at any time through your account settings.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6 text-white/90">4.3 Refunds</h3>
            <p className="text-white/70 leading-relaxed">
              Refunds are provided at our discretion. Contact us at <a href="mailto:hello@nextmonth.io" className="text-purple-400 hover:text-purple-300">hello@nextmonth.io</a> for refund requests.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">5. User Content</h2>
            <h3 className="text-xl font-medium mb-3 text-white/90">5.1 Your Content</h3>
            <p className="text-white/70 leading-relaxed">
              You retain ownership of content you upload or create using our service. By uploading content, you grant us a license to use, store, and process it to provide our services.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6 text-white/90">5.2 Content Responsibility</h3>
            <p className="text-white/70 leading-relaxed">
              You are solely responsible for the content you upload. You represent that you have all necessary rights to the content and that it does not violate any laws or third-party rights.
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6 text-white/90">5.3 Prohibited Content</h3>
            <p className="text-white/70 leading-relaxed">You agree not to upload content that:</p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li>Infringes intellectual property rights</li>
              <li>Contains illegal, harmful, or offensive material</li>
              <li>Violates privacy or data protection laws</li>
              <li>Contains malware or harmful code</li>
              <li>Impersonates others or is fraudulent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">6. AI-Generated Content</h2>
            <p className="text-white/70 leading-relaxed">
              Our service uses artificial intelligence to generate images, videos, and text. You understand that:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li>AI-generated content may not always be accurate or appropriate</li>
              <li>You are responsible for reviewing and approving AI-generated content before publishing</li>
              <li>We do not guarantee the accuracy, quality, or suitability of AI outputs</li>
              <li>AI-generated content should not be used to deceive or mislead others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">7. Intellectual Property</h2>
            <p className="text-white/70 leading-relaxed">
              The service, including its original content, features, and functionality, is owned by NextMonth Ltd and is protected by copyright, trademark, and other intellectual property laws. Our trademarks may not be used without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">8. Acceptable Use</h2>
            <p className="text-white/70 leading-relaxed">You agree not to:</p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li>Use the service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the service</li>
              <li>Use automated means to access the service without permission</li>
              <li>Resell or redistribute our service without authorization</li>
              <li>Use the service to compete with us</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">9. Termination</h2>
            <p className="text-white/70 leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, for any breach of these Terms. Upon termination, your right to use the service ceases immediately. You may also terminate your account at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">10. Limitation of Liability</h2>
            <p className="text-white/70 leading-relaxed">
              To the maximum extent permitted by law, NextMonth Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use of the service.
            </p>
            <p className="text-white/70 leading-relaxed mt-4">
              Our total liability shall not exceed the amount you paid to us in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">11. Disclaimer of Warranties</h2>
            <p className="text-white/70 leading-relaxed">
              The service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the service will be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">12. Indemnification</h2>
            <p className="text-white/70 leading-relaxed">
              You agree to indemnify and hold harmless NextMonth Ltd and its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">13. Governing Law</h2>
            <p className="text-white/70 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">14. Changes to Terms</h2>
            <p className="text-white/70 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of significant changes by posting a notice on our service or sending you an email. Your continued use of the service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">15. Severability</h2>
            <p className="text-white/70 leading-relaxed">
              If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">16. Contact Us</h2>
            <p className="text-white/70 leading-relaxed">
              For any questions about these Terms, please contact us at:
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
