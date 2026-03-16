import { createClient } from "@supabase/supabase-js";
import { constants, createPublicKey, publicEncrypt } from "node:crypto";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function encryptRoomKeyForPublicKey(publicKeyJwk, roomKeyBase64) {
  const keyObject = createPublicKey({ key: JSON.parse(publicKeyJwk), format: "jwk" });
  const encrypted = publicEncrypt(
    {
      key: keyObject,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(roomKeyBase64, "base64"),
  );
  return encrypted.toString("base64");
}

async function main() {
  const { data: threads, error: threadsError } = await supabase
    .from("dm_threads")
    .select("id,participant1_id,participant2_id,room_key,encrypted_key_for_p1,encrypted_key_for_p2")
    .not("room_key", "is", null);

  if (threadsError) {
    console.error("Failed to load dm_threads:", threadsError.message);
    process.exit(1);
  }

  if (!threads || threads.length === 0) {
    console.log("No legacy room_key rows found.");
    return;
  }

  const profileIds = new Set();
  for (const t of threads) {
    profileIds.add(t.participant1_id);
    profileIds.add(t.participant2_id);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,encryption_public_key")
    .in("id", Array.from(profileIds));

  if (profilesError) {
    console.error("Failed to load profiles:", profilesError.message);
    process.exit(1);
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  let updated = 0;
  let skipped = 0;
  for (const thread of threads) {
    const p1 = profileMap.get(thread.participant1_id);
    const p2 = profileMap.get(thread.participant2_id);

    if (!thread.room_key || !p1?.encryption_public_key || !p2?.encryption_public_key) {
      skipped += 1;
      continue;
    }

    let encryptedKeyForP1;
    let encryptedKeyForP2;
    try {
      encryptedKeyForP1 = encryptRoomKeyForPublicKey(p1.encryption_public_key, thread.room_key);
      encryptedKeyForP2 = encryptRoomKeyForPublicKey(p2.encryption_public_key, thread.room_key);
    } catch {
      skipped += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("dm_threads")
      .update({
        encrypted_key_for_p1: encryptedKeyForP1,
        encrypted_key_for_p2: encryptedKeyForP2,
        room_key: null,
      })
      .eq("id", thread.id);

    if (updateError) {
      console.error(`Failed to update thread ${thread.id}:`, updateError.message);
      skipped += 1;
      continue;
    }

    updated += 1;
  }

  console.log(`Backfill done. updated=${updated}, skipped=${skipped}, total=${threads.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
