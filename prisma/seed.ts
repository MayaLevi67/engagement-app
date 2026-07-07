import { TaskCategory } from '@prisma/client';
import { prisma } from '../lib/db';

type TemplateSeed = {
  id: string;
  title_en: string;
  title_he: string;
  category:
    | 'VENUE'
    | 'CATERING'
    | 'PHOTOGRAPHY'
    | 'MUSIC'
    | 'ATTIRE'
    | 'DESIGN'
    | 'FLOWERS'
    | 'GUESTS'
    | 'CEREMONY'
    | 'PLANNING'
    | 'BUDGET'
    | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueOffsetDays: number | null;
  sortOrder: number;
};

// Default bilingual wedding checklist. Ordered roughly by category, then by
// how far ahead of the wedding the task should typically be tackled.
const templates: TemplateSeed[] = [
  // Planning
  { id: 'tmpl-set-budget', title_en: 'Set the overall wedding budget', title_he: 'לקבוע תקציב כולל לחתונה', category: 'PLANNING', priority: 'HIGH', dueOffsetDays: 400, sortOrder: 10 },
  { id: 'tmpl-set-date', title_en: 'Set the wedding date', title_he: 'לקבוע תאריך לחתונה', category: 'PLANNING', priority: 'HIGH', dueOffsetDays: 395, sortOrder: 20 },

  // Venue
  { id: 'tmpl-venue-book', title_en: 'Book the venue', title_he: 'להזמין אולם לחתונה', category: 'VENUE', priority: 'HIGH', dueOffsetDays: 365, sortOrder: 30 },
  { id: 'tmpl-venue-visit', title_en: 'Tour and compare venues', title_he: 'לסייר ולהשוות בין אולמות', category: 'VENUE', priority: 'MEDIUM', dueOffsetDays: 340, sortOrder: 40 },
  { id: 'tmpl-venue-contract', title_en: 'Sign the venue contract', title_he: 'לחתום על חוזה עם האולם', category: 'VENUE', priority: 'HIGH', dueOffsetDays: 330, sortOrder: 50 },

  // Catering
  { id: 'tmpl-catering-book', title_en: 'Book catering services', title_he: 'להזמין שירותי קייטרינג', category: 'CATERING', priority: 'HIGH', dueOffsetDays: 300, sortOrder: 60 },
  { id: 'tmpl-catering-tasting', title_en: 'Schedule a menu tasting', title_he: 'לתאם טעימת תפריט', category: 'CATERING', priority: 'MEDIUM', dueOffsetDays: 200, sortOrder: 70 },
  { id: 'tmpl-catering-cake', title_en: 'Order the wedding cake', title_he: 'להזמין עוגת חתונה', category: 'CATERING', priority: 'MEDIUM', dueOffsetDays: 60, sortOrder: 80 },
  { id: 'tmpl-catering-dietary', title_en: "Collect guests' dietary restrictions", title_he: 'לאסוף מידע על הגבלות תזונה של האורחים', category: 'CATERING', priority: 'LOW', dueOffsetDays: 45, sortOrder: 90 },

  // Photography
  { id: 'tmpl-photo-book', title_en: 'Book a photographer', title_he: 'להזמין צלם/ת לחתונה', category: 'PHOTOGRAPHY', priority: 'HIGH', dueOffsetDays: 270, sortOrder: 100 },
  { id: 'tmpl-video-book', title_en: 'Book a videographer', title_he: 'להזמין צלם/ת וידאו', category: 'PHOTOGRAPHY', priority: 'MEDIUM', dueOffsetDays: 270, sortOrder: 110 },
  { id: 'tmpl-engagement-shoot', title_en: 'Schedule an engagement photo shoot', title_he: 'לתאם צילומי אירוסין', category: 'PHOTOGRAPHY', priority: 'LOW', dueOffsetDays: 180, sortOrder: 120 },
  { id: 'tmpl-photo-shotlist', title_en: 'Prepare a must-have shot list', title_he: 'להכין רשימת תמונות חובה', category: 'PHOTOGRAPHY', priority: 'LOW', dueOffsetDays: 30, sortOrder: 130 },

  // Music
  { id: 'tmpl-music-band', title_en: 'Book a band or DJ', title_he: 'להזמין להקה או תקליטן/ית', category: 'MUSIC', priority: 'HIGH', dueOffsetDays: 250, sortOrder: 140 },
  { id: 'tmpl-music-firstdance', title_en: 'Choose the first dance song', title_he: 'לבחור שיר לריקוד הראשון', category: 'MUSIC', priority: 'LOW', dueOffsetDays: 60, sortOrder: 150 },
  { id: 'tmpl-music-ceremony', title_en: 'Choose ceremony music', title_he: 'לבחור מוזיקה לטקס', category: 'MUSIC', priority: 'LOW', dueOffsetDays: 45, sortOrder: 160 },

  // Attire
  { id: 'tmpl-attire-dress', title_en: 'Buy the wedding dress', title_he: 'לרכוש שמלת כלה', category: 'ATTIRE', priority: 'HIGH', dueOffsetDays: 200, sortOrder: 170 },
  { id: 'tmpl-attire-suit', title_en: "Buy or rent the groom's suit", title_he: 'לרכוש או לשכור חליפת חתן', category: 'ATTIRE', priority: 'HIGH', dueOffsetDays: 150, sortOrder: 180 },
  { id: 'tmpl-attire-rings', title_en: 'Buy the wedding rings', title_he: 'לרכוש טבעות נישואין', category: 'ATTIRE', priority: 'HIGH', dueOffsetDays: 90, sortOrder: 190 },
  { id: 'tmpl-attire-shoes', title_en: 'Choose shoes and accessories', title_he: 'לבחור נעליים ואביזרים', category: 'ATTIRE', priority: 'LOW', dueOffsetDays: 60, sortOrder: 200 },
  { id: 'tmpl-attire-fitting', title_en: 'Schedule dress fittings', title_he: 'לתאם מדידות לשמלה', category: 'ATTIRE', priority: 'MEDIUM', dueOffsetDays: 45, sortOrder: 210 },

  // Design
  { id: 'tmpl-design-theme', title_en: 'Choose wedding theme and colors', title_he: 'לבחור קונספט וצבעים לחתונה', category: 'DESIGN', priority: 'MEDIUM', dueOffsetDays: 300, sortOrder: 220 },
  { id: 'tmpl-design-invitations', title_en: 'Design the wedding invitations', title_he: 'לעצב הזמנות לחתונה', category: 'DESIGN', priority: 'MEDIUM', dueOffsetDays: 90, sortOrder: 230 },
  { id: 'tmpl-design-favors', title_en: 'Choose guest favors', title_he: 'לבחור מתנות לאורחים', category: 'DESIGN', priority: 'LOW', dueOffsetDays: 45, sortOrder: 240 },
  { id: 'tmpl-design-signage', title_en: 'Design signage and table numbers', title_he: 'לעצב שילוט ומספרי שולחנות', category: 'DESIGN', priority: 'LOW', dueOffsetDays: 30, sortOrder: 250 },

  // Flowers
  { id: 'tmpl-flowers-book', title_en: 'Book a florist', title_he: 'להזמין מעצב/ת פרחים', category: 'FLOWERS', priority: 'MEDIUM', dueOffsetDays: 150, sortOrder: 260 },
  { id: 'tmpl-flowers-bouquet', title_en: 'Choose the bridal bouquet style', title_he: 'לבחור סגנון זר לכלה', category: 'FLOWERS', priority: 'LOW', dueOffsetDays: 60, sortOrder: 270 },
  { id: 'tmpl-flowers-centerpieces', title_en: 'Choose table centerpieces', title_he: 'לבחור סידורי פרחים לשולחנות', category: 'FLOWERS', priority: 'LOW', dueOffsetDays: 60, sortOrder: 280 },

  // Guests
  { id: 'tmpl-guests-list-draft', title_en: 'Draft the guest list', title_he: 'להכין טיוטת רשימת מוזמנים', category: 'GUESTS', priority: 'HIGH', dueOffsetDays: 350, sortOrder: 290 },
  { id: 'tmpl-guests-invitations-send', title_en: 'Send invitations to guests', title_he: 'לשלוח הזמנות לאורחים', category: 'GUESTS', priority: 'HIGH', dueOffsetDays: 60, sortOrder: 300 },
  { id: 'tmpl-guests-accommodations', title_en: 'Arrange lodging for out-of-town guests', title_he: 'לארגן לינה לאורחים מחוץ לעיר', category: 'GUESTS', priority: 'LOW', dueOffsetDays: 60, sortOrder: 310 },
  { id: 'tmpl-guests-rsvp-track', title_en: 'Track RSVPs', title_he: 'לעקוב אחר אישורי הגעה', category: 'GUESTS', priority: 'MEDIUM', dueOffsetDays: 30, sortOrder: 320 },
  { id: 'tmpl-guests-headcount-final', title_en: 'Confirm final headcount', title_he: 'לאשר מספר אורחים סופי', category: 'GUESTS', priority: 'HIGH', dueOffsetDays: 14, sortOrder: 330 },
  { id: 'tmpl-guests-seating', title_en: 'Prepare the seating arrangements', title_he: 'להכין סידורי הושבה', category: 'GUESTS', priority: 'MEDIUM', dueOffsetDays: 14, sortOrder: 340 },

  // Ceremony
  { id: 'tmpl-ceremony-officiant', title_en: 'Book an officiant / rabbi', title_he: 'להזמין רב/ה או עורך/ת טקס', category: 'CEREMONY', priority: 'HIGH', dueOffsetDays: 200, sortOrder: 350 },
  { id: 'tmpl-ceremony-license', title_en: 'Handle marriage registration', title_he: 'לטפל ברישום הנישואין', category: 'CEREMONY', priority: 'HIGH', dueOffsetDays: 90, sortOrder: 360 },
  { id: 'tmpl-ceremony-vows', title_en: 'Write personal vows', title_he: 'לכתוב נדרים אישיים', category: 'CEREMONY', priority: 'LOW', dueOffsetDays: 21, sortOrder: 370 },
  { id: 'tmpl-ceremony-rehearsal', title_en: 'Schedule the ceremony rehearsal', title_he: 'לתאם חזרה גנרלית לטקס', category: 'CEREMONY', priority: 'MEDIUM', dueOffsetDays: 7, sortOrder: 380 },

  // Budget
  { id: 'tmpl-budget-track', title_en: 'Track expenses against the budget', title_he: 'לעקוב אחר ההוצאות מול התקציב', category: 'BUDGET', priority: 'MEDIUM', dueOffsetDays: 200, sortOrder: 390 },
  { id: 'tmpl-budget-vendor-payments', title_en: 'Schedule final vendor payments', title_he: 'לתזמן תשלומים סופיים לספקים', category: 'BUDGET', priority: 'HIGH', dueOffsetDays: 14, sortOrder: 400 },
  { id: 'tmpl-budget-tipping', title_en: 'Prepare gratuities for vendors', title_he: 'להכין תשרים לספקים', category: 'BUDGET', priority: 'LOW', dueOffsetDays: 7, sortOrder: 410 },

  // Other
  { id: 'tmpl-other-honeymoon', title_en: 'Book the honeymoon trip', title_he: 'להזמין את ירח הדבש', category: 'OTHER', priority: 'MEDIUM', dueOffsetDays: 120, sortOrder: 420 },
  { id: 'tmpl-other-emergency-kit', title_en: 'Prepare a wedding-day emergency kit', title_he: 'להכין ערכת חירום ליום החתונה', category: 'OTHER', priority: 'LOW', dueOffsetDays: 3, sortOrder: 430 },
  { id: 'tmpl-other-thankyou', title_en: 'Prepare thank-you cards for guests', title_he: 'להכין גלויות תודה לאורחים', category: 'OTHER', priority: 'LOW', dueOffsetDays: null, sortOrder: 440 },
];

type ElementSeed = {
  title_en: string;
  title_he: string;
  description_en: string;
  description_he: string;
  category:
    | 'VENUE' | 'CATERING' | 'PHOTOGRAPHY' | 'MUSIC' | 'ATTIRE' | 'DESIGN'
    | 'FLOWERS' | 'GUESTS' | 'CEREMONY' | 'PLANNING' | 'BUDGET' | 'OTHER';
  estCostMin: number | null;
  estCostMax: number | null;
  sortOrder: number;
};

type ConceptSeed = {
  id: string;
  title_en: string;
  title_he: string;
  tagline_en: string;
  tagline_he: string;
  description_en: string;
  description_he: string;
  palette: string[];
  isPremium: boolean;
  sortOrder: number;
  images: { url: string; alt_en: string; alt_he: string; sortOrder: number }[];
  elements: ElementSeed[];
};

const concepts: ConceptSeed[] = [
  {
    id: 'concept-party-time',
    title_en: 'Party Time',
    title_he: 'מסיבה בלי סוף',
    tagline_en: 'Dance floor first, everything else second',
    tagline_he: 'רחבת ריקודים במרכז, כל השאר מסביב',
    description_en: 'A high-energy celebration built around the music and the crowd — two DJs, bold lighting, and a late-night set that keeps everyone dancing.',
    description_he: 'חגיגה אנרגטית שנבנית סביב המוזיקה והקהל — שני תקליטנים, תאורה נועזת וסט אחרי-חצות שמשאיר את כולם על הרחבה.',
    palette: ['#1C1C1C', '#E4007C', '#00E0FF', '#FFD400'],
    isPremium: false,
    sortOrder: 10,
    images: [
      { url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819', alt_en: 'Wedding dance floor at night', alt_he: 'רחבת ריקודים בחתונה בלילה', sortOrder: 0 },
    ],
    elements: [
      { title_en: 'Two DJs — mainstream + techno after-party', title_he: 'שני תקליטנים — מיינסטרים ואפטר טכנו', description_en: 'One DJ for the main set, a second for the late-night techno after-party.', description_he: 'תקליטן אחד לסט המרכזי, שני לאפטר טכנו של אחרי חצות.', category: 'MUSIC', estCostMin: 6000, estCostMax: 14000, sortOrder: 10 },
      { title_en: 'Extra party lighting & effects', title_he: 'תאורת מסיבה ואפקטים', description_en: 'Moving heads, lasers and haze to turn the room into a club.', description_he: 'ראשים נעים, לייזרים ועשן שהופכים את החלל למועדון.', category: 'DESIGN', estCostMin: 4000, estCostMax: 9000, sortOrder: 20 },
      { title_en: 'Sunglasses station for the techno set', title_he: 'עמדת משקפי שמש לסט הטכנו', description_en: 'A styled station of sunglasses guests grab for the after-party.', description_he: 'עמדה מעוצבת של משקפי שמש שהאורחים לוקחים לאפטר.', category: 'OTHER', estCostMin: 800, estCostMax: 2000, sortOrder: 30 },
    ],
  },
  {
    id: 'concept-italian-summer',
    title_en: 'Italian Summer',
    title_he: 'קיץ איטלקי',
    tagline_en: 'Lemons, linen and golden light',
    tagline_he: 'לימונים, פשתן ואור זהוב',
    description_en: 'A sun-drenched garden celebration — long linen tables, citrus and olive branches, and a relaxed al-fresco feast.',
    description_he: 'חגיגה בגן שטופת שמש — שולחנות פשתן ארוכים, ענפי הדרים וזית, וסעודה נינוחה בחוץ.',
    palette: ['#FFFFFF', '#6E8B3D', '#E7B10A', '#F2E8CF'],
    isPremium: true,
    sortOrder: 20,
    images: [
      { url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed', alt_en: 'Outdoor garden wedding table', alt_he: 'שולחן חתונה בגן פתוח', sortOrder: 0 },
    ],
    elements: [
      { title_en: 'Long linen banquet tables', title_he: 'שולחנות בנקט ארוכים מפשתן', description_en: 'Family-style seating on long tables with natural linen.', description_he: 'ישיבה משפחתית סביב שולחנות ארוכים עם פשתן טבעי.', category: 'DESIGN', estCostMin: 5000, estCostMax: 12000, sortOrder: 10 },
      { title_en: 'Citrus & olive branch centerpieces', title_he: 'מרכזי שולחן מהדרים וענפי זית', description_en: 'Lemons, olive branches and wildflowers down the table.', description_he: 'לימונים, ענפי זית ופרחי בר לאורך השולחן.', category: 'FLOWERS', estCostMin: 3000, estCostMax: 8000, sortOrder: 20 },
      { title_en: 'Al-fresco antipasti table', title_he: 'שולחן אנטיפסטי בחוץ', description_en: 'A grazing table of Italian antipasti as guests arrive.', description_he: 'שולחן אנטיפסטי איטלקי לקבלת הפנים.', category: 'CATERING', estCostMin: 4000, estCostMax: 10000, sortOrder: 30 },
    ],
  },
  {
    id: 'concept-old-money',
    title_en: 'Old Money',
    title_he: 'אלגנטיות קלאסית',
    tagline_en: 'Timeless, heirloom, effortlessly grand',
    tagline_he: 'נצחי, מסורתי, מפואר בטבעיות',
    description_en: 'Understated luxury — heirloom details, a muted palette and classic florals for a wedding that feels inherited, not bought.',
    description_he: 'יוקרה מאופקת — פרטים מסורתיים, פלטה עמומה ופרחים קלאסיים לחתונה שמרגישה מורשת, לא קנויה.',
    palette: ['#7A1F2B', '#C9A227', '#F5F0E6', '#1F3D2B'],
    isPremium: true,
    sortOrder: 30,
    images: [
      { url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6', alt_en: 'Elegant classic wedding setup', alt_he: 'הפקת חתונה קלאסית ואלגנטית', sortOrder: 0 },
    ],
    elements: [
      { title_en: 'Classic string quartet for the ceremony', title_he: 'רביעיית מיתרים קלאסית לטקס', description_en: 'A live string quartet during the ceremony and reception.', description_he: 'רביעיית מיתרים חיה בטקס ובקבלת הפנים.', category: 'MUSIC', estCostMin: 4000, estCostMax: 9000, sortOrder: 10 },
      { title_en: 'Monochrome white florals in silver', title_he: 'פרחים לבנים מונוכרומטיים בכלי כסף', description_en: 'White roses and peonies in polished silver vessels.', description_he: 'ורדים ואדמוניות לבנות בכלי כסף מלוטשים.', category: 'FLOWERS', estCostMin: 6000, estCostMax: 15000, sortOrder: 20 },
      { title_en: 'Engraved heirloom-style stationery', title_he: 'הזמנות מודפסות בסגנון מסורתי', description_en: 'Letterpress invitations and place cards with monogram.', description_he: 'הזמנות בהדפס בלט וכרטיסי מקום עם מונוגרמה.', category: 'DESIGN', estCostMin: 2000, estCostMax: 6000, sortOrder: 30 },
    ],
  },
  {
    id: 'concept-modern-luxury',
    title_en: 'Modern Luxury',
    title_he: 'יוקרה מודרנית',
    tagline_en: 'Architectural, refined, unforgettable',
    tagline_he: 'אדריכלי, מוקפד, בלתי נשכח',
    description_en: 'Clean lines, statement florals and a monochrome palette punctuated by metallic accents — a wedding that feels like a private gallery opening.',
    description_he: 'קווים נקיים, פרחים סטייטמנט ופלטה מונוכרומטית עם נגיעות מטאליות — חתונה שמרגישה כמו פתיחת גלריה פרטית.',
    palette: ['#E8E8E8', '#C9A227', '#FFFFFF', '#1C1C1C'],
    isPremium: true,
    sortOrder: 40,
    images: [
      { url: 'https://images.unsplash.com/photo-1522413452208-996ff3f3e740', alt_en: 'Modern minimalist wedding table', alt_he: 'שולחן חתונה מודרני מינימליסטי', sortOrder: 0 },
    ],
    elements: [
      { title_en: 'Monochrome white orchids in tall glass', title_he: 'סחלבים לבנים בכלי זכוכית גבוהים', description_en: 'Monochrome white orchids and anthurium in tall glass vessels.', description_he: 'סחלבים לבנים ואנתוריום בכלי זכוכית גבוהים.', category: 'FLOWERS', estCostMin: 7000, estCostMax: 16000, sortOrder: 10 },
      { title_en: 'Sculptural installations & acrylic signage', title_he: 'מיצבים פיסוליים ושילוט אקרילי', description_en: 'Sculptural installations, acrylic signage and taper candles in brass holders.', description_he: 'מיצבים פיסוליים, שילוט אקרילי ונרות בכלי פליז.', category: 'DESIGN', estCostMin: 5000, estCostMax: 13000, sortOrder: 20 },
      { title_en: 'Sleek minimalist gown', title_he: 'שמלה מינימליסטית מוקפדת', description_en: 'A sleek minimalist gown with architectural lines.', description_he: 'שמלה מינימליסטית עם קווים אדריכליים.', category: 'ATTIRE', estCostMin: 8000, estCostMax: 25000, sortOrder: 30 },
    ],
  },
];

const budgetBaseline: { category: TaskCategory; defaultPercent: number; sortOrder: number }[] = [
  { category: 'VENUE', defaultPercent: 20, sortOrder: 10 },
  { category: 'CATERING', defaultPercent: 25, sortOrder: 20 },
  { category: 'PHOTOGRAPHY', defaultPercent: 10, sortOrder: 30 },
  { category: 'MUSIC', defaultPercent: 10, sortOrder: 40 },
  { category: 'ATTIRE', defaultPercent: 8, sortOrder: 50 },
  { category: 'DESIGN', defaultPercent: 7, sortOrder: 60 },
  { category: 'FLOWERS', defaultPercent: 6, sortOrder: 70 },
  { category: 'GUESTS', defaultPercent: 4, sortOrder: 80 },
  { category: 'CEREMONY', defaultPercent: 3, sortOrder: 90 },
  { category: 'PLANNING', defaultPercent: 3, sortOrder: 100 },
  { category: 'BUDGET', defaultPercent: 0, sortOrder: 110 },
  { category: 'OTHER', defaultPercent: 4, sortOrder: 120 },
];

type VendorSeed = {
  id: string;
  name_en: string; name_he: string;
  description_en: string; description_he: string;
  category: TaskCategory;
  city: string;
  priceMin: number; priceMax: number;
  email: string; phone: string; website: string;
  verified: boolean; isPremium: boolean; sortOrder: number;
  images: { url: string; alt_en: string; alt_he: string; sortOrder: number }[];
};

const vendors: VendorSeed[] = [
  {
    id: 'vendor-lumiere-photo', name_en: 'Lumière Photography', name_he: 'לומייר צילום',
    description_en: 'Fine-art wedding photography with a timeless, editorial style.',
    description_he: 'צילום חתונות אמנותי בסגנון עריכתי ונצחי.',
    category: 'PHOTOGRAPHY', city: 'Tel Aviv', priceMin: 8000, priceMax: 18000,
    email: 'hello@lumiere.example', phone: '+972500000001', website: 'https://lumiere.example',
    verified: true, isPremium: true, sortOrder: 10,
    images: [{ url: 'https://images.unsplash.com/photo-1519741497674-611481863552', alt_en: 'Wedding couple portrait', alt_he: 'פורטרט של זוג חתונה', sortOrder: 0 }],
  },
  {
    id: 'vendor-groove-dj', name_en: 'Groove DJ Collective', name_he: 'גרוב תקליטנים',
    description_en: 'High-energy DJs for the main set and a late-night after-party.',
    description_he: 'תקליטנים אנרגטיים לסט המרכזי ולאפטר של אחרי חצות.',
    category: 'MUSIC', city: 'Tel Aviv', priceMin: 5000, priceMax: 12000,
    email: 'book@groove.example', phone: '+972500000002', website: 'https://groove.example',
    verified: true, isPremium: false, sortOrder: 20,
    images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819', alt_en: 'DJ at a wedding party', alt_he: 'תקליטן במסיבת חתונה', sortOrder: 0 }],
  },
  {
    id: 'vendor-olive-catering', name_en: 'Olive & Thyme Catering', name_he: 'זית ותימין קייטרינג',
    description_en: 'Seasonal Mediterranean menus and grazing tables.',
    description_he: 'תפריטים ים-תיכוניים עונתיים ושולחנות גרייזינג.',
    category: 'CATERING', city: 'Jerusalem', priceMin: 12000, priceMax: 40000,
    email: 'events@olive.example', phone: '+972500000003', website: 'https://olive.example',
    verified: false, isPremium: false, sortOrder: 30,
    images: [{ url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288', alt_en: 'Catering grazing table', alt_he: 'שולחן גרייזינג', sortOrder: 0 }],
  },
  {
    id: 'vendor-bloom-florals', name_en: 'Bloom Room Florals', name_he: 'חדר הפריחה',
    description_en: 'Lush, garden-style florals and installations.',
    description_he: 'עיצובי פרחים גני עשירים ומיצבים.',
    category: 'FLOWERS', city: 'Haifa', priceMin: 4000, priceMax: 15000,
    email: 'studio@bloom.example', phone: '+972500000004', website: 'https://bloom.example',
    verified: true, isPremium: false, sortOrder: 40,
    images: [{ url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed', alt_en: 'Floral centerpiece', alt_he: 'מרכז שולחן פרחוני', sortOrder: 0 }],
  },
];

async function main() {
  for (const t of templates) {
    await prisma.checklistTemplate.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        title_en: t.title_en,
        title_he: t.title_he,
        titleLocale: 'AUTO',
        category: t.category,
        priority: t.priority,
        dueOffsetDays: t.dueOffsetDays,
        active: true,
        sortOrder: t.sortOrder,
      },
      update: {
        title_en: t.title_en,
        title_he: t.title_he,
        titleLocale: 'AUTO',
        category: t.category,
        priority: t.priority,
        dueOffsetDays: t.dueOffsetDays,
        active: true,
        sortOrder: t.sortOrder,
      },
    });
  }

  console.log(`Seeded ${templates.length} checklist templates.`);

  for (const c of concepts) {
    await prisma.concept.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        title_en: c.title_en, title_he: c.title_he, titleLocale: 'AUTO',
        tagline_en: c.tagline_en, tagline_he: c.tagline_he,
        description_en: c.description_en, description_he: c.description_he,
        palette: c.palette, isPremium: c.isPremium, active: true, sortOrder: c.sortOrder,
      },
      update: {
        title_en: c.title_en, title_he: c.title_he, titleLocale: 'AUTO',
        tagline_en: c.tagline_en, tagline_he: c.tagline_he,
        description_en: c.description_en, description_he: c.description_he,
        palette: c.palette, isPremium: c.isPremium, active: true, sortOrder: c.sortOrder,
      },
    });
    // Replace child rows so a re-seed reflects the seed file exactly.
    await prisma.conceptImage.deleteMany({ where: { conceptId: c.id } });
    await prisma.conceptElement.deleteMany({ where: { conceptId: c.id } });
    await prisma.conceptImage.createMany({
      data: c.images.map((im) => ({ conceptId: c.id, ...im })),
    });
    await prisma.conceptElement.createMany({
      data: c.elements.map((el) => ({ conceptId: c.id, titleLocale: 'AUTO', active: true, ...el })),
    });
  }

  console.log(`Seeded ${concepts.length} wedding concepts.`);

  for (const b of budgetBaseline) {
    await prisma.budgetTemplate.upsert({
      where: { category: b.category },
      create: { category: b.category, defaultPercent: b.defaultPercent, active: true, sortOrder: b.sortOrder },
      update: { defaultPercent: b.defaultPercent, active: true, sortOrder: b.sortOrder },
    });
  }
  console.log(`Seeded ${budgetBaseline.length} budget baseline rows.`);

  for (const v of vendors) {
    const { images, ...fields } = v;
    await prisma.vendor.upsert({
      where: { id: v.id },
      create: { ...fields, titleLocale: 'AUTO', active: true },
      update: { ...fields, titleLocale: 'AUTO', active: true },
    });
    await prisma.vendorImage.deleteMany({ where: { vendorId: v.id } });
    await prisma.vendorImage.createMany({ data: images.map((im) => ({ vendorId: v.id, ...im })) });
  }
  console.log(`Seeded ${vendors.length} vendors.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
