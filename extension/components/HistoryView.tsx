import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteConversation, listConversations } from "@/lib/storage";
import type { T } from "@shared/lib/i18n";
import type { Conversation } from "@shared/lib/types";

export function HistoryView({
  t,
  currentVideoId,
  onOpen,
}: {
  t: T;
  currentVideoId: string;
  onOpen: (conv: Conversation) => void;
}) {
  const [items, setItems] = React.useState<Conversation[] | null>(null);

  const reload = React.useCallback(() => {
    void listConversations().then(setItems);
  }, []);

  React.useEffect(reload, [reload]);

  if (items === null) return <div className="p-3 text-sm text-muted-foreground">…</div>;
  if (!items.length) {
    return <p className="p-3 text-sm text-muted-foreground">{t("historyEmpty")}</p>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 min-h-32">
      {items.map((c) => (
        <div
          key={c.videoId}
          className="mb-1 flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-accent"
        >
          <button
            type="button"
            onClick={() => onOpen(c)}
            className="min-w-0 flex-1 text-left cursor-pointer"
          >
            <p className="truncate text-sm">
              {c.title || c.videoId}
              {c.videoId === currentVideoId && (
                <span className="ml-1 text-xs text-muted-foreground">·</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(c.updatedAt).toLocaleString()} · {c.messages.length}
            </p>
          </button>
          <Button
            size="iconSm"
            variant="ghost"
            title={t("delete")}
            onClick={() => void deleteConversation(c.videoId).then(reload)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  );
}
