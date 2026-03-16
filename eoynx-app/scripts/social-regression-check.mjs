import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_SIZE = 1000;

async function fetchAll(table, select) {
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`${table} fetch failed: ${error.message}`);
    }

    const chunk = data ?? [];
    rows.push(...chunk);

    if (chunk.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function countDuplicates(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  let duplicateRows = 0;
  for (const count of map.values()) {
    if (count > 1) duplicateRows += count - 1;
  }
  return duplicateRows;
}

function countOrphans(rows, key, validSet) {
  let count = 0;
  for (const row of rows) {
    const value = row[key];
    if (value == null) continue;
    if (!validSet.has(value)) count += 1;
  }
  return count;
}

function makeSet(rows, key) {
  return new Set(rows.map((row) => row[key]).filter((value) => value != null));
}

async function main() {
  const [profiles, items, likes, comments, commentLikes, notifications, dmThreads] = await Promise.all([
    fetchAll("profiles", "id"),
    fetchAll("items", "id,owner_id"),
    fetchAll("likes", "id,item_id,user_id"),
    fetchAll("comments", "id,item_id,user_id,parent_id"),
    fetchAll("comment_likes", "id,comment_id,user_id"),
    fetchAll("notifications", "id,user_id,actor_id,type,item_id,comment_id,thread_id,read_at"),
    fetchAll("dm_threads", "id"),
  ]);

  const profileIds = makeSet(profiles, "id");
  const itemIds = makeSet(items, "id");
  const commentIds = makeSet(comments, "id");
  const threadIds = makeSet(dmThreads, "id");

  const summary = {
    rows: {
      profiles: profiles.length,
      items: items.length,
      likes: likes.length,
      comments: comments.length,
      commentLikes: commentLikes.length,
      notifications: notifications.length,
      dmThreads: dmThreads.length,
    },
    checks: {
      likes: {
        duplicateUserItem: countDuplicates(likes, (row) => `${row.user_id}:${row.item_id}`),
        orphanItemRefs: countOrphans(likes, "item_id", itemIds),
        orphanUserRefs: countOrphans(likes, "user_id", profileIds),
      },
      comments: {
        orphanItemRefs: countOrphans(comments, "item_id", itemIds),
        orphanUserRefs: countOrphans(comments, "user_id", profileIds),
        orphanParentRefs: countOrphans(comments, "parent_id", commentIds),
      },
      commentLikes: {
        duplicateUserComment: countDuplicates(commentLikes, (row) => `${row.user_id}:${row.comment_id}`),
        orphanCommentRefs: countOrphans(commentLikes, "comment_id", commentIds),
        orphanUserRefs: countOrphans(commentLikes, "user_id", profileIds),
      },
      notifications: {
        orphanUserRefs: countOrphans(notifications, "user_id", profileIds),
        orphanActorRefs: countOrphans(notifications, "actor_id", profileIds),
        orphanItemRefs: countOrphans(notifications, "item_id", itemIds),
        orphanCommentRefs: countOrphans(notifications, "comment_id", commentIds),
        orphanThreadRefs: countOrphans(notifications, "thread_id", threadIds),
        invalidTypeRows: notifications.filter(
          (n) => !["follow", "like", "comment", "dm", "dm_request"].includes(String(n.type))
        ).length,
      },
    },
  };

  const issueCount = Object.values(summary.checks).reduce((acc, group) => {
    return (
      acc +
      Object.values(group).reduce((inner, value) => {
        return inner + (typeof value === "number" ? value : 0);
      }, 0)
    );
  }, 0);

  console.log(JSON.stringify({ issueCount, ...summary }, null, 2));

  if (issueCount > 0) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
