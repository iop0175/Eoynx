import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Navbar } from "./navbar";
import { getUnreadNotificationCount } from "@/app/actions/notifications";

export async function NavbarServer() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  let unreadNotifications = 0;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("handle, avatar_url")
      .eq("id", user.id)
      .single();
    profile = data;

    // Get unread notification count
    unreadNotifications = await getUnreadNotificationCount();
  }

  return (
    <Navbar
      user={
        profile
          ? { handle: profile.handle, avatar_url: profile.avatar_url }
          : null
      }
      unreadNotifications={unreadNotifications}
    />
  );
}
