export type ChatBubble = {
  id: string;
  side: "in" | "out";
  text: string;
};

export function ChatBubbles({ bubbles }: { bubbles: ChatBubble[] }) {
  return (
    <div className="grid gap-2">
      {bubbles.map((b) => (
        <div
          key={b.id}
          className={
            "flex " + (b.side === "out" ? "justify-end" : "justify-start")
          }
        >
          <div
            className={
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-5 " +
              (b.side === "out"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                : "bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-white")
            }
          >
            {b.text}
          </div>
        </div>
      ))}
    </div>
  );
}
