export type EchoResponse = {
  title: string;
  summary: string;
  bullets?: string[];
  link?: { label: string; url: string };
  chips?: string[];
  sourceId?: string;
  contentType?: "service" | "proof" | "page" | "topic" | "person" | "action";
};

export type EchoContext = {
  brandName?: string;
  itemLabel?: string;
  itemType?: string;
  itemText?: string;
  pageUrl?: string;
};

function inferContentType(title: string, itemText?: string, pageUrl?: string): EchoResponse["contentType"] {
  const t = (itemText || "").trim();
  if (pageUrl) return "page";
  if (t.length === 0 && title.split(" ").length <= 6) return "proof";
  if (t.length > 0 && t.length < 80 && title.split(" ").length <= 6) return "proof";
  return "topic";
}

function sanitiseToOneOrTwoSentences(text: string, title: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const titleLower = title.toLowerCase().trim();
  
  const filtered = sentences.filter(s => {
    const sLower = s.toLowerCase().trim();
    return sLower !== titleLower && !sLower.startsWith(titleLower);
  });
  
  if (filtered.length === 0) {
    return sentences.slice(0, 2).join(' ').trim();
  }
  
  return filtered.slice(0, 2).join(' ').trim();
}

function buildFallbackSummary(args: {
  title: string;
  itemText?: string;
  brandName?: string;
  itemType: EchoResponse["contentType"];
}): string {
  const brand = args.brandName || "this team";
  const text = (args.itemText || "").trim();
  const titleLower = args.title.toLowerCase().trim();
  
  if (text && text.length > 10 && text.toLowerCase().trim() !== titleLower) {
    const sanitised = sanitiseToOneOrTwoSentences(text, args.title);
    if (sanitised && sanitised.toLowerCase().trim() !== titleLower && sanitised.length > 10) {
      return sanitised;
    }
  }
  
  if (args.itemType === "proof") {
    return `${args.title} is a key outcome ${brand} focuses on. Tell me what matters most to you and I'll point you to the most relevant information.`;
  }
  
  if (args.itemType === "page") {
    return `This links to a page with more detail. I can summarise it here, or you can open it directly.`;
  }
  
  if (args.itemType === "person") {
    return `I can tell you more about this person's role and how they can help.`;
  }
  
  if (args.itemType === "action") {
    return `This is an action you can take. Would you like me to help you get started?`;
  }
  
  if (args.itemType === "topic") {
    return `${args.title} is something ${brand} can help with. Tell me what you're looking for and I'll guide you to the right information.`;
  }
  
  return `I can explain what "${args.title}" means in practice and what to do next.`;
}

function buildDefaultChips(title: string, brandName?: string): string[] {
  const brand = brandName || "the team";
  return [
    "Tell me more",
    `How does ${brand} help?`,
    "What should I do next?"
  ];
}

export function normaliseEchoResponse(
  input: Partial<EchoResponse>,
  ctx: EchoContext
): EchoResponse {
  const title = (input.title || ctx.itemLabel || "Details").trim();
  
  let summary = (input.summary || "").trim();
  
  if (!summary || summary.length < 10) {
    const contentType = input.contentType || inferContentType(title, ctx.itemText, ctx.pageUrl);
    summary = buildFallbackSummary({
      title,
      itemText: ctx.itemText,
      brandName: ctx.brandName,
      itemType: contentType,
    });
  }
  
  return {
    title,
    summary,
    bullets: input.bullets?.filter(Boolean),
    link: input.link,
    chips: input.chips?.filter(Boolean) || buildDefaultChips(title, ctx.brandName),
    sourceId: input.sourceId,
    contentType: input.contentType || inferContentType(title, ctx.itemText, ctx.pageUrl),
  };
}

export function ensureMessageBody(message: string, ctx: EchoContext): string {
  const trimmed = message.trim();
  
  if (trimmed.length >= 20) {
    return trimmed;
  }
  
  const title = ctx.itemLabel || trimmed || "Details";
  const contentType = inferContentType(title, ctx.itemText, ctx.pageUrl);
  const fallback = buildFallbackSummary({
    title,
    itemText: ctx.itemText,
    brandName: ctx.brandName,
    itemType: contentType,
  });
  
  if (trimmed && trimmed !== fallback) {
    return `${trimmed}\n\n${fallback}`;
  }
  
  return fallback;
}

export function dedupeText(text: string): string {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    if (normalized.length < 3) {
      deduped.push(line);
      continue;
    }
    
    let isDupe = false;
    const seenArray = Array.from(seen);
    for (let i = 0; i < seenArray.length; i++) {
      if (similarity(normalized, seenArray[i]) > 0.85) {
        isDupe = true;
        break;
      }
    }
    
    if (!isDupe) {
      seen.add(normalized);
      deduped.push(line);
    }
  }
  
  return deduped.join('\n');
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const wordsA = a.split(' ');
  const wordsB = b.split(' ');
  const setB = new Set(wordsB);
  const intersection = wordsA.filter(x => setB.has(x));
  const unionSet = new Set(wordsA.concat(wordsB));
  
  return intersection.length / unionSet.size;
}

export function echoStyleGuard(text: string): string {
  let result = text;
  
  result = result.replace(/\b([A-Z]{2,}(?:\s+[A-Z]{2,})*)\b/g, (match) => {
    const acronyms = ['API', 'UK', 'USA', 'CEO', 'CTO', 'FAQ', 'PDF', 'URL', 'TLS', 'SSL', 'VAT', 'ROI', 'B2B', 'B2C'];
    if (acronyms.includes(match)) return match;
    
    if (match.length <= 4) return match;
    
    return match.split(' ')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  });
  
  const roboticPhrases = [
    /What would you like to explore about\s*["']?[^"'?]*["']?\??/gi,
    /What would you like to know about\s*["']?[^"'?]*["']?\??/gi,
    /Would you like to learn more about\s*["']?[^"'?]*["']?\??/gi,
    /Is there anything else you'd like to know\??/gi,
    /Let me know if you have any questions\.?/gi,
    /Feel free to ask if you have any questions\.?/gi,
    /I'm here to help with any questions\.?/gi,
    /I'd be happy to help\.?/gi,
    /Great question!/gi,
    /That's a great question!/gi,
  ];
  
  for (const pattern of roboticPhrases) {
    result = result.replace(pattern, '').trim();
  }
  
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/^\s+|\s+$/g, '');
  
  return result;
}

export function formatEchoResponse(
  title: string,
  summary: string,
  options?: {
    bullets?: string[];
    link?: { label: string; url: string };
    chips?: string[];
  }
): string {
  const parts: string[] = [];
  
  const cleanTitle = echoStyleGuard(title);
  if (cleanTitle && cleanTitle !== summary.slice(0, cleanTitle.length)) {
    parts.push(cleanTitle);
  }
  
  if (summary) {
    parts.push(summary);
  }
  
  if (options?.bullets && options.bullets.length > 0) {
    const bulletList = options.bullets.slice(0, 4).map(b => `• ${b}`).join('\n');
    parts.push(bulletList);
  }
  
  if (options?.link) {
    parts.push(`${options.link.label}: ${options.link.url}`);
  }
  
  return dedupeText(parts.join('\n\n'));
}
