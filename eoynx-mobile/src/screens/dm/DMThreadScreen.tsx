import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { supabase } from "../../lib/supabase";
import { canUseWebCrypto, decryptWithRoomKey, encryptWithRoomKey, importRoomKey } from "../../lib/dmCrypto";
import type { FeedStackParamList } from "../../navigation/types";
import { webUi } from "../../theme/webUi";

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

export function DMThreadScreen({ route }: Props) {
  const { threadId, otherHandle, otherName, otherAvatarUrl } = route.params;
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [roomCryptoKey, setRoomCryptoKey] = useState<CryptoKey | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageMimeType, setSelectedImageMimeType] = useState("image/jpeg");
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadMessages();
  }, [threadId]);

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
      Alert.alert("Auth Error", authError?.message ?? "No authenticated user.");
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
      Alert.alert("Load Error", threadError.message);
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
      Alert.alert("Load Error", error.message);
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
          content = decrypted ?? "Encrypted message";
          if (!decrypted) {
            console.log("[DM Crypto] decrypt failed", { messageId: row.id, hasIv: Boolean(row.iv) });
          }
        } else if (row.is_encrypted) {
          content = "Encrypted message";
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

    setMessages(nextMessages);
    if (!silent) setLoading(false);

    await supabase
      .from("dm_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", threadId)
      .neq("sender_id", uid)
      .is("read_at", null);
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content && !selectedImageUri) return;
    if (!userId) return;

    setSending(true);
    let imagePath: string | null = null;
    if (selectedImageUri) {
      try {
        const uploaded = await uploadDMImage(selectedImageUri, selectedImageMimeType, userId);
        imagePath = uploaded.imagePath;
      } catch (error) {
        setSending(false);
        const message = error instanceof Error ? error.message : "Image upload failed.";
        Alert.alert("Upload Error", message);
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

    const { error } = await supabase.from("dm_messages").insert(insertPayload);

    if (error) {
      setSending(false);
      Alert.alert("Send Error", error.message);
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
      Alert.alert("Permission Required", "Please allow gallery access.");
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
      Alert.alert("Permission Required", "Please allow camera access.");
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
    Alert.alert("Attach image", "Choose source", [
      { text: "Gallery", onPress: () => void pickImageFromLibrary() },
      { text: "Camera", onPress: () => void pickImageFromCamera() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
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
          <Text style={styles.encryptedBadgeText}>Encrypted</Text>
        </View>
      </View>
      {loading ? <ActivityIndicator style={styles.loader} /> : null}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        style={styles.messagesList}
        ListEmptyComponent={<Text style={styles.emptyText}>Start a conversation</Text>}
        renderItem={({ item }) => {
          const mine = item.sender_id === userId;
          return (
            <View style={[styles.messageBubble, mine ? styles.myBubble : styles.otherBubble]}>
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
              {item.content ? <Text style={[styles.messageText, mine && styles.myMessageText]}>{item.content}</Text> : null}
              <Text style={[styles.timeText, mine ? styles.myTimeText : null]}>{formatTime(item.created_at)}</Text>
            </View>
          );
        }}
      />

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
          placeholder="Type a message"
          placeholderTextColor={webUi.color.placeholder}
          style={styles.input}
          value={input}
        />
        <Pressable disabled={sending} onPress={() => void sendMessage()} style={styles.sendButton}>
          <Text style={styles.sendLabel}>{sending ? "..." : "Send"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    flex: 1,
    gap: 10,
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
  handle: { color: webUi.color.textMuted, fontSize: 12, marginTop: 2 },
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
    backgroundColor: webUi.color.text,
  },
  otherBubble: {
    alignSelf: "flex-start",
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderWidth: 1,
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
  myTimeText: { color: webUi.color.textMuted },
  inputRow: { flexDirection: "row", gap: 8, paddingBottom: 6 },
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
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: webUi.color.text,
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
});
