import * as React from "react";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { makeT, resolveUiLang } from "@/lib/i18n";
import { getSettings } from "@/lib/storage";
import type { UiLang } from "@/lib/types";

/**
 * Rahmen um die Sidebar für Chromes Seitenleiste.
 *
 * Das Panel lebt ausserhalb der Seite und weiss von sich aus nicht, welches Video
 * gerade läuft. Es fragt deshalb das Content-Script im aktiven Tab und lässt sich von
 * ihm über jede Navigation innerhalb von YouTube unterrichten.
 */
export function PanelApp() {
  const [video, setVideo] = React.useState<{ id: string; title: string } | null>(null);
  const [tabId, setTabId] = React.useState<number | null>(null);
  const [uiLang, setUiLang] = React.useState<UiLang>("de");
  const [bereit, setBereit] = React.useState(false);
  const t = makeT(uiLang);

  React.useEffect(() => {
    void getSettings().then((s) => setUiLang(resolveUiLang(s.uiLang)));
  }, []);

  // Theme: dem YouTube-Tab folgen, sonst dem System.
  React.useEffect(() => {
    const setzen = (dunkel: boolean) =>
      document.documentElement.classList.toggle("dark", dunkel);
    setzen(window.matchMedia("(prefers-color-scheme: dark)").matches);
    void frageTab<boolean>("theme").then((d) => {
      if (typeof d === "boolean") setzen(d);
    });
  }, [video?.id]);

  const lesen = React.useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTabId(tab?.id ?? null);
    const info = await frageTab<{ videoId: string | null; title: string }>("video");
    setVideo(info?.videoId ? { id: info.videoId, title: info.title } : null);
    setBereit(true);
  }, []);

  React.useEffect(() => {
    void lesen();

    // Das Content-Script meldet jede SPA-Navigation; Tab-Wechsel meldet Chrome.
    const onMessage = (msg: { type?: string }) => {
      if (msg?.type === "videoChanged") void lesen();
    };
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.tabs.onActivated.addListener(lesen);
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.tabs.onActivated.removeListener(lesen);
    };
  }, [lesen]);

  const seek = React.useCallback(
    (sekunden: number) => {
      if (tabId == null) return;
      void chrome.tabs.sendMessage(tabId, { type: "seek", sekunden }).catch(() => {});
    },
    [tabId],
  );

  if (!bereit) return null;

  if (!video || tabId == null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center text-sm text-muted-foreground">
        <p>{t("panelNoVideo")}</p>
        <Button variant="outline" size="sm" onClick={() => chrome.runtime.openOptionsPage()}>
          {t("openOptions")}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-background p-2">
      <Sidebar
        key={video.id}
        videoId={video.id}
        videoTitle={video.title}
        tabId={tabId}
        onSeek={seek}
        collapsible={false}
        fullHeight
      />
    </div>
  );
}

/** Fragt das Content-Script des aktiven Tabs. Antwortet es nicht, ist es kein YouTube-Tab. */
async function frageTab<T>(type: string): Promise<T | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    return (await chrome.tabs.sendMessage(tab.id, { type })) as T;
  } catch {
    return null;
  }
}
