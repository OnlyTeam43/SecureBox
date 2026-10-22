export const CHARACTERS = ['panda', 'cat', 'puppy'];
export const STATES = [
  'idle', 'talking', 'typing', 'mute', 'call', 'video', 'deafen', 'cameraoff',
];

export const DEFAULT_CHARACTER = { male: 'panda', female: 'cat' };

export const VIEWBOX = '-8 -8 136 142';
export const VIEWBOX_RATIO = 142 / 136;

const CHEEKS =
  '<circle cx="28" cy="78" r="5" fill="#F4C0D1"/><circle cx="92" cy="78" r="5" fill="#F4C0D1"/>';

const mouth = (cy, open, rx) =>
  open
    ? `<ellipse cx="60" cy="${cy + 3}" rx="${rx}" ry="6" fill="#712B13"/>`
    : `<ellipse cx="60" cy="${cy}" rx="${rx}" ry="2" fill="#712B13"/>`;

const BASE = {
  panda: (open) =>
    '<circle cx="26" cy="26" r="15" fill="#2C2C2A"/><circle cx="94" cy="26" r="15" fill="#2C2C2A"/>' +
    '<circle cx="60" cy="66" r="44" fill="#FFFFFF" stroke="#2C2C2A" stroke-width="2"/>' +
    '<ellipse cx="42" cy="60" rx="10" ry="12" fill="#2C2C2A" transform="rotate(20 42 60)"/>' +
    '<ellipse cx="78" cy="60" rx="10" ry="12" fill="#2C2C2A" transform="rotate(-20 78 60)"/>' +
    '<circle cx="43" cy="59" r="3.5" fill="#FFFFFF"/><circle cx="77" cy="59" r="3.5" fill="#FFFFFF"/>' +
    '<ellipse cx="60" cy="74" rx="6" ry="4.5" fill="#2C2C2A"/>' +
    CHEEKS +
    mouth(84, open, 6),
  cat: (open) =>
    '<path d="M20 52 L28 12 L54 34Z" fill="#FAC775" stroke="#854F0B" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M100 52 L92 12 L66 34Z" fill="#FAC775" stroke="#854F0B" stroke-width="2" stroke-linejoin="round"/>' +
    '<ellipse cx="60" cy="68" rx="44" ry="40" fill="#FAC775" stroke="#854F0B" stroke-width="2"/>' +
    '<circle cx="44" cy="62" r="5" fill="#412402"/><circle cx="76" cy="62" r="5" fill="#412402"/>' +
    '<circle cx="45.5" cy="60.5" r="1.6" fill="#FFFFFF"/><circle cx="77.5" cy="60.5" r="1.6" fill="#FFFFFF"/>' +
    '<path d="M56 73 L64 73 L60 78Z" fill="#D4537E"/>' +
    '<path d="M14 72 L36 76M14 82 L36 80M106 72 L84 76M106 82 L84 80" stroke="#854F0B" stroke-width="1.5" stroke-linecap="round"/>' +
    CHEEKS +
    mouth(86, open, 5),
  puppy: (open) =>
    '<ellipse cx="20" cy="54" rx="13" ry="26" fill="#854F0B" transform="rotate(12 20 54)"/>' +
    '<ellipse cx="100" cy="54" rx="13" ry="26" fill="#854F0B" transform="rotate(-12 100 54)"/>' +
    '<circle cx="60" cy="66" r="42" fill="#F5C4B3" stroke="#993C1D" stroke-width="2"/>' +
    '<ellipse cx="60" cy="80" rx="19" ry="14" fill="#FAECE7"/>' +
    '<circle cx="44" cy="58" r="5" fill="#2C2C2A"/><circle cx="76" cy="58" r="5" fill="#2C2C2A"/>' +
    '<circle cx="45.5" cy="56.5" r="1.6" fill="#FFFFFF"/><circle cx="77.5" cy="56.5" r="1.6" fill="#FFFFFF"/>' +
    '<ellipse cx="60" cy="72" rx="6.5" ry="4.5" fill="#2C2C2A"/>' +
    mouth(85, open, 5),
};

const OVERLAYS = {
  idle: () => '',
  talking: () => '',
  typing: (beat) =>
    '<rect x="42" y="86" width="36" height="42" rx="6" fill="#2C2C2A" stroke="#5E5D59" stroke-width="1.5"/>' +
    '<rect x="46" y="90" width="28" height="28" rx="3" fill="#FAF9F5"/>' +
    `<circle cx="${beat ? 40 : 44}" cy="${beat ? 98 : 102}" r="6" fill="#D49A6A" stroke="#854F0B" stroke-width="1.5"/>` +
    `<circle cx="${beat ? 80 : 76}" cy="${beat ? 102 : 98}" r="6" fill="#D49A6A" stroke="#854F0B" stroke-width="1.5"/>`,
  mute: () =>
    '<ellipse cx="60" cy="84" rx="11" ry="8" fill="#D49A6A" stroke="#854F0B" stroke-width="1.5"/>' +
    '<rect x="57" y="72" width="6" height="16" rx="3" fill="#D49A6A" stroke="#854F0B" stroke-width="1.5"/>',
  call: () =>
    '<path d="M22 66 C22 28, 98 28, 98 66" fill="none" stroke="#2C2C2A" stroke-width="4" stroke-linecap="round"/>' +
    '<rect x="14" y="56" width="12" height="22" rx="5" fill="#D97757"/>' +
    '<rect x="94" y="56" width="12" height="22" rx="5" fill="#D97757"/>' +
    '<path d="M20 74 C20 92, 44 94, 52 94" fill="none" stroke="#2C2C2A" stroke-width="2.5" stroke-linecap="round"/>' +
    '<circle cx="54" cy="94" r="3.5" fill="#D97757"/>',
  video: () =>
    '<rect x="8" y="14" width="104" height="104" rx="16" fill="none" stroke="#2C84DB" stroke-width="2.5" stroke-dasharray="6 4"/>' +
    '<circle cx="100" cy="26" r="4" fill="#C0392B"/>',
  deafen: () =>
    '<ellipse cx="20" cy="64" rx="8" ry="12" fill="#D49A6A" stroke="#854F0B" stroke-width="1.5"/>' +
    '<ellipse cx="100" cy="64" rx="8" ry="12" fill="#D49A6A" stroke="#854F0B" stroke-width="1.5"/>',
  cameraoff: () =>
    '<path d="M60 40 C36 40 20 64 20 86 C20 104 38 116 60 116 C82 116 100 104 100 86 C100 64 84 40 60 40 Z" fill="#2F7D4F" opacity="0.95"/>' +
    '<path d="M60 44 L60 112" stroke="#E6F2EA" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M60 62 L44 54M60 78 L40 70M60 94 L44 88M60 62 L76 54M60 78 L80 70M60 94 L76 88" stroke="#E6F2EA" stroke-width="1.5" stroke-linecap="round"/>',
};

export function characterSvg(character, state = 'idle', options = {}) {
  const open = state === 'talking' ? !!options.beat : false;
  const baseFn = BASE[character] || BASE.panda;
  const overlayFn = OVERLAYS[state] || OVERLAYS.idle;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">` +
    baseFn(open) +
    overlayFn(!!options.beat) +
    '</svg>'
  );
}
