import { Link } from "wouter";
import { ArrowLeft, Shield, Server, GitBranch, AlertTriangle, Database, Users, ExternalLink } from "lucide-react";

const LOGO_URL = "/logo.png";

const policyLinks = [
  { href: '/policies/information-security', label: 'Information Security Policy' },
  { href: '/policies/access-control', label: 'Access Control Policy' },
  { href: '/policies/change-management', label: 'Change Management Policy' },
  { href: '/policies/incident-response', label: 'Incident Response Policy' },
  { href: '/policies/data-protection-retention', label: 'Data Protection & Retention Policy' },
  { href: '/policies/sub-processors', label: 'Sub-Processors List' },
];

export default function Security() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <img src={LOGO_URL} alt="NextMonth" className="h-20 cursor-pointer" style={{ clipPath: 'inset(30% 0 30% 0)' }} />
          </Link>
          <Link href="/">
            <span className="text-white/60 hover:text-white text-sm flex items-center gap-2 cursor-pointer" data-testid="link-back-home">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-blue-400" />
          <h1 className="text-4xl font-bold" data-testid="heading-security">Security</h1>
        </div>
        <p className="text-lg text-white/70 mb-4">How NextMonth protects your data and supports ISO 27001-aligned workflows.</p>
        <p className="text-white/40 text-sm mb-12">Last updated: January 2026</p>

        <div className="prose prose-invert prose-lg max-w-none space-y-12">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white flex items-center gap-2">
              <span className="text-blue-400">1.</span> Our Approach
            </h2>
            <p className="text-white/70 leading-relaxed mb-4">
              Security is foundational to how we build and operate NextMonth. We follow industry best practices to protect your data and maintain trust.
            </p>
            <ul className="list-none space-y-3 text-white/70">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2.5 shrink-0" />
                <span>Least privilege access — users and systems only have the permissions they need</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2.5 shrink-0" />
                <span>Named accounts — no shared logins</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2.5 shrink-0" />
                <span>Multi-factor authentication (MFA) where supported</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2.5 shrink-0" />
                <span>Secrets stored in environment variables — never in code</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2.5 shrink-0" />
                <span>Auditability via version control and deployment logs</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2.5 shrink-0" />
                <span>Continuous improvement mindset</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-400" />
              <span><span className="text-purple-400">2.</span> Hosting & Infrastructure</span>
            </h2>
            <p className="text-white/70 leading-relaxed mb-4">
              Services are hosted on managed cloud infrastructure using industry-standard encryption in transit and environment-level secret management.
            </p>
            <ul className="list-none space-y-3 text-white/70">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2.5 shrink-0" />
                <span>HTTPS / TLS for all data in transit</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2.5 shrink-0" />
                <span>Environment-based configuration</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2.5 shrink-0" />
                <span>Logical separation between environments where applicable</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2.5 shrink-0" />
                <span>Controlled deployment pipeline</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-green-400" />
              <span><span className="text-green-400">3.</span> Change Management</span>
            </h2>
            <p className="text-white/70 leading-relaxed mb-4">
              All production changes are tracked through version control and deployed through a controlled pipeline.
            </p>
            <ul className="list-none space-y-3 text-white/70">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2.5 shrink-0" />
                <span>Git-based history and traceability</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2.5 shrink-0" />
                <span>Automated deploys from production branch</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2.5 shrink-0" />
                <span>Rollback and remediation supported</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2.5 shrink-0" />
                <span>Emergency changes reviewed retrospectively</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span><span className="text-amber-400">4.</span> Incident Response</span>
            </h2>
            <p className="text-white/70 leading-relaxed mb-4">
              Our incident response process follows established best practices:
            </p>
            <ol className="list-none space-y-3 text-white/70">
              <li className="flex items-start gap-3">
                <span className="text-amber-400 font-mono text-sm mt-0.5 shrink-0">01</span>
                <span>Identify — detect and confirm the incident</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-400 font-mono text-sm mt-0.5 shrink-0">02</span>
                <span>Contain — limit the scope and impact</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-400 font-mono text-sm mt-0.5 shrink-0">03</span>
                <span>Assess impact — determine affected systems and data</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-400 font-mono text-sm mt-0.5 shrink-0">04</span>
                <span>Notify — inform affected parties where appropriate</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-400 font-mono text-sm mt-0.5 shrink-0">05</span>
                <span>Remediate — fix the root cause</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-400 font-mono text-sm mt-0.5 shrink-0">06</span>
                <span>Record and improve — document lessons learned</span>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              <span><span className="text-cyan-400">5.</span> Data Protection & Retention</span>
            </h2>
            <p className="text-white/70 leading-relaxed mb-4">
              Data is processed to deliver the service, retained only as long as necessary, and deletion requests are supported subject to contractual and legal constraints.
            </p>
            <ul className="list-none space-y-3 text-white/70">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2.5 shrink-0" />
                <span>Access restricted to authorised personnel</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2.5 shrink-0" />
                <span>Encryption in transit</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2.5 shrink-0" />
                <span>Retention minimisation</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2.5 shrink-0" />
                <span>Contact for data requests: <a href="mailto:hello@nextmonth.io" className="text-cyan-400 hover:text-cyan-300 transition-colors" data-testid="link-email-data-requests">hello@nextmonth.io</a></span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-pink-400" />
              <span><span className="text-pink-400">6.</span> Sub-processors</span>
            </h2>
            <p className="text-white/70 leading-relaxed">
              We rely on trusted providers for hosting, source control, AI inference, email, and monitoring. We assess providers for their security posture and can share a current list on request. Contact <a href="mailto:hello@nextmonth.io" className="text-pink-400 hover:text-pink-300 transition-colors" data-testid="link-email-subprocessors">hello@nextmonth.io</a> for details.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-2xl font-semibold mb-4 text-white">Policies</h2>
            <p className="text-white/60 text-sm mb-6">
              Full policies are being published. If you need them immediately, email <a href="mailto:hello@nextmonth.io" className="text-blue-400 hover:text-blue-300 transition-colors" data-testid="link-email-policies">hello@nextmonth.io</a>.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {policyLinks.map((policy) => (
                <Link key={policy.href} href={policy.href}>
                  <div className="p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group" data-testid={`link-policy-${policy.href.split('/').pop()}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 group-hover:text-white transition-colors">{policy.label}</span>
                      <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="pt-8 border-t border-white/10">
            <h2 className="text-xl font-semibold mb-3 text-white">Contact for Security Enquiries</h2>
            <p className="text-white/70">
              For security questions, concerns, or to report a vulnerability, please contact us at{' '}
              <a href="mailto:hello@nextmonth.io" className="text-blue-400 hover:text-blue-300 transition-colors" data-testid="link-email-security">hello@nextmonth.io</a>.
            </p>
          </section>
        </div>
      </main>

      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/">
            <span className="text-sm text-white/60 hover:text-foreground transition-colors cursor-pointer" data-testid="link-footer-home">
              Back to NextMonth Home
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-footer-privacy">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors" data-testid="link-footer-terms">Terms</Link>
            <Link href="/cookies" className="hover:text-foreground transition-colors" data-testid="link-footer-cookies">Cookies</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
