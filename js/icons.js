"use strict";
/** The edge round every icon: the darkest soot of the game. */
const ICON_EDGE = '#14100c';
const ICON = {
    coin: { rows: ['..llll..', '.lwaaas.', 'laassaas', 'lasaasas', 'lasaasas', 'laassaas', '.aaaaas.', '..ssss..'], pal: { a: '#cba34f', l: '#e8c874', s: '#a78039', w: '#f7e2a0' } },
    loaf: { rows: ['........', '..llll..', '.lawaws.', 'lawawaas', 'laaaaass', 'lsssssss', '.dddddd.', '........'], pal: { a: '#cf9f3c', l: '#e6c15f', s: '#a67a27', d: '#7e571b', w: '#f2dc92' } },
    horn: { rows: ['.....lxy', '...lasxy', '..laas..', '.las....', 'laas....', 'laas....', 'laas....', '.ss.....'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784', x: '#939ca3', y: '#48515a' } },
    barrel: { rows: ['.lllaas.', 'llaaaass', 'xxxxxxxy', 'llaaaass', 'llaaaass', 'xxxxxxxy', 'llaaaass', '.lalaas.'], pal: { a: '#a67a27', l: '#cf9f3c', s: '#7e571b', x: '#939ca3', y: '#48515a' } },
    mace: { rows: ['.....la.', '....lxas', '....laxs', '.....ss.', '....y...', '...y....', '..y.....', 'ay......'], pal: { a: '#cba34f', l: '#e8c874', s: '#a78039', x: '#bec4c6', y: '#846c4c' } },
    hourglass: { rows: ['xxxxxxxy', '.l....s.', '..lwws..', '...ls...', '...ls...', '..l..s..', '.lwwwws.', 'xxxxxxxy'], pal: { l: '#e7ddbf', s: '#b3a784', w: '#e6c15f', x: '#cba34f', y: '#a78039' } },
    drop: { rows: ['...la...', '...la...', '..llaa..', '..laas..', '.lwaaas.', '.lwaaas.', '.laaass.', '..asss..'], pal: { a: '#b2493a', l: '#d0705a', s: '#8f3328', w: '#e9a58b' } },
    flame: { rows: ['.....s..', '....ss..', '...ssa..', '..sssas.', '.ssaaaas', '.saallas', '.saalwas', '..ssaas.'], pal: { a: '#e8862c', l: '#f6b73e', s: '#c4521a', w: '#fcdc7c' } },
    heart: { rows: ['........', '.lw..aa.', 'lwaaaaas', 'laaaaaas', 'laaaaass', '.laaass.', '..assa..', '...ss...'], pal: { a: '#b2493a', l: '#d0705a', s: '#8f3328', w: '#e9a58b' } },
    shield: { rows: ['llllllla', 'laaaaaas', 'laayxaas', 'laaxxaas', '.laaaas.', '.saaaas.', '..saas..', '...ss...'], pal: { a: '#6b757e', l: '#939ca3', s: '#48515a', x: '#cba34f', y: '#f7e2a0' } },
    sabre: { rows: ['.......l', '....lla.', '..lla...', '..la....', '..la....', '.xxxx...', '..y.....', '.xx.....'], pal: { a: '#bec4c6', l: '#e3e6e2', x: '#cba34f', y: '#a78039' } },
    shot: { rows: ['.......l', '......la', '.....la.', '...wla..', '..xwa...', '.xxxy...', 'xxxy....', 'wxy.....'], pal: { a: '#6b757e', l: '#939ca3', w: '#e8c874', x: '#846c4c', y: '#67533b' } }, // drawn as musket
    pike: { rows: ['....l...', '...lls..', '..llass.', '...las..', '....y...', '....x...', '....x...', '....x...'], pal: { a: '#bec4c6', l: '#e3e6e2', s: '#6b757e', x: '#846c4c', y: '#cba34f' } },
    swords: { rows: ['l......l', '.l....l.', '..a..a..', '...aa...', '.x.aa.x.', '..x..x..', '.x.yy.x.', 'y......y'], pal: { a: '#bec4c6', l: '#e3e6e2', x: '#cba34f', y: '#80602a' } },
    star: { rows: ['...ll...', '...la...', 'llaaaaas', '.laaaas.', '..laas..', '..laas..', '.las.as.', '.l....s.'], pal: { a: '#cba34f', l: '#e8c874', s: '#a78039' } },
    warn: { rows: ['...l....', '..las...', '..lds...', '.ladas..', '.ladas..', 'laaaaas.', 'laadaas.', 'sssssss.'], pal: { a: '#cf9f3c', l: '#e6c15f', s: '#a67a27', d: '#14100c' } },
    moon: { rows: ['...llas.', '..las...', '.las....', '.las....', '.las....', '.las....', '..lss...', '...asss.'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
    drill: { rows: ['..llll..', '.lxxxxs.', 'lxaaaaxs', 'lxaxxaxs', 'lxaxxaxs', 'lxaaaaxs', '.lxxxxs.', '..asss..'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784', x: '#b2493a' } }, // drawn as target
    forage: { rows: ['....a...', '...lal..', '..lalas.', '...lal..', '..lalas.', '....as..', '....x...', '....x...'], pal: { a: '#cf9f3c', l: '#e6c15f', s: '#a67a27', x: '#7e571b' } }, // drawn as wheat
    cross: { rows: ['...la...', '...la...', 'llllaaaa', 'lllaaaas', '...as...', '...as...', '...as...', '...as...'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
    skull: { rows: ['..llll..', '.llaaaa.', 'laaaaaas', 'lddaadds', 'lddaadds', '.laddas.', '..aaas..', '..adas..'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784', d: '#1d1711' } },
    check: { rows: ['......ll', '.....lls', '....lls.', 'll.lls..', 'llllas..', '.llas...', '..ls....', '........'], pal: { a: '#a0ae60', l: '#c6cf8c', s: '#7a8e42' } },
    plus: { rows: ['...la...', '...la...', '...la...', 'llllaaaa', 'laaaaaas', '...as...', '...as...', '...as...'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
    up: { rows: ['...ll...', '..llas..', '.llaaas.', 'llaaaaas', '..laas..', '..laas..', '..laas..', '..laas..'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
    boot: { rows: ['.lllll..', '.laaas..', '.laaas..', '.laaas..', '.laaaas.', '.laaaaas', '.laaaaas', 'sssssss.'], pal: { a: '#7a4d36', l: '#a5714f', s: '#67533b' } },
    forced: { rows: ['ll.ll...', '.ll.ll..', '..ll.ll.', '...ll.ll', '...as.as', '..as.as.', '.as.as..', 'as.as...'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } }, // drawn as chevrons
    wall: { rows: ['ll.ll.ll', 'ls.ls.ls', 'llllllls', 'aaadaaad', 'aaaaaaas', 'adaaadaa', 'aaaaaaas', 'ssssssss'], pal: { a: '#b3a784', l: '#d1c5a1', s: '#8f8467', d: '#6e6249' } },
    eye: { rows: ['........', '..llll..', '.laxxas.', 'laxldxas', '.laxxas.', '..asss..', '........', '........'], pal: { a: '#e7ddbf', l: '#f4edd6', s: '#b3a784', x: '#4b6f98', d: '#14100c' } },
    lantern: { rows: ['...ll...', '..laas..', '.lllaas.', '.lyyyas.', '.lyyyas.', '.lxyyas.', '.laaaas.', '.ssssss.'], pal: { a: '#6b757e', l: '#939ca3', s: '#48515a', x: '#f6b73e', y: '#fcdc7c' } },
    tent: { rows: ['...la...', '..llas..', '..llas..', '.llaaas.', '.llaaas.', 'lladdaas', 'lladdaas', 'lladdaas'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784', d: '#1d1711' } },
    scales: { rows: ['...ll...', '..l..a..', 'llaaaaas', '.s.aa.s.', '.s....s.', '.s....s.', 'lll..lll', '.a....a.'], pal: { a: '#cba34f', l: '#f7e2a0', s: '#a78039' } },
    men: { rows: ['..yy....', '.yyyy.yy', '.llll.xx', '.llls...', '..aa..xx', '.laaasxx', 'laaaassx', 'laaaassx'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784', x: '#8f8467', y: '#846c4c' } },
    dice: { rows: ['lllllll.', 'ldaaadas', 'laaaaaas', 'laadaaas', 'laaaaaas', 'ldaaadas', 'laaaaaas', '.sssssss'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784', d: '#1d1711' } },
    cuirass: { rows: ['.ll..ll.', 'llaaaaas', 'llalaaas', '.lalaas.', '.lalaas.', '.xxxxxx.', '.lalaas.', '..ssss..'], pal: { a: '#939ca3', l: '#bec4c6', s: '#6b757e', x: '#cba34f' } },
    map: { rows: ['........', 'lll..lll', 'axxllaay', 'xxxllyya', 'xxayyaaa', 'xyyllaaa', 'sssllsss', '...ss...'], pal: { a: '#e4d8b3', l: '#f4edd6', s: '#bfae82', x: '#7a8e42', y: '#6d5f3f' } },
    scroll: { rows: ['.llllll.', 'lssssssl', '.aaaaas.', '.adddas.', '.aaaaas.', '.adddas.', 'lssssssl', '.llllll.'], pal: { a: '#e4d8b3', l: '#f4edd6', s: '#bfae82', d: '#8d7b52' } },
    book: { rows: ['........', 'lll..lll', 'laayyaas', 'lssyysss', 'laayyaas', 'lssyysss', 'xxxxxxxx', '.yyyyyy.'], pal: { a: '#e7ddbf', l: '#f4edd6', s: '#b3a784', x: '#4b6f98', y: '#33507a' } },
    wagon: { rows: ['........', '..llllll', 'yaaaaaas', '.aaaaaas', '..ssssss', '.xx..xx.', 'xyyx.xyx', '.xx..xx.'], pal: { a: '#a67a27', l: '#cf9f3c', s: '#7e571b', x: '#846c4c', y: '#cba34f' } },
    note: { rows: ['.....la.', '.....laa', '.....a.s', '.....a..', '.....a..', '..llaa..', '.laaas..', '..sss...'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
    speaker: { rows: ['....l...', '...ll.x.', 'lllaa..x', 'aaaaa.x.', 'aaaaa.x.', 'sssss..x', '...as.x.', '....s...'], pal: { a: '#939ca3', l: '#bec4c6', s: '#6b757e', x: '#d1c5a1' } },
    sun: { rows: ['...xx...', '.x.xx.x.', '..llaa..', 'xxllaaxx', 'xxlaaaxx', '..aass..', '.x.xx.x.', '...xx...'], pal: { a: '#e6c15f', l: '#f2dc92', s: '#cf9f3c', x: '#cba34f' } },
    rain: { rows: ['..lll...', '.llaaas.', 'laaaaaas', '.ssssss.', '.x..x..x', 'x..x..x.', '.x..x..x', 'x..x..x.'], pal: { a: '#939ca3', l: '#bec4c6', s: '#6b757e', x: '#6f94b4' } },
    fog: { rows: ['..lll...', '.llaaas.', 'laaaaaas', '.sssss..', '........', 'aaaaaa..', '........', '..ssssss'], pal: { a: '#b3a784', l: '#d1c5a1', s: '#8f8467' } },
    flag: { rows: ['.x......', '.yllllll', '.yaaaa..', '.yaaaa..', '.yssssss', '.y......', '.y......', '.y......'], pal: { a: '#b2493a', l: '#d0705a', s: '#8f3328', x: '#e8c874', y: '#846c4c' } }, // drawn as banner
    road: { rows: ['..llll..', '.laaaals', '..ssss..', '...y....', '...y....', '...y....', '...y....', '..yyy...'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#8f8467', y: '#846c4c' } },
    pause: { rows: ['........', '.la..la.', '.la..la.', '.la..la.', '.la..la.', '.la..la.', '.ss..ss.', '........'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
    play: { rows: ['l.......', 'lla.....', 'llaa....', 'llaas...', 'laaas...', 'laas....', 'las.....', 's.......'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
    retreat: { rows: ['...l....', '..ll....', '.lllllll', 'laaaaaas', '.assssss', '..as....', '...s....', '........'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
    run: { rows: ['....la..', '....as..', '........', '..lllas.', '.l.laas.', '...las..', '..las.s.', '.las..as'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
    white: { rows: ['.x......', '.yllllll', '.yaaaaas', '.yaaaas.', '.yssss..', '.y......', '.y......', '.y......'], pal: { a: '#e7ddbf', l: '#f4edd6', s: '#b3a784', x: '#e8c874', y: '#846c4c' } },
    calendar: { rows: ['.llllll.', 'lxxxxxxs', 'laaaaaas', 'ladaadas', 'laaaaaas', 'ladaadas', 'laaaaaas', '.ssssss.'], pal: { a: '#e7ddbf', l: '#f4edd6', s: '#b3a784', x: '#b2493a', d: '#4e3d2c' } },
    limp: { rows: ['ll......', 'lal.....', '.lal....', '..lxx...', '...xxs..', '....las.', '.....las', '......as'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784', x: '#b2493a' } }, // drawn as bandage
    surgeon: { rows: ['........', '.yy.....', 'yyyllll.', 'yyyaaaas', '.y.x.x.x', '........', '........', '........'], pal: { a: '#bec4c6', l: '#e3e6e2', s: '#939ca3', x: '#6b757e', y: '#846c4c' } },
    qm: { rows: ['.lla....', 'l..a....', 'a..s....', '.ass....', '....a...', '.....a..', '.....as.', '.....ass'], pal: { a: '#cba34f', l: '#e8c874', s: '#a78039' } }, // drawn as key
    chaplain: { rows: ['..llla..', '...la...', 'llllaaaa', '...la...', '...la...', '..lllas.', '...as...', '...as...'], pal: { a: '#cba34f', l: '#e8c874', s: '#a78039' } },
    x: { rows: ['la....as', '.la..as.', '..laas..', '...ls...', '...ls...', '..lass..', '.las.as.', 'la....as'], pal: { a: '#d1c5a1', l: '#e7ddbf', s: '#b3a784' } },
};
/** The pixels of an icon on its ten by ten square, as the colour of each in rows: the edge (every clear pixel that touches a drawn one) and the picture. */
function iconPixels(def) {
    const solid = {}, out = [];
    def.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++)
        if (row[x] !== '.')
            solid[(x + 1) + ',' + (y + 1)] = def.pal[row[x]]; });
    for (let y = 0; y < 10; y++)
        for (let x = 0; x < 10; x++) {
            const k = x + ',' + y;
            if (solid[k])
                out.push({ x, y, c: solid[k] });
            else if (solid[(x - 1) + ',' + y] || solid[(x + 1) + ',' + y] || solid[x + ',' + (y - 1)] || solid[x + ',' + (y + 1)])
                out.push({ x, y, c: ICON_EDGE });
        }
    return out;
}
/** An icon as the paths of an SVG: one for each colour, each a run of pixels along a row at a time. */
function iconPaths(def) {
    const byColour = {}, px = iconPixels(def);
    for (let i = 0; i < px.length;) {
        let w = 1;
        while (i + w < px.length && px[i + w].y === px[i].y && px[i + w].x === px[i].x + w && px[i + w].c === px[i].c)
            w++;
        byColour[px[i].c] = (byColour[px[i].c] || '') + 'M' + px[i].x + ' ' + px[i].y + 'h' + w + 'v1h-' + w + 'z';
        i += w;
    }
    const colours = Object.keys(byColour).sort((a, b) => (a === ICON_EDGE ? -1 : b === ICON_EDGE ? 1 : 0));
    return colours.map(c => '<path fill="' + c + '" d="' + byColour[c] + '"/>').join('');
}
/** Every icon, as a symbol of one hidden SVG that the page holds: ic() points at the symbol, so that a page of a hundred icons does not carry a hundred drawings. */
function iconSprite() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" focusable="false">' +
        Object.keys(ICON).map(n => '<symbol id="i-' + n + '" viewBox="0 0 10 10">' + iconPaths(ICON[n]) + '</symbol>').join('') + '</svg>';
}
/** Puts the sprite in the page, once. It waits for the page's body if the script was loaded before it, and does nothing where there is no page. */
function installIcons() {
    if (typeof document === 'undefined')
        return;
    if (!document.body) {
        if (typeof document.addEventListener === 'function')
            document.addEventListener('DOMContentLoaded', installIcons);
        return;
    }
    if (typeof document.getElementById === 'function' && document.getElementById('icons'))
        return;
    const host = document.createElement('div');
    host.id = 'icons';
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    host.innerHTML = iconSprite();
    document.body.appendChild(host);
}
installIcons();
// An icon as markup: decorative unless given a label, and drawn at 20 pixels (see .i in the stylesheet).
function ic(name, label) {
    return '<svg class="i" viewBox="0 0 10 10"' + (label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true"') + '><use href="#i-' + name + '"/></svg>';
}
