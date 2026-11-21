"use strict";
/* ===== SOTNIA command: who leads the company. The captain, the four officers and the retainer, and what each changes in the rules. No DOM in this block ===== */

/* ---------- what a person changes ---------- */
/**
 * The things a company's people change about the rules. A modifier names one of them and a number: for a multiplier (mul) the number is its
 * change, -0.2 for a fifth off; for the rest it is an amount added. A modifier that names a class (cls) is for that class only.
 */
type ModKey = 'price' | 'hire' | 'wage' | 'eat' | 'forage' | 'rest' | 'wounded' | 'tend' | 'mercy' | 'drill' | 'spirit' | 'renown' | 'pay' | 'ambush' | 'edge' | 'guard' | 'unpaid';
/** How a modifier reads: dear is true where more of it is worse for the company. */
interface ModInfo { mul: boolean; icon: IconName; what: string; dear?: boolean }
const MODS: Record<ModKey, ModInfo> = {
  price: { mul: true, icon: 'coin', what: 'market prices', dear: true },
  hire: { mul: true, icon: 'men', what: 'fees to hire men', dear: true },
  wage: { mul: true, icon: 'coin', what: 'the men’s wages', dear: true },
  eat: { mul: false, icon: 'loaf', what: 'bread eaten a day', dear: true },
  forage: { mul: false, icon: 'forage', what: 'bread from each forager' },
  rest: { mul: false, icon: 'moon', what: 'blood a day at rest' },
  wounded: { mul: false, icon: 'cross', what: 'blood a day, laid up' },
  tend: { mul: false, icon: 'drop', what: 'blood a day on the road and at drill' },
  mercy: { mul: false, icon: 'heart', what: 'chance a man struck down lives' },
  drill: { mul: true, icon: 'drill', what: 'experience from drill' },
  spirit: { mul: false, icon: 'flame', what: 'spirit a day, every man' },
  renown: { mul: true, icon: 'mace', what: 'renown earned' },
  pay: { mul: true, icon: 'coin', what: 'the pay of paid work' },
  ambush: { mul: true, icon: 'warn', what: 'the chance of an ambush', dear: true },
  edge: { mul: false, icon: 'swords', what: 'skill in a fight' },
  guard: { mul: false, icon: 'shield', what: 'guard in a fight' },
  unpaid: { mul: false, icon: 'coin', what: 'spirit lost when the pay fails', dear: true }
};
interface Mod { k: ModKey; v: number; cls?: TroopClass }
/** The classes a modifier without one is for. */
const ALL_CLASSES: readonly TroopClass[] = ['pike', 'shot', 'sabre'];

/** The faiths a chaplain can have, and the nations whose men he hearts. A man of another faith is not heartened (nor is a Lipka Tatar by any of them). */
type FaithId = 'catholic' | 'orthodox' | 'lutheran' | 'reformed' | 'open';
interface Faith { name: string; peoples: OriginId[] }
const FAITHS: Record<FaithId, Faith> = {
  catholic: { name: 'Catholic', peoples: ['pole', 'croat', 'german', 'magyar'] },
  orthodox: { name: 'Orthodox', peoples: ['cossack'] },
  lutheran: { name: 'Lutheran', peoples: ['swede', 'german'] },
  reformed: { name: 'Reformed', peoples: ['scot', 'magyar'] },
  open: { name: 'of no party', peoples: ['cossack', 'pole', 'german', 'swede', 'scot', 'magyar', 'croat'] }
};
/** The spirit a man gets in a day from the chaplain: two if it is his faith, one from a chaplain of no party. A chaplain lifts a man no higher than FAITH_CEIL. */
const FAITH_HEART = 2, FAITH_OPEN = 1, FAITH_CEIL = 90;

/* ---------- the four stations ---------- */
/** The four stations an officer can hold: each owns one thing that changes every day. */
type StaffId = 'surgeon' | 'drill' | 'qm' | 'chaplain';
interface StaffInfo { name: string; owns: string; icon: IconName }
const STAFF: Record<StaffId, StaffInfo> = {
  surgeon: { name: 'Surgeon', owns: 'Blood: how fast the men mend, and how many of those struck down live.', icon: 'surgeon' },
  drill: { name: 'Drillmaster', owns: 'Experience: what a day of drill teaches.', icon: 'drill' },
  qm: { name: 'Quartermaster', owns: 'Bread and prices: what the company eats, and what it pays.', icon: 'qm' },
  chaplain: { name: 'Chaplain', owns: 'Spirit: what keeps the men from deserting.', icon: 'chaplain' }
};
const STATIONS: readonly StaffId[] = ['surgeon', 'drill', 'qm', 'chaplain'];

/** The ways an officer can be, each a kind of man for one station. */
type OfficerKind = 'barber' | 'bonesetter' | 'physician' | 'herbalist' | 'armysurgeon'
  | 'pikemaster' | 'fencer' | 'gunner' | 'taskmaster' | 'veteran'
  | 'haggler' | 'provisioner' | 'scrounger' | 'paymaster' | 'fixer'
  | 'catholic' | 'orthodox' | 'lutheran' | 'reformed' | 'open';
/** What a kind of officer is: his station, his title and a line about him, the nations he comes from, his fee and wage, and what he changes. */
interface Specialty { station: StaffId; title: string; blurb: string; from: readonly OriginId[]; fee: number; wage: number; mods: readonly Mod[]; faith?: FaithId }
const EVERY: readonly OriginId[] = ['cossack', 'pole', 'german', 'swede', 'scot', 'magyar', 'croat'];
const SPECIALTIES: Record<OfficerKind, Specialty> = {
  barber: { station: 'surgeon', title: 'A barber-surgeon', blurb: 'Lets blood, pulls teeth and sets a leg in the same morning. Rest mends the men faster under him.', from: EVERY, fee: 40, wage: 6, mods: [{ k: 'rest', v: 6 }, { k: 'wounded', v: 3 }, { k: 'mercy', v: 0.18 }] },
  bonesetter: { station: 'surgeon', title: 'A bonesetter', blurb: 'A farrier’s son who knows how a limb goes back. Fewer of the struck down are lost.', from: ['pole', 'cossack', 'croat', 'magyar'], fee: 35, wage: 5, mods: [{ k: 'mercy', v: 0.3 }, { k: 'rest', v: 2 }] },
  physician: { station: 'surgeon', title: 'A university physician', blurb: 'Trained at Padua and dear at the price. He keeps the whole column on its feet.', from: ['german', 'pole', 'swede'], fee: 60, wage: 9, mods: [{ k: 'rest', v: 5 }, { k: 'wounded', v: 3 }, { k: 'mercy', v: 0.18 }, { k: 'tend', v: 1 }] },
  herbalist: { station: 'surgeon', title: 'A village herbalist', blurb: 'Knows every weed of the roadside. Men mend a little even on the march.', from: ['cossack', 'pole', 'scot', 'magyar'], fee: 25, wage: 3, mods: [{ k: 'tend', v: 2 }, { k: 'rest', v: 3 }] },
  armysurgeon: { station: 'surgeon', title: 'A surgeon of the Swedish army', blurb: 'Has cut off more legs than he has had hot dinners. Hardly anyone struck down is lost.', from: ['swede', 'scot', 'german'], fee: 50, wage: 7, mods: [{ k: 'mercy', v: 0.35 }, { k: 'wounded', v: 2 }] },
  pikemaster: { station: 'drill', title: 'A pike-master of the Swiss school', blurb: 'Drills a pikeman to stand against horse. The others learn a little by watching.', from: ['german', 'scot', 'swede'], fee: 45, wage: 6, mods: [{ k: 'drill', cls: 'pike', v: 0.6 }, { k: 'drill', cls: 'shot', v: 0.2 }, { k: 'drill', cls: 'sabre', v: 0.2 }] },
  fencer: { station: 'drill', title: 'A fencing-master', blurb: 'Taught the sabre in Kraków and Vienna. Sabreurs come on fast; the others pick up something.', from: ['pole', 'magyar', 'croat'], fee: 45, wage: 6, mods: [{ k: 'drill', cls: 'sabre', v: 0.6 }, { k: 'drill', cls: 'pike', v: 0.2 }, { k: 'drill', cls: 'shot', v: 0.2 }] },
  gunner: { station: 'drill', title: 'An old arquebusier', blurb: 'Served the guns of three armies and can load a musket asleep. Musketeers learn the most.', from: ['swede', 'german', 'scot'], fee: 45, wage: 6, mods: [{ k: 'drill', cls: 'shot', v: 0.6 }, { k: 'drill', cls: 'pike', v: 0.2 }, { k: 'drill', cls: 'sabre', v: 0.2 }] },
  taskmaster: { station: 'drill', title: 'A taskmaster', blurb: 'Drills everyone from before dawn until the light goes. They learn, and they hate him for it.', from: EVERY, fee: 35, wage: 5, mods: [{ k: 'drill', v: 0.45 }, { k: 'spirit', v: -1 }] },
  veteran: { station: 'drill', title: 'A veteran of a dozen sieges', blurb: 'The best teacher to be had, and he knows it. Every man learns more under him.', from: EVERY, fee: 70, wage: 9, mods: [{ k: 'drill', v: 0.6 }] },
  haggler: { station: 'qm', title: 'A haggler', blurb: 'Could sell a drowned man his own coat. The stalls give him their lowest price.', from: EVERY, fee: 30, wage: 3, mods: [{ k: 'price', v: -0.2 }] },
  provisioner: { station: 'qm', title: 'A provisioner', blurb: 'Makes a loaf go further than it has any right to, and spares a thaler besides.', from: ['german', 'pole', 'swede', 'scot'], fee: 30, wage: 3, mods: [{ k: 'eat', v: -2 }, { k: 'price', v: -0.05 }] },
  scrounger: { station: 'qm', title: 'A scrounger', blurb: 'Finds bread where there is none: a forager under him comes back with two loaves more.', from: ['cossack', 'croat', 'magyar', 'pole'], fee: 25, wage: 3, mods: [{ k: 'forage', v: 2 }, { k: 'eat', v: -1 }] },
  paymaster: { station: 'qm', title: 'A paymaster', blurb: 'Keeps the books, and the men’s wages come out a little lighter than they should.', from: ['german', 'swede', 'scot'], fee: 35, wage: 4, mods: [{ k: 'wage', v: -0.15 }, { k: 'price', v: -0.05 }] },
  fixer: { station: 'qm', title: 'A fixer', blurb: 'Knows a man in every town who needs something carried or someone hurt. Work pays better, and the men are cheaper.', from: ['pole', 'german', 'magyar', 'croat'], fee: 40, wage: 5, mods: [{ k: 'pay', v: 0.12 }, { k: 'hire', v: -0.1 }] },
  catholic: { station: 'chaplain', title: 'A Jesuit father', blurb: 'Hears confession, says Mass on a drumhead, and keeps the Catholic men steady.', from: ['pole', 'croat', 'german', 'magyar'], fee: 30, wage: 3, mods: [], faith: 'catholic' },
  orthodox: { station: 'chaplain', title: 'A priest of the Dnieper', blurb: 'A black-bearded priest from a Cossack village church, who blesses the sabres.', from: ['cossack'], fee: 20, wage: 2, mods: [], faith: 'orthodox' },
  lutheran: { station: 'chaplain', title: 'A Lutheran pastor', blurb: 'Preaches the Augsburg Confession and a long sermon. The Swedes and the Saxons hear him gladly.', from: ['swede', 'german'], fee: 30, wage: 3, mods: [], faith: 'lutheran' },
  reformed: { station: 'chaplain', title: 'A Calvinist minister', blurb: 'Stern and plain-spoken: the Scots listen, and the Hungarian Calvinists with them.', from: ['scot', 'magyar'], fee: 30, wage: 3, mods: [], faith: 'reformed' },
  open: { station: 'chaplain', title: 'A chaplain of no party', blurb: 'Prays for every Christian man alike and offends none of them. Warmth for all, but no fire for any.', from: EVERY, fee: 35, wage: 4, mods: [], faith: 'open' }
};
/** A man holding a station of the company. fee was paid to engage him, and wage is paid every month. */
interface Officer { id: number; station: StaffId; kind: OfficerKind; name: string; origin: OriginId; fee: number; wage: number }

/* ---------- the captain ---------- */
/** An order the captain can give once in a fight (see the battle in core.ts). */
type CaptainOrder = 'rally' | 'volley' | 'stand' | 'charge';
interface OrderInfo { name: string; icon: IconName; text: string; secs: number }
const ORDERS: Record<CaptainOrder, OrderInfo> = {
  rally: { name: 'Rally', icon: 'flag', text: 'Raises the standard. Every man’s spirit leaps, and men who are running turn back.', secs: 8 },
  volley: { name: 'Volley', icon: 'shot', text: 'Every musketeer fires now, and aims truer for a few seconds after.', secs: 6 },
  stand: { name: 'Stand fast', icon: 'pike', text: 'The pikes close up behind their points and are much harder to break for a while.', secs: 12 },
  charge: { name: 'Charge home', icon: 'sabre', text: 'The sabreurs go in at a gallop, hit harder and are faster for a while.', secs: 10 }
};
type CaptainId = 'ataman' | 'rotmistrz' | 'hauptmann' | 'colonel' | 'hussar' | 'swede';
/** A kind of captain: where he is from and the arm he knows, a line about him, what he is good at (perk) and bad at (flaw), and the order he gives. */
interface CaptainType { title: string; origin: OriginId; cls: TroopClass; blurb: string; perk: { name: string; mods: readonly Mod[] }; flaw: { name: string; mods: readonly Mod[] }; order: CaptainOrder }
const CAPTAINS: Record<CaptainId, CaptainType> = {
  ataman: { title: 'An ataman’s son', origin: 'cossack', cls: 'sabre', blurb: 'Raised among the Dnieper rapids, he has led raids since he could sit a horse. His men follow him anywhere, and are paid when he remembers.',
    perk: { name: 'Steppe-wise', mods: [{ k: 'forage', v: 1 }, { k: 'edge', cls: 'sabre', v: 1 }] }, flaw: { name: 'Free men', mods: [{ k: 'unpaid', v: 10 }] }, order: 'charge' },
  rotmistrz: { title: 'A rotmistrz of the Crown horse', origin: 'pole', cls: 'sabre', blurb: 'A gentleman of a good name and a bad purse, who has led a hussar banner and knows how to talk to a hetman.',
    perk: { name: 'A name that opens doors', mods: [{ k: 'renown', v: 0.25 }] }, flaw: { name: 'Spends like a lord', mods: [{ k: 'wage', v: 0.1 }] }, order: 'rally' },
  hauptmann: { title: 'A Hauptmann of the old school', origin: 'german', cls: 'pike', blurb: 'Twenty years under six banners, he knows every hiring hall from the Baltic to the Danube and eats well at all of them.',
    perk: { name: 'Knows the hiring halls', mods: [{ k: 'hire', v: -0.12 }] }, flaw: { name: 'Likes his table', mods: [{ k: 'eat', v: 1 }] }, order: 'volley' },
  colonel: { title: 'A colonel of the Swedish war', origin: 'scot', cls: 'pike', blurb: 'Fought under Gustavus at Breitenfeld, and has not forgiven his old regiment for owing him two years’ pay.',
    perk: { name: 'Pikes in the old style', mods: [{ k: 'guard', cls: 'pike', v: 1 }, { k: 'edge', cls: 'pike', v: 1 }] }, flaw: { name: 'Pays are slow', mods: [{ k: 'pay', v: -0.08 }] }, order: 'stand' },
  hussar: { title: 'A Hungarian hussar', origin: 'magyar', cls: 'sabre', blurb: 'Rode with the Imperial light horse and the Transylvanian princes, and knows a road from a trap by the smell of it.',
    perk: { name: 'Reads the road', mods: [{ k: 'ambush', v: -0.25 }] }, flaw: { name: 'Cannot abide a pike', mods: [{ k: 'drill', cls: 'pike', v: -0.2 }] }, order: 'charge' },
  swede: { title: 'A cashiered Swedish captain', origin: 'swede', cls: 'shot', blurb: 'Drilled his musketeers in the new manner until the colonel drilled him out of the army over a dead man’s purse.',
    perk: { name: 'Drilled in the new manner', mods: [{ k: 'edge', cls: 'shot', v: 2 }] }, flaw: { name: 'Expects a salary', mods: [{ k: 'wage', v: 0.1 }] }, order: 'volley' }
};
/** The captain of a campaign: his kind and his name. */
interface Captain { type: CaptainId; name: string }

/* ---------- the retainer ---------- */
type RetainerId = 'engineer' | 'cartographer' | 'informant' | 'wisewoman' | 'renegade' | 'duellist' | 'kobzar' | 'merchant';
/** A kind of retainer: a person with a way of his own, who rides with the company if he is taken on, one at a time. offer is what he says; fee is asked once and wage every month. */
interface RetainerType { title: string; names: readonly string[]; she?: boolean; blurb: string; offer: string; fee: number; wage: number; mods: readonly Mod[]; lands: readonly LandId[] }
const RETAINERS: Record<RetainerId, RetainerType> = {
  engineer: { title: 'A Venetian engineer', names: ['Maestro Zanetti', 'Messer Gradenigo'], blurb: 'Digs a field work in an hour and pikes and musketeers stand the better behind it.',
    offer: 'A Venetian engineer, out of work since the siege, offers to build earthworks wherever the company halts. He asks a fee, and a wage.', fee: 40, wage: 8, mods: [{ k: 'guard', cls: 'pike', v: 1 }, { k: 'guard', cls: 'shot', v: 1 }], lands: ['front', 'silesia', 'saxony', 'prussia'] },
  cartographer: { title: 'A wandering cartographer', names: ['Master Hondius', 'Herr Merian'], blurb: 'Has walked every road on the map and a few that are not on it. Ambushes seldom find the column.',
    offer: 'A map-maker with a case of sheets and a good pair of boots asks to ride with the train. He knows where the raiders lie up.', fee: 20, wage: 4, mods: [{ k: 'ambush', v: -0.3 }, { k: 'price', v: -0.05 }], lands: ['poland', 'ukraine', 'lithuania', 'prussia', 'silesia', 'saxony'] },
  informant: { title: 'A paid informant', names: ['Szymon the Lame', 'Old Brandt'], blurb: 'Hears things in taverns. Paid work pays a little better and the raiders are a little less sure.',
    offer: 'A quiet man in a good coat offers to tell you what the tavern keepers know, for a fee and a monthly wage.', fee: 30, wage: 6, mods: [{ k: 'pay', v: 0.1 }, { k: 'ambush', v: -0.15 }], lands: ['poland', 'lithuania', 'silesia', 'saxony'] },
  wisewoman: { title: 'A village wise-woman', names: ['Baba Hanna', 'Mother Agafya'], she: true, blurb: 'Knows what the barber does not. The sick mend faster and the wounded sooner get up.',
    offer: 'A wise-woman of the village has a bundle of roots and no husband. She would travel with the sick wagon, for her keep.', fee: 10, wage: 3, mods: [{ k: 'rest', v: 4 }, { k: 'wounded', v: 2 }], lands: ['ukraine', 'poland', 'lithuania', 'steppe'] },
  renegade: { title: 'A cashiered Swedish drill-sergeant', names: ['Sergeant Axel Lind', 'Sergeant Torsten Hök'], blurb: 'Drills the musketeers into something like a regiment, and the pikes along with them.',
    offer: 'A Swedish drill-sergeant, broken out of his regiment, asks for a place and says he can make musketeers of your shot.', fee: 0, wage: 9, mods: [{ k: 'edge', cls: 'shot', v: 2 }, { k: 'edge', cls: 'pike', v: 1 }], lands: ['silesia', 'saxony', 'prussia', 'poland'] },
  duellist: { title: 'A famed duellist', names: ['Pan Zagłoba', 'Herr von Falkenberg'], blurb: 'Has killed eleven men over eleven trifles. Sabreurs fight like him, and the banner’s name travels.',
    offer: 'A famous swordsman looking for a patron says he will teach your sabreurs a trick or two, and add lustre to your banner.', fee: 25, wage: 7, mods: [{ k: 'edge', cls: 'sabre', v: 2 }, { k: 'renown', v: 0.15 }], lands: ['poland', 'ukraine', 'lithuania', 'silesia', 'saxony'] },
  kobzar: { title: 'A kobzar of the Cossacks', names: ['Old Ivan the Blind', 'Ostap Veresai'], blurb: 'Sings the old dumy by the fire. Spirits are higher and the banner’s name goes before the column.',
    offer: 'A blind singer with a bandura asks for a seat by the fire and a share of the bread. The men would listen.', fee: 5, wage: 3, mods: [{ k: 'spirit', v: 1 }, { k: 'renown', v: 0.1 }], lands: ['ukraine', 'steppe', 'poland'] },
  merchant: { title: 'An Armenian merchant', names: ['Khoja Sarkis', 'Master Hovsep'], blurb: 'Buys cheap and sells dear in six languages. Prices drop and paid work pays more.',
    offer: 'An Armenian cloth merchant with a mule train would travel under your banner and give the company the benefit of his connexions.', fee: 35, wage: 5, mods: [{ k: 'price', v: -0.1 }, { k: 'pay', v: 0.08 }], lands: ['ukraine', 'poland', 'prussia', 'saxony'] }
};
/** The camp events in which a retainer asks for a place: the ids of RETAINER_EVENTS. */
type RetainerEventId = `retainer-${RetainerId}`;
/** A person who rides with the company beside its officers. wage is the month's, as agreed. */
interface Retainer { type: RetainerId; name: string; wage: number }

/* ---------- slots ---------- */
/** The renown at which each officer's place in the company opens: the first two are open from the start. */
const OFFICER_RENOWN: readonly number[] = [0, 0, 8, 20];
const officerSlots = (st: Pick<Campaign, 'renown'>) => OFFICER_RENOWN.filter(r => st.renown >= r).length;
/** What the next place needs: the renown it opens at, or null when they are all open. */
const nextSlotRenown = (st: Pick<Campaign, 'renown'>) => OFFICER_RENOWN.find(r => st.renown < r) ?? null;
/** The officers a company has, in the order of the stations. */
const officersOf = (st: Pick<Campaign, 'officers'>) => STATIONS.map(k => st.officers[k]).filter((o): o is Officer => !!o);
const officer = (st: Pick<Campaign, 'officers'>, k: StaffId) => st.officers[k] || null;

/* ---------- what it all adds up to ---------- */
/** Everything the company's people change, summed, as the rules read it. Without anyone in post it changes nothing. */
interface Effects {
  price: number; hire: number; wage: number; pay: number; renown: number; ambush: number; // multipliers
  eat: number; forage: number; rest: number; wounded: number; tend: number; mercy: number; spirit: number; unpaid: number; // amounts added
  drill: Record<TroopClass, number>; edge: Record<TroopClass, number>; guard: Record<TroopClass, number>;
  faith: FaithId | null; // the chaplain's, which hearts the men of some nations (see faithSpirit)
}
/** The modifiers of every person the company has, the captain's perk and flaw first. */
function modsOf(st: Pick<Campaign, 'captain' | 'officers' | 'retainer'>): Mod[] {
  const out: Mod[] = [];
  const c = CAPTAINS[st.captain.type];
  out.push(...c.perk.mods, ...c.flaw.mods);
  for (const o of officersOf(st)) out.push(...SPECIALTIES[o.kind].mods);
  if (st.retainer) out.push(...RETAINERS[st.retainer.type].mods);
  return out;
}
function effectsOf(st: Pick<Campaign, 'captain' | 'officers' | 'retainer'>): Effects {
  const per = (v: number) => ({ pike: v, shot: v, sabre: v } as Record<TroopClass, number>);
  const e: Effects = { price: 1, hire: 1, wage: 1, pay: 1, renown: 1, ambush: 1, eat: 0, forage: 0, rest: 0, wounded: 0, tend: 0, mercy: 0, spirit: 0, unpaid: 0, drill: per(1), edge: per(0), guard: per(0), faith: null };
  for (const m of modsOf(st)) {
    const mul = MODS[m.k].mul;
    if (m.k === 'drill' || m.k === 'edge' || m.k === 'guard') { for (const c of m.cls ? [m.cls] : ALL_CLASSES) e[m.k][c] = mul ? e[m.k][c] * (1 + m.v) : e[m.k][c] + m.v; }
    else if (mul) (e as unknown as Record<string, number>)[m.k] *= 1 + m.v;
    else (e as unknown as Record<string, number>)[m.k] += m.v;
  }
  const chaplain = st.officers.chaplain;
  if (chaplain) e.faith = SPECIALTIES[chaplain.kind].faith || null;
  return e;
}
const originId = (label: string) => ORIGINS.find(o => o.label === label)!.id;
/** What the chaplain's faith adds to a man's spirit in a day (see FAITH_HEART and its kin). */
function faithSpirit(e: Pick<Effects, 'faith'>, s: Pick<Soldier, 'origin' | 'morale'>) {
  if (!e.faith) return 0;
  const o = originId(s.origin);
  if (s.morale >= FAITH_CEIL || !FAITHS[e.faith].peoples.includes(o)) return 0;
  return e.faith === 'open' ? FAITH_OPEN : FAITH_HEART;
}
/** A modifier as the chip that tells of it: its icon, its signed amount, and what it is of; and whether it is good for the company. */
function modChip(m: Mod): { chip: FxChip; good: boolean } {
  const I = MODS[m.k], amount = I.mul ? Math.round(Math.abs(m.v) * 100) + '%' : String(+Math.abs(m.v).toFixed(2));
  const text = (m.v > 0 ? '+' : m.v < 0 ? '−' : '') + amount;
  const what = I.what + (m.cls ? ' (' + CLASS_MEN[m.cls] + ')' : '');
  const good = I.dear ? m.v < 0 : m.v > 0;
  return { chip: [I.icon, text, what, good ? 'up' : 'down'], good };
}
/** The nations of a faith, as the words that name them. */
const originLabel = (id: OriginId) => ORIGINS.find(o => o.id === id)!.label;
const flockOf = (f: FaithId) => f === 'open' ? 'every Christian' : FAITHS[f].peoples.map(originLabel).join(', ');
/** A faith as the chip of what the chaplain does: spirit for the nations that share it. */
const faithChip = (f: FaithId): FxChip => ['flame', '+' + (f === 'open' ? FAITH_OPEN : FAITH_HEART), 'spirit a day, ' + flockOf(f), 'up'];
/** Every chip that tells what a kind of officer does. */
function officerChips(kind: OfficerKind): { chip: FxChip; good: boolean }[] {
  const S = SPECIALTIES[kind], out = S.mods.map(modChip);
  if (S.faith) out.unshift({ chip: faithChip(S.faith), good: true });
  return out;
}

/* ---------- making people ---------- */
const nameFrom = (o: OriginId) => { const O = ORIGINS.find(x => x.id === o)!; return pick(O.first) + ' ' + pick(O.last); };
/** The captains offered at the start: three of different kinds, from different nations. */
function genCaptains(): Captain[] {
  const ids = (Object.keys(CAPTAINS) as CaptainId[]).sort(() => Math.random() - 0.5), out: Captain[] = [];
  for (const id of ids) {
    if (out.some(c => CAPTAINS[c.type].origin === CAPTAINS[id].origin)) continue;
    out.push({ type: id, name: nameFrom(CAPTAINS[id].origin) });
    if (out.length === 3) break;
  }
  return out;
}
/** How likely a kind of officer is to turn up in a land: more where more of the nations he is drawn from live. */
const kindWeight = (kind: OfficerKind, land: LandId) => 1 + SPECIALTIES[kind].from.filter(o => LANDS[land].origins.includes(o)).length * 2;
function makeOfficer(st: Pick<Campaign, 'nextId'>, kind: OfficerKind, land: LandId): Officer {
  const S = SPECIALTIES[kind], near = S.from.filter(o => LANDS[land].origins.includes(o)), origin = pick(near.length ? near : S.from);
  return { id: st.nextId++, station: S.station, kind, name: nameFrom(origin), origin, fee: Math.round(S.fee * (0.9 + 0.2 * Math.random())), wage: S.wage };
}
/** Three officers to choose from for each station, of different kinds, drawn from the land the company is in. */
function genOfficers(st: Campaign) {
  const land = here(st).land;
  st.pool = {};
  for (const k of STATIONS) {
    const kinds = (Object.keys(SPECIALTIES) as OfficerKind[]).filter(x => SPECIALTIES[x].station === k), chosen: OfficerKind[] = [];
    while (chosen.length < 3 && kinds.length) {
      let r = Math.random() * kinds.reduce((n, x) => n + kindWeight(x, land), 0), i = 0;
      for (; i < kinds.length - 1; i++) { r -= kindWeight(kinds[i], land); if (r < 0) break; }
      chosen.push(kinds.splice(i, 1)[0]);
    }
    st.pool[k] = chosen.map(kind => makeOfficer(st, kind, land));
  }
}
/**
 * Engage the officer on offer at a station. The fee must be in the chest, and the company must have a place for him: a station already
 * held is a place (its officer is let go, with no refund), and a station that is not needs one of the places the renown has opened.
 */
function hireOfficer(st: Campaign, k: StaffId, i: number) {
  const o = st.pool[k] && st.pool[k]![i], sitting = st.officers[k];
  if (!o || st.thalers < o.fee || (!sitting && officersOf(st).length >= officerSlots(st))) return false;
  if (sitting) logLine(st, sitting.name + ' leaves the ' + STAFF[k].name.toLowerCase() + '’s post.');
  st.thalers -= o.fee; st.officers[k] = o; st.pool[k] = st.pool[k]!.filter(x => x !== o);
  logLine(st, o.name + ', ' + originLabel(o.origin).toLowerCase() + ' ' + SPECIALTIES[o.kind].title.toLowerCase().replace(/^an? /, '') + ', takes the ' + STAFF[k].name.toLowerCase() + '’s post.');
  st.odds = {};
  return true;
}
function dismissOfficer(st: Campaign, k: StaffId) {
  const o = st.officers[k];
  if (!o) return false;
  delete st.officers[k];
  logLine(st, o.name + ' leaves the ' + STAFF[k].name.toLowerCase() + '’s post.');
  st.odds = {};
  return true;
}
/** The wages the officers and the retainer cost in a month. */
const officerWages = (st: Pick<Campaign, 'officers' | 'retainer'>) => officersOf(st).reduce((n, o) => n + o.wage, 0) + (st.retainer ? st.retainer.wage : 0);
/** Let the retainer go. */
function dismissRetainer(st: Campaign) {
  if (!st.retainer) return false;
  logLine(st, st.retainer.name + ' takes leave of the train.');
  st.retainer = null; st.odds = {};
  return true;
}

/* ---------- retainers, who come as events ---------- */
/** How likely a retainer is to be on offer when the company arrives at a place with people in it, and on a day spent in one; and the days there must be between offers. */
const RETAINER_ODDS = 0.3, RETAINER_ODDS_CAMP = 0.08, RETAINER_GAP = 8;
const eventOf = (id: CampEventId | null | undefined) => EVENTS.find(e => e.id === id) || RETAINER_EVENTS.find(e => e.id === id);
/** The camp event in which a retainer asks to be taken on. */
function retainerEvent(t: RetainerId): CampEvent {
  const T = RETAINERS[t], him = T.she ? 'her' : 'him';
  return {
    id: ('retainer-' + t) as RetainerEventId, title: T.title + ' asks for a place', text: () => T.offer,
    ok: st => st.thalers >= T.fee && (!st.retainer || st.retainer.type !== t) && T.lands.includes(here(st).land),
    choices: [
      { label: 'Take ' + him + ' on', hint: 'Rides with the train, one retainer at a time. ' + (T.fee ? 'Pay ' + T.fee + ' thalers now and ' : 'Asks nothing now, and ') + T.wage + ' a month.', fx: [...(T.fee ? [['coin', '−' + T.fee, 'thalers, once'] as FxChip] : []), ['coin', '−' + T.wage, 'thalers a month'], ...T.mods.map(m => modChip(m).chip)],
        fn: st => { const was = st.retainer; st.thalers -= T.fee; st.retainer = { type: t, name: pick(T.names), wage: T.wage }; return (was ? was.name + ' is paid off. ' : '') + st.retainer.name + ' takes a place with the train.'; } },
      { label: 'Send ' + him + ' on', hint: 'Nothing gained, nothing lost.', fn: () => cap1(T.she ? 'she' : 'he') + ' shoulders ' + (T.she ? 'her' : 'his') + ' bundle and walks on to the next company.' }
    ]
  };
}
const RETAINER_EVENTS: CampEvent[] = (Object.keys(RETAINERS) as RetainerId[]).map(retainerEvent);
/**
 * A retainer's offer, if one is to be made now: at a place with people in it, the odds, and the days since the last offer. The offer
 * is left pending, as an event's is, for the screen to put to the player.
 */
function rollRetainer(st: Campaign, odds: number) {
  if (st.pending || !has(st, 'recruits') || st.day - st.offered < RETAINER_GAP || !chance(odds)) return null;
  const pool = RETAINER_EVENTS.filter(e => e.ok(st));
  if (!pool.length) return null;
  const e = pick(pool);
  st.offered = st.day; st.pending = { id: e.id };
  return e;
}
