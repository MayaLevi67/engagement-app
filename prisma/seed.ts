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
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
