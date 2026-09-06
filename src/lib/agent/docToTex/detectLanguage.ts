// Auto-detects the source document's language from its extracted text.
// Doc-to-TeX never translates (faithful mode preserves wording verbatim,
// rewrite mode only improves style) - the "language" setting only controls
// which babel/font packages the LaTeX preamble needs, so asking the user to
// pick it is pointless busywork. The document already tells us.

const KAZAKH_ONLY_RE = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/; // Ә ә Ғ ғ Қ қ Ң ң Ө ө Ұ ұ Ү ү Һ һ І і
const CYRILLIC_RE = /[Ѐ-ӿ]/;

export function detectLanguage(text: string): string {
    const sample = text.slice(0, 5000); // early text is representative and keeps this cheap on huge documents
    if (KAZAKH_ONLY_RE.test(sample)) return "kk";
    if (CYRILLIC_RE.test(sample)) return "ru";
    return "en";
}
