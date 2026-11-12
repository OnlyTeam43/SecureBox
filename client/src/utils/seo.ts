// client/src/utils/seo.ts
// Centralized SEO metadata, canonical URLs, Open Graph, Twitter Cards, and JSON-LD Schema helpers
// Ensures exact synchronization between visible page content and search engine structured data.

export type SeoRouteKey = 'home' | 'securebox' | 'dropbox';

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export const SITE_ORIGIN = 'https://thesecurebox.vercel.app';

export const SECUREBOX_FAQS: SeoFaqItem[] = [
  {
    question: 'What is SecureBox and how does the Brick Smash game disguise work?',
    answer:
      'SecureBox is a zero-knowledge end-to-end encrypted messaging web app and Android APK hidden behind a fully playable retro Brick Smash arcade game. To anyone glancing at your phone or browser tab, it looks and plays like an arcade brick breaker. Entering your local Hub PIN unlocks your private encrypted chat rooms, and switching tabs or going idle automatically locks back to the game.',
  },
  {
    question: 'Does SecureBox store my messages or encryption keys on a server?',
    answer:
      'No. All messages and photos are encrypted client-side in your browser or phone using WebCrypto AES-GCM 256-bit encryption with PBKDF2-SHA256 (100,000 iterations) derived from your shared room secret. Servers never receive your plaintext messages, Hub PIN, or room secret key, and rooms expire automatically after 24 hours unless extended.',
  },
  {
    question: 'How do I download and install the SecureBox Android APK?',
    answer:
      'You can download the official standalone SecureBox.apk directly from the SecureBox page at /Securebox without creating a store account. Tap Download SecureBox.apk (approximately 54 MB), open the downloaded APK file on Android 8.0 or newer, and tap Install.',
  },
  {
    question: 'Can I send files, videos, or links between devices without logging in?',
    answer:
      'Yes. SecureBox includes a dedicated browser-based encrypted QuickDrop page at /dropbox. You can upload photos, videos, PDFs, documents, links, and text notes behind a custom numeric pickup code and retrieve them on any phone or computer without signing into WhatsApp, email, or cloud drives.',
  },
];

export const DROPBOX_FAQS: SeoFaqItem[] = [
  {
    question: 'Do I need an account or login to use SecureBox QuickDrop?',
    answer:
      'No login, email, phone number, or account creation is required. You choose a numeric pickup code, drop your files, links, or text notes directly in your browser, and enter that same code on any other phone, laptop, or public computer to decrypt and retrieve them.',
  },
  {
    question: 'How are uploaded files, links, and text notes encrypted?',
    answer:
      'Everything is encrypted inside your browser before leaving your device using WebCrypto AES-256-GCM authenticated encryption and a key derived from your numeric pickup code via PBKDF2-SHA256 (100,000 iterations). Only someone holding your exact numeric code can decrypt the files or links.',
  },
  {
    question: 'How long do files and links stay before automatic deletion?',
    answer:
      'Every SecureBox QuickDrop bundle enforces a strict 7-day automatic deletion timer so nothing stays online permanently. You can also keep Burn After Retrieval enabled so the cloud copy is permanently erased immediately after the recipient downloads all files or copies the note.',
  },
  {
    question: 'What file types, sizes, and link formats are supported?',
    answer:
      'You can batch-upload multiple images, videos, PDFs, Word documents, spreadsheets, ZIP archives, and text files (up to 15 MB per file and 35 MB total per bundle), plus paste up to 100,000 characters of links and text notes. Retrieved http and https URLs are automatically detected into one-tap Open and Copy buttons.',
  },
  {
    question: 'Why use SecureBox QuickDrop instead of logging into WhatsApp Web or Gmail on a shared PC?',
    answer:
      'Signing into personal WhatsApp Web, Google Drive, or email on a print shop, library, school, or friend’s computer risks leaving active sessions behind. SecureBox QuickDrop lets you grab a single document, photo, or link using only a temporary numeric code—zero account exposure and instant burn cleanup.',
  },
];

interface RouteSeoConfig {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  ogType: string;
  ogImage: string;
  ogImageAlt: string;
  structuredData: Record<string, unknown>;
}

export const ROUTE_SEO_CONFIG: Record<SeoRouteKey, RouteSeoConfig> = {
  home: {
    title: 'Brick Smash Arcade — SecureBox Disguised Encrypted Chat & QuickDrop',
    description:
      'Play Brick Smash retro arcade disguise to access SecureBox zero-knowledge AES-256-GCM encrypted rooms, or open SecureBox QuickDrop at /dropbox to send files, links, and text without login.',
    keywords:
      'SecureBox, Brick Smash disguise, encrypted chat app, anonymous file transfer, zero login quickdrop, SecureBox QuickDrop, AES-256-GCM private chat',
    canonicalUrl: `${SITE_ORIGIN}/`,
    ogType: 'website',
    ogImage: `${SITE_ORIGIN}/mockups/mockup-game.jpg`,
    ogImageAlt: 'Brick Smash retro arcade disguise interface for SecureBox',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'SecureBox',
          url: `${SITE_ORIGIN}/`,
          description:
            'Disguised zero-knowledge encrypted chat application and anonymous browser-based QuickDrop.',
        },
        {
          '@type': 'Organization',
          name: 'SecureBox',
          url: `${SITE_ORIGIN}/`,
          logo: `${SITE_ORIGIN}/mockups/mockup-game.jpg`,
        },
      ],
    },
  },
  securebox: {
    title: 'SecureBox — Disguised Encrypted Chat App & Private Vault APK',
    description:
      'Download SecureBox Android APK & web vault. Zero-knowledge AES-256-GCM encrypted private chat disguised as a Brick Smash arcade game with 24-hour auto-destruct and anonymous QuickDrop.',
    keywords:
      'SecureBox, SecureBox APK, SecureBox app, disguised secret chat app, encrypted messenger without phone number, zero knowledge chat, self destructing chat rooms, stealth brick smash vault, AES-256-GCM encrypted messaging',
    canonicalUrl: `${SITE_ORIGIN}/Securebox`,
    ogType: 'website',
    ogImage: `${SITE_ORIGIN}/mockups/mockup-chat.jpg`,
    ogImageAlt: 'SecureBox disguised encrypted vault messenger and mobile app showcase',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          name: 'SecureBox',
          alternateName: 'SecureBox Vault & Brick Smash Disguise',
          url: `${SITE_ORIGIN}/Securebox`,
          downloadUrl: `${SITE_ORIGIN}/securebox.apk`,
          applicationCategory: 'SecurityApplication',
          operatingSystem: 'Android, Web',
          softwareVersion: '1.0.0',
          fileSize: '54MB',
          description:
            'Zero-knowledge AES-256-GCM encrypted chat messenger disguised inside a playable Brick Smash arcade game with 24-hour ephemeral rooms, idle auto-lock, and sandboxed isolation.',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          featureList: [
            'Brick Smash retro arcade game camouflage',
            'Client-side WebCrypto AES-GCM 256-bit encryption',
            'PBKDF2-SHA256 100,000-iteration key derivation',
            '24-hour ephemeral rooms with instant wipe on both devices',
            'Auto-lock disguise on tab switch or 60-second idle',
            'Direct Android APK download (~54 MB)',
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: SECUREBOX_FAQS.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: `${SITE_ORIGIN}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'SecureBox',
              item: `${SITE_ORIGIN}/Securebox`,
            },
          ],
        },
      ],
    },
  },
  dropbox: {
    title: 'SecureBox QuickDrop — Anonymous File, Link, Text & Chrome Extension Transfer',
    description:
      'Send photos, videos, PDFs, links, and text between phone and laptop without logging in. Client-side AES-256 encrypted pickup code, burn-after-retrieval, and 7-day auto-delete.',
    keywords:
      'SecureBox QuickDrop, QuickDrop Chrome extension, send files without login, anonymous file transfer, temporary file sharing 7 day auto delete, share links between phone and laptop without login, numeric code file pickup, encrypted file drop, burn after download file sharing',
    canonicalUrl: `${SITE_ORIGIN}/dropbox`,
    ogType: 'website',
    ogImage: `${SITE_ORIGIN}/mockups/mockup-hub.jpg`,
    ogImageAlt: 'SecureBox QuickDrop zero-login encrypted file, link, and text transfer',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebApplication',
          name: 'SecureBox QuickDrop',
          alternateName: 'QuickDrop Anonymous Media, Links & Text Shuttle',
          url: `${SITE_ORIGIN}/dropbox`,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Any (Web Browser — Windows, macOS, Android, iOS, Linux)',
          browserRequirements: 'Modern web browser with WebCrypto API',
          description:
            'Browser-based zero-login encrypted transfer shuttle for sending multiple images, videos, documents, URLs, and text notes across devices using a numeric pickup code with 7-day auto-delete and burn-on-retrieval.',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          featureList: [
            'Zero login, zero signup, zero WhatsApp or email exposure',
            'Multiple file batch upload (images, videos, PDFs, docs, archives)',
            'Encrypted URL links and text note transfer up to 100,000 characters',
            'Custom or generated numeric pickup code with AES-256-GCM encryption',
            'Strict 7-day automatic expiry plus optional Burn After Retrieval',
          ],
        },
        {
          '@type': 'HowTo',
          name: 'How to Send Files, Links, and Text Without Logging In',
          description:
            'Transfer media, documents, URLs, and notes across devices securely using a numeric pickup code.',
          step: [
            {
              '@type': 'HowToStep',
              position: 1,
              name: 'Add files, links, or text',
              text: 'Select multiple images, videos, or documents, or paste URLs and text notes into SecureBox QuickDrop.',
            },
            {
              '@type': 'HowToStep',
              position: 2,
              name: 'Set your numeric pickup code',
              text: 'Keep the generated 6-digit code or enter your own custom numeric code. Your browser encrypts everything locally with AES-256-GCM.',
            },
            {
              '@type': 'HowToStep',
              position: 3,
              name: 'Retrieve and auto-burn on any device',
              text: 'Open /dropbox on the target device, enter the numeric code to decrypt locally, copy links or download files, and optionally burn the cloud copy immediately.',
            },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: DROPBOX_FAQS.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: `${SITE_ORIGIN}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'SecureBox',
              item: `${SITE_ORIGIN}/Securebox`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: 'QuickDrop',
              item: `${SITE_ORIGIN}/dropbox`,
            },
          ],
        },
      ],
    },
  },
};

function upsertMetaTag(
  selector: string,
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLd(data: Record<string, unknown>): void {
  const id = 'route-structured-data';
  let script = document.head.querySelector<HTMLScriptElement>(`script#${id}`);
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/**
 * Synchronizes document title, meta description/keywords, canonical URL,
 * Open Graph, Twitter Card, and JSON-LD structured data for the active route.
 */
export function applyRouteSeo(route: SeoRouteKey): void {
  if (typeof document === 'undefined') return;
  const cfg = ROUTE_SEO_CONFIG[route];

  document.title = cfg.title;
  upsertCanonical(cfg.canonicalUrl);
  upsertMetaTag('meta[name="description"]', 'name', 'description', cfg.description);
  upsertMetaTag('meta[name="keywords"]', 'name', 'keywords', cfg.keywords);
  upsertMetaTag(
    'meta[name="robots"]',
    'name',
    'robots',
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  );

  upsertMetaTag('meta[property="og:type"]', 'property', 'og:type', cfg.ogType);
  upsertMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'SecureBox');
  upsertMetaTag('meta[property="og:title"]', 'property', 'og:title', cfg.title);
  upsertMetaTag('meta[property="og:description"]', 'property', 'og:description', cfg.description);
  upsertMetaTag('meta[property="og:url"]', 'property', 'og:url', cfg.canonicalUrl);
  upsertMetaTag('meta[property="og:image"]', 'property', 'og:image', cfg.ogImage);
  upsertMetaTag('meta[property="og:image:alt"]', 'property', 'og:image:alt', cfg.ogImageAlt);

  upsertMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', cfg.title);
  upsertMetaTag(
    'meta[name="twitter:description"]',
    'name',
    'twitter:description',
    cfg.description
  );
  upsertMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', cfg.ogImage);

  upsertJsonLd(cfg.structuredData);
}
