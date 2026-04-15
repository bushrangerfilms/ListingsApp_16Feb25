/**
 * Render Brochure Preview
 *
 * Generates a PDF from the ClassicBrochureTemplate with sample data,
 * then converts it to PNG images for visual review.
 *
 * Usage:
 *   npx tsx scripts/render-brochure.tsx
 *
 * Output:
 *   /tmp/brochure-preview.pdf
 *   /tmp/brochure-pages/*.png (one per page)
 */

import React from 'react';
import { renderToFile } from '@react-pdf/renderer';
import { execSync } from 'child_process';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { ClassicBrochureTemplate } from '@/components/brochure/templates/ClassicBrochureTemplate';
import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import { DEFAULT_STYLE_OPTIONS } from '@/lib/brochure/types';

// Resolve local fixture images (avoids network fetch timeouts)
// Use absolute path to avoid import.meta issues in CJS bundles
const FIXTURES = resolve(process.cwd(), 'scripts', 'fixtures');
const img = (name: string) => `${FIXTURES}/${name}.png`;

// ── Sample Data (matches Pat Gannon / Glenvale listing from screenshots) ──

const sampleContent: BrochureContent = {
  cover: {
    headline: '58 Glenvale, Ballyragget, Kilkenny',
    address: '58 Glenvale, Ballyragget, Kilkenny, R95 E298',
    price: '\u20AC275,000',
    saleMethod: 'For Sale by Private Treaty',
    heroPhotoUrl: img('hero'),
    energyRating: 'C2',
  },
  description: {
    marketingText:
      'Presenting a fantastic opportunity to acquire a well-proportioned 3-bedroom detached residence in the heart of Ballyragget, Kilkenny. Extending to a generous c. 1,332 sq. ft. (124 m\u00B2), this home offers a versatile layout across two floors, featuring a spacious kitchen/dining area, a bright sitting room, and three generous bedrooms, including an ensuite.\nOffered as a blank canvas, the property has been stripped back internally, allowing the new owner to infuse their personal style and finish to a high standard. Beautifully positioned overlooking a large green area, it enjoys pleasant countryside views while being just a short stroll from local shops, schools, and essential village amenities.',
    keyFeatures: [
      'Detached 3-bed family home',
      'Overlooking large green area',
      'Excellent village centre location',
      'Scope to finish to own taste',
      'Generous 1,332 sq. ft. (124 m\u00B2)',
      'Gas fired central heating',
    ],
  },
  rooms: [
    {
      id: 'r1',
      name: 'Entrance Hallway',
      floor: 'Ground Floor',
      dimensions: "6'3 x 21'6 (1.92m x 6.5m)",
      description: 'Carpet stairwell to first floor, plumbed for washing machine.',
      photoUrl: img('hallway'),
    },
    {
      id: 'r2',
      name: 'Kitchen',
      floor: 'Ground Floor',
      dimensions: "15'5 x 9'4 (4.7m x 2.9m)",
      description: 'Units at floor and eye level, oven, hob, extractor, dishwasher, gas boiler.',
      photoUrl: img('kitchen'),
    },
    {
      id: 'r3',
      name: 'Dining Area',
      floor: 'Ground Floor',
      dimensions: "11'10 x 13'9 (3.4m x 4.2m)",
      description: 'Patio doors to rear garden, French doors to sitting room.',
      photoUrl: img('dining'),
    },
    {
      id: 'r4',
      name: 'Sitting Room',
      floor: 'Ground Floor',
      dimensions: "18'5 x 13'6 (5.6m x 4.1m)",
      description: 'Cast iron open fireplace with timber surround, French doors to dining.',
      photoUrl: img('sitting'),
    },
    {
      id: 'r5',
      name: 'Guest Toilet',
      floor: 'Ground Floor',
      dimensions: "4'7 x 4'2 (1.4m x 1.3m)",
      description: 'WHB & WC, tiled floor for convenience.',
      photoUrl: img('wc'),
    },
    {
      id: 'r6',
      name: 'Landing',
      floor: 'First Floor',
      dimensions: "9'4 x 9'6 (2.9m x 2.92m)",
      description: 'Carpet flooring, hotpress, access to attic space.',
      photoUrl: img('landing'),
    },
    {
      id: 'r7',
      name: 'Main Bathroom',
      floor: 'First Floor',
      dimensions: "7' x 5'9 (2.1m x 1.5m)",
      description: 'WHB, WC and Bath, vinyl flooring.',
      photoUrl: img('bathroom'),
    },
    {
      id: 'r8',
      name: 'Bedroom 1',
      floor: 'First Floor',
      dimensions: "13'10 x 12'9 (4m x 3.9m)",
      description: 'Spacious bedroom with T&G timber flooring.',
      photoUrl: img('bed1'),
    },
    {
      id: 'r9',
      name: 'Ensuite Bathroom',
      floor: 'First Floor',
      dimensions: "7'05 x 7'08 (2.1m x 2.2m)",
      description: 'WHB, WC and Shower with Triton T90z.',
      photoUrl: img('ensuite'),
    },
    {
      id: 'r10',
      name: 'Bedroom 2',
      floor: 'First Floor',
      dimensions: "15' x 10'4 (4.6m x 3.2m)",
      description: 'Generous second bedroom with carpet flooring.',
      photoUrl: img('bed2'),
    },
    {
      id: 'r11',
      name: 'Bedroom 3',
      floor: 'First Floor',
      dimensions: "11'6 x 9'4 (3.5m x 2.9m)",
      description: 'Comfortable third bedroom with T&G flooring.',
      photoUrl: img('bed3'),
    },
  ],
  features: {
    services: ['Gas fired central heating', 'Mains water', 'Mains sewerage'],
    external: ['Detached property', 'Overlooking large green area', 'Countryside views', 'Rear garden access'],
    nearby: ['Village shops', 'Local schools', 'Amenities within walking distance', 'Kilkenny City (17km)'],
  },
  location: {
    text: 'Ballyragget is a charming village situated just 17km north of Kilkenny City, offering a peaceful rural setting with excellent connectivity. This home in Glenvale benefits from being within a short walk of all essential village amenities, including shops and schools.',
    amenities: [],
  },
  floorPlans: [],
  gallery: [
    { id: 'g1', url: img('gallery1'), caption: 'Bright and spacious sitting room' },
    { id: 'g2', url: img('gallery2'), caption: 'Kitchen area ready for customisation' },
    { id: 'g3', url: img('gallery3'), caption: 'One of three generous bedrooms' },
    { id: 'g4', url: img('gallery4'), caption: 'Rear exterior of the property' },
  ],
  legal: {
    disclaimer:
      'While every care has been taken in the preparation of these particulars, and they are believed to be correct, they are not warranted and intending purchasers should satisfy themselves as to the correctness of the information given. All measurements are approximate and are for guidance purposes only. The services, equipment and fittings have not been tested and no warranty is given as to their condition.',
    psrLicenceNumber: '003442',
  },
  visibleSections: {
    cover: true,
    description: true,
    rooms: true,
    features: true,
    location: true,
    gallery: true,
    floorPlans: true,
    legal: true,
  },
  sectionOrder: ['cover', 'description', 'rooms', 'features', 'location', 'gallery', 'floorPlans', 'legal'],
};

const sampleBranding: BrochureBranding = {
  businessName: 'Pat Gannon Auctioneers Ltd',
  logoUrl: null,
  primaryColor: '#1a365d',
  secondaryColor: '#c53030',
  contactName: 'Marie',
  contactEmail: 'marie@gannonauctioneers.com',
  contactPhone: '+353868192059',
  businessAddress: '',
  psrLicenceNumber: '003442',
  locale: 'en-IE',
  currency: 'EUR',
  countryCode: 'IE',
  styleOptions: {
    ...DEFAULT_STYLE_OPTIONS,
  },
};

// ── Render ──

const PDF_PATH = '/tmp/brochure-preview.pdf';
const PNG_DIR = '/tmp/brochure-pages';

async function main() {
  console.log('Rendering brochure PDF...');

  const element = React.createElement(ClassicBrochureTemplate, {
    content: sampleContent,
    branding: sampleBranding,
  });

  await renderToFile(element as any, PDF_PATH);
  console.log(`PDF written to ${PDF_PATH}`);

  // Convert to PNG using pdftoppm (poppler) — one PNG per page
  if (existsSync(PNG_DIR)) {
    rmSync(PNG_DIR, { recursive: true });
  }
  mkdirSync(PNG_DIR, { recursive: true });

  try {
    execSync(`pdftoppm -png -r 200 ${PDF_PATH} ${PNG_DIR}/page`);
    console.log(`PNGs written to ${PNG_DIR}/`);
    const files = execSync(`ls ${PNG_DIR}/*.png 2>/dev/null`).toString().trim().split('\n');
    files.forEach((f) => console.log(`  ${f}`));
  } catch {
    console.log('pdftoppm failed — trying qlmanage fallback...');
    try {
      execSync(`qlmanage -t -s 1200 -o ${PNG_DIR} ${PDF_PATH} 2>/dev/null`);
    } catch {
      console.log(`Open ${PDF_PATH} manually to review.`);
    }
  }
}

main().catch((err) => {
  console.error('Render failed:', err);
  process.exit(1);
});
