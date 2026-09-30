import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ask } from "@/lib/chat-client";
import type { UpdateInfo } from "@/lib/fallback";
import type { T } from "@shared/lib/i18n";

/**
 * Zeile „Neue Version X · Aktualisieren“, nur im Build "full" und nur mit Helfer aus
 * einem Release-Paket. Geprüft wird höchstens einmal am Tag (lib/fallback.ts),
 * geladen erst auf Klick. Ohne Helfer oder ohne Netz bleibt die Zeile weg – die
 * Prüfung hat niemand verlangt, also meldet sie auch keinen Fehler.
 */
export function UpdateHinweis({ t, className }: { t: T; className?: string }) {
  const [info, setInfo] = React.useState<UpdateInfo | null>(null);
  const [lage, setLage] = React.useState<"frei" | "laeuft" | "fertig" | "spaeter">("frei");
  const [fehler, setFehler] = React.useState("");

  React.useEffect(() => {
    ask<UpdateInfo>("updateCheck").then(setInfo).catch(() => {});
  }, []);

  if (!info?.neuer || !info.installierbar || lage === "spaeter") return null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex-1">
          {lage === "fertig" ? (
            t("updateDone")
          ) : (
            <>
              {t("updateAvailable")} {info.version}
              {info.seite && (
                <>
                  {" · "}
                  <a href={info.seite} target="_blank" rel="noreferrer" className="underline">
                    {t("updateNotes")}
                  </a>
                </>
              )}
            </>
          )}
        </span>
        {lage !== "fertig" && (
          <>
            <Button
              size="sm"
              disabled={lage === "laeuft"}
              onClick={() => {
                setLage("laeuft");
                setFehler("");
                ask<string>("updateInstall")
                  .then(() => setLage("fertig"))
                  .catch((e) => {
                    setFehler(String(e?.message ?? e));
                    setLage("frei");
                  });
              }}
            >
              {lage === "laeuft" && <Loader2 className="animate-spin" />}
              {lage === "laeuft" ? t("updateBusy") : t("updateInstall")}
            </Button>
            {lage === "frei" && (
              <Button size="sm" variant="ghost" onClick={() => setLage("spaeter")}>
                {t("updateLater")}
              </Button>
            )}
          </>
        )}
      </div>
      {fehler && <p className="mt-1 whitespace-pre-wrap text-xs text-destructive">{fehler}</p>}
    </div>
  );
}
