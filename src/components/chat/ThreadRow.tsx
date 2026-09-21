import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Photo } from "@/components/ui/Photo";
import { cn } from "@/lib/cn";
import type { Thread } from "@/lib/types";

/**
 * Ligne de la liste des messages. Elle rappelle le produit sous le nom :
 * un fil unique par personne n'est lisible que si le commerçant voit de
 * quoi il s'agit sans l'ouvrir.
 *
 * `basePath` plutôt qu'un `/messages/` en dur : cette ligne sert les deux
 * messageries, et celle du commerçant vit sous `/vendeur/messages`.
 */
export function ThreadRow({ thread, basePath }: { thread: Thread; basePath: string }) {
  const unread = thread.unreadCount > 0;
  return (
    <Link
      href={`${basePath}/${thread.id}`}
      className="flex items-start gap-3 border-b border-line py-3.5"
    >
      <Avatar name={thread.peerName} kind={thread.peerKind} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-base font-semibold">{thread.peerName}</span>
          <time className="shrink-0 text-2xs text-ink-soft">{thread.lastAt}</time>
        </div>
        <div className="flex items-center gap-1.5">
          <Photo ratio="free" className="size-4.5 shrink-0 rounded-xs" iconSize={10} />
          <span className="truncate text-2xs font-medium text-ink-soft">
            {thread.lastProductTitle}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex-1 truncate text-sm",
              unread ? "font-semibold text-ink" : "text-ink-soft",
            )}
          >
            {thread.lastMessage}
          </span>
          {unread ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-bold text-on-accent">
              {thread.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
