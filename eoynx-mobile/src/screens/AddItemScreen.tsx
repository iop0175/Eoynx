import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { Image as ExpoImage } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import { supabase } from "../lib/supabase";
import type { AddStackParamList } from "../navigation/types";
import { webUi } from "../theme/webUi";
import type { Item } from "../types/item";

const CATEGORIES = ["Luxury", "Electronics", "Fashion", "Art", "Collectibles", "Jewelry", "Watches", "Other"];
const MAX_IMAGES = 5;
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_BRAND_LENGTH = 80;
const MAX_HASHTAGS = 15;
const MAX_HASHTAG_LENGTH = 30;
const MAX_PRICE_MINOR = 99_999_999_999;
const MAX_PREVIEW_EDGE = 1600;

type LocalImage = {
  id: string;
  uri: string;
  mimeType: string;
};
type Props = NativeStackScreenProps<AddStackParamList, "AddItemHome">;

const ALLOWED_UPLOAD_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const normalizeImageUri = async (uri: string, mimeType?: string | null): Promise<string> => {
  if (!uri.startsWith("content://")) return uri;
  const cacheDir = FileSystemLegacy.cacheDirectory ?? FileSystemLegacy.documentDirectory;
  if (!cacheDir) return uri;
  const ext = (mimeType?.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const cachedUri = `${cacheDir}preview_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  await FileSystemLegacy.copyAsync({ from: uri, to: cachedUri });
  return cachedUri;
};

const optimizePreviewUri = async (
  uri: string,
  mimeType: string,
  width?: number,
  height?: number,
): Promise<string> => {
  const normalized = await normalizeImageUri(uri, mimeType);
  const safeWidth = width ?? 0;
  const safeHeight = height ?? 0;
  const longest = Math.max(safeWidth, safeHeight);
  const actions =
    longest > MAX_PREVIEW_EDGE
      ? (safeWidth >= safeHeight
          ? [{ resize: { width: MAX_PREVIEW_EDGE } }]
          : [{ resize: { height: MAX_PREVIEW_EDGE } }])
      : [];

  try {
    const result = await ImageManipulator.manipulateAsync(
      normalized,
      actions,
      {
        compress: 0.82,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return result.uri;
  } catch {
    return normalized;
  }
};

export function AddItemScreen({ navigation, route }: Props) {
  const editItem = route.params?.editItem ?? null;
  const isEditMode = Boolean(editItem);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [primaryImageId, setPrimaryImageId] = useState<string | null>(null);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [price, setPrice] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const visibilityDescription = {
    public: "Public: visible on profile & searchable",
    unlisted: "Unlisted: only accessible via link",
    private: "Private: only visible to you",
  };

  const canPublish = useMemo(
    () => title.trim().length > 0 && images.length > 0 && !loading && !deleting,
    [title, images.length, loading, deleting],
  );

  useEffect(() => {
    if (!editItem) {
      setImages([]);
      setPrimaryImageId(null);
      setFailedPreviewIds(new Set());
      setCategory("");
      setBrand("");
      setTitle("");
      setDescription("");
      setHashtags("");
      setPrice("");
      setVisibility("public");
      return;
    }

    const existingUrls =
      editItem.image_urls && editItem.image_urls.length > 0
        ? editItem.image_urls.filter(Boolean)
        : editItem.image_url
          ? [editItem.image_url]
          : [];
    const mapped = existingUrls.map((uri, index) => ({
      id: `existing_${index}_${Date.now()}`,
      uri,
      mimeType: "image/jpeg",
    }));
    setImages(mapped);
    setPrimaryImageId(mapped[0]?.id ?? null);
    setFailedPreviewIds(new Set());
    setCategory(editItem.category ?? "");
    setBrand(editItem.brand ?? "");
    setTitle(editItem.title ?? "");
    setDescription(editItem.description ?? "");
    setHashtags("");
    setPrice("");
    setVisibility(editItem.visibility ?? "public");
  }, [editItem]);

  useEffect(() => {
    const primary = images.find((img) => img.id === primaryImageId) ?? images[0];
    console.log(
      "[AddItem] state",
      JSON.stringify({
        images: images.length,
        primaryImageId,
        primaryUri: primary?.uri ?? null,
      }),
    );
  }, [images, primaryImageId]);

  const addImagesFromLibrary = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert("Limit", `Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow gallery access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      allowsMultipleSelection: false,
      aspect: [4, 3],
      mediaTypes: ["images"],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? "image/jpeg";
    const safeUri = await optimizePreviewUri(asset.uri, mimeType, asset.width, asset.height);
    const nextImage: LocalImage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      uri: safeUri,
      mimeType,
    };

    console.log("[AddItem] picked from library", nextImage.uri);
    setImages((prev) => [nextImage, ...prev]);
    setFailedPreviewIds(new Set());
    setPrimaryImageId(nextImage.id);
  };

  const addImageFromCamera = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert("Limit", `Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

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
    const mimeType = asset.mimeType ?? "image/jpeg";
    const safeUri = await optimizePreviewUri(asset.uri, mimeType, asset.width, asset.height);
    const nextImage: LocalImage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      uri: safeUri,
      mimeType,
    };
    console.log("[AddItem] picked from camera", nextImage.uri);
    setImages((prev) => [nextImage, ...prev]);
    setFailedPreviewIds(new Set());
    setPrimaryImageId(nextImage.id);
  };

  const removeImage = (id: string) => {
    setFailedPreviewIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (primaryImageId === id) {
        setPrimaryImageId(filtered[0]?.id ?? null);
      }
      return filtered;
    });
  };

  const setPrimary = (id: string) => {
    console.log("[AddItem] setPrimary", id);
    setPrimaryImageId(id);
  };

  const parseHashtags = (input: string) =>
    input
      .split(/[\s,]+/)
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter(Boolean);

  const parsePriceMinor = (raw: string): number | undefined => {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    if (!cleaned) return undefined;
    const num = Number.parseFloat(cleaned);
    if (Number.isNaN(num)) return undefined;
    return Math.round(num * 100);
  };

  const uploadLocalImage = async (img: LocalImage, userId: string): Promise<string> => {
    if (img.uri.startsWith("http://") || img.uri.startsWith("https://")) {
      return img.uri;
    }
    const safeMime = ALLOWED_UPLOAD_MIME.has(img.mimeType) ? img.mimeType : "image/jpeg";
    const ext = (safeMime.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    let sourceUri = img.uri;

    // Android content:// URIs can fail with direct reads. Copy to cache first if needed.
    if (sourceUri.startsWith("content://")) {
      const cacheDir = FileSystemLegacy.cacheDirectory ?? FileSystemLegacy.documentDirectory;
      if (!cacheDir) throw new Error("Local file cache directory is unavailable.");
      const cachedUri = `${cacheDir}upload_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      await FileSystemLegacy.copyAsync({ from: sourceUri, to: cachedUri });
      sourceUri = cachedUri;
    }

    const base64 = await FileSystemLegacy.readAsStringAsync(sourceUri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    const { data, error } = await supabase.storage.from("items").upload(filePath, arrayBuffer, {
      cacheControl: "3600",
      contentType: safeMime,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data: publicData } = supabase.storage.from("items").getPublicUrl(data.path);
    return publicData.publicUrl;
  };

  const handlePublish = async () => {
    const titleTrimmed = title.trim();
    const descTrimmed = description.trim();
    const brandTrimmed = brand.trim();
    const parsedHashtags = parseHashtags(hashtags);
    const parsedPriceMinor = price.trim() ? parsePriceMinor(price) : undefined;

    if (!titleTrimmed) return Alert.alert("Validation", "Please enter an item name.");
    if (titleTrimmed.length > MAX_TITLE_LENGTH) return Alert.alert("Validation", `Item name must be <= ${MAX_TITLE_LENGTH} chars.`);
    if (images.length === 0) return Alert.alert("Validation", "Please add at least one image.");
    if (images.length > MAX_IMAGES) return Alert.alert("Validation", `Maximum ${MAX_IMAGES} images allowed.`);
    if (descTrimmed.length > MAX_DESCRIPTION_LENGTH) return Alert.alert("Validation", `Description must be <= ${MAX_DESCRIPTION_LENGTH} chars.`);
    if (brandTrimmed.length > MAX_BRAND_LENGTH) return Alert.alert("Validation", `Brand must be <= ${MAX_BRAND_LENGTH} chars.`);
    if (parsedHashtags.length > MAX_HASHTAGS) return Alert.alert("Validation", `You can add up to ${MAX_HASHTAGS} hashtags.`);
    if (parsedHashtags.some((tag) => tag.length > MAX_HASHTAG_LENGTH)) {
      return Alert.alert("Validation", `Each hashtag must be <= ${MAX_HASHTAG_LENGTH} chars.`);
    }
    if (parsedPriceMinor !== undefined && (parsedPriceMinor < 0 || parsedPriceMinor > MAX_PRICE_MINOR)) {
      return Alert.alert("Validation", "Price is out of allowed range.");
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setLoading(false);
        Alert.alert("Auth Error", authError?.message ?? "No authenticated user.");
        return;
      }
      const ownerId = authData.user.id;

      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        try {
          const url = await uploadLocalImage(img, ownerId);
          uploadedUrls.push(url);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Image upload failed.";
          throw new Error(`Image ${i + 1} upload failed: ${msg}`);
        }
      }
      const upsertAttempts = [
        {
          title: titleTrimmed,
          description: descTrimmed || null,
          visibility,
          image_url: uploadedUrls[0] ?? null,
          image_urls: uploadedUrls,
          category: category || null,
          brand: brandTrimmed || null,
          hashtags: parsedHashtags,
          price_minor: parsedPriceMinor ?? null,
          price_currency: "USD",
        },
        {
          title: titleTrimmed,
          description: descTrimmed || null,
          visibility,
          image_url: uploadedUrls[0] ?? null,
          image_urls: uploadedUrls,
          category: category || null,
          brand: brandTrimmed || null,
        },
        {
          title: titleTrimmed,
          description: descTrimmed || null,
          visibility,
          image_url: uploadedUrls[0] ?? null,
        },
      ];

      let upsertErrorMessage: string | null = null;
      let savedItemRow:
        | {
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
          }
        | null = null;
      let upsertSucceeded = false;
      for (const payload of upsertAttempts) {
        const fullPayload = { owner_id: ownerId, ...payload };
        const res = isEditMode
          ? await supabase
              .from("items")
              .update(fullPayload)
              .eq("id", editItem!.id)
              .eq("owner_id", ownerId)
              .select("id,title,description,image_url,image_urls,brand,category,visibility,owner_id,created_at")
              .single()
          : await supabase
              .from("items")
              .insert(fullPayload)
              .select("id,title,description,image_url,image_urls,brand,category,visibility,owner_id,created_at")
              .single();
        if (!res.error) {
          savedItemRow = res.data;
          upsertSucceeded = true;
          break;
        }
        upsertErrorMessage = res.error.message;
      }

      if (!upsertSucceeded) {
        throw new Error(upsertErrorMessage ?? (isEditMode ? "Failed to update item." : "Failed to create item."));
      }

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("handle,display_name,avatar_url")
        .eq("id", ownerId)
        .maybeSingle();

      if (!savedItemRow) {
        throw new Error(isEditMode ? "Updated item not found." : "Created item not found.");
      }

      const detailItem: Item = {
        ...savedItemRow,
        owner: {
          handle: ownerProfile?.handle ?? "unknown",
          display_name: ownerProfile?.display_name ?? null,
          avatar_url: ownerProfile?.avatar_url ?? null,
        },
        liked: false,
        bookmarked: false,
        like_count: 0,
        comment_count: 0,
        comment_preview: [],
      };

      setImages([]);
      setPrimaryImageId(null);
      setFailedPreviewIds(new Set());
      setCategory("");
      setBrand("");
      setTitle("");
      setDescription("");
      setHashtags("");
      setPrice("");
      setVisibility("public");
      navigation.navigate("FeedItemDetail", { item: detailItem });
    } catch (error) {
      const msg = error instanceof Error ? error.message : isEditMode ? "Failed to update item." : "Failed to create item.";
      Alert.alert(isEditMode ? "Update Error" : "Create Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = () => {
    if (!isEditMode || !editItem || deleting || loading) return;
    Alert.alert("Delete item", "Are you sure you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData.user) {
              Alert.alert("Auth Error", authError?.message ?? "No authenticated user.");
              return;
            }
            const ownerId = authData.user.id;
            const { error } = await supabase.from("items").delete().eq("id", editItem.id).eq("owner_id", ownerId);
            if (error) throw new Error(error.message);
            navigation.getParent<any>()?.navigate("Feed", { screen: "FeedList" });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete item.";
            Alert.alert("Delete Error", message);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const primaryImage =
    images.find((img) => img.id === primaryImageId && !failedPreviewIds.has(img.id)) ??
    images.find((img) => !failedPreviewIds.has(img.id)) ??
    images[0];
  const subImages = images.filter((img) => img.id !== primaryImage?.id);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{isEditMode ? "Edit item" : "Add item"}</Text>
          <Text style={styles.subtitle}>
            {isEditMode ? "Update your item details" : "Create a new item in your collection"}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Images ({images.length}/{MAX_IMAGES})</Text>

        {primaryImage ? (
          <View style={styles.primaryWrap}>
            <ExpoImage
              onLoad={() => {
                console.log("[AddItem] primary onLoad", primaryImage.uri);
              }}
              onError={() => {
                console.log("[AddItem] primary preview load failed", primaryImage.uri);
                setFailedPreviewIds((prev) => {
                  const next = new Set(prev);
                  next.add(primaryImage.id);
                  return next;
                });
                setPrimaryImageId((current) => {
                  if (current !== primaryImage.id) return current;
                  const next = images.find((img) => img.id !== primaryImage.id && !failedPreviewIds.has(img.id));
                  return next?.id ?? null;
                });
              }}
              contentFit="cover"
              source={{ uri: primaryImage.uri }}
              style={styles.primaryImage}
            />
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>Primary</Text>
            </View>
            <Pressable onPress={() => removeImage(primaryImage.id)} style={styles.removePrimaryButton}>
              <Text style={styles.removeButtonText}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyPrimary}>
            <Text style={styles.emptyPrimaryText}>Add primary image</Text>
          </View>
        )}

        <View style={styles.imageActionRow}>
          <Pressable disabled={loading || deleting || images.length >= MAX_IMAGES} onPress={() => void addImagesFromLibrary()} style={styles.imageActionButton}>
            <Text style={styles.imageActionLabel}>Gallery</Text>
          </Pressable>
          <Pressable disabled={loading || deleting || images.length >= MAX_IMAGES} onPress={() => void addImageFromCamera()} style={styles.imageActionButton}>
            <Text style={styles.imageActionLabel}>Camera</Text>
          </Pressable>
        </View>

        {subImages.length > 0 ? (
          <ScrollView contentContainerStyle={styles.subImageRow} horizontal showsHorizontalScrollIndicator={false}>
            {subImages.map((img) => (
              <View key={img.id} style={styles.subImageWrap}>
                <ExpoImage
                  onLoad={() => {
                    console.log("[AddItem] sub onLoad", img.uri);
                  }}
                  onError={() => {
                    console.log("[AddItem] sub preview load failed", img.uri);
                  }}
                  contentFit="cover"
                  source={{ uri: img.uri }}
                  style={styles.subImage}
                />
                <View style={styles.subActions}>
                  <Pressable onPress={() => setPrimary(img.id)} style={styles.smallActionButton}>
                    <Text style={styles.smallActionLabel}>P</Text>
                  </Pressable>
                  <Pressable onPress={() => removeImage(img.id)} style={styles.smallActionButton}>
                    <Text style={styles.smallActionLabel}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {CATEGORIES.map((value) => (
              <Pressable key={value} onPress={() => setCategory(value)} style={[styles.chip, category === value && styles.chipActive]}>
                <Text style={[styles.chipText, category === value && styles.chipTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>Brand</Text>
        <TextInput
          autoCorrect={false}
          onChangeText={setBrand}
          placeholder="HERMES"
          placeholderTextColor={webUi.color.placeholder}
          style={styles.input}
          value={brand}
        />

        <Text style={styles.label}>Item name</Text>
        <TextInput
          onChangeText={setTitle}
          placeholder="Birkin 25"
          placeholderTextColor={webUi.color.placeholder}
          style={styles.input}
          value={title}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={webUi.color.placeholder}
          style={[styles.input, styles.textArea]}
          value={description}
        />

        <Text style={styles.label}>Hashtags</Text>
        <TextInput
          onChangeText={setHashtags}
          placeholder="#luxury #birkin"
          placeholderTextColor={webUi.color.placeholder}
          style={styles.input}
          value={hashtags}
        />

        <Text style={styles.label}>Price</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setPrice}
          placeholder="$16,000 (optional)"
          placeholderTextColor={webUi.color.placeholder}
          style={styles.input}
          value={price}
        />

        <Text style={styles.label}>Visibility</Text>
        <View style={styles.visibilityRow}>
          {(["public", "unlisted", "private"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setVisibility(value)}
              style={[styles.visibilityChip, visibility === value && styles.visibilityChipActive]}
            >
              <Text style={[styles.visibilityText, visibility === value && styles.visibilityTextActive]}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.visibilityDesc}>{visibilityDescription[visibility]}</Text>
      </View>

      <Pressable disabled={!canPublish} onPress={() => void handlePublish()} style={[styles.publishButton, !canPublish && styles.publishButtonDisabled]}>
        <Text style={styles.publishLabel}>
          {loading ? "Uploading images..." : deleting ? "Deleting item..." : isEditMode ? "Save changes" : "Publish"}
        </Text>
      </Pressable>
      {isEditMode ? (
        <Pressable
          disabled={loading || deleting}
          onPress={handleDeleteItem}
          style={[styles.deleteButton, (loading || deleting) && styles.publishButtonDisabled]}
        >
          <Text style={styles.deleteLabel}>Delete item</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    gap: 12,
    maxWidth: webUi.layout.pageMaxWidth,
    paddingBottom: 24,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: webUi.color.text,
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: webUi.color.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xxl,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  label: {
    color: webUi.color.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  primaryWrap: {
    backgroundColor: webUi.color.surfaceMuted,
    borderRadius: 0,
    overflow: "visible",
    position: "relative",
    aspectRatio: 4 / 3,
    width: "100%",
  },
  primaryImage: {
    backgroundColor: webUi.color.surfaceMuted,
    height: "100%",
    width: "100%",
  },
  primaryBadge: {
    backgroundColor: webUi.color.primary,
    borderRadius: 999,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    top: 8,
  },
  primaryBadgeText: {
    color: webUi.color.primaryText,
    fontSize: 11,
    fontWeight: "700",
  },
  removePrimaryButton: {
    alignItems: "center",
    backgroundColor: webUi.color.overlayControl,
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    top: 8,
    width: 24,
  },
  removeButtonText: {
    color: webUi.color.primaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyPrimary: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceMuted,
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderStyle: "dashed",
    borderWidth: 2,
    height: 180,
    justifyContent: "center",
  },
  emptyPrimaryText: {
    color: webUi.color.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  imageActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  imageActionButton: {
    alignItems: "center",
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  imageActionLabel: {
    color: webUi.color.text,
    fontSize: 13,
    fontWeight: "600",
  },
  subImageRow: {
    gap: 8,
  },
  subImageWrap: {
    borderRadius: webUi.radius.xl,
    height: 84,
    overflow: "hidden",
    position: "relative",
    width: 84,
  },
  subImage: {
    height: "100%",
    width: "100%",
  },
  subActions: {
    bottom: 4,
    flexDirection: "row",
    gap: 4,
    position: "absolute",
    right: 4,
  },
  smallActionButton: {
    alignItems: "center",
    backgroundColor: webUi.color.surfaceOverlay,
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  smallActionLabel: {
    color: webUi.color.text,
    fontSize: 10,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: webUi.color.text,
    borderColor: webUi.color.text,
  },
  chipText: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: webUi.color.primaryText,
  },
  input: {
    borderColor: webUi.color.border,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    color: webUi.color.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  visibilityRow: {
    flexDirection: "row",
    gap: 8,
  },
  visibilityChip: {
    borderColor: webUi.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  visibilityChipActive: {
    backgroundColor: webUi.color.text,
    borderColor: webUi.color.text,
  },
  visibilityText: {
    color: webUi.color.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  visibilityTextActive: {
    color: webUi.color.primaryText,
  },
  visibilityDesc: {
    color: webUi.color.textMuted,
    fontSize: 12,
  },
  publishButton: {
    alignItems: "center",
    backgroundColor: webUi.color.primary,
    borderRadius: webUi.radius.xl,
    paddingVertical: 12,
  },
  publishButtonDisabled: {
    opacity: 0.5,
  },
  publishLabel: {
    color: webUi.color.primaryText,
    fontWeight: "700",
  },
  deleteButton: {
    alignItems: "center",
    borderColor: webUi.color.danger,
    borderRadius: webUi.radius.xl,
    borderWidth: 1,
    paddingVertical: 12,
  },
  deleteLabel: {
    color: webUi.color.danger,
    fontWeight: "700",
  },
});
