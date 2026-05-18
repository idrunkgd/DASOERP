/** Palette stable de couleurs Tailwind pour identifier visuellement chaque catégorie */
// IMPORTANT : ces classes doivent rester en string littéraux pour que Tailwind JIT
// les inclue dans le CSS bundle final.
export const CATEGORY_COLORS = [
  "bg-indigo-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-pink-400",
  "bg-cyan-400",
  "bg-purple-400",
  "bg-teal-400",
  "bg-rose-400",
  "bg-blue-400",
  "bg-orange-400",
  "bg-lime-400",
  "bg-violet-400",
  "bg-fuchsia-400",
  "bg-sky-400",
  "bg-yellow-400"
];

/** Renvoie une classe Tailwind de couleur stable pour un nom de catégorie. */
export function colorForCategory(category: string): string {
  let h = 0;
  for (let i = 0; i < category.length; i++) {
    h = (h * 31 + category.charCodeAt(i)) & 0xffffff;
  }
  return CATEGORY_COLORS[Math.abs(h) % CATEGORY_COLORS.length];
}

export const NO_CATEGORY = "(sans catégorie)";
