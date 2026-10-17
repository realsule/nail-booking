/* ==========================================================================
   Mrembo Nails — PUBLIC SITE CONFIGURATION
   --------------------------------------------------------------------------
   👑 OWNER: this is the only file you need to edit to personalise the site.
   Everything here is loaded into index.html automatically — no HTML editing.

   If the Supabase admin dashboard is configured, anything saved from
   admin.html → Settings is stored in Supabase and *overrides* these values
   at run time. This file then acts as the sensible fallback.

   ⚠ NEVER put passwords, the Supabase service-role key, or any private
   secret in this file. It ships to every visitor's browser.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ----------------------------------------------------------------
     Sample photography (Unsplash). Swap these URLs for the owner's
     own photos any time — or better, upload real work in admin.html.
     ---------------------------------------------------------------- */
  var U = 'https://images.unsplash.com/';
  var Q = 'auto=format&fit=crop&w=1100&q=80';
  function pic(id) { return U + id + '?' + Q; }

  /* ----------------------------------------------------------------
     The short "do this before launch" checklist (mirrored in README).
     ---------------------------------------------------------------- */
  var WHAT_TO_CONFIGURE = [
    'config.js → DEFAULT_SETTINGS.whatsappNumber (2547XXXXXXXX, no spaces, no +)',
    'config.js → DEFAULT_SETTINGS.instagramUsername (your real Instagram handle)',
    'admin.html — create your owner account in Supabase (see README step 5)',
    'index.html / admin.html → edit supabase.js with your Supabase URL + anon key',
    'Run supabase-setup.sql once in the Supabase SQL editor (tables + policies)',
    'Create the public "nail-photos" storage bucket (see README step 6)',
    'admin.html → Gallery: upload your own nail photos, publish your favourites',
    'admin.html → Services: adjust names, starting prices (KSh) and add-ons',
    'admin.html → Settings: business name, logo, areas, hours, booking note',
    'config.js → sample Unsplash photos in pics can be replaced with your own'
  ];

  /* ----------------------------------------------------------------
     Business identity & copy. Everything public can read these.
     ---------------------------------------------------------------- */
  var DEFAULT_SETTINGS = {
    businessName: 'Mrembo Nails',
    heroBadge: 'House Calls Available',
    heroHeadline: 'Your Nails. Your Mood. Your Moment.',
    heroDescription: 'Luxury nail experiences, delivered to your doorstep.',
    heroImage: pic('photo-1487412947147-5cebf100ffc2'),
    technicianImage: pic('photo-1599948128020-9a44505b0d1b'),
    metaDescription:
      'Luxury mobile nail services in Nairobi — gel, acrylic, French tips, ' +
      'bridal sets and nail art at your door. Book on WhatsApp today.',
    heroCtaPrimaryLabel: 'Book on WhatsApp',
    heroCtaSecondaryLabel: 'Explore Nail Designs',
    heroFromLabel: 'From',                 // shown before the cheapest service price
    heroFromCaption: 'Manicure & gel sets',
    showHeroFrom: true,                    // hide if you'd rather not show prices in hero

    // -- section headings (the public page uses these instantly) --
    servicesSectionTitle: 'Choose Your Ritual',
    servicesSectionSub:
      'Every service is a small ritual. Pick a set below — the final quote ' +
      'depends on length, design and add-ons.',
    gallerySectionTitle: 'The Inspiration Wall',
    gallerySectionSub: 'Real sets from the studio — saved, styled and ready for your feed.',
    bookingSectionTitle: 'Reserve Your Moment',
    houseSectionTitle: 'Beauty Comes to You',
    housePhotoTag: 'We come to you — all of it.',

    // -- bottom promo band --
    ctaBandTitle: 'Ready for your next set?',
    ctaBandSubtitle: 'DM or WhatsApp your inspiration today — I’ll handle the artistry.',
    showCtaBand: true,

    // -- toggle whole sections on the public page --
    showGallerySection: true,
    showHouseCallSection: true,

    // -- footer sign-off (the sentence AFTER "© year Brand"; {year} & {brand} tokens work here too) --
    footerNote: ' · Nail artistry in Kenya · Appointments confirmed by the artist via WhatsApp/Instagram',

    // 👑 CONFIGURE: international format WITHOUT '+', spaces or a leading 0.
    // e.g. 0712 345 678 → '254712345678'. Leave '' until launch is ready.
    whatsappNumber: '254739394636',

    instagramUsername: 'mrembo.nails', // 👑 CONFIGURE (no @ needed)
    logoUrl: '', // optional image logo; blank = elegant text logo

    studioLocation: 'Kilimani, Nairobi',
    houseCallAreas: 'Kilimani; Kileleshwa; Westlands; Lavington; Karen; Riverside',
    houseCallDescription:
      'No traffic, no queues — a full nail session in the comfort of your ' +
      'living room. I bring a sterilised kit, lamp, colours and a fold-out ' +
      'setup, and leave your space exactly as I found it.',
    transportFee: 'KSh 300 within the service areas below; agreed before the visit.',
    businessHours: 'Mon–Sat 9:00 AM – 7:00 PM · Sun 11:00 AM – 5:00 PM',

    bookingInstructions:
      'Pick a service, choose your date & time, and send the ready-made ' +
      'WhatsApp message. Prices below are starting rates — your final quote ' +
      'depends on length, design and add-ons.',
    bookingDisclaimer:
      'Sending a WhatsApp message does not automatically confirm an appointment. ' +
      'The nail artist confirms availability and the final price by reply.'
  };

  /* ----------------------------------------------------------------
     Categories (keep in sync with the Supabase table CHECK constraints)
     ---------------------------------------------------------------- */
  var SERVICE_CATEGORIES = ['Gel', 'Acrylic', 'French Tips', 'Natural Nails', 'Nail Art'];
  var GALLERY_CATEGORIES = ['Nude Nails', 'Pink Nails', 'French Tips', 'Chrome', 'Acrylic', 'Bridal', 'Nail Art'];

  /* ----------------------------------------------------------------
     Starter services (the single source of all starting prices = KSh). The admin dashboard
     replaces these with live records once services exist in Supabase.
     ---------------------------------------------------------------- */
  var DEFAULT_SERVICES = [
    {
      name: 'Classic Manicure',
      category: 'Natural Nails',
      price: 800,
      duration: '45–60 min',
      description: 'Prep, shaping, cuticle care, buff and a glossy polish finish on your natural nails.',
      addons: [
        { label: 'Hand & cuticle oil treatment', price: 150 },
        { label: 'French tip on natural nails', price: 200 }
      ],
      cover_url: pic('photo-1604654894610-df63bc536371'),
      featured: false, enabled: true, sort_order: 1
    },
    {
      name: 'Gel Nails',
      category: 'Gel',
      price: 1200,
      duration: '60–90 min',
      description: 'Chip-resistant gel colour cured to a glass shine that lasts two to three weeks.',
      addons: [
        { label: 'Chrome powder finish', price: 300 },
        { label: 'Gel removal (soak-off)', price: 200 },
        { label: 'Nail repair (per nail)', price: 100 }
      ],
      cover_url: pic('photo-1610992015732-2449b76344bc'),
      featured: true, enabled: true, sort_order: 2
    },
    {
      name: 'Acrylic Extensions',
      category: 'Acrylic',
      price: 1500,
      duration: '2–2.5 hrs',
      description: 'Custom length & shape — almond, coffin, square — sculpted strong and lightweight.',
      addons: [
        { label: 'Extra-long length', price: 300 },
        { label: 'Ombré / baby-boomer blend', price: 400 },
        { label: 'Gel top coat upgrade', price: 200 }
      ],
      cover_url: pic('photo-1522337660859-02fbefca4702'),
      featured: true, enabled: true, sort_order: 3
    },
    {
      name: 'French Tips',
      category: 'French Tips',
      price: 1200,
      duration: '1.5–2 hrs',
      description: 'The classic — crisp tips with a modern twist: colour tips, micro-French or chrome.',
      addons: [
        { label: 'Coloured tips', price: 200 },
        { label: 'Chrome tips', price: 300 },
        { label: 'Micro-French (thin line)', price: 250 }
      ],
      cover_url: pic('photo-1457972729786-0411a3b2b626'),
      featured: false, enabled: true, sort_order: 4
    },
    {
      name: 'Custom Nail Art',
      category: 'Nail Art',
      price: 1500,
      duration: '2+ hrs',
      description: 'Hand-painted florals, marble, charms and packaging inspired by your mood board.',
      addons: [
        { label: 'Hand-painted design (per nail)', price: 100 },
        { label: '3D charms / pearls (per nail)', price: 150 },
        { label: 'Full-set chrome effect', price: 250 }
      ],
      cover_url: pic('photo-1522335789203-aabd1fc54bc9'),
      featured: false, enabled: true, sort_order: 5
    },
    {
      name: 'House-Call Nail Service',
      category: '', // no category chip → appears under "All" and in the booking list
      price: 1500,
      duration: 'At your home',
      description: 'The full salon setup at your door — manicure, gel or acrylic, anywhere in the areas below.',
      addons: [
        { label: 'Gel colour upgrade', price: 400 },
        { label: 'Pedicure add-on', price: 700 }
      ],
      cover_url: pic('photo-1519014816548-bf5fe059798b'),
      featured: true, enabled: true, sort_order: 6
    }
  ];

  /* ----------------------------------------------------------------
     Starter gallery — 14 built-in designs across all 7 categories.
     Uploaded owner photos (published=true in Supabase) appear ABOVE these.
     ---------------------------------------------------------------- */
  var g = function (title, category, description, id, featured) {
    return {
      title: title,
      category: category,
      description: description,
      image_url: pic(id),
      source: 'external', // inspiration links, not stored in the owner's bucket
      featured: !!featured,
      storage_path: null,
      published: true
    };
  };
  var DEFAULT_GALLERY = [
    g('Sweet Nude Set', 'Nude Nails', 'Milky nude, the quiet-luxury classic.', 'photo-1604654894610-df63bc536371', true),
    g('Rosy Nude Blush', 'Nude Nails', 'Soft rosy nude with a clean oval shape.', 'photo-1457972729786-0411a3b2b626'),
    g('Everyday Polish', 'Nude Nails', 'A glossy, office-ready natural finish.', 'photo-1519699047748-de8e457a634e'),
    g('Soft Blush Pink', 'Pink Nails', 'Candy pink with a glass-gel shine.', 'photo-1610992015732-2449b76344bc', true),
    g('Rosé All Day', 'Pink Nails', 'Playful pink set with a high-shine finish.', 'photo-1522093537031-3ee69e6b1746'),
    g('Parisian French', 'French Tips', 'The timeless white-tip French.', 'photo-1519014816548-bf5fe059798b', true),
    g('Modern French Fade', 'French Tips', 'A soft baby-boomer fade instead of a hard tip.', 'photo-1607779097040-26e80aa78e66'),
    g('Mirror Chrome', 'Chrome', 'Liquid-metal chrome over a pink base.', 'photo-1581338834647-b0fb40704e21'),
    g('Pearly Chrome', 'Chrome', 'Glazed pearl chrome — the viral doughnut finish.', 'photo-1522335789203-aabd1fc54bc9', true),
    g('Long Acrylic Glam', 'Acrylic', 'Sculpted long acrylics with a glossy top.', 'photo-1522337660859-02fbefca4702'),
    g('Blush Acrylic Set', 'Acrylic', 'Blush-toned acrylics, almond shaped.', 'photo-1595476108010-b4d1f102b1b1'),
    g('Bridal Blush', 'Bridal', 'Soft bridal set with delicate accents.', 'photo-1515377905703-c4788e51af15'),
    g('Bespoke Nail Art', 'Nail Art', 'One-of-one hand-painted art on a nude base.', 'photo-1487412947147-5cebf100ffc2'),
    g('Golden Hour Art', 'Nail Art', 'Warm, minimal accents for a statement set.', 'photo-1599948128020-9a44505b0d1b', true)
  ];

  global.SITE = {
    WHAT_TO_CONFIGURE: WHAT_TO_CONFIGURE,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    SERVICE_CATEGORIES: SERVICE_CATEGORIES,
    GALLERY_CATEGORIES: GALLERY_CATEGORIES,
    DEFAULT_SERVICES: DEFAULT_SERVICES,
    DEFAULT_GALLERY: DEFAULT_GALLERY
  };
})(window);
