import { Card } from "@/lib/mockData";

interface SiteIdentity {
  sourceDomain: string;
  title: string | null;
  heroHeadline: string | null;
  heroDescription: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  primaryColour: string;
  serviceHeadings: string[];
  serviceBullets: string[];
  faqCandidates: string[];
}

export interface PreviewTarget {
  type: 'overview' | 'service' | 'faq' | 'lead' | 'why';
  id?: string;
  label?: string;
}

function getBestImage(identity: SiteIdentity): string {
  if (identity.heroImageUrl) return identity.heroImageUrl;
  if (identity.logoUrl) return identity.logoUrl;
  if (identity.faviconUrl) return identity.faviconUrl;
  return `https://placehold.co/1080x1920/1a1a2e/7c3aed?text=${encodeURIComponent(identity.sourceDomain)}`;
}

export function adaptPreviewToCards(
  identity: SiteIdentity,
  siteTitle: string | null,
  target?: PreviewTarget
): Card[] {
  const brandName = identity.title?.split(' - ')[0]?.split(' | ')[0] || siteTitle?.split(' - ')[0] || identity.sourceDomain;
  const description = identity.heroDescription || '';
  const sentences = description.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 15);
  const heroImage = getBestImage(identity);

  if (!target || target.type === 'overview') {
    return [
      {
        id: 'preview-identity',
        dayIndex: 1,
        title: brandName,
        image: heroImage,
        captions: [
          `Welcome to ${brandName}`,
          sentences[0] || 'Discover what we offer',
          sentences[1] || 'Your journey starts here',
        ],
        sceneText: description || `Learn more about ${brandName} and how we can help you.`,
        recapText: brandName,
        publishDate: new Date().toISOString(),
      }
    ];
  }

  if (target.type === 'service') {
    const serviceHeading = target.label || identity.serviceHeadings[0] || 'Our Services';
    const relatedBullet = identity.serviceBullets.find(b => 
      b.toLowerCase().includes(serviceHeading.toLowerCase().split(' ')[0])
    ) || identity.serviceBullets[0];
    
    return [
      {
        id: `preview-service-${target.id}`,
        dayIndex: 2,
        title: serviceHeading,
        image: heroImage,
        captions: [
          serviceHeading,
          relatedBullet || 'Expert solutions tailored to you',
          'Designed for real results',
        ],
        sceneText: relatedBullet || `Learn more about ${serviceHeading} and how it can benefit you.`,
        recapText: serviceHeading,
        publishDate: new Date().toISOString(),
      }
    ];
  }

  if (target.type === 'faq') {
    const question = target.label || identity.faqCandidates[0] || 'Common Questions';
    return [
      {
        id: `preview-faq-${target.id}`,
        dayIndex: 3,
        title: 'A question you might have',
        image: heroImage,
        captions: [
          'You might be wondering...',
          question,
          'Let us explain',
        ],
        sceneText: question,
        recapText: question,
        publishDate: new Date().toISOString(),
      }
    ];
  }

  if (target.type === 'why') {
    const whyHeading = identity.serviceHeadings.find(h => 
      /why|about|approach|difference|values|mission/i.test(h)
    ) || 'Why Choose Us';
    
    return [
      {
        id: 'preview-why',
        dayIndex: 4,
        title: whyHeading,
        image: heroImage,
        captions: [
          'What makes us different',
          whyHeading,
          sentences[2] || 'Results you can trust',
        ],
        sceneText: sentences[2] || `Discover why ${brandName} is the right choice for you.`,
        recapText: whyHeading,
        publishDate: new Date().toISOString(),
      }
    ];
  }

  if (target.type === 'lead') {
    return [
      {
        id: 'preview-lead',
        dayIndex: 5,
        title: 'Ready to get started?',
        image: heroImage,
        captions: [
          'Your next step',
          `Activate your Smart Site`,
          'Keep the conversation going',
        ],
        sceneText: `Claim this Smart Site to keep it live and capture the leads it uncovers.`,
        recapText: 'Get Started',
        publishDate: new Date().toISOString(),
      }
    ];
  }

  return [];
}

export function getTargetsFromIdentity(identity: SiteIdentity): PreviewTarget[] {
  const targets: PreviewTarget[] = [
    { type: 'overview', id: 'overview', label: 'Overview' }
  ];

  identity.serviceHeadings.slice(0, 4).forEach((heading, i) => {
    targets.push({ type: 'service', id: `service-${i}`, label: heading });
  });

  const whyHeading = identity.serviceHeadings.find(h => 
    /why|about|approach|difference|values|mission/i.test(h)
  );
  if (whyHeading) {
    targets.push({ type: 'why', id: 'why', label: whyHeading });
  }

  identity.faqCandidates.slice(0, 3).forEach((faq, i) => {
    targets.push({ type: 'faq', id: `faq-${i}`, label: faq });
  });

  targets.push({ type: 'lead', id: 'lead', label: 'Get Started' });

  return targets;
}
