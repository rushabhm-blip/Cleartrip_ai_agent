// Fixtures. All properties, prices, inventory and AI claims are demo data.
// Currency is stored as integer rupees. Nothing here is verified travel pricing.

export const img = n => `assets/img/${n}.jpg`;

export const DEMO = {
  destination: 'Hampi',
  start: '2026-11-14',
  end: '2026-11-17',
  nights: 3,
  label: 'Demo plan · sample prices',
};

// Traveller illustrations (assets/chars3, all 14 role assets from Traveller_Group_14_Assets.zip). See js/looks.js for how they are chosen.
// Geometry is in cropped-image pixels (each asset normalised to 720 px tall, feet on one baseline):
//   w = width, cx = head centre, k = uniform scale that equalises shoulder height across assets,
//   ls / rs = shoulder-top rest point on THIS person (screen left / right) where a neighbour's hand lands,
//   lp / rp = this person's own palm contact (raised screen-left / screen-right arm),
//   hl / hr = [x0,y0,x1,y1] hand region (cut into its own foreground layer).
export const ASSETS = {
  solo_male: {"img": "solo_male_01", "w": 254, "cx": 129, "ls": [68, 140], "rs": [190, 140], "k": 1.0, "cl": -1, "cr": 255},
  solo_female: {"img": "solo_female_01", "w": 234, "cx": 115, "ls": [68, 148], "rs": [162, 148], "k": 1.014, "cl": 4, "cr": 230},
  end_male_left: {"img": "ends_male_left", "w": 402, "cx": 127, "ls": [64, 138], "rs": [190, 138], "rp": [379, 167], "hr": [356, 141, 402, 214], "k": 0.997, "cl": 4, "cr": 208},
  end_male_right: {"img": "ends_male_right", "w": 400, "cx": 277, "ls": [215, 140], "rs": [339, 140], "lp": [22, 179], "hl": [0, 153, 46, 226], "k": 1.0, "cl": 194, "cr": 399},
  end_female_left: {"img": "ends_female_left", "w": 411, "cx": 126, "ls": [63, 136], "rs": [189, 136], "rp": [388, 158], "hr": [365, 132, 411, 204], "k": 0.993, "cl": 13, "cr": 206},
  end_female_right: {"img": "ends_female_right", "w": 395, "cx": 270, "ls": [215, 140], "rs": [325, 140], "lp": [22, 182], "hl": [0, 156, 46, 232], "k": 1.0, "cl": 187, "cr": 388},
  mid_male_1: {"img": "middle_male_01", "w": 427, "cx": 214, "ls": [95, 122], "rs": [335, 122], "lp": [22, 156], "rp": [404, 157], "hl": [0, 130, 46, 231], "hr": [381, 131, 427, 233], "k": 0.97, "cl": 126, "cr": 294},
  mid_male_2: {"img": "middle_male_02", "w": 428, "cx": 211, "ls": [135, 125], "rs": [290, 125], "lp": [22, 160], "rp": [405, 161], "hl": [0, 134, 46, 246], "hr": [382, 135, 428, 246], "k": 0.975, "cl": 127, "cr": 294},
  mid_male_3: { "tuck": 35,"img": "middle_male_03", "w": 413, "cx": 202, "ls": [100, 122], "rs": [320, 125], "lp": [22, 150], "rp": [390, 149], "hl": [0, 124, 46, 230], "hr": [367, 123, 413, 230], "k": 0.972, "cl": 121, "cr": 286},
  mid_male_4: {"img": "middle_male_04", "w": 455, "cx": 223, "ls": [105, 135], "rs": [350, 135], "lp": [22, 153], "rp": [432, 152], "hl": [0, 127, 46, 226], "hr": [409, 126, 455, 226], "k": 0.991, "cl": 138, "cr": 299},
  mid_female_1: {"img": "middle_female_01", "w": 405, "cx": 194, "ls": [85, 135], "rs": [325, 140], "lp": [22, 162], "rp": [382, 162], "hl": [0, 136, 46, 240], "hr": [359, 136, 405, 239], "k": 0.996, "cl": 109, "cr": 278},
  mid_female_2: {"img": "middle_female_02", "w": 413, "cx": 202, "ls": [105, 135], "rs": [310, 135], "lp": [22, 146], "rp": [390, 145], "hl": [0, 120, 46, 213], "hr": [367, 119, 413, 213], "k": 0.991, "cl": 122, "cr": 279},
  mid_female_3: { "tuck": 50,"img": "middle_female_03", "w": 444, "cx": 220, "ls": [80, 125], "rs": [355, 125], "lp": [22, 151], "rp": [421, 152], "hl": [0, 125, 46, 220], "hr": [398, 126, 444, 219], "k": 0.975, "cl": 145, "cr": 289},
  mid_female_4: {"img": "middle_female_04", "w": 411, "cx": 200, "ls": [95, 128], "rs": [320, 128], "lp": [22, 149], "rp": [388, 151], "hl": [0, 123, 46, 217], "hr": [365, 125, 411, 218], "k": 0.98, "cl": 115, "cr": 286},
};
// Seeded friend slots: used in order as friends are added. Caps belong to the slot / traveller ID, not to the display name.
export const FRIEND_SLOTS = [
  { name:'Srikant',   cap:12000, tone:'m5' },
  { name:'Prathmesh', cap:10200, tone:'m3' },
];
export const DEFAULT_CAP = 12000;

export const VIBES = [
  { id:'heritage', label:'Heritage & sunrise', icon:'temple' },
  { id:'hills',    label:'Hills & chill',      icon:'mountain' },
  { id:'beach',    label:'Beach',              icon:'umbrella' },
];

// ---- Stays: exactly three nights (14, 15, 16 Nov) ----
export const STAYS = {
  riverside: { id:'riverside', name:'Riverside Courtyard', img:'stay_riverside', nights:[1200,1500,1200], amenities:['Wi-Fi','Breakfast included'], tag:'Current' },
  boulder:   { id:'boulder',   name:'Boulder View',        img:'stay_boulder',   nights:[1200,1200,1200], amenities:['Wi-Fi','Breakfast included'], tag:'Alternative' },
};
export const NIGHT_LABELS = ['14 Nov (Night 1)', '15 Nov (Night 2)', '16 Nov (Night 3)'];

// ---- Meals: breakfast is included in the stay and never charged ----
// Day 4 has lunch only. Meals per day: D1 500, D2 700, D3 500, D4 400 = 2,100 per person.
export const MEAL_PRICES = {
  1: { lunch:200, dinner:300 },
  2: { lunch:300, dinner:400 },
  3: { lunch:200, dinner:300 },
  4: { lunch:400, dinner:0   },
};

// ---- Local transport allocation (sample). Outbound/return buses are checkout items ----
export const BUS = { outbound:1200, ret:1200 };
export const LOCAL_BASE = { 1:200, 2:1000, 3:700, 4:200 };   // autos / local; Day 2 may become a scooty
export const SCOOTY = { price:400, savesVsAutos:600, travelFactor:0.7 };

// ---- Day content and timing model (hours). Not a geographic map. ----
export const DAYS = [
  { n:1, date:'Sat, 14 Nov', short:'14 Nov', title:'Arrive & explore', summary:'Arrive in Hampi, check in, explore Hampi Bazaar', img:'day_temple', available:7,
    stops:[ {id:'bazaar',name:'Hampi Bazaar',sights:1.5,travel:.25,part:'Afternoon'}, {id:'hemakuta',name:'Hemakuta Hill sunset',sights:1,travel:.5,part:'Evening'} ], start:'11:00' },
  { n:2, date:'Sun, 15 Nov', short:'15 Nov', title:'Heritage trail', summary:'Virupaksha Temple, Vittala Temple, Lotus Mahal', img:'day_chariot', available:8.5,
    stops:[ {id:'virupaksha',name:'Virupaksha Temple',sights:2,travel:.25,part:'Morning'}, {id:'vittala',name:'Vittala Temple',sights:1.5,travel:.5,part:'Morning'}, {id:'lotus',name:'Lotus Mahal',sights:1.5,travel:.5,part:'Afternoon'} ], start:'09:00' },
  { n:3, date:'Mon, 16 Nov', short:'16 Nov', title:'Boulders & riverside', summary:'Royal Enclosure and the riverside walk', img:'day_boulders', available:8.5,
    stops:[ {id:'royal',name:'Royal Enclosure',sights:1.5,travel:.5,part:'Morning'}, {id:'pampa',name:'Pampa riverside walk',sights:.75,travel:.25,part:'Afternoon'} ], start:'09:00' },
  { n:4, date:'Tue, 17 Nov', short:'17 Nov', title:'Wrap up & depart', summary:'Morning at Sanapur Lake, check out and return', img:'day_arch', available:6.5,
    stops:[ {id:'sanapur',name:'Sanapur Lake',sights:1.5,travel:.75,part:'Morning'} ], start:'09:00' },
];
export const ANJANADRI = { id:'anjanadri', name:'Anjanadri Hill', sights:2, travel:1.25, part:'Evening' };
export const LUNCH_HOURS = 1;
export const BUFFER_HOURS = 0.5;

export const PICKS = [
  { id:'bazaar', title:'Hampi Bazaar', kind:'Craft stalls', img:'pick_bazaar', note:'Sample recommendation' },
  { id:'mango',  title:'Mango Tree',   kind:'Meal stop',    img:'pick_mango',  note:'Sample recommendation' },
];

export const WHY = [
  { icon:'temple', text:'Heritage sights grouped to reduce backtracking.' },
  { icon:'bed',    text:'Stay near monuments.' },
  { icon:'bus',    text:'Intercity buses keep costs predictable.' },
];

// ---- Scripted AI copy. The AI, inventory, invitations and approvals are mock adapters. ----
export const COPY = {
  aiIntro: 'Hi! Add the friends travelling with you, then tell me about your trip.',
  gotTarget: cap => `Got it. I'll aim for ${rupee(cap)} per person so the plan works for everyone.`,
  askVibe: 'What kind of trip are you in the mood for?',
  vibeHint: 'For Hampi, heritage & sunrise is a natural fit.',
  planningStatus: ['Compared 14 stays near the monuments','Checked buses and travel times','Fitting sights into opening hours','Checking the budget target'],
  unsupported: (dest, dates) => `I only have sample inventory for Hampi, 14–17 Nov 2026. I've kept your request (${dest}, ${dates}). Want to explore the Hampi demo, or adjust your request?`,
  help: 'I can help with: choosing a trip vibe, making the plan cheaper, explaining a day, or changing a stay, meal or local transport. Try one of the suggestions.',
};

export function rupee(n){ const v=Math.round(n); return (v<0?'-':'')+'₹'+Math.abs(v).toLocaleString('en-IN'); }
export function hm(hours){ const m=Math.round(hours*60); const h=Math.floor(m/60), r=m%60; if(!h) return `${r} m`; return r? `${h} h ${r} m` : `${h} h`; }
export function hmShort(hours){ const m=Math.round(hours*60); const h=Math.floor(m/60), r=m%60; return h? (r? `${h}h${String(r).padStart(2,'0')}` : `${h}h`) : `${r}m`; }
