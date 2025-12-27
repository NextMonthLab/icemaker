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
  imagePool?: string[];
}

export interface PreviewTarget {
  type: 'overview' | 'service' | 'faq' | 'lead' | 'why';
  id?: string;
  label?: string;
  index?: number;
}

function getImageForIndex(identity: SiteIdentity, index: number, useGradientFallback: boolean = false): string {
  if (useGradientFallback) {
    return createGradientPlaceholder(identity.primaryColour, identity.sourceDomain);
  }
  
  const pool = identity.imagePool || [];
  const uniqueImages = Array.from(new Set(pool));
  
  if (uniqueImages.length > 1) {
    return uniqueImages[index % uniqueImages.length];
  }
  
  if (uniqueImages.length === 1 && index === 0) {
    return uniqueImages[0];
  }
  
  if (identity.heroImageUrl && index === 0) {
    return identity.heroImageUrl;
  }
  
  return createGradientPlaceholder(identity.primaryColour, identity.sourceDomain);
}

function createGradientPlaceholder(colour: string, domain: string): string {
  const safeColour = colour.replace('#', '');
  return `https://placehold.co/1080x1920/${safeColour}/ffffff?text=${encodeURIComponent(domain)}`;
}

function truncateHeadline(text: string, maxWords: number = 8): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
}

export function adaptPreviewToCards(
  identity: SiteIdentity,
  siteTitle: string | null,
  target?: PreviewTarget
): Card[] {
  const brandName = identity.title?.split(' - ')[0]?.split(' | ')[0] || siteTitle?.split(' - ')[0] || identity.sourceDomain;
  const description = identity.heroDescription || '';
  const shortDesc = description.split('.')[0]?.trim() || '';
  const targetIndex = target?.index || 0;

  if (!target || target.type === 'overview') {
    return [
      {
        id: 'preview-identity',
        dayIndex: 1,
        title: truncateHeadline(brandName),
        image: getImageForIndex(identity, 0),
        captions: [
          truncateHeadline(shortDesc || `Welcome to ${brandName}`, 10),
        ],
        sceneText: '',
        recapText: brandName,
        publishDate: new Date().toISOString(),
      }
    ];
  }

  if (target.type === 'service') {
    const serviceHeading = truncateHeadline(target.label || identity.serviceHeadings[0] || 'Our Services');
    
    return [
      {
        id: `preview-service-${target.id}`,
        dayIndex: 2,
        title: serviceHeading,
        image: getImageForIndex(identity, targetIndex + 1),
        captions: [serviceHeading],
        sceneText: '',
        recapText: serviceHeading,
        publishDate: new Date().toISOString(),
      }
    ];
  }

  if (target.type === 'faq') {
    const question = truncateHeadline(target.label || identity.faqCandidates[0] || 'Common Questions', 12);
    return [
      {
        id: `preview-faq-${target.id}`,
        dayIndex: 3,
        title: question,
        image: getImageForIndex(identity, targetIndex + 2),
        captions: [question],
        sceneText: '',
        recapText: question,
        publishDate: new Date().toISOString(),
      }
    ];
  }

  if (target.type === 'why') {
    const whyHeading = truncateHeadline(
      identity.serviceHeadings.find(h => /why|about|approach|difference|values|mission/i.test(h)) || 'Why Choose Us'
    );
    
    return [
      {
        id: 'preview-why',
        dayIndex: 4,
        title: whyHeading,
        image: getImageForIndex(identity, targetIndex + 3),
        captions: [whyHeading],
        sceneText: '',
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
        title: 'Ready to start?',
        image: getImageForIndex(identity, targetIndex + 4),
        captions: ['Your next step'],
        sceneText: '',
        recapText: 'Get Started',
        publishDate: new Date().toISOString(),
      }
    ];
  }

  return [];
}

export function getTargetsFromIdentity(identity: SiteIdentity): PreviewTarget[] {
  const targets: PreviewTarget[] = [
    { type: 'overview', id: 'overview', label: 'Overview', index: 0 }
  ];

  identity.serviceHeadings.slice(0, 4).forEach((heading, i) => {
    targets.push({ type: 'service', id: `service-${i}`, label: heading, index: i + 1 });
  });

  const whyHeading = identity.serviceHeadings.find(h => 
    /why|about|approach|difference|values|mission/i.test(h)
  );
  if (whyHeading) {
    targets.push({ type: 'why', id: 'why', label: whyHeading, index: 5 });
  }

  identity.faqCandidates.slice(0, 3).forEach((faq, i) => {
    targets.push({ type: 'faq', id: `faq-${i}`, label: faq, index: 6 + i });
  });

  targets.push({ type: 'lead', id: 'lead', label: 'Get Started', index: 10 });

  return targets;
}
