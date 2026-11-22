"use strict";
/* ===== SOTNIA training: the guide that walks a new captain through the training commission =====
 * A training commission (a quest with `training` set: see QUESTS in journey.ts) is an ordinary commission on a short and quiet road, and a guide that stays
 * beside the screen while it is played: a strip at the foot of the page that says what to do next and why, and a gilt ring on the thing to do it with. It
 * teaches the real game, not a picture of it: every step is done with the clicks the game has, on the rules the game plays by.
 *
 * Nothing is shut off to make the captain follow it. The guide only watches: after each drawing of the screen (render() in screens.ts) it looks at the
 * campaign and the interface, and when the step in hand has been done it goes on to the next. A step can be skipped, and the whole guide sent away.
 * The lesson and the way it goes on are in the first part, which touches nothing of the page; the strip is the second.
 */

/* ---------- the lesson ---------- */
/** Where the guide has got to: the step it is at (an index into TRAINING), and whether the captain sent it away. It is kept with the campaign. */
interface TrainingState { step: number; off?: true }
/** The parts of the lesson, in the order they are taught. */
type TrainingChapter = 'goal' | 'camp' | 'fight' | 'road' | 'end';
interface ChapterInfo { name: string; icon: IconName }
const CHAPTERS: Record<TrainingChapter, ChapterInfo> = {
  goal: { name: 'The commission', icon: 'flag' },
  camp: { name: 'The camp', icon: 'tent' },
  fight: { name: 'A fight', icon: 'swords' },
  road: { name: 'The road', icon: 'road' },
  end: { name: 'The ledger closed', icon: 'book' }
};
type TrainId = 'commission' | 'ledger' | 'roll' | 'orders' | 'close' | 'market' | 'hire' | 'bread' | 'work' | 'muster' | 'arms' | 'battle' | 'report' | 'leg' | 'town' | 'course' | 'deliver' | 'farewell';
/** What a step says, and what it rings: the words (a few short paragraphs, which may carry **bold** and {icon}) and the selectors of what to point at. */
interface Say { text: string[]; aim: string[] }
/**
 * One step of the lesson. screens are where it is done: anywhere else the strip says where to go (elsewhere, for a fight's step met in the camp). A step with
 * a done is done by doing: done says when the captain has, and the guide goes on by itself. A step without one is read, and has a button that goes on. moot says
 * that a step no longer applies (the captain is past what it teaches), and the guide goes on without it. aim lists selectors that name one thing each (an
 * attribute, a class or an id, joined): the tests check that each is on the screen.
 */
interface TrainStep {
  id: TrainId; chapter: TrainingChapter; title: string; screens: readonly ScreenId[];
  text: (g: Campaign) => string[]; aim: (g: Campaign) => string[];
  done?: (g: Campaign) => boolean; moot?: (g: Campaign) => boolean;
  button?: { label: string; act: string; icon: IconName }; // what a read step's button says and does, where it is not "Understood"
  elsewhere?: { title: string; say: (g: Campaign) => Say };
}

/** The thing in the camp that opens each page, as the words of a step name it. */
const PAGE_THING: Record<TabId, string> = {
  map: 'the signpost (**Road**)', roll: 'the tent (**Roll**)', market: 'the wagon (**Market**)', work: 'the noticeboard (**Work**)', command: 'the captain’s tent (**Command**)', log: 'the banner (**Chronicle**)'
};
/** How to get a page open, as words and a ring: the thing in the camp that opens it, or the cross of the page that is in the way. open is true where it is open already. */
function wayTo(k: TabId, lead = ''): Say & { open: boolean } {
  if (ui.panel === k) return { open: true, text: [], aim: [] };
  return ui.panel ?
    { open: false, text: [lead + 'Another page is open over the camp: put it away (its cross, or **Esc**), then open ' + PAGE_THING[k] + '.'], aim: ['[data-act="panelClose"]'] } :
    { open: false, text: [lead + 'Open ' + PAGE_THING[k] + '.'], aim: ['[data-act="panel"][data-k="' + k + '"]'] };
}
/** What to say and ring for something done inside a page: with the page open, that; otherwise how to open the page. lead begins the words of the way to it. */
function pageSay(k: TabId, inside: (g: Campaign) => Say, lead?: (g: Campaign) => string): (g: Campaign) => Say {
  return g => { const w = wayTo(k, lead ? lead(g) : ''); return w.open ? inside(g) : w; };
}
/** A step done inside a page, as the words and the ring it is made of. */
function inPage(k: TabId, inside: (g: Campaign) => Say, lead?: (g: Campaign) => string): Pick<TrainStep, 'text' | 'aim'> {
  const say = pageSay(k, inside, lead);
  return { text: g => say(g).text, aim: g => say(g).aim };
}
/** The next stretch of the road the company has to march, or null at the end of it. */
function trainLeg(g: Campaign) { const r = routeTo(g, questOf(g).to); return r ? r[0] : null; }
/** The job on the noticeboard for a first fight: the easy one, which the board always has in the first town. */
function easyJob(g: Campaign) { return g.contracts.find(c => c.grade === 'easy') || g.contracts[0] || null; }
const fought = (g: Campaign) => g.stats.battles > 0;
/** Whether the bread will not last the next stretch of the road, and the purse could buy more: the one thing that stops a course at a market. */
const needBread = (g: Campaign) => { const leg = trainLeg(g); return !!leg && g.bread < breadDue(g) * leg.days && g.thalers >= breadPrice(g); };
/** What the market is for, as the bread of the next stretch makes it: what the company eats on the way, what it has, and what ten loaves cost. */
function breadInside(g: Campaign): Say {
  const leg = trainLeg(g), need = breadDue(g);
  if (!leg) return { text: ['There is no road left to buy bread for.'], aim: [] };
  return { aim: ['[data-act="buy"][data-k="bread"]'], text: [
    'The road to ' + PLACES[leg.to].name + ' is ' + plural(leg.days, 'day', 'days') + ', and the company eats ' + plural(need, 'loaf', 'loaves') + ' a day: ' + need * leg.days + ' in all. You have ' + g.bread + '.',
    'Ten loaves cost ' + breadPrice(g) + ' thalers. A course will not march on without bread to last to the next market.'] };
}
/** The words that open the step at a town on the way: where the company is, what every town has, and that the pay day has been if it has. */
function townLead(g: Campaign) {
  const q = questOf(g), paid = g.payDue > q.start + (q.payIn || 30);
  return 'You are at ' + cap1(here(g).name) + '. Every town has a market, men to hire and work posted.' + (paid ? ' Pay day has come on the road, and the men were paid from the purse.' : '') + ' ';
}
const toFight = (g: Campaign): Say => {
  const w = wayTo('work'), job = easyJob(g);
  return { text: ['The training goes on in a fight. ' + (w.open ? 'Press **Muster** on a job.' : w.text[0])], aim: w.open ? (job ? ['[data-act="muster"][data-id="' + job.id + '"]'] : []) : w.aim };
};

/** A course, or the bread it cannot leave a market without. */
const sayCourse = pageSay('map', g => ({ text: ['Pick ' + PLACES[questOf(g).to].name + ' in the list and press **March**. The company marches leg after leg until something needs you: raiders, a camp event, bread or pay running short.'],
  aim: ['#course-to', '[data-act="course"]:not([data-f])'] }), () => 'From here you can set a course instead of marching leg by leg. ');
const sayBread = pageSay('market', g => breadInside(g), () => 'Bread first: a course will not leave a market with bread that will not last to the next. ');

const TRAINING: readonly TrainStep[] = [
  { id: 'commission', chapter: 'goal', title: 'Your commission', screens: ['camp'],
    text: g => { const q = questOf(g); return [
      'You carry the Crown’s chest, ' + q.cargo.n + ' thalers, from ' + cap1(PLACES[q.from].name) + ' to ' + PLACES[q.to].name + ', to be there by ' + dateText(q.deadline, true) + '.',
      'Arrive in time, with the chest whole and a company still standing: that is the whole game. Each day late takes 2% off the fee, and each thaler missing from the chest comes off it too.']; },
    aim: () => ['.stat.due'] },
  { id: 'ledger', chapter: 'goal', title: 'The ledger', screens: ['camp'],
    text: g => [
      'The bar is your ledger: days left, the chest, thalers, bread, powder and renown. Rest the pointer on a figure, or tap it, to see what it comes to.',
      'Bread goes every day, and wages fall due every thirty days (the first, to show you, in ' + plural(Math.max(0, g.payDue - g.date), 'day', 'days') + '). Hungry or unpaid men lose heart and desert.'],
    aim: () => ['.stats'] },
  { id: 'roll', chapter: 'camp', title: 'Open the roll', screens: ['camp'],
    text: () => ['Everything in the camp is a button, and each has its name over it. The roll is where your men are.', ...wayTo('roll').text],
    aim: () => wayTo('roll').aim,
    done: () => ui.panel === 'roll' },
  { id: 'orders', chapter: 'camp', title: 'Give an order', screens: ['camp'],
    ...inPage('roll', g => ({
      text: ['Pikemen hold the line, musketeers shoot, sabreurs hunt musketeers. Each man has an order for the day: **drill** teaches him, **rest** heals him, **forage** finds bread.',
        'Send ' + (g.roster[0] ? g.roster[0].name.split(' ')[0] : 'a man') + ' to forage.'],
      aim: g.roster[0] ? ['[data-act="order"][data-o="forage"][data-id="' + g.roster[0].id + '"]'] : [] })),
    done: g => g.roster.some(s => s.order === 'forage') },
  { id: 'close', chapter: 'camp', title: 'Put the page away', screens: ['camp'],
    text: () => ['A page opens over the camp, and the ledger stays in view. Put it away with its cross, with **Esc**, or with a click beside it.'],
    aim: () => ['[data-act="panelClose"]'],
    done: () => ui.panel === null },
  { id: 'market', chapter: 'camp', title: 'Open the market', screens: ['camp'],
    text: () => ['The wagon is the market: men to hire, bread, powder, and the chest itself, which you never sell, for every thaler taken comes off your fee.', ...wayTo('market').text],
    aim: () => wayTo('market').aim,
    done: () => ui.panel === 'market' },
  { id: 'hire', chapter: 'camp', title: 'Hire a man', screens: ['camp'],
    ...inPage('market', g => ({
      text: ['A man costs the thalers on his coin, once, and then draws his wages every month. The roll holds ' + ROSTER_MAX + '. Hire one you can afford.'],
      aim: g.recruits.map((r, i) => (recruitPrice(g, r) <= g.thalers ? '[data-act="hire"][data-i="' + i + '"]' : '')).filter(Boolean) })),
    done: g => g.roster.length > questOf(g).men.length || g.roster.length >= ROSTER_MAX || !g.recruits.some(r => recruitPrice(g, r) <= g.thalers) },
  { id: 'bread', chapter: 'camp', title: 'Buy bread', screens: ['camp'],
    ...inPage('market', g => breadInside(g)),
    done: g => !needBread(g) },
  { id: 'work', chapter: 'fight', title: 'Find some work', screens: ['camp'],
    text: () => ['Paid fights are posted on the noticeboard. A win earns thalers and renown, and renown brings better men to the market, better pay and places for officers.', ...wayTo('work').text],
    aim: () => wayTo('work').aim,
    done: g => ui.panel === 'work' || ui.screen === 'muster' || ui.screen === 'battle' || fought(g) },
  { id: 'muster', chapter: 'fight', title: 'Choose a fight', screens: ['camp'],
    ...inPage('work', g => {
      const job = easyJob(g);
      return { text: ['Each job shows its foe, its pay and what the scouts think of your chances.' + (job ? ' Take “' + job.title + '” for a first fight: its foe is the weakest on the board.' : ''), 'Press **Muster** on it.'],
        aim: job ? ['[data-act="muster"][data-id="' + job.id + '"]'] : [] };
    }),
    done: g => ui.screen === 'muster' || ui.screen === 'battle' || fought(g) },
  { id: 'arms', chapter: 'fight', title: 'Choose your men', screens: ['muster'],
    text: () => ['The scouts have picked the fittest men: click a man to add him or take him off. Then choose how you open: **Hold** waits for them, **Advance** marches on them, **Charge** rushes them. The pips say which the scouts favour.', 'Press **To arms**.'],
    aim: () => ['.stances', '[data-act="fight"]'],
    done: g => ui.screen === 'battle' || fought(g),
    elsewhere: { title: 'To the fight', say: toFight } },
  { id: 'battle', chapter: 'fight', title: 'In the fight', screens: ['battle'],
    text: () => ['Keys **1**, **2** and **3** change your order at any moment; **O** calls your captain’s order, once; **Space** pauses, and the buttons speed it up. The retreat saves men but costs the fee.', 'When it is decided, press **Count the cost**.'],
    aim: () => ['#orders', '#captain', '#speed'],
    done: g => fought(g),
    elsewhere: { title: 'To the fight', say: toFight } },
  { id: 'report', chapter: 'fight', title: 'The butcher’s bill', screens: ['report'],
    text: () => ['Each card tells how a man fared: kills, experience, and whether he was hurt, struck down (abed for days) or killed. A win pays thalers and renown, and may loot bread and powder.', 'Press **Back to camp**: the fight took the day.'],
    aim: () => ['[data-act="camp"]'],
    done: () => ui.screen === 'camp' || ui.screen === 'end' },
  { id: 'leg', chapter: 'road', title: 'March a leg', screens: ['camp'],
    ...inPage('map', g => {
      const leg = trainLeg(g);
      return leg ? { text: ['Under **One leg at a time**, march to ' + PLACES[leg.to].name + ': ' + plural(leg.days, 'day', 'days') + ', and the company eats ' + breadDue(g) * leg.days + ' loaves on the way.' +
        (g.bread < breadDue(g) * leg.days ? ' You have only ' + g.bread + ', and the men would go hungry.' : '')], aim: ['[data-act="march"][data-r="' + leg.i + '"]:not([data-f])'] } : { text: ['The road is done.'], aim: [] };
    }, () => 'Now the road. '),
    done: g => g.path.length > 1 || atEnd(g) },
  { id: 'town', chapter: 'road', title: 'A town on the road', screens: ['camp'],
    ...inPage('market', g => breadInside(g), townLead),
    done: g => !needBread(g),
    moot: g => atEnd(g) },
  { id: 'course', chapter: 'road', title: 'Set a course', screens: ['camp'],
    text: g => (needBread(g) ? sayBread : sayCourse)(g).text,
    aim: g => (needBread(g) ? sayBread : sayCourse)(g).aim,
    done: g => atEnd(g) },
  { id: 'deliver', chapter: 'road', title: 'Hand over the chest', screens: ['camp'],
    text: g => ['You are at ' + PLACES[questOf(g).to].name + '. A button over the scene now hands over the chest: it names the fee, less anything missing and less 2% for each day late.', 'Press **Hand over the chest**.'],
    aim: () => ['[data-act="deliver"]'],
    done: g => !!g.over },
  { id: 'farewell', chapter: 'end', title: 'The training is done', screens: ['end'],
    text: g => g.over === 'arrived' ? [
      'That is a whole commission: the camp, the market, a fight, the road and the delivery. A real one is longer, its raiders stronger and its day nearer.',
      'The {book} encyclopedia and the {scroll} standing orders, at the top right, answer the rest. Raise a banner of your own when you are ready.'] : [
      'The company was broken before the chest came in. That is how a commission fails: no men, or no coin to keep them.',
      'Begin the training again from the title: it costs nothing but the time.'],
    aim: () => ['[data-act="title"]'],
    button: { label: 'Choose a commission', act: 'title', icon: 'flag' } }
];

/** The guide of the campaign in play, if it has one that has not been sent away or finished. */
function trainingOf(g: Campaign | null): TrainingState | null {
  return g && g.training && !g.training.off && g.training.step < TRAINING.length ? g.training : null;
}
/** Goes on past every step that has been done, or that no longer applies: called after each drawing of the screen, so a step is done the moment the captain does it. */
function trainingAdvance(g: Campaign | null) {
  const t = trainingOf(g);
  while (t && t.step < TRAINING.length) {
    const s = TRAINING[t.step];
    if ((s.done && s.done(g!)) || (s.moot && s.moot(g!))) t.step++; else break;
  }
}
/** The buttons of the strip: a read step goes on, and so does a skipped one; the guide can be sent away for good. */
function trainingNext(g: Campaign) { const t = trainingOf(g); if (t) t.step++; }
function trainingLeave(g: Campaign) { const t = trainingOf(g); if (t) t.off = true; }

/* ---------- what the guide says when the captain is somewhere the step is not ---------- */
/** A word about a dialog, or a screen of a fight, that the lesson does not stand in. */
interface Aside { title: string; text: string[]; aim: string[] }
const ASIDE: Record<'ambush' | 'event' | 'muster' | 'battle' | 'report', Aside> = {
  ambush: { title: 'Raiders on the road', aim: [], text: ['Raiders have fallen on the train. **Stand and fight**, with the scouts’ odds before you, or pay them off, from the chest (which comes off your fee) or from your own purse. Beaten, you lose a third of the chest.'] },
  event: { title: 'A camp event', aim: [], text: ['Something has come up. Each answer shows what it costs or earns, so read before you choose: some cost nothing at all.'] },
  muster: { title: 'At the muster', aim: ['[data-act="fight"]'], text: ['Choose who fights and how they open, then press **To arms**: or go back to camp to carry on with the training.'] },
  battle: { title: 'The fight', aim: ['#orders', '#captain'], text: ['Keys **1**, **2** and **3** change the order, **O** calls the captain’s order, **Space** pauses. Press **Count the cost** when it is decided.'] },
  report: { title: 'The count', aim: ['[data-act="camp"]'], text: ['Press the button at the foot of the report when you have read the bill.'] }
};

/* ---------- the strip: what the guide shows ---------- */
/** What the strip shows now: where in the lesson, what the step says, what to ring, and the button that goes on. */
interface CoachView {
  key: string; // what it is about, which changes when its words do: a reader of the screen is told once
  chapter: ChapterInfo;
  n: number; of: number; // the step and the number of them; n is 0 before the first
  title: string; lines: string[]; aim: string[];
  button: { label: string; act: string; icon: IconName } | null; // the button of a step that is read
  todo: boolean; // whether the captain has something to do for the guide to go on
  skip: boolean; // whether the step can be skipped
  leave: boolean; // whether the guide can be sent away: not before there is a company to leave it, nor when the road is done
}
/** The strip as it stands: null where there is no training in play, or nothing to be said on this screen. */
function coachView(): CoachView | null {
  const screen = ui.screen;
  if (screen === 'title' || screen === 'codex') return null;
  if (screen === 'captain') {
    const cs = ui.captains, q = cs ? QUESTS.find(x => x.id === cs.q) : null;
    if (!q || !q.training) return null;
    return { key: 'captain', chapter: CHAPTERS.goal, n: 0, of: TRAINING.length, title: 'Choose a captain', skip: false, leave: false, todo: true, button: null, aim: ['[data-act="new"]'],
      lines: ['Before the road, the company needs a captain. Each of the three has a gift, a flaw and an order he calls once in a fight, and leads from the first day to the last.', 'Any will do for the training: pick one, and press **Take command**.'] };
  }
  const g = G, t = trainingOf(g);
  if (!g || !t) return null;
  const last = screen === 'end', s = last ? TRAINING[TRAINING.length - 1] : TRAINING[t.step];
  const base = { chapter: CHAPTERS[s.chapter], n: last ? TRAINING.length : t.step + 1, of: TRAINING.length, button: null, todo: false, skip: false, leave: !last };
  const aside = (key: string, a: Aside): CoachView => ({ ...base, key, title: a.title, lines: a.text, aim: a.aim });
  if (ui.modal && (ui.modal.type === 'ambush' || ui.modal.type === 'event')) return aside('modal:' + ui.modal.type, ASIDE[ui.modal.type]);
  if (!s.screens.includes(screen)) {
    if (screen === 'camp') { const e = s.elsewhere; return e ? { ...base, key: s.id + ':elsewhere:' + ui.panel, title: e.title, lines: e.say(g).text, aim: e.say(g).aim } : null; }
    if (screen === 'muster' || screen === 'battle' || screen === 'report') return aside('screen:' + screen, ASIDE[screen]);
    return null;
  }
  // the words and the ring depend on where the captain stands (which page is open), so the page is part of what the strip is about
  return { ...base, key: s.id + ':' + ui.panel, title: s.title, lines: s.text(g), aim: s.aim(g), skip: !last, todo: !!s.done, button: s.done ? null : s.button || { label: 'Understood', act: 'trainNext', icon: 'check' } };
}

/** What the training covers, for the title to show beside its card: each chapter of the lesson with the steps in it, read out of the lesson itself. */
function trainingSyllabusHTML() {
  const chapters = (Object.keys(CHAPTERS) as TrainingChapter[]).filter(k => k !== 'end');
  return '<div class="syllabus"><p>A guide at the foot of the screen says what to do next, and rings the thing to do it with. Every step is done in the game as it is played; any can be skipped, and the whole guide sent away.</p>' +
    '<ol class="how">' + chapters.map(k => '<li><span class="disc">' + ic(CHAPTERS[k].icon) + '</span><span><b>' + esc(CHAPTERS[k].name) + '</b>' + TRAINING.filter(t => t.chapter === k).map(t => esc(t.title)).join(' · ') + '</span></li>').join('') + '</ol></div>';
}
/** A line of the guide as markup: its words escaped, **bold** for what to look for on the screen, and {name} for the icon of a thing the captain will see there. */
function coachMarkup(s: string) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\{(\w+)\}/g, (m, k: string) => (k in ICON ? ic(k as IconName) : m));
}
/** The same line as plain words, for the reader of the screen. */
const coachPlain = (s: string) => s.replace(/\*\*/g, '').replace(/\{(\w+)\}/g, (m, k: string) => (k in ICON ? k : m));
function coachHTML(v: CoachView) {
  const fold = ui.coachMin, pos = v.n ? v.n + ' of ' + v.of : 'before the road';
  return '<section class="coach' + (fold ? ' min' : '') + '" role="region" aria-label="Training, ' + esc(pos) + '"><div class="cin">' +
    '<div class="chead"><span class="chap">' + ic(v.chapter.icon) + esc(v.chapter.name) + '</span><span class="ctitle">' + esc(v.title) + '</span><span class="grow"></span>' +
    (v.n ? '<span class="prog" role="img" aria-label="' + esc('Step ' + pos) + '"><i style="width:' + pct(v.n - 1, v.of) + '%"></i></span><span class="count num" aria-hidden="true">' + v.n + '<small>/' + v.of + '</small></span>' : '') +
    '<button class="fold" data-act="trainMin" aria-expanded="' + !fold + '" aria-label="' + (fold ? 'Show the guide' : 'Fold the guide away') + '">' + ic('up') + '</button></div>' +
    '<div class="cbody"><h2>' + esc(v.title) + '</h2>' + v.lines.map(l => '<p>' + coachMarkup(l) + '</p>').join('') + '</div>' +
    '<div class="cacts">' + (v.button ? '<button class="btn go sm" data-act="' + v.button.act + '">' + ic(v.button.icon) + esc(v.button.label) + '</button>' : v.todo ? '<span class="todo">' + ic('eye') + 'Your turn: do it, and the guide goes on.</span>' : '') +
    (v.skip ? '<button class="link" data-act="trainSkip">Skip this step</button>' : '') + (v.leave ? '<button class="link" data-act="trainLeave">Leave the training</button>' : '') + '</div></div></section>';
}

let coachKey = ''; // what the strip last said
let coachFloor = 0; // the tallest the strip has had to be since the window last changed, which it stays
/**
 * The height of the strip, which the page makes room for (see --coach-h in the stylesheet): nothing, where there is no strip. Where the camp is one screen,
 * the scene is as big as the room the strip leaves it, so a strip that is taller for one step than the next would make the scene jump in size, and move its
 * things from under the pointer: there the strip keeps the height of the tallest step it has had to show (put right again when the window changes size, by
 * fresh), and the scene settles after the first few steps. A folded strip, and a screen too small for the camp to be one, are as tall as their words.
 */
function fitCoach(fresh = false) {
  const el = $('#coach'), box = el && (el.firstElementChild as HTMLElement | null), root = document.documentElement.style;
  if (!el || !box) { coachFloor = 0; root.setProperty('--coach-h', '0px'); return; }
  const roomy = !!window.matchMedia && window.matchMedia('(min-width: 880px) and (min-height: 600px)').matches;
  box.style.minHeight = ''; // as its words make it
  const h = box.offsetHeight;
  coachFloor = roomy && !ui.coachMin ? (fresh ? h : Math.max(coachFloor, h)) : 0;
  if (coachFloor > h) box.style.minHeight = coachFloor + 'px';
  root.setProperty('--coach-h', el.offsetHeight + 'px');
}
/**
 * Scrolls a ringed thing into view, up and down only (the page keeps its place from side to side) and clear of the bar above it and the strip below, in the
 * page that holds it if that scrolls (a drawer), and in the window if not. It leaves a thing that is in view where it is.
 */
function bringIntoView(el: HTMLElement) {
  if (el.closest('#coach')) return;
  let box: HTMLElement | null = el.parentElement;
  while (box && !(box.scrollHeight > box.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
  const bar = $('.bar'), strip = $('#coach'), r = el.getBoundingClientRect(), pad = 12;
  const top = box ? box.getBoundingClientRect().top : bar ? bar.getBoundingClientRect().bottom : 0;
  const bottom = box ? box.getBoundingClientRect().bottom : strip && strip.firstElementChild ? strip.getBoundingClientRect().top : window.innerHeight;
  const by = r.top < top + pad ? r.top - top - pad : r.bottom > bottom - pad ? Math.min(r.bottom - bottom + pad, r.top - top - pad) : 0;
  if (!by) return;
  const to = { top: by, behavior: calm ? 'auto' : 'smooth' } as ScrollToOptions;
  if (box) box.scrollBy(to); else window.scrollBy(to);
}
/** Rings what the step points at, and brings the first of them into view when the step is new. */
function coachAim(v: CoachView, fresh: boolean) {
  if (!v.aim.length || ui.modal) return;
  const hit = Array.from(document.querySelectorAll<HTMLElement>(v.aim.join(', ')));
  hit.forEach(el => el.classList.add('aim'));
  const first = hit.find(el => el.offsetParent !== null);
  if (fresh && first) bringIntoView(first);
}
/** Draws the strip: called with the rest of the screen (render() in screens.ts), after the page that may be open, since it rings things in both. */
function renderCoach() {
  const el = $('#coach'); if (!el) return;
  const v = coachView(), say = $('#coach-say');
  el.innerHTML = v ? coachHTML(v) : '';
  const fresh = !!v && v.key !== coachKey;
  if (v && fresh && say) say.textContent = v.title + '. ' + v.lines.map(coachPlain).join(' ');
  coachKey = v ? v.key : '';
  fitCoach();
  if (v) coachAim(v, fresh);
}
/** Keeps the room made for the strip right when its words wrap differently (the window is resized, the fonts arrive). */
function watchCoach() {
  const el = $('#coach');
  if (el && typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fitCoach()).observe(el);
}
