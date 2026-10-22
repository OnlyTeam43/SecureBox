export type CharacterId = 'panda' | 'cat' | 'puppy';
export type CharacterState =
  | 'idle'
  | 'talking'
  | 'typing'
  | 'mute'
  | 'call'
  | 'video'
  | 'deafen'
  | 'cameraoff';

export const CHARACTERS: CharacterId[] = ['panda', 'cat', 'puppy'];
export const STATES: CharacterState[] = [
  'idle', 'talking', 'typing', 'mute', 'call', 'video', 'deafen', 'cameraoff',
];

export const DEFAULT_CHARACTER = { male: 'panda', female: 'cat' } as const;

export const VIEWBOX = '-8 -8 136 142';
export const VIEWBOX_RATIO = 142 / 136;

const CHEEKS =
  '<circle cx="28" cy="78" r="5" fill="#F4C0D1"/><circle cx="92" cy="78" r="5" fill="#F4C0D1"/>';

const mouth = (cy: number, open: boolean, rx: number) =>
  open
    ? `<ellipse cx="60" cy="${cy + 3}" rx="${rx}" ry="6" fill="#712B13"/>`
    : `<ellipse cx="60" cy="${cy}" rx="${rx}" ry="2" fill="#712B13"/>`;

const BASE: Record<CharacterId, (open: boolean) => string> = {
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

const PAW = 'fill="#FAECE7" stroke="#712B13" stroke-width="2"';

const OVERLAY: Partial<Record<CharacterState, (beat: boolean) => string>> = {
  typing: (beat) =>
    '<rect x="30" y="96" width="60" height="30" rx="6" fill="#2C2C2A"/>' +
    '<rect x="34" y="100" width="52" height="22" rx="3" fill="#85B7EB"/>' +
    `<circle cx="26" cy="${beat ? 103 : 108}" r="9" ${PAW}/>` +
    `<circle cx="94" cy="${beat ? 108 : 103}" r="9" ${PAW}/>`,
  mute: () =>
    `<rect x="54" y="66" width="12" height="36" rx="6" ${PAW}/>` +
    `<circle cx="60" cy="106" r="13" ${PAW}/>`,
  call: () =>
    '<path d="M16 64 A44 44 0 0 1 104 64" stroke="#534AB7" stroke-width="6" stroke-linecap="round"/>' +
    '<rect x="8" y="54" width="14" height="26" rx="6" fill="#534AB7"/>' +
    '<rect x="98" y="54" width="14" height="26" rx="6" fill="#534AB7"/>' +
    '<path d="M105 80 Q104 100 74 94" stroke="#534AB7" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="72" cy="94" r="5" fill="#3C3489"/>',
  video: () =>
    '<rect x="-4" y="-4" width="128" height="134" rx="18" stroke="#378ADD" stroke-width="3"/>' +
    '<circle cx="10" cy="8" r="4" fill="#E24B4A"/>',
  deafen: () =>
    `<ellipse cx="9" cy="62" rx="12" ry="16" ${PAW}/>` +
    `<ellipse cx="111" cy="62" rx="12" ry="16" ${PAW}/>`,
  cameraoff: () =>
    '<path d="M60 4 C106 30 106 98 60 126 C14 98 14 30 60 4Z" fill="#97C459" stroke="#3B6D11" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M60 10 L60 122" stroke="#3B6D11" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M60 40 L38 26M60 62 L32 46M60 84 L34 68M60 40 L82 26M60 62 L88 46M60 84 L86 68" stroke="#3B6D11" stroke-width="1.5" stroke-linecap="round"/>',
};

export interface SvgOptions {
  /** Flips between two frames: mouth open/closed (talking) or paws up/down (typing). */
  beat?: boolean;
}

export function characterSvg(
  character: CharacterId,
  state: CharacterState = 'idle',
  { beat = false }: SvgOptions = {},
): string {
  const mouthOpen = state === 'talking' && beat;
  const overlay = OVERLAY[state] ? OVERLAY[state]!(beat) : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" fill="none">` +
    BASE[character](mouthOpen) +
    overlay +
    '</svg>'
  );
}
