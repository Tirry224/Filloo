export type ImageRow = { storage_path: string; position: number };

export type ThreadMessageRow = {
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  products: { title: string; product_images: ImageRow[] } | null;
};

export type ThreadSummaryRaw = {
  lastMessage: string;
  lastCreatedAt: string;
  lastProductTitle: string;
  lastProductCoverPath?: string;
  unreadCount: number;
};

export function coverPath(images: ImageRow[] | undefined): string | undefined {
  if (!images || images.length === 0) return undefined;
  return images.reduce((first, image) => (image.position < first.position ? image : first)).storage_path;
}

/** `rows` triées du plus récent au plus ancien. */
export function summarizeThreadRows(rows: ThreadMessageRow[], myProfileId: string): Map<string, ThreadSummaryRaw> {
  const summaries = new Map<string, ThreadSummaryRaw>();
  for (const row of rows) {
    const existing = summaries.get(row.conversation_id);
    const isUnread = row.read_at === null && row.sender_id !== myProfileId;
    if (!existing) {
      summaries.set(row.conversation_id, {
        lastMessage: row.body,
        lastCreatedAt: row.created_at,
        lastProductTitle: row.products?.title ?? "",
        lastProductCoverPath: coverPath(row.products?.product_images),
        unreadCount: isUnread ? 1 : 0,
      });
      continue;
    }
    if (isUnread) existing.unreadCount += 1;
    if (!existing.lastProductTitle && row.products?.title) {
      existing.lastProductTitle = row.products.title;
      existing.lastProductCoverPath = coverPath(row.products.product_images);
    }
  }
  return summaries;
}
