import { cn } from "@/lib/cn";
import type { Message } from "@/lib/types";

export function MessageBubble({ message }: { message: Message }) {
  return (
    <div
      className={cn(
        "flex max-w-[80%] flex-col gap-0.5 px-3 pt-2.5 pb-2",
        message.mine
          ? "self-end rounded-lg rounded-br-xs bg-accent text-on-accent"
          : "self-start rounded-lg rounded-bl-xs border border-line bg-surface",
      )}
    >
      <p className="text-base leading-normal">{message.body}</p>
      <time
        className={cn("self-end text-2xs", message.mine ? "text-on-accent/75" : "text-ink-soft")}
      >
        {message.sentAt}
      </time>
    </div>
  );
}
