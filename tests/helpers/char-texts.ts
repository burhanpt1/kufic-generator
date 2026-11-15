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
/** A third set, never yet drawn by any rule (added 15 November after the first widening): the next held-out
 *  measure. It leans on what the first two sets lacked: finals in ق ض ش, openings in ن ت ث ح ع, dots over a carrying
 *  letter, and more single words and long texts. */
export const FRESH: [id: string, text: string, why: string][] = [
  ['haqq', 'الحق', 'one word, ends in a dotted bowl'],
  ['tawhid', 'توحيد', 'one word, opens with a dotted tooth, ends in a foot'],
  ['arsh', 'العرش', 'one word, ends in a dotted bowl with teeth'],
  ['nasr', 'نصر من الله', 'three words, opens with a dotted tooth, the name last'],
  ['thabit', 'ثابت', 'one word, three dots at the opening'],
  ['hayy', 'الحي القيوم', 'two words, a returning bowl then a tail'],
  ['alim', 'عليم حكيم', 'two words, both open with roofed letters and end in tails'],
  ['ard', 'في الأرض', 'two words, ends in a dotted bowl'],
  ['tawakkul', 'توكلت على الله', 'three words, kaf and lam stems, the name last'],
  ['rizq', 'وارزقنا وأنت خير الرازقين', 'four words, tails and a bowl at the very end'],
  ['salam', 'السلام عليكم ورحمة الله وبركاته', 'five words, lam-alif, the name fourth'],
  ['nasr2', 'إذا جاء نصر الله والفتح', 'five words, hamza, a returning bowl at the end'],
  ['falaq', 'قل أعوذ برب الفلق من شر ما خلق', 'eight words, dotted bowls throughout'],
  ['asr', 'والعصر إن الإنسان لفي خسر إلا الذين آمنوا وعملوا الصالحات', 'ten words, long, tails'],
];
export const ALL_TEXTS: [id: string, text: string][] = [
  ...TUNED,
  ...UNSEEN.map(([id, text]) => [id, text] as [string, string]),
];
