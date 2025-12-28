import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const LOGO_URL = "/logo.png";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <img src={LOGO_URL} alt="NextMonth" className="h-10 cursor-pointer" />
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
        <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-white/50 mb-12">Last updated: December 2024</p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">1. Introduction</h2>
            <p className="text-white/70 leading-relaxed">
              This Cookie Policy explains how NextMonth Ltd ("we", "us", or "our"), company number 16464586, uses cookies and similar technologies when you visit the NextMonth platform. This policy should be read alongside our <Link href="/privacy" className="text-purple-400 hover:text-purple-300">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">2. What Are Cookies?</h2>
            <p className="text-white/70 leading-relaxed">
              Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently, provide a better user experience, and give website owners useful information about how their site is being used.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">3. Types of Cookies We Use</h2>
            
            <h3 className="text-xl font-medium mb-3 text-white/90">3.1 Strictly Necessary Cookies</h3>
            <p className="text-white/70 leading-relaxed">
              These cookies are essential for the website to function properly. They enable core functionality such as security, authentication, and session management. You cannot opt out of these cookies.
            </p>
            <div className="bg-white/5 rounded-lg p-4 mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-white/90">Cookie</th>
                    <th className="text-left py-2 text-white/90">Purpose</th>
                    <th className="text-left py-2 text-white/90">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-white/70">
                  <tr className="border-b border-white/5">
                    <td className="py-2">connect.sid</td>
                    <td className="py-2">Session authentication</td>
                    <td className="py-2">Session</td>
                  </tr>
                  <tr>
                    <td className="py-2">csrf_token</td>
                    <td className="py-2">Security protection</td>
                    <td className="py-2">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-medium mb-3 mt-8 text-white/90">3.2 Functional Cookies</h3>
            <p className="text-white/70 leading-relaxed">
              These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings. If you disable these cookies, some features may not work properly.
            </p>
            <div className="bg-white/5 rounded-lg p-4 mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-white/90">Cookie</th>
                    <th className="text-left py-2 text-white/90">Purpose</th>
                    <th className="text-left py-2 text-white/90">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-white/70">
                  <tr className="border-b border-white/5">
                    <td className="py-2">theme</td>
                    <td className="py-2">Remember display preferences</td>
                    <td className="py-2">1 year</td>
                  </tr>
                  <tr>
                    <td className="py-2">universe_id</td>
                    <td className="py-2">Remember selected story</td>
                    <td className="py-2">30 days</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-medium mb-3 mt-8 text-white/90">3.3 Analytics Cookies</h3>
            <p className="text-white/70 leading-relaxed">
              These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our service.
            </p>
            <div className="bg-white/5 rounded-lg p-4 mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-white/90">Cookie</th>
                    <th className="text-left py-2 text-white/90">Purpose</th>
                    <th className="text-left py-2 text-white/90">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-white/70">
                  <tr>
                    <td className="py-2">_analytics</td>
                    <td className="py-2">Usage analytics</td>
                    <td className="py-2">2 years</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-medium mb-3 mt-8 text-white/90">3.4 Third-Party Cookies</h3>
            <p className="text-white/70 leading-relaxed">
              Some cookies are set by third-party services that appear on our pages:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li><strong>Stripe:</strong> For secure payment processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">4. Managing Cookies</h2>
            <p className="text-white/70 leading-relaxed">
              You can control and manage cookies in various ways:
            </p>

            <h3 className="text-xl font-medium mb-3 mt-6 text-white/90">4.1 Browser Settings</h3>
            <p className="text-white/70 leading-relaxed">
              Most browsers allow you to refuse or accept cookies through their settings. The following links provide instructions for common browsers:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li><a href="https://support.google.com/chrome/answer/95647" className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
            </ul>

            <h3 className="text-xl font-medium mb-3 mt-6 text-white/90">4.2 Opt-Out Links</h3>
            <p className="text-white/70 leading-relaxed">
              You can opt out of certain third-party cookies using industry opt-out tools:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li><a href="https://optout.aboutads.info" className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">Digital Advertising Alliance</a></li>
              <li><a href="https://www.youronlinechoices.com" className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">Your Online Choices (EU)</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">5. Consequences of Disabling Cookies</h2>
            <p className="text-white/70 leading-relaxed">
              If you choose to disable cookies, some parts of our website may not function properly. In particular:
            </p>
            <ul className="list-disc list-inside text-white/70 space-y-2 mt-4">
              <li>You may not be able to log in or stay logged in</li>
              <li>Your preferences may not be remembered</li>
              <li>Some features may be unavailable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">6. Updates to This Policy</h2>
            <p className="text-white/70 leading-relaxed">
              We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated revision date. We encourage you to review this policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">7. Contact Us</h2>
            <p className="text-white/70 leading-relaxed">
              If you have any questions about our use of cookies, please contact us at:
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
