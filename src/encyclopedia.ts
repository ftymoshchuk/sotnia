"use strict";
/* ===== SOTNIA interface: the encyclopedia. Every nation of the company and the men it sends, the arms and armour, the foes and the baggage train, built from the game's own tables. ===== */

/** The tabs of the encyclopedia. */
type CodexTab = 'nations' | 'units' | 'foes' | 'lands' | 'goods';
const CODEX_TABS: readonly (readonly [CodexTab, IconName, string])[] = [['nations', 'flag', 'Nations'], ['units', 'men', 'Units'], ['foes', 'swords', 'Foes'], ['lands', 'map', 'Lands'], ['goods', 'wagon', 'Train and goods']];
/** What the way back says, by the screen the encyclopedia was opened from. */
const BACK_WORD: Partial<Record<ScreenId, string>> = { title: 'Back to the title', camp: 'Back to camp', muster: 'Back to the muster', report: 'Back to the report', end: 'Back to the ledger' };

/**
 * What the encyclopedia says that the rules do not: who each nation is, and what it wears. The colours and the caps themselves are
 * NATIONS in figures.ts, and the rest of a page is read from the tables of the game, so a nation, a weapon or a foe added there appears here;
 * Record makes it a compile error to leave one of these without its words.
 */
const NATION_TEXT: Record<OriginId, { blurb: string; dress: string }> = {
  cossack: { blurb: 'Cossacks of the Dnieper rapids and the Wild Fields: quick on a march, hard to frighten, and as good with a musket as with a sabre. Wherever a company of them sits by the fire, one has a bandura.',
    dress: 'A blue coat, yellow boots and dark blue hose, a fur kolpak with a red bag, and a long moustache.' },
  pole: { blurb: 'Gentry and townsmen of the Crown and the Grand Duchy: the sabres of the gentry and the pikes of the hired foot. They wear their moustaches long and their kontusz sleeves thrown back.',
    dress: 'A crimson coat with the white żupan showing at the chest and white cuffs, red boots, a sleeve thrown back from the shoulder, and a heron’s feather in the cap.' },
  german: { blurb: 'The Empire’s war has left more idle soldiers in Germany than anywhere: pikemen and musketeers of the old landsknecht school, who march for whoever pays.',
    dress: 'Black and gold, slashed sleeves, one leg red and the other dark, and a great hat with a red plume.' },
  swede: { blurb: 'Pikemen and musketeers drilled in the new manner, discharged or run off from King Gustavus’s armies, and still marching in step.',
    dress: 'A yellow coat, blue hose and a plume to match. The blue-coated Swedish foot on the road wear the same two colours the other way about.' },
  scot: { blurb: 'Scots sell their pikes and muskets all round the Baltic, from Danzig to Stralsund, and keep their bonnets and their plaids wherever they go.',
    dress: 'A blue bonnet with a diced band and a red tuft, a tartan plaid hung from the shoulders, and red hose.' },
  magyar: { blurb: 'Hussars and haiduks of the Hungarian lands, with sabre and musket, and a feather for every occasion.',
    dress: 'A green dolman with white braid, red hose, and a tall kalpak with a red bag and a white feather.' },
  croat: { blurb: 'Light horsemen of the Croatian frontier, who gave the neckcloth its name: fast, hard, and hard to pay. A few sell their sabres to the highest bidder, whichever side that is.',
    dress: 'A brown coat, a red cravat, and a broad hat with a red plume.' },
  tatar: { blurb: 'Tatars settled in Lithuania for generations, who serve the Crown with the sabre and keep to their own customs.',
    dress: 'A teal coat and a wound turban, with a jewel and a feather for the better equipped.' }
};
/** The men of each class, in the plural. */
const CLASS_MEN: Record<TroopClass, string> = { pike: 'pikemen', shot: 'musketeers', sabre: 'sabreurs' };
/** What is said of each class: how he fights. The numbers beside it are read from CLS. */
const CLASS_TEXT: Record<TroopClass, string> = {
  pike: 'The pike is the company’s wall. A pikeman is slow and tough and wears the heaviest armour, and his reach is the longest on the field: against anything with a shorter weapon he strikes first.',
  shot: 'A musket ball does more harm than any blow, at a distance. A musketeer is frail and poor in the press, and reloads slowly, a little faster the better his aim. Every shot is a charge of the company’s powder, and rain makes matchlocks misfire.',
  sabre: 'The quickest man on the field, with the best blade and a good guard but little armour: first into a melee, and first away from a musket.'
};
/** What is said of each people met on the road, and which class mixes they take their classes from if the fights they are in do not tell. */
interface FoeText { name: string; blurb: string; also?: string; mix?: readonly TroopClass[] }
const FOE_TEXT: Record<Exclude<Skin, 'own'>, FoeText> = {
  imperial: { name: 'Imperial foot', blurb: 'The Emperor’s yellow-coats, of Wallenstein’s army: drilled, well armed and often hungry, and they strip the country they march through.' },
  swede: { name: 'Swedish foot', blurb: 'Blue-coats in good order, drilled in the new manner. They fire salvos, not single shots, and hold a crossroads like a wall.' },
  muscovite: { name: 'Muscovite streltsy', blurb: 'Streltsy of Shein’s army before Smolensk: tall caps, long coats, long muskets, and an appetite for bread.' },
  tatar: { name: 'Tatar raiders', blurb: 'Nogai bands that rise out of the tall grass and dismount to take a train, sabres first.' },
  croat: { name: 'Croat horse', blurb: 'The Emperor’s Croats, the terror of Silesia, who fight dismounted with their sabres out.' },
  bandit: { name: 'Road agents and masterless men', blurb: 'Runaways, cut-purses and men who answer to no lord, in whatever they could steal. Seldom well armed and never in order, but they know the road better than you.' },
  deserter: { name: 'Deserters and river thieves', blurb: 'Unpaid soldiers who have walked away from their colours and mean to collect their arrears from the first train they meet. Some of them still have powder.' },
  raider: { name: 'Raiders', blurb: 'Horsemen and footpads in green, out of the grass or the forest for whatever the villages have. They come at a rush.' },
  champion: { name: 'Hired blades', blurb: 'A neighbour who wants your contract will hire men to take it, and a gentleman’s quarrel is settled by one man from each side.', also: 'An affair of honour is a duel to the yield.', mix: ['sabre'] },
  black: { name: 'The Black Regiment', blurb: 'Colonel Krafft’s black-coats, who have sold their swords to the other side: picked men, drilled and well armed, met only at the end of a long road.', also: 'Holds the ford at the end of the road.', mix: ['pike', 'shot', 'sabre'] }
};
/** The land each nation and each people is shown in, as at home: where its men are most to be found, or met. */
const NATION_HOME: Record<OriginId, LandId> = { cossack: 'steppe', pole: 'poland', german: 'saxony', swede: 'silesia', scot: 'prussia', magyar: 'poland', croat: 'silesia', tatar: 'lithuania' };
const FOE_HOME: Record<Exclude<Skin, 'own'>, LandId> = { imperial: 'silesia', swede: 'saxony', muscovite: 'front', tatar: 'steppe', croat: 'silesia', bandit: 'poland', deserter: 'lithuania', raider: 'ukraine', champion: 'poland', black: 'saxony' };
/** What a cap is called, and what a nation's mark is. */
const HEAD_NAME: Record<HeadKind, string> = { morion: 'a morion', hat: 'a broad felt hat', kolpak: 'a fur kolpak', kalpak: 'a tall kalpak', bonnet: 'a blue bonnet', tatar: 'a turban' };
const MARK_TEXT: Record<NationalMark, string> = { plaid: 'a tartan plaid hung from the shoulders', hanging: 'a sleeve thrown back from the shoulder', cravat: 'a red cravat', braid: 'white braid across the chest', slashes: 'slashed sleeves' };

/** "a, b and c"; where a name has an "and" of its own, "a; b and c; d". */
const cxList = (a: readonly string[]) => (a.some(x => / and /.test(x)) ? a.join('; ') : a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '');
/** A colour (#rrggbb) as its red, green and blue, each from 0 to 255. */
const cxRGB = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
/** How bright a colour is to the eye, from 0 to 1 (the relative luminance of WCAG 2). */
function cxLuma(hex: string) {
  const [r, g, b] = cxRGB(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** How well two colours read against each other, from 1 to 21; small type wants 4.5. */
function cxContrast(a: string, b: string) { const x = cxLuma(a), y = cxLuma(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/** A colour moved part of the way (t, from 0 to 1) towards another. */
function cxMix(a: string, b: string, t: number) {
  const p = cxRGB(a), q = cxRGB(b);
  return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const CX_DARK = '#1c1a17', CX_LIGHT = '#f4ecd8';
/** The ink and the ground for a bar in a coat's colour: light ink when it reads about as well as dark, and the colour itself or, if it cannot be read on, the nearest shade of it that can. */
function cxBar(coat: string) {
  const light = cxContrast(coat, CX_LIGHT) * 1.1 >= cxContrast(coat, CX_DARK), fg = light ? CX_LIGHT : CX_DARK;
  let bg = coat;
  for (let i = 0; i < 12 && cxContrast(bg, fg) < 4.5; i++) bg = cxMix(bg, light ? '#000000' : '#ffffff', 0.08);
  return { bg, fg };
}
/** The style that gives a `nation` bar that ground and ink. */
const cxBarStyle = (coat: string) => { const b = cxBar(coat); return '--n:' + b.bg + ';--nt:' + b.fg; };
/** A number with its sign, the minus a real one. */
const cxSigned = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
/** A number of at most two places, without trailing noughts. */
const cxNum = (n: number) => String(+n.toFixed(2));
const cxLine = (icon: IconName, text: string) => '<span class="line">' + ic(icon) + '<span>' + esc(text) + '</span></span>';
/** The classes in the order the company lists them, from a set. */
const cxClasses = (s: ReadonlySet<TroopClass>) => (['pike', 'shot', 'sabre'] as const).filter(c => s.has(c));

/* ---------- the nations ---------- */
/** The colours of a nation's dress as swatches, each named once, and the company's sash. */
function cxSwatches(id: NationId) {
  const N = NATIONS[id], hose = typeof N.hose === 'string' ? N.hose : N.hose ? N.hose[1] : '', seen = new Set<string>();
  const all: [string, string][] = [['Coat', N.coat], ['Trim', N.trim], ['Hose', hose], ['Boots', N.boot || MAT.boot], ['Cap', N.bag || ''], ['The company’s sash', PAL.red]];
  const own = all.filter(([, c]) => { if (!c || seen.has(c)) return false; seen.add(c); return true; });
  return '<span class="swatches" role="img" aria-label="' + esc('Colours: ' + own.map(x => x[0].toLowerCase()).join(', ')) + '">' + own.map(([n, c]) => '<i class="sw" title="' + esc(n) + '" style="background:' + c + '"></i>').join('') + '</span>';
}
function codexNation(o: Origin) {
  const N = NATIONS[o.id], T = NATION_TEXT[o.id], cs = classesOf(o);
  const lands = (Object.keys(LANDS) as LandId[]).filter(l => LANDS[l].origins.includes(o.id)).map(l => LANDS[l].name);
  const names = [0, 1, 2].map(i => o.first[i] + ' ' + o.last[i]).join(', ');
  return cardHTML({
    cls: 'cxnation', attrs: ' aria-label="' + esc(o.label) + '"', title: esc(o.label) + '<small>' + esc(cxList(cs.map(c => CLASS_MEN[c]))) + '</small>',
    art: nationArt(o, NATION_HOME[o.id]), artCls: 'squad',
    body: '<span class="flavour">' + esc(T.blurb) + '</span>' + cxLine('eye', T.dress) +
      '<span class="colours">' + flagHTML(o.label) + cxSwatches(o.id) + '</span>' +
      cxLine('map', 'Signs on in ' + cxList(lands) + '.') + cxLine('men', names + '…'),
    type: { look: 'nation', style: cxBarStyle(N.coat), text: cs.map(c => CLS[c].name).join(' · ') }
  });
}
function codexNations() {
  return '<section>' + sectHTML('The nations of the company', 'where its men come from') + '<div class="cards wide">' + ORIGINS.map(codexNation).join('') + '</div></section>';
}

/* ---------- the units ---------- */
/** The four weapons of a class, or the four armours, with what each does and what it costs to rise to it from the one before. */
function cxGearRows(slot: GearSlot, cls: TroopClass) {
  const names = slot === 'wpn' ? WPN[cls] : ARM;
  return '<span class="gearrows">' + names.map((n, i) => {
    const what = slot === 'arm' ? (i ? '−' + cxNum(ARM_PLATE * i) + ' from a blow, −' + cxNum(ARM_PLATE * i / 2) + ' from a ball' : 'Nothing')
      : cls === 'shot' ? (i ? '+' + WPN_BALL * i + ' to a ball, +' + WPN_BLOW * i + ' to a blow with the butt' : 'The old way') : (i ? '+' + WPN_BLOW * i + ' to a blow' : 'What a man starts with');
    return '<span class="gearrow"><img src="' + gearArt(slot, slot === 'wpn' ? cls : 'pike', i) + '" alt=""><span><b>' + esc(n) + '</b><small>' + esc(what) + '</small></span>' +
      '<span class="cost" title="' + (i ? 'To rise to it from the one before, thalers' : 'Issued free') + '">' + (i ? ic('coin') + GEAR_COST[i - 1] : '') + '</span></span>';
  }).join('') + '</span>';
}
function codexClass(cls: TroopClass) {
  const c = CLS[cls], skill = cls === 'shot' ? c.aim : c.mel;
  const facts = [[c.reach, 'reach'], [cls === 'shot' ? BALL_DMG[0] + '–' + BALL_DMG[1] : c.dmg[0] + '–' + c.dmg[1], cls === 'shot' ? 'a ball' : 'a blow'], [c.cd + ' s', 'between blows'], [c.arm, 'armour']];
  return cardHTML({
    cls: 'cxclass', attrs: ' aria-label="' + esc(c.name) + '"', title: esc(c.name) + '<small>lives by his ' + esc(c.skill.toLowerCase()) + '</small>',
    art: classArt(cls), artCls: 'strip4',
    body: '<span class="flavour">' + esc(CLASS_TEXT[cls]) + '</span>' +
      '<span class="strip">' + stat('heart', c.vig, 'Vigour: the blood he starts with') + stat(cls, skill, c.skill) + stat('shield', c.grd, 'Guard') + stat('boot', c.spd, 'Speed') + '</span>' +
      '<span class="facts">' + facts.map(f => '<span><b>' + esc(f[0]) + '</b> ' + f[1] + '</span>').join('') + '</span>' +
      '<span class="gearhead">His weapons, worst to best</span>' + cxGearRows('wpn', cls),
    type: { look: LOOK[cls], text: c.name }
  });
}
function codexUnit(o: Origin, cls: TroopClass) {
  const d = dressFor({ cls, skin: 'own', nation: o.id }), name = o.label + ' ' + CLS[cls].name;
  return cardHTML({
    cls: 'cxunit', attrs: ' aria-label="' + esc(name) + '"', title: esc(name) + '<small>from the ' + esc(WPN[cls][0].toLowerCase()) + ' to the ' + esc(WPN[cls][3].toLowerCase()) + '</small>',
    art: unitArt(o, cls, NATION_HOME[o.id]), artCls: 'squad',
    body: cxLine('eye', 'Head: ' + HEAD_NAME[d.head] + '.') + (d.mark ? cxLine('star', 'Mark: ' + MARK_TEXT[d.mark] + '.') : '') +
      '<span class="colours">' + flagHTML(o.label) + cxSwatches(o.id) + '</span>',
    type: { look: LOOK[cls], text: o.label }
  });
}
function codexArmour() {
  return cardHTML({
    cls: 'cxclass', attrs: ' aria-label="Armour"', title: 'Armour<small>the same four for every class</small>', art: armourArt(), artCls: 'strip4',
    body: '<span class="flavour">A man comes to better armour by buying it, a level at a time, wherever there is a market. It hides his coat, so from the buff coat up his nation is carried by his sleeves, his legs, his cap and his mark; the company’s red sash goes over all of it.</span>' + cxGearRows('arm', 'pike'),
    type: { look: 'steel', text: 'Armour' }
  });
}
function codexTraits() {
  return cardHTML({
    cls: 'cxclass', attrs: ' aria-label="Traits"', title: 'Traits<small>what a man is like</small>',
    body: '<span class="traits">' + (Object.keys(TRAITS) as Trait[]).map(k => '<span class="line' + (TRAITS[k].good ? '' : ' bad') + '">' + ic(TRAITS[k].good ? 'star' : 'warn') + '<span><b>' + esc(k) + '</b> ' + esc(TRAITS[k].desc) + '</span></span>').join('') + '</span>',
    type: { look: 'ink', text: 'Good and bad' }
  });
}
function codexUnits() {
  let h = '';
  for (const cls of ['pike', 'shot', 'sabre'] as const) {
    const from = ORIGINS.filter(o => o.cls.includes(cls));
    h += '<section>' + sectHTML(CLS[cls].name, from.length + (from.length === 1 ? ' nation sends him' : ' nations send him')) + '<div class="cards wide">' + codexClass(cls) + from.map(o => codexUnit(o, cls)).join('') + '</div></section>';
  }
  return h + '<section>' + sectHTML('Armour and character', 'what any man may wear, and what he may be like') + '<div class="cards wide">' + codexArmour() + codexTraits() + '</div></section>';
}

/* ---------- the foes ---------- */
/** The classes a people fields, from the fights it takes part in. */
function cxFoeClasses(skin: Exclude<Skin, 'own'>) {
  const s = new Set<TroopClass>(FOE_TEXT[skin].mix || []);
  for (const a of Object.keys(AMBUSHES) as AmbushId[]) if (AMBUSHES[a].skin === skin) AMBUSHES[a].mix.forEach(c => s.add(c));
  for (const t of TEMPLATES) if (t.skin === skin) t.mix.forEach(c => s.add(c));
  return cxClasses(s);
}
function codexFoe(skin: Exclude<Skin, 'own'>) {
  const T = FOE_TEXT[skin], cs = cxFoeClasses(skin), coat = SKINS[skin].coat;
  const lands = (Object.keys(LANDS) as LandId[]).filter(l => LANDS[l].ambush.some(a => AMBUSHES[a].skin === skin)).map(l => LANDS[l].name);
  const jobs = TEMPLATES.filter(t => t.skin === skin).map(t => '“' + t.title + '”');
  return cardHTML({
    cls: 'cxfoe', attrs: ' aria-label="' + esc(T.name) + '"', title: esc(T.name), art: peopleArt(skin, cs, 1, FOE_HOME[skin]), artCls: 'squad',
    body: '<span class="flavour">' + esc(T.blurb) + '</span>' + (lands.length ? cxLine('map', 'Waylays trains in ' + cxList(lands) + '.') : '') +
      (jobs.length ? cxLine('scroll', 'Hired against in ' + cxList(jobs) + '.') : '') + (T.also ? cxLine('swords', T.also) : ''),
    type: { look: 'nation', style: cxBarStyle(coat), text: cs.map(c => CLS[c].name).join(' · ') }
  });
}
function codexTier(t: number) {
  const gear = Math.max(0, t - 1);
  return cardHTML({
    cls: 'cxtier', attrs: ' aria-label="' + esc(cap1(TIER[t])) + '"', title: esc(cap1(TIER[t])) + '<small>' + (gear ? 'level ' + gear + ' arms and armour' : t ? 'the same arms, better drilled' : 'the arms and armour a man starts with') + '</small>',
    art: peopleArt('imperial', ['pike', 'shot'], t, 'silesia'), artCls: 'squad',
    body: '<span class="strip">' + stat('heart', Math.round(100 * TVIG[t]) + '%', 'Vigour, against a man of the same class in the company') + stat('swords', cxSigned(TSK[t]), 'To skill and to guard') + stat('flame', TMOR[t], 'Spirit at the start') + stat('cuirass', gear, 'Level of arms and armour') + '</span>',
    type: { look: (['grey', 'ink', 'weld', 'madder'] as const)[t], text: cap1(TIER[t]) }
  });
}
function codexFoes() {
  const people = Object.keys(FOE_TEXT) as Exclude<Skin, 'own'>[];
  return '<section>' + sectHTML('Peoples met on the road', 'who waylays a train, and who is hired against') + '<div class="cards wide">' + people.map(codexFoe).join('') + '</div></section>' +
    '<section>' + sectHTML('How well drilled', 'every foe has a degree of drill, and the arms that go with it') + '<div class="cards wide">' + TIER.map((_, t) => codexTier(t)).join('') + '</div></section>';
}

/* ---------- the lands ---------- */
/** What is said of each land: what it is called by the eye, and what the traveller sees in it (the pictures are drawn from TERRAINS in terrain.ts). */
const LAND_TEXT: Record<LandId, { epithet: string; blurb: string }> = {
  steppe: { epithet: 'Open grass', blurb: 'The Wild Fields, where the Dnieper runs out into grass and the Crimean khan’s horse rides. There is nothing to stand behind: a burial mound with its stone woman, a Cossack watchtower with a tar barrel on a pole, a lone thorn tree, a well with its sweep, a herd far off. Feather grass reaches the stirrup.' },
  ukraine: { epithet: 'Villages and willows', blurb: 'Rolling country of whitewashed huts under thatch, willows by the ponds, windmills on the rises and wooden churches with their three domes. Black earth is ploughed up to the doors, and the haystacks stand until the snow.' },
  poland: { epithet: 'The Crown’s plain', blurb: 'Wide ploughland and birch groves under a high sky: a village church with its spire, thatched cottages, a storks’ nest on a pole, a manor behind its wall, windmills, and a wayside cross where the roads part.' },
  prussia: { epithet: 'Dykes, dunes and sails', blurb: 'The Vistula delta and the Baltic shore: flat country behind its dykes, ditches full of reeds, a brick church with its steep spire and a Dutch tower mill, pines on the dunes, and ships standing out on the grey water.' },
  lithuania: { epithet: 'Forest and lake', blurb: 'The Grand Duchy: wall after wall of spruce and pine, with log huts and a small wooden chapel in the clearings, birches, boulders and bracken, and still lakes the mist comes off.' },
  front: { epithet: 'Siege lines', blurb: 'Before Smolensk the country has been dug over: earthworks with their gabions and guns, tents in rows, smoke from burning villages and bare trees, and, on its hill, the walled city with its towers, which the Crown’s army has come to relieve.' },
  silesia: { epithet: 'Hills and burnt farms', blurb: 'The Emperor’s hills under the blue line of the mountains: a castle on its rise, half-timbered farms and a church spire, and everywhere the marks of fifteen years of war, roofless houses, smoke, and a gibbet at the crossroads.' },
  saxony: { epithet: 'The Elbe valley', blurb: 'Vineyards on the slopes, half-timbered houses round a church, a castle on its rock or a windmill, hop poles in the fields, and the Elbe behind them with its barges and reeds.' }
};
/** What is said of each place a fight is fought at, besides the land: the work that is done there is read from SITE_OF. */
const SITE_TEXT: Record<SiteId, { name: string; blurb: string }> = {
  ford: { name: 'The ford', blurb: 'A shallow crossing, with stepping stones and reeds on both banks, where horse and foot must wade and whoever waits in the reeds fires first.' },
  river: { name: 'The riverbank', blurb: 'A broad river and its reeds, with rafts of grain and boats tied up along the bank.' },
  mill: { name: 'The burnt mill', blurb: 'The stump of a mill with its sails burned off, smoke still rising, and a dead tree beside it: good cover for men with powder.' },
  toll: { name: 'The toll house', blurb: 'A toll house at the end of a plank bridge over a stream, its barrier pole across the road.' },
  wagons: { name: 'The wagon road', blurb: 'A convoy of covered wagons strung out along a rutted road.' },
  pond: { name: 'The mill-pond', blurb: 'A pond held back by a weir, with a watermill and its wheel at one end.' },
  picket: { name: 'The picket', blurb: 'A crossroads with its signpost, a palisade of stakes, and the tents of a picket in a row.' },
  forage: { name: 'The foragers’ farm', blurb: 'A barn and its haystacks, and a cart standing loaded, where an army that lives off the country is helping itself.' },
  burning: { name: 'The burning village', blurb: 'Thatched huts on fire, smoke in columns, and cattle being driven off to one side.' },
  manor: { name: 'The manor', blurb: 'A manor behind its low wall, shaded by oaks, with a cellar worth holding.' },
  blockhouse: { name: 'The blockhouse', blurb: 'A log blockhouse behind a palisade of stakes, put up to hold a road.' },
  road: { name: 'The wayside', blurb: 'A rutted road, a wayside cross, and a couple of carts standing on it.' },
  ravine: { name: 'The ravine', blurb: 'A cleft cut across the hills, where the road narrows, with scrub on its lip and rocks at its foot.' },
  edge: { name: 'The edge of the forest', blurb: 'The first trees of a forest close at one side of the road, with bushes in front of them and the light behind.' }
};
/** What each weather does to a fight, beyond the picture: read from MISFIRE, MUSKET_RANGE and WEATHER_ODDS. */
const WEATHER_TEXT: Record<Weather, string> = {
  clear: 'The sun is out and the air is clear. A musket does its work as it should.',
  rain: 'A grey sky, puddles standing on the ground and the colours washed out. Matchlocks misfire in the wet.',
  fog: 'Fog on the hills and the far country gone, so that the landmarks are ghosts. Muskets carry a little over half as far and aim worse.'
};
/** The place's names for the lands' towns and camps, major ones first. */
const cxPlaces = (id: LandId) => {
  const here = (Object.keys(PLACES) as PlaceId[]).filter(p => PLACES[p].land === id), major = here.filter(p => PLACES[p].major).map(p => PLACES[p].name), minor = here.length - major.length;
  return cxList(minor ? [...major, minor === 1 ? 'one more' : minor + ' more'] : major) + '.';
};
function codexLand(id: LandId) {
  const L = LANDS[id], T = LAND_TEXT[id];
  const origins = L.origins.map(o => ORIGINS.find(x => x.id === o)!.label), work = TEMPLATES.filter(t => t.lands && t.lands.includes(id)).map(t => '“' + t.title + '”');
  return cardHTML({
    cls: 'cxland', attrs: ' aria-label="' + esc(L.name) + '"', title: esc(cap1(L.name)) + '<small>' + esc(T.epithet) + '</small>',
    art: landArt(id), artCls: 'panorama',
    body: '<span class="flavour">' + esc(T.blurb) + '</span>' + cxLine('map', cap1(cxPlaces(id))) +
      '<span class="line">' + ic('men') + '<span class="colours">' + L.origins.map(o => flagHTML(ORIGINS.find(x => x.id === o)!.label)).join('') + '<span>Men sign on here: ' + esc(cxList(origins)) + '.</span></span></span>' +
      cxLine('swords', 'Trains are waylaid by ' + cxList(L.ambush.map(a => AMBUSHES[a].foe)) + '.') + (work.length ? cxLine('scroll', 'Work posted: ' + cxList(work) + '.') : '') +
      '<span class="line">' + ic('warn') + '<span>' + pips(L.danger, 3, DANGER[L.danger]) + ' ' + esc(DANGER[L.danger]) + '</span></span>',
    type: { look: 'nation', style: cxBarStyle(TONES[id].mark), text: esc(T.epithet) }
  });
}
function codexWeather(w: Weather) {
  const odds = Math.round(100 * WEATHER_ODDS[w]), icon = w === 'clear' ? 'sun' : w;
  return cardHTML({
    cls: 'cxweather', attrs: ' aria-label="' + esc(WEATHER[w]) + '"', title: esc(cap1(w)) + '<small>' + odds + ' days in a hundred</small>', art: landArt('poland', w), artCls: 'panorama',
    body: '<span class="flavour">' + esc(WEATHER_TEXT[w]) + '</span>' +
      cxLine('shot', 'A shot misfires ' + Math.round(100 * MISFIRE[w]) + ' times in a hundred.') + cxLine('eye', 'A musket carries ' + MUSKET_RANGE[w] + ' paces' + (w === 'fog' ? ', and ' + Math.round(100 * FOG_AIM) + ' in a hundred fewer shots find their man.' : '.')),
    type: { look: w === 'clear' ? 'weld' : w === 'rain' ? 'woad' : 'grey', text: ic(icon as IconName) + esc(cap1(w)) }
  });
}
function codexSite(id: SiteId) {
  const T = SITE_TEXT[id];
  const tpls = (Object.keys(SITE_OF) as Contract['tpl'][]).filter(k => SITE_OF[k] === id);
  const names = [...new Set(tpls.map(k => k === 'final' ? 'The Black Regiment at the ford' : (TEMPLATES.find(t => t.id === k) || AMBUSHES[k as AmbushId]).title))];
  const lands = new Set<LandId>();
  for (const k of tpls) { const t = TEMPLATES.find(x => x.id === k); if (t && t.lands) t.lands.forEach(l => lands.add(l)); for (const l of Object.keys(LANDS) as LandId[]) if (LANDS[l].ambush.includes(k as AmbushId)) lands.add(l); }
  const home = [...lands][0] || 'poland';
  return cardHTML({
    cls: 'cxsite', attrs: ' aria-label="' + esc(T.name) + '"', title: esc(T.name), art: siteArt(id, home), artCls: 'squad',
    body: '<span class="flavour">' + esc(T.blurb) + '</span>' + cxLine('scroll', 'Fought for: ' + cxList(names.map(n => '“' + n + '”')) + '.') + (lands.size ? cxLine('map', 'Seen in ' + cxList([...lands].map(l => LANDS[l].name)) + '.') : ''),
    type: { look: 'ink', text: esc(T.name) }
  });
}
function codexLands() {
  const lands = Object.keys(LANDS) as LandId[], sites = Object.keys(SITE_TEXT) as SiteId[];
  return '<section>' + sectHTML('The lands of the road', 'what each looks like, and who is in it') + '<div class="cards lands">' + lands.map(codexLand).join('') + '</div></section>' +
    '<section>' + sectHTML('The weather', 'the same country on three days') + '<div class="cards wide">' + (['clear', 'rain', 'fog'] as const).map(codexWeather).join('') + '</div></section>' +
    '<section>' + sectHTML('Where a fight is fought', 'a piece of work, or an ambush, may name the place') + '<div class="cards wide">' + sites.map(codexSite).join('') + '</div></section>';
}

/* ---------- the train and the goods ---------- */
function codexHand(k: StaffId) {
  const s = STAFF[k];
  return cardHTML({
    cls: 'cxhand', attrs: ' aria-label="' + esc(s.name) + '"', title: esc(s.name), art: staffArt(k, 'poland'), body: STAFF_FX[k].map(fxLine).join(''),
    type: { look: 'moss', text: '+' + s.wage + ' a month', coin: s.fee, coinLabel: 'Fee to engage, thalers' }
  });
}
function codexSupply(k: Supply) {
  const bread = k === 'bread';
  return '<div class="pile">' + cardHTML({
    cls: 'cxsupply', attrs: ' aria-label="' + (bread ? 'Bread' : 'Powder') + '"', title: bread ? 'Bread' : 'Powder', art: supplyArt(k), badges: '<span class="badge right">×10</span>',
    body: fxLine(bread ? ['men', 'Each man eats one a day'] : ['shot', 'One charge a shot']),
    type: { look: 'weld', text: 'Supply', coin: bread ? BREAD_COST : POWDER_COST, coinLabel: 'Price of ten, thalers' }
  }) + '</div>';
}
function codexGoods() {
  return '<section>' + sectHTML('The baggage train', 'hired hands, engaged once and paid by the month') + '<div class="cards">' + (Object.keys(STAFF) as StaffId[]).map(codexHand).join('') + '</div></section>' +
    '<section>' + sectHTML('Supplies', 'bought ten at a time, wherever there is a market') + '<div class="cards">' + codexSupply('bread') + codexSupply('powder') + '</div></section>' +
    '<section>' + sectHTML('The commissions of 1633', 'the cargoes a company can raise its banner for') + '<div class="cards wide quests">' + QUESTS.map(q => questCard(q, false)).join('') + '</div></section>';
}

/** The encyclopedia screen: a way back, the tabs, and the open tab. */
function codexHTML() {
  const back = BACK_WORD[ui.codexFrom] || 'Back';
  return '<div class="codex"><div class="codex-head"><button class="btn ghost" data-act="codexBack">' + ic('retreat') + esc(back) + '</button>' +
    '<div><h2 class="codex-title">Encyclopedia</h2><p class="codex-sub">The nations of the company and the men they send, the arms and armour a man can come to, the foes on the road, the lands they are met in, and the baggage train.</p></div></div>' +
    '<nav class="tabs" role="tablist" aria-label="The encyclopedia">' + CODEX_TABS.map(t => '<button role="tab" data-act="codexTab" data-k="' + t[0] + '" aria-selected="' + (ui.codex === t[0]) + '">' + ic(t[1]) + t[2] + '</button>').join('') + '</nav>' +
    '<div class="panel" role="tabpanel">' + (ui.codex === 'nations' ? codexNations() : ui.codex === 'units' ? codexUnits() : ui.codex === 'foes' ? codexFoes() : ui.codex === 'lands' ? codexLands() : codexGoods()) + '</div></div>';
}
