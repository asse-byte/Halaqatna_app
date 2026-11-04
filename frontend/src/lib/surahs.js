// The 114 Surahs: Arabic name, English name and ayah count.
// Teachers pick a Surah by name (FR5); the numeric surah_from / surah_to columns of
// Figure 4.7 are unchanged — only the way the number is chosen has changed.
// The ayah count bounds the Ayah inputs so a teacher cannot enter ayah 200 of Al-Fatihah.
export const SURAHS = [
  null,
  ["الفاتحة", "Al-Fatihah", 7], ["البقرة", "Al-Baqarah", 286], ["آل عمران", "Aal-Imran", 200],
  ["النساء", "An-Nisa", 176], ["المائدة", "Al-Ma'idah", 120], ["الأنعام", "Al-An'am", 165],
  ["الأعراف", "Al-A'raf", 206], ["الأنفال", "Al-Anfal", 75], ["التوبة", "At-Tawbah", 129],
  ["يونس", "Yunus", 109], ["هود", "Hud", 123], ["يوسف", "Yusuf", 111],
  ["الرعد", "Ar-Ra'd", 43], ["إبراهيم", "Ibrahim", 52], ["الحجر", "Al-Hijr", 99],
  ["النحل", "An-Nahl", 128], ["الإسراء", "Al-Isra", 111], ["الكهف", "Al-Kahf", 110],
  ["مريم", "Maryam", 98], ["طه", "Taha", 135], ["الأنبياء", "Al-Anbiya", 112],
  ["الحج", "Al-Hajj", 78], ["المؤمنون", "Al-Mu'minun", 118], ["النور", "An-Nur", 64],
  ["الفرقان", "Al-Furqan", 77], ["الشعراء", "Ash-Shu'ara", 227], ["النمل", "An-Naml", 93],
  ["القصص", "Al-Qasas", 88], ["العنكبوت", "Al-Ankabut", 69], ["الروم", "Ar-Rum", 60],
  ["لقمان", "Luqman", 34], ["السجدة", "As-Sajdah", 30], ["الأحزاب", "Al-Ahzab", 73],
  ["سبأ", "Saba", 54], ["فاطر", "Fatir", 45], ["يس", "Ya-Sin", 83],
  ["الصافات", "As-Saffat", 182], ["ص", "Sad", 88], ["الزمر", "Az-Zumar", 75],
  ["غافر", "Ghafir", 85], ["فصلت", "Fussilat", 54], ["الشورى", "Ash-Shura", 53],
  ["الزخرف", "Az-Zukhruf", 89], ["الدخان", "Ad-Dukhan", 59], ["الجاثية", "Al-Jathiyah", 37],
  ["الأحقاف", "Al-Ahqaf", 35], ["محمد", "Muhammad", 38], ["الفتح", "Al-Fath", 29],
  ["الحجرات", "Al-Hujurat", 18], ["ق", "Qaf", 45], ["الذاريات", "Adh-Dhariyat", 60],
  ["الطور", "At-Tur", 49], ["النجم", "An-Najm", 62], ["القمر", "Al-Qamar", 55],
  ["الرحمن", "Ar-Rahman", 78], ["الواقعة", "Al-Waqi'ah", 96], ["الحديد", "Al-Hadid", 29],
  ["المجادلة", "Al-Mujadilah", 22], ["الحشر", "Al-Hashr", 24], ["الممتحنة", "Al-Mumtahanah", 13],
  ["الصف", "As-Saff", 14], ["الجمعة", "Al-Jumu'ah", 11], ["المنافقون", "Al-Munafiqun", 11],
  ["التغابن", "At-Taghabun", 18], ["الطلاق", "At-Talaq", 12], ["التحريم", "At-Tahrim", 12],
  ["الملك", "Al-Mulk", 30], ["القلم", "Al-Qalam", 52], ["الحاقة", "Al-Haqqah", 52],
  ["المعارج", "Al-Ma'arij", 44], ["نوح", "Nuh", 28], ["الجن", "Al-Jinn", 28],
  ["المزمل", "Al-Muzzammil", 20], ["المدثر", "Al-Muddaththir", 56], ["القيامة", "Al-Qiyamah", 40],
  ["الإنسان", "Al-Insan", 31], ["المرسلات", "Al-Mursalat", 50], ["النبأ", "An-Naba", 40],
  ["النازعات", "An-Nazi'at", 46], ["عبس", "Abasa", 42], ["التكوير", "At-Takwir", 29],
  ["الانفطار", "Al-Infitar", 19], ["المطففين", "Al-Mutaffifin", 36], ["الانشقاق", "Al-Inshiqaq", 25],
  ["البروج", "Al-Buruj", 22], ["الطارق", "At-Tariq", 17], ["الأعلى", "Al-A'la", 19],
  ["الغاشية", "Al-Ghashiyah", 26], ["الفجر", "Al-Fajr", 30], ["البلد", "Al-Balad", 20],
  ["الشمس", "Ash-Shams", 15], ["الليل", "Al-Layl", 21], ["الضحى", "Ad-Duha", 11],
  ["الشرح", "Ash-Sharh", 8], ["التين", "At-Tin", 8], ["العلق", "Al-Alaq", 19],
  ["القدر", "Al-Qadr", 5], ["البينة", "Al-Bayyinah", 8], ["الزلزلة", "Az-Zalzalah", 8],
  ["العاديات", "Al-Adiyat", 11], ["القارعة", "Al-Qari'ah", 11], ["التكاثر", "At-Takathur", 8],
  ["العصر", "Al-Asr", 3], ["الهمزة", "Al-Humazah", 9], ["الفيل", "Al-Fil", 5],
  ["قريش", "Quraysh", 4], ["الماعون", "Al-Ma'un", 7], ["الكوثر", "Al-Kawthar", 3],
  ["الكافرون", "Al-Kafirun", 6], ["النصر", "An-Nasr", 3], ["المسد", "Al-Masad", 5],
  ["الإخلاص", "Al-Ikhlas", 4], ["الفلق", "Al-Falaq", 5], ["الناس", "An-Nas", 6],
];

export const SURAH_NUMBERS = Array.from({ length: 114 }, (_, i) => i + 1);

/** Display name of a Surah in the active locale, e.g. "٢. البقرة" → "البقرة". */
export const surahName = (n, locale = "ar") => {
  const s = SURAHS[n];
  if (!s) return String(n ?? "");
  return locale === "ar" ? s[0] : s[1];
};

/** Number of ayahs in a Surah — used as the max of the Ayah inputs. */
export const ayahCount = (n) => SURAHS[n]?.[2] ?? 286;

/**
 * Where each Juz begins, as [surah, ayah] — the standard thirty-part division of the Madani
 * mushaf (Hafs). Fixed structure of the text, like the ayah counts above, not a constant to
 * calibrate. Index 0 is unused so JUZ_STARTS[j] reads as "Juz j".
 */
export const JUZ_STARTS = [
  null,
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

/** The Surahs in one Juz, each with the ayahs of it that fall inside that Juz. */
export function surahsInJuz(juz) {
  const [s0, a0] = JUZ_STARTS[juz];
  const [s1, a1] = JUZ_STARTS[juz + 1] ?? [115, 1];
  const out = [];
  for (let s = s0; s <= Math.min(s1, 114); s++) {
    const from = s === s0 ? a0 : 1;
    const to = s === s1 ? a1 - 1 : ayahCount(s);
    // The next Juz may open on ayah 1 of its first Surah, which then belongs wholly to it.
    if (to >= from) out.push({ surah: s, from, to, whole: from === 1 && to === ayahCount(s) });
  }
  return out;
}

/** "البقرة ١ – ٥" style range label, with no bare numbers the reader has to decode. */
export function rangeLabel(s, locale = "ar") {
  if (!s?.surah_from) return "—";
  const from = `${surahName(s.surah_from, locale)} ${s.ayah_from}`;
  if (s.surah_to === s.surah_from) {
    return s.ayah_to && s.ayah_to !== s.ayah_from ? `${from} – ${s.ayah_to}` : from;
  }
  return `${from} – ${surahName(s.surah_to, locale)} ${s.ayah_to}`;
}
