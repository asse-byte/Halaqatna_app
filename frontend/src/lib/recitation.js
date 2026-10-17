// DEMO ONLY — the "listen to the model recitation" button on the student's Juz map.
//
// The audio streams from QuranicAudio's public archive, so pressing the button makes the
// student's browser load a third-party file. That is acceptable for a demonstration, which
// is all this is: nothing here is part of the approved requirements, nothing is stored, and
// the screen labels it as a demo. docker/nginx sets no Content-Security-Policy today, so
// nothing blocks it; if one is added it needs `media-src https://download.quranicaudio.com`.
// A deployment would serve recordings it hosts itself and replace this file.
export const DEMO_RECITER = { ar: "مشاري راشد العفاسي", en: "Mishary Rashid Alafasy" };

export const recitationUrl = (surah) =>
  `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${String(surah).padStart(3, "0")}.mp3`;
