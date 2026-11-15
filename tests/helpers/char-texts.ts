// A wider set of texts for the letters-first roundel experiments (tests/char-*-sheet.test.ts), so that a rule is
// judged on words it was not tuned on. The four the experiments began with are `TUNED`; `UNSEEN` is everything else,
// chosen to vary what a composition has to work with: how many words, how many tall stems, whether a bowl or a tail
// ends the text, whether the name of God or the name محمد is in it, and which letters open it.
export const TUNED: [id: string, text: string][] = [
  ['names', 'محمد علي'],
  ['basmala', 'بسم الله الرحمن الرحيم'],
  ['salawat', 'اللهم صل على محمد وآل محمد'],
  ['ikhlas', 'قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد'],
];
export const UNSEEN: [id: string, text: string, why: string][] = [
  // one word
  ['fatima', 'فاطمة', 'one word, one stem, no bowl at the end'],
  ['husayn', 'حسين', 'one word, no stem, ends in a bowl'],
  ['nur', 'نور', 'one word, three letters, ends in a tail'],
  // two and three words
  ['hamd', 'الحمد لله', 'two words, five stems, no bowl'],
  ['mashallah', 'ما شاء الله', 'three words, the name last'],
  ['subhan', 'سبحان الله', 'two words, a bowl in the first word, not the last'],
  ['zaynab', 'زينب وقصي', 'two names, no tall stem at all, ends in a bowl'],
  ['rabbi', 'رب زدني علما', 'three words, tails and one bowl, ends in an alif'],
  ['nurnur', 'نور على نور', 'three words, the same word twice, tails'],
  // four to seven words
  ['shahada', 'لا إله إلا الله', 'four words, nearly all stems, no bowl'],
  ['hasbuna', 'حسبنا الله ونعم الوكيل', 'four words, opens with a roofed letter, ends in a bowl'],
  ['tawfiq', 'وما توفيقي إلا بالله', 'four words, a bowl in the middle, the name last with a prefix'],
  ['sabr', 'الصبر مفتاح الفرج', 'three words, tails, ends in a returning bowl'],
  ['inna', 'إنا لله وإنا إليه راجعون', 'five words, ends in a bowl after many stems'],
  ['hawla', 'لا حول ولا قوة إلا بالله', 'six words, lam-alifs, bowls in the middle'],
  ['nursamawat', 'الله نور السماوات والأرض', 'four words, the name first, ends in a bowl'],
  // long
  ['fatiha1', 'الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين', 'nine words, bowls throughout'],
  ['kursi1', 'الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم', 'twelve words, the name first'],
];
export const ALL_TEXTS: [id: string, text: string][] = [
  ...TUNED,
  ...UNSEEN.map(([id, text]) => [id, text] as [string, string]),
];
