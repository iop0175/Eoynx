import { redirect } from "next/navigation";
import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProfileSettingsClient from "./profile-settings-client";

export const metadata = {
  title: "Edit Profile",
  robots: NOINDEX,
};

export default async function ProfileSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, display_name, bio, avatar_url, dm_open")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/auth");
  }

  return (
    <PageShell title="Edit Profile" subtitle="Update your profile information">
      <ProfileSettingsClient profile={profile} />
    </PageShell>
  );
}
