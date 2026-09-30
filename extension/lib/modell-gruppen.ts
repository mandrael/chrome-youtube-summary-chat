import type { ModelInfo } from "@shared/lib/types";

/** Treffer für die Modellsuche: Name oder Slug, ohne Gross-/Kleinschreibung. */
export function filtereModelle(models: ModelInfo[], suche: string): ModelInfo[] {
  const q = suche.trim().toLowerCase();
  if (!q) return models;
  return models.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
}

/*
 * Die vollständige Liste nach Anbietern, für die Optionsseite und das Modellmenü im Chat.
 * Der Anbieter steht im Namen vor dem Doppelpunkt, dem einzigen Feld, aus dem er sich
 * ohne gepflegte Liste ergibt. Anbieter mit ein oder zwei Modellen zerhacken die Liste
 * in Grüppchen und wandern zusammen nach „Weitere" ans Ende.
 */
export function nachAnbieter(models: ModelInfo[]): [anbieter: string, liste: ModelInfo[]][] {
  const gruppen = new Map<string, ModelInfo[]>();
  for (const m of models) {
    const anbieter = m.name.includes(":") ? m.name.split(":")[0]!.trim() : "Weitere";
    const bisher = gruppen.get(anbieter);
    if (bisher) bisher.push(m);
    else gruppen.set(anbieter, [m]);
  }
  const gross: [string, ModelInfo[]][] = [];
  const klein: ModelInfo[] = [];
  for (const [anbieter, liste] of gruppen) {
    if (anbieter !== "Weitere" && liste.length >= 3) gross.push([anbieter, liste]);
    else klein.push(...liste);
  }
  if (klein.length) gross.push(["Weitere", klein]);
  return gross;
}
