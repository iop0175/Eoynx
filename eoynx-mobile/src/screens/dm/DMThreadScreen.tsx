import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { Image as ExpoImage } from "expo-image";
import { useI18n } from "../../i18n";
import { supabase } from "../../lib/supabase";
import { canUseWebCrypto, decryptWithRoomKey, encryptWithRoomKey, importRoomKey } from "../../lib/dmCrypto";
import type { FeedStackParamList } from "../../navigation/types";
import { webUi } from "../../theme/webUi";
import type { Item } from "../../types/item";

type Props = NativeStackScreenProps<FeedStackParamList, "DMThread">;

type Message = {
  id: string;
  sender_id: string;
  content: string;
  is_encrypted: boolean;
  iv: string | null;
  image_url: string | null;
  created_at: string;
  read_at: string | null;
};

type SharedItemPreview = {
  id: string;
  title: string;
  image_url: string | null;
  brand: string | null;
  category: string | null;
};

function areMessagesEqual(prev: Message[], next: Message[]) {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (
      a.id !== b.id ||
      a.sender_id !== b.sender_id ||
      a.content !== b.content ||
      a.is_encrypted !== b.is_encrypted ||
      a.iv !== b.iv ||
      a.image_url !== b.image_url ||
      a.created_at !== b.created_at ||
      a.read_at !== b.read_at
    ) {
      return false;
    }
  }
  return true;
}

function parseSharedItemMessage(raw: string) {
  const normalized = raw.trim();
  const match =
    normalized.match(/^피드를 공유했습니다\n(.+)\n(https?:\/\/[^\s]+\/i\/[a-f0-9-]+)$/i) ??
    normalized.match(/^📦\s+(.+)\n(https?:\/\/[^\s]+\/i\/[a-f0-9-]+)$/i);
  if (!match) return null;

  let path = "";
  let itemId = "";
  try {
    const parsed = new URL(match[2].trim());
    path = parsed.pathname;
    const idMatch = path.match(/^\/i\/([a-f0-9-]+)$/i);
    itemId = idMatch?.[1] ?? "";
  } catch {
    // Keep fallback values empty when URL parsing fails.
  }

  return {
    title: match[1].trim(),
    url: match[2].trim(),
    path,
    itemId,
  };
}

export function DMThreadScreen({ route, navigation }: Props) {
  const { t } = useI18n();
  const { threadId, otherHandle, otherName, otherAvatarUrl, prefillText } = route.params;
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [roomCryptoKey, setRoomCryptoKey] = useState<CryptoKey | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageMimeType, setSelectedImageMimeType] = useState("image/jpeg");
  const [incomingBadgeCount, setIncomingBadgeCount] = useState(0);
  const [latestIncomingMessageId, setLatestIncomingMessageId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [sharedItemPreviews, setSharedItemPreviews] = useState<Record<string, SharedItemPreview>>({});
  const [openingProfile, setOpeningProfile] = useState(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<Message> | null>(null);
  const isNearBottomRef = useRef(true);
  const initializedMessagesRef = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const didInitialScrollRef = useRef(false);

  useEffect(() => {
    void loadMessages();
  }, [threadId]);

  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [threadId]);

  useEffect(() => {
    if (!prefillText) return;
    setInput((prev) => (prev.trim().length > 0 ? prev : prefillText));
  }, [prefillText]);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        void loadMessages({ silent: true });
      }, 120);
    };

    const channel = supabase
      .channel(`dm-thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_messages",
        },
        (payload: any) => {
          const payloadThreadId = payload?.new?.thread_id ?? payload?.old?.thread_id ?? null;
          if (payloadThreadId !== threadId) return;
          scheduleReload();
        }
      )
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setRealtimeReady(connected);
        console.log("[DM Realtime] status=", status, "threadId=", threadId);
      });

    const threadChannel = supabase
      .channel(`dm-thread-meta:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dm_threads",
          filter: `id=eq.${threadId}`,
        },
        scheduleReload
      )
      .subscribe((status) => {
        console.log("[DM Realtime] meta status=", status, "threadId=", threadId);
      });

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
      void supabase.removeChannel(threadChannel);
    };
  }, [threadId]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadMessages({ silent: true });
    }, realtimeReady ? 2000 : 1200);
    return () => clearInterval(interval);
  }, [realtimeReady, threadId]);

  useEffect(() => {
    const sharedIds = Array.from(
      new Set(
        messages
          .map((message) => (message.content ? parseSharedItemMessage(message.content) : null))
          .filter((shared): shared is NonNullable<ReturnType<typeof parseSharedItemMessage>> => Boolean(shared?.itemId))
          .map((shared) => shared.itemId)
      )
    );

    const missingIds = sharedIds.filter((id) => !sharedItemPreviews[id]);
    if (missingIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id,title,image_url,brand,category")
        .in("id", missingIds);

      if (cancelled || error || !data) return;
      setSharedItemPreviews((prev) => {
        const next = { ...prev };
        for (const row of data) {
          next[row.id] = {
            id: row.id,
            title: row.title,
            image_url: row.image_url,
            brand: row.brand,
            category: row.category,
          };
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, sharedItemPreviews]);

  const resolveMessageImageUrl = async (storedValue: string | null): Promise<string | null> => {
    if (!storedValue) return null;

    // New format (web-compatible): image_url stores path like threadId/userId/file.jpg
    if (!storedValue.startsWith("http://") && !storedValue.startsWith("https://")) {
      const { data, error } = await supabase.storage.from("dm-attachments").createSignedUrl(storedValue, 60 * 60 * 24 * 7);
      if (error || !data?.signedUrl) {
        console.log("[DM Image] signed URL failed", { path: storedValue, error: error?.message ?? null });
        return null;
      }
      return data.signedUrl;
    }

    // Legacy format compatibility: full URL in DB.
    const marker = "/dm-attachments/";
    const idx = storedValue.indexOf(marker);
    if (idx < 0) return storedValue;
    const path = storedValue.slice(idx + marker.length).split("?")[0];
    if (!path) return storedValue;
    const { data, error } = await supabase.storage.from("dm-attachments").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error || !data?.signedUrl) {
      console.log("[DM Image] signed URL failed", { path, error: error?.message ?? null });
      return storedValue;
    }
    return data.signedUrl;
  };

  const loadMessages = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      if (!silent) setLoading(false);
      Alert.alert(t("alert.authError"), authError?.message ?? t("common.unknownError"));
      return;
    }
    const uid = authData.user.id;
    setUserId(uid);

    const { data: threadData, error: threadError } = await supabase
      .from("dm_threads")
      .select("room_key")
      .eq("id", threadId)
      .maybeSingle();

    if (threadError) {
      if (!silent) setLoading(false);
      Alert.alert(t("alert.loadError"), threadError.message);
      return;
    }
    const resolvedRoomKey = threadData?.room_key ?? null;
    const importedRoomKey = resolvedRoomKey ? await importRoomKey(resolvedRoomKey) : null;
    setRoomCryptoKey(importedRoomKey);
    console.log("[DM Crypto] subtle=", canUseWebCrypto(), "roomKey=", Boolean(resolvedRoomKey), "imported=", Boolean(importedRoomKey));

    const { data, error } = await supabase
      .from("dm_messages")
      .select("id,sender_id,encrypted_content,is_encrypted,iv,image_url,created_at,read_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      if (!silent) setLoading(false);
      Alert.alert(t("alert.loadError"), error.message);
      return;
    }

    const rows = (data ?? []) as Array<{
      id: string;
      sender_id: string;
      encrypted_content: string | null;
      is_encrypted: boolean | null;
      iv: string | null;
      image_url: string | null;
      created_at: string;
      read_at: string | null;
    }>;

    const nextMessages: Message[] = await Promise.all(
      rows.map(async (row) => {
        let content = row.encrypted_content ?? "";
        if (row.is_encrypted && row.encrypted_content && row.iv && importedRoomKey) {
          const decrypted = importedRoomKey
            ? await decryptWithRoomKey(importedRoomKey, row.encrypted_content, row.iv)
            : null;
          content = decrypted ?? t("dm.encryptedMessage");
          if (!decrypted) {
            console.log("[DM Crypto] decrypt failed", { messageId: row.id, hasIv: Boolean(row.iv) });
          }
        } else if (row.is_encrypted) {
          content = t("dm.encryptedMessage");
        }
        return {
          id: row.id,
          sender_id: row.sender_id,
          content,
          is_encrypted: Boolean(row.is_encrypted),
          iv: row.iv,
          image_url: await resolveMessageImageUrl(row.image_url),
          created_at: row.created_at,
          read_at: row.read_at,
        };
      })
    );

    setMessages((prev) => (areMessagesEqual(prev, nextMessages) ? prev : nextMessages));
    if (!silent) setLoading(false);

    await supabase
      .from("dm_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", threadId)
      .neq("sender_id", uid)
      .is("read_at", null);
  };

  useEffect(() => {
    if (messages.length === 0) return;
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
    }
    const latest = messages[messages.length - 1];

    if (!initializedMessagesRef.current) {
      initializedMessagesRef.current = true;
      lastMessageIdRef.current = latest.id;
      return;
    }
    if (lastMessageIdRef.current === latest.id) return;
    lastMessageIdRef.current = latest.id;

    const isIncoming = Boolean(userId) && latest.sender_id !== userId;
    if (!isIncoming) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      return;
    }

    if (isNearBottomRef.current) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      return;
    }

    setLatestIncomingMessageId(latest.id);
    setIncomingBadgeCount((prev) => prev + 1);
  }, [messages, userId]);

  const handleMessagesScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const nearBottom = distanceFromBottom < 80;
    isNearBottomRef.current = nearBottom;

    if (nearBottom && incomingBadgeCount > 0) {
      setIncomingBadgeCount(0);
      setLatestIncomingMessageId(null);
    }
  };

  const focusLatestIncomingMessage = () => {
    listRef.current?.scrollToEnd({ animated: true });
    setIncomingBadgeCount(0);
    if (latestIncomingMessageId) {
      setHighlightedMessageId(latestIncomingMessageId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
      }, 1800);
    }
    setLatestIncomingMessageId(null);
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content && !selectedImageUri) return;
    if (!userId) return;

    setSending(true);
    let imagePath: string | null = null;
    let imageSignedUrl: string | null = null;
    if (selectedImageUri) {
      try {
        const uploaded = await uploadDMImage(selectedImageUri, selectedImageMimeType, userId);
        imagePath = uploaded.imagePath;
        imageSignedUrl = uploaded.imageUrl;
      } catch (error) {
        setSending(false);
        const message = error instanceof Error ? error.message : t("common.unknownError");
        Alert.alert(t("alert.shareError"), message);
        return;
      }
    }

    const encrypted = roomCryptoKey ? await encryptWithRoomKey(roomCryptoKey, content) : null;
    const insertPayload = encrypted
      ? {
          thread_id: threadId,
          sender_id: userId,
          encrypted_content: encrypted.encryptedContent,
          iv: encrypted.iv,
          is_encrypted: true,
          image_url: imagePath,
        }
      : {
          thread_id: threadId,
          sender_id: userId,
          encrypted_content: content,
          is_encrypted: false,
          image_url: imagePath,
        };

    const { data: inserted, error } = await supabase
      .from("dm_messages")
      .insert(insertPayload)
      .select("id,sender_id,created_at,read_at")
      .single();

    if (error || !inserted) {
      setSending(false);
      Alert.alert(t("alert.shareError"), error?.message ?? t("common.unknownError"));
      return;
    }

    await supabase
      .from("dm_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    setInput("");
    setSelectedImageUri(null);
    setSelectedImageMimeType("image/jpeg");
    setSending(false);

    const mineMessage: Message = {
      id: inserted.id,
      sender_id: inserted.sender_id,
      content,
      is_encrypted: Boolean(roomCryptoKey),
      iv: encrypted?.iv ?? null,
      image_url: imageSignedUrl,
      created_at: inserted.created_at,
      read_at: inserted.read_at,
    };

    setMessages((prev) => {
      if (prev.some((message) => message.id === mineMessage.id)) return prev;
      return [...prev, mineMessage];
    });

    setHighlightedMessageId(mineMessage.id);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1200);

    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    void loadMessages({ silent: true });
  };

  const uploadDMImage = async (
    uri: string,
    mimeType: string,
    uid: string,
  ): Promise<{ imagePath: string; imageUrl: string }> => {
    const safeMime = (mimeType || "image/jpeg").toLowerCase();
    const ext = (safeMime.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const imagePath = `${threadId}/${uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    let sourceUri = uri;
    if (sourceUri.startsWith("content://")) {
      const cacheDir = FileSystemLegacy.cacheDirectory ?? FileSystemLegacy.documentDirectory;
      if (!cacheDir) throw new Error("Local cache directory is unavailable.");
      const cachedUri = `${cacheDir}dm_upload_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      await FileSystemLegacy.copyAsync({ from: sourceUri, to: cachedUri });
      sourceUri = cachedUri;
    }

    const base64 = await FileSystemLegacy.readAsStringAsync(sourceUri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    const { data, error } = await supabase.storage.from("dm-attachments").upload(imagePath, arrayBuffer, {
      cacheControl: "3600",
      contentType: safeMime,
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("dm-attachments")
      .createSignedUrl(data.path, 60 * 60 * 24 * 7);
    if (signedError || !signedData?.signedUrl) {
      throw new Error(signedError?.message ?? "Failed to create signed URL.");
    }
    return { imagePath: data.path, imageUrl: signedData.signedUrl };
  };

  const pickImageFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("alert.authRequired"), t("dm.gallery"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setSelectedImageUri(asset.uri);
    setSelectedImageMimeType(asset.mimeType ?? "image/jpeg");
  };

  const pickImageFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("alert.authRequired"), t("dm.camera"));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setSelectedImageUri(asset.uri);
    setSelectedImageMimeType(asset.mimeType ?? "image/jpeg");
  };

  const openImagePicker = () => {
    Alert.alert(t("dm.attachImage"), t("dm.chooseSource"), [
      { text: t("dm.gallery"), onPress: () => void pickImageFromLibrary() },
      { text: t("dm.camera"), onPress: () => void pickImageFromCamera() },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("dm.justNow");
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const openSharedItemInApp = async (shared: NonNullable<ReturnType<typeof parseSharedItemMessage>>) => {
    if (shared.itemId) {
      const { data, error } = await supabase
        .from("items")
        .select(
          "id,title,description,image_url,image_urls,brand,category,visibility,owner_id,created_at,profiles(handle,display_name,avatar_url)"
        )
        .eq("id", shared.itemId)
        .maybeSingle();

      if (!error && data) {
        const row = data as {
          id: string;
          title: string;
          description: string | null;
          image_url: string | null;
          image_urls: string[] | null;
          brand: string | null;
          category: string | null;
          visibility: "public" | "unlisted" | "private";
          owner_id: string;
          created_at: string | null;
          profiles:
            | { handle: string; display_name: string | null; avatar_url: string | null }
            | Array<{ handle: string; display_name: string | null; avatar_url: string | null }>
            | null;
        };
        const ownerProfile = Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles;

        const detailItem: Item = {
          id: row.id,
          title: row.title,
          description: row.description,
          image_url: row.image_url,
          image_urls: row.image_urls,
          brand: row.brand,
          category: row.category,
          visibility: row.visibility,
          owner_id: row.owner_id,
          created_at: row.created_at,
          owner: {
            handle: ownerProfile?.handle ?? "unknown",
            display_name: ownerProfile?.display_name ?? null,
            avatar_url: ownerProfile?.avatar_url ?? null,
          },
        };

        navigation.navigate("FeedItemDetail", { item: detailItem });
        return;
      }
    }

    try {
      await Linking.openURL(shared.url);
    } catch {
      Alert.alert(t("alert.loadError"), t("common.unknownError"));
    }
  };

  const openOtherProfile = async () => {
    if (openingProfile) return;
    setOpeningProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,handle")
      .eq("handle", otherHandle)
      .maybeSingle();

    setOpeningProfile(false);
    if (error || !data?.id) {
      Alert.alert(t("alert.loadError"), error?.message ?? t("common.unknownError"));
      return;
    }
    navigation.navigate("UserProfile", { ownerId: data.id, handle: data.handle });
  };

  return (
    <View style={styles.container}>
      <Pressable
        disabled={openingProfile}
        onPress={() => {
          void openOtherProfile();
        }}
        style={styles.headerCard}
      >
        <View style={styles.avatarWrap}>
          {otherAvatarUrl ? (
            <Image source={{ uri: otherAvatarUrl }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarLabel}>{(otherName ?? otherHandle).slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.userMeta}>
          <Text style={styles.title}>{otherName ?? otherHandle}</Text>
          <Text style={styles.handle}>@{otherHandle}</Text>
        </View>
        <View style={styles.encryptedBadge}>
          <Text style={styles.encryptedBadgeText}>{t("dm.encryptedBadge")}</Text>
        </View>
      </Pressable>
      {loading ? <ActivityIndicator style={styles.loader} /> : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        onScroll={handleMessagesScroll}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (isNearBottomRef.current) {
            listRef.current?.scrollToEnd({ animated: false });
          }
        }}
        scrollEventThrottle={16}
        contentContainerStyle={styles.messagesContainer}
        style={styles.messagesList}
        ListEmptyComponent={<Text style={styles.emptyText}>{t("dm.startConversation")}</Text>}
        renderItem={({ item }) => {
          const mine = item.sender_id === userId;
          const sharedItem = item.content ? parseSharedItemMessage(item.content) : null;
          const sharedPreview = sharedItem?.itemId ? sharedItemPreviews[sharedItem.itemId] : null;
          return (
            <View
              style={[
                styles.messageBubble,
                mine ? styles.myBubble : styles.otherBubble,
                highlightedMessageId === item.id ? styles.highlightedBubble : null,
              ]}
            >
              {item.image_url ? (
                <ExpoImage
                  contentFit="cover"
                  source={{ uri: item.image_url }}
                  style={styles.messageImage}
                  onError={() => {
                    console.log("[DM Image] message load failed", item.image_url);
                  }}
                />
              ) : null}
              {sharedItem ? (
                <Pressable
                  onPress={() => {
                    void openSharedItemInApp(sharedItem);
                  }}
                  style={[styles.sharedCard, mine ? styles.sharedCardMine : styles.sharedCardOther]}
                >
                  <Text style={[styles.sharedLabel, mine ? styles.sharedLabelMine : null]}>{t("dm.sharedItem")}</Text>
                  <View style={styles.sharedMainRow}>
                    {sharedPreview?.image_url ? (
                      <Image source={{ uri: sharedPreview.image_url }} style={styles.sharedThumb} />
                    ) : (
                      <View style={styles.sharedThumbFallback}>
                        <Text style={styles.sharedThumbFallbackText}>📦</Text>
                      </View>
                    )}
                    <View style={styles.sharedTextWrap}>
                      <Text numberOfLines={1} style={[styles.sharedTitle, mine ? styles.sharedTextMine : null]}>
                        {sharedPreview?.title ?? sharedItem.title}
                      </Text>
                    </View>
                  </View>
                  {(sharedPreview?.brand || sharedPreview?.category) ? (
                    <View style={styles.sharedMetaRow}>
                      {sharedPreview?.brand ? (
                        <Text style={[styles.sharedChip, mine ? styles.sharedChipMine : null]}>{sharedPreview.brand}</Text>
                      ) : null}
                      {sharedPreview?.category ? (
                        <Text style={[styles.sharedChip, mine ? styles.sharedChipMine : null]}>{sharedPreview.category}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              ) : item.content ? (
                <Text style={[styles.messageText, mine && styles.myMessageText]}>{item.content}</Text>
              ) : null}
              <Text style={[styles.timeText, mine ? styles.myTimeText : null]}>{formatTime(item.created_at)}</Text>
            </View>
          );
        }}
      />
      {incomingBadgeCount > 0 ? (
        <Pressable onPress={focusLatestIncomingMessage} style={styles.newMessageBadge}>
          <Text style={styles.newMessageBadgeText}>{t("dm.newMessages", { count: incomingBadgeCount })}</Text>
        </Pressable>
      ) : null}

      {selectedImageUri ? (
        <View style={styles.selectedImageWrap}>
          <Image source={{ uri: selectedImageUri }} style={styles.selectedImagePreview} />
          <Pressable onPress={() => setSelectedImageUri(null)} style={styles.selectedImageRemove}>
            <Text style={styles.selectedImageRemoveText}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <Pressable disabled={sending} onPress={openImagePicker} style={styles.attachButton}>
          <Text style={styles.attachLabel}>+</Text>
        </Pressable>
        <TextInput
          onChangeText={setInput}
          onSubmitEditing={() => void sendMessage()}
          placeholder={t("dm.typeMessage")}
          placeholderTextColor={webUi.color.placeholder}
          returnKeyType="send"
          style={styles.input}
          value={input}
        />
        <Pressable disabled={sending} onPress={() => void sendMessage()} style={styles.sendButton}>
          <Text style={styles.sendLabel}>{sending ? "..." : t("feed.send")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    flex: 1,
    gap: webUi.layout.pageGap,
    maxWidth: webUi.layout.pageMaxWidth,
    width: "100%",
  },
  headerCard: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  avatarWrap: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
    width: 40,
  },
  avatar: { height: "100%", width: "100%" },
  avatarLabel: { color: webUi.color.textSecondary, fontSize: 14, fontWeight: "700" },
  userMeta: { flex: 1 },
  title: { color: webUi.color.text, fontSize: 15, fontWeight: "700" },
  handle: { color: webUi.color.textMuted, fontSize: webUi.typography.pageSubtitle, marginTop: 2 },
  encryptedBadge: {
    backgroundColor: webUi.color.successBg,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  encryptedBadgeText: { color: webUi.color.successText, fontSize: 10, fontWeight: "700" },
  loader: { marginTop: 8 },
  messagesList: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    flex: 1,
  },
  messagesContainer: {
    flexGrow: 1,
    gap: 8,
    justifyContent: "flex-end",
    padding: 12,
  },
  emptyText: { color: webUi.color.textMuted, textAlign: "center" },
  messageBubble: {
    borderRadius: webUi.radius.xl,
    marginBottom: 2,
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: webUi.color.primary,
  },
  otherBubble: {
    alignSelf: "flex-start",
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderWidth: 1,
  },
  highlightedBubble: {
    borderColor: webUi.color.primary,
    borderWidth: 2,
  },
  messageImage: {
    borderRadius: webUi.radius.xl,
    height: 220,
    marginBottom: 8,
    width: 220,
  },
  messageText: { color: webUi.color.text, fontSize: 13 },
  myMessageText: { color: webUi.color.primaryText },
  timeText: { color: webUi.color.textMuted, fontSize: 10, marginTop: 4, textAlign: "right" },
  myTimeText: { color: webUi.color.primaryText },
  inputRow: { flexDirection: "row", gap: 8, paddingBottom: 6 },
  newMessageBadge: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: webUi.color.text,
    borderRadius: 999,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newMessageBadgeText: {
    color: webUi.color.primaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  attachButton: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  attachLabel: {
    color: webUi.color.textSecondary,
    fontSize: 22,
    lineHeight: 22,
  },
  input: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    color: webUi.color.text,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: webUi.layout.controlVerticalPadding,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: webUi.color.primary,
    borderRadius: webUi.radius.xl,
    justifyContent: "center",
    minWidth: 64,
  },
  sendLabel: { color: webUi.color.primaryText, fontWeight: "700" },
  selectedImageWrap: {
    alignSelf: "flex-end",
    marginBottom: 4,
    position: "relative",
  },
  selectedImagePreview: {
    borderRadius: webUi.radius.xl,
    height: 80,
    width: 80,
  },
  selectedImageRemove: {
    alignItems: "center",
    backgroundColor: webUi.color.overlayControl,
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: -6,
    top: -6,
    width: 20,
  },
  selectedImageRemoveText: {
    color: webUi.color.primaryText,
    fontSize: 10,
    fontWeight: "700",
  },
  sharedCard: {
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    marginBottom: 2,
    padding: 10,
  },
  sharedCardMine: {
    backgroundColor: webUi.color.overlaySoft,
    borderColor: webUi.color.overlayDot,
  },
  sharedCardOther: {
    backgroundColor: webUi.color.surface,
    borderColor: webUi.color.border,
  },
  sharedLabel: {
    color: webUi.color.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  sharedLabelMine: {
    color: webUi.color.primaryText,
  },
  sharedMainRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sharedThumb: {
    borderRadius: 8,
    height: 50,
    width: 50,
  },
  sharedThumbFallback: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  sharedThumbFallbackText: {
    fontSize: 20,
  },
  sharedTextWrap: {
    flex: 1,
  },
  sharedTitle: {
    color: webUi.color.text,
    fontSize: 13,
    fontWeight: "700",
  },
  sharedPath: {
    color: webUi.color.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sharedTextMine: {
    color: webUi.color.primaryText,
  },
  sharedSubtextMine: {
    color: webUi.color.primaryText,
  },
  sharedMetaRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  sharedChip: {
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: 999,
    color: webUi.color.textSecondary,
    fontSize: 10,
    fontWeight: "600",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  sharedChipMine: {
    backgroundColor: webUi.color.overlaySoft,
    color: webUi.color.primaryText,
  },
});
