// Fixed UI data: palettes, sample texts, layout notes, letter labels.

export interface Palette {
  name: string;
  ink: string;
  ink2: string;
  paper: string;
  mark: string;
}
export const PALETTES: Palette[] = [
  { name: 'Carved stone', ink: '#4A3A2A', ink2: '#9A6B3C', paper: '#DDD0B6', mark: '#9C3A22' },
  { name: "Banna'i brick", ink: '#1E8586', ink2: '#24427E', paper: '#C99D74', mark: '#7B2A1C' },
  { name: 'Cobalt', ink: '#1F3F8C', ink2: '#2C8F9A', paper: '#F1EFE8', mark: '#B7322A' },
  { name: 'Ink', ink: '#161616', ink2: '#A2772E', paper: '#ECE8DF', mark: '#B7322A' },
  { name: 'Gold on lapis', ink: '#D8AC45', ink2: '#9CC3D6', paper: '#1C2B5E', mark: '#E9E4D6' },
  { name: 'Chalk', ink: '#EFECE3', ink2: '#D49A6A', paper: '#233130', mark: '#E3895A' },
];
export const PRESETS: [string, string][] = [
  ['Basmala', 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'],
  ['Basmala + names', 'بسم الله الرحمن الرحيم\nمحمد علي فاطمة\nالحسن الحسين'],
  ['Shahada', 'لا اله الا الله محمد رسول الله'],
  ['Ya Ali madad', 'يا علي مدد'],
  ['Alhamdulillah', 'ٱلْحَمْدُ لِلَّهِ'],
];
export const NOTES: Record<string, string> = {
  rings: 'Square rings, with the square sized to fit your text.',
  circle: 'Concentric circles, baseline outward, sized to fit your text.',
  line: 'One straight line, for checking how each word reads.',
  letters: 'Every letter in isolated, initial, medial and final form, right to left. Edit any of them below.',
};
export const LETTER_CHARS: Record<string, string> = {
  ALEF: 'ا', BEH: 'ب', HAH: 'ح', DAL: 'د', REH: 'ر', SEEN: 'س', SAD: 'ص', TAH: 'ط', AIN: 'ع', FEH: 'ف',
  QAF: 'ق', KAF: 'ك', LAM: 'ل', MEEM: 'م', NOON: 'ن', HEH: 'ه', WAW: 'و', YEH: 'ي', LAMALEF: 'لا', HAMZA: 'ء',
}; // prettier-ignore
