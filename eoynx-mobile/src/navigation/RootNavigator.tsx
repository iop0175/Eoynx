import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import { Dimensions } from "react-native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import Svg, { Path } from "react-native-svg";
import { AddItemScreen } from "../screens/AddItemScreen";
import { AuthScreen } from "../screens/AuthScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { FeedItemDetailScreen } from "../screens/feed/FeedItemDetailScreen";
import { DMInboxScreen } from "../screens/dm/DMInboxScreen";
import { DMRequestsScreen } from "../screens/dm/DMRequestsScreen";
import { DMThreadScreen } from "../screens/dm/DMThreadScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ProfileEditScreen } from "../screens/profile/ProfileEditScreen";
import { UserProfileScreen } from "../screens/profile/UserProfileScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { useI18n } from "../i18n";
import { webUi } from "../theme/webUi";
import type {
  AddStackParamList,
  FeedStackParamList,
  MainTabParamList,
  ProfileStackParamList,
  RootStackParamList,
  SearchStackParamList,
} from "./types";

type RootNavigatorProps = {
  session: Session | null;
  navigationRef?: any;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const MainTabs = createBottomTabNavigator<MainTabParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const AddStack = createNativeStackNavigator<AddStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const HORIZONTAL_GUTTER = Math.round(Dimensions.get("window").width * 0.02);

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: webUi.color.bg,
    border: webUi.color.border,
    card: webUi.color.surface,
    notification: webUi.color.primary,
    primary: webUi.color.primary,
    text: webUi.color.text,
  },
};

const sharedStackOptions: NativeStackNavigationOptions = {
  contentStyle: {
    backgroundColor: webUi.color.bg,
    paddingHorizontal: HORIZONTAL_GUTTER,
    paddingTop: 12,
  },
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: webUi.color.surface,
  },
  headerTintColor: webUi.color.text,
  headerTitleStyle: {
    color: webUi.color.text,
    fontSize: 16,
    fontWeight: "700",
  },
};

type TabIconProps = {
  color: string;
  focused: boolean;
  name: keyof MainTabParamList;
};

function TabIcon({ color, focused, name }: TabIconProps) {
  const strokeWidth = focused ? 2 : 1.8;

  if (name === "Feed") {
    return (
      <Svg fill="none" height={20} viewBox="0 0 24 24" width={20}>
        <Path
          d="M4 10.5L12 4l8 6.5V20H4v-9.5Z"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
    );
  }

  if (name === "Search") {
    return (
      <Svg fill="none" height={20} viewBox="0 0 24 24" width={20}>
        <Path
          d="m20 20-3.8-3.8M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
    );
  }

  if (name === "Add") {
    return (
      <Svg fill="none" height={20} viewBox="0 0 24 24" width={20}>
        <Path
          d="M12 5v14M5 12h14"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
    );
  }

  if (name === "Profile") {
    return (
      <Svg fill="none" height={20} viewBox="0 0 24 24" width={20}>
        <Path
          d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <Path
          d="M5 20a7 7 0 0 1 14 0"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
    );
  }

  return (
    <Svg fill="none" height={20} viewBox="0 0 24 24" width={20}>
      <Path
        d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M17.3 6.7l-1.4 1.4M8.1 15.9l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

function FeedStackNavigator() {
  return (
    <FeedStack.Navigator screenOptions={sharedStackOptions}>
      <FeedStack.Screen
        component={FeedScreen}
        name="FeedList"
        options={{
          headerShown: false,
        }}
      />
      <FeedStack.Screen
        component={FeedItemDetailScreen}
        name="FeedItemDetail"
        options={{
          headerTitle: "Item Detail",
        }}
      />
      <FeedStack.Screen
        component={UserProfileScreen}
        name="UserProfile"
        options={{
          headerTitle: "Profile",
        }}
      />
      <FeedStack.Screen
        component={DMInboxScreen}
        name="DMInbox"
        options={{ headerShown: false }}
      />
      <FeedStack.Screen
        component={DMThreadScreen}
        name="DMThread"
        options={{ headerTitle: "Thread" }}
      />
      <FeedStack.Screen
        component={DMRequestsScreen}
        name="DMRequests"
        options={{ headerTitle: "DM Requests" }}
      />
      <FeedStack.Screen
        component={NotificationsScreen}
        name="NotificationsHome"
        options={{ headerShown: false }}
      />
    </FeedStack.Navigator>
  );
}

function MainTabNavigator({ session }: { session: Session }) {
  const { t } = useI18n();
  return (
    <MainTabs.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, focused }) => (
          <TabIcon color={color} focused={focused} name={route.name as keyof MainTabParamList} />
        ),
        headerShown: false,
        tabBarStyle: {
          backgroundColor: webUi.color.surface,
          borderTopColor: webUi.color.border,
          borderTopWidth: 1,
          height: 62,
          left: 0,
          marginHorizontal: 0,
          paddingBottom: 6,
          paddingHorizontal: 0,
          paddingTop: 6,
          right: 0,
        },
        tabBarActiveTintColor: webUi.color.text,
        tabBarInactiveTintColor: webUi.color.textMuted,
        sceneStyle: {
          backgroundColor: webUi.color.bg,
          paddingHorizontal: HORIZONTAL_GUTTER,
          paddingTop: 12,
        },
      })}
    >
      <MainTabs.Screen name="Feed" component={FeedStackNavigator} options={{ tabBarLabel: t("tab.feed"), title: t("tab.feed") }} />
      <MainTabs.Screen name="Search" component={SearchStackNavigator} options={{ tabBarLabel: t("tab.search"), title: t("tab.search") }} />
      <MainTabs.Screen name="Add" component={AddStackNavigator} options={{ tabBarLabel: t("tab.add"), title: t("tab.add") }} />
      <MainTabs.Screen name="Profile" options={{ tabBarLabel: t("tab.profile"), title: t("tab.profile") }}>
        {() => <ProfileStackNavigator session={session} />}
      </MainTabs.Screen>
    </MainTabs.Navigator>
  );
}

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator screenOptions={sharedStackOptions}>
      <SearchStack.Screen
        component={SearchScreen}
        name="SearchHome"
        options={{ headerShown: false }}
      />
      <SearchStack.Screen
        component={UserProfileScreen}
        name="SearchUserProfile"
        options={{ headerTitle: "Profile" }}
      />
    </SearchStack.Navigator>
  );
}

function AddStackNavigator() {
  return (
    <AddStack.Navigator screenOptions={sharedStackOptions}>
      <AddStack.Screen
        component={AddItemScreen}
        name="AddItemHome"
        options={{ headerShown: false }}
      />
      <AddStack.Screen
        component={FeedItemDetailScreen}
        name="FeedItemDetail"
        options={{ headerTitle: "Item Detail" }}
      />
    </AddStack.Navigator>
  );
}

function ProfileStackNavigator({ session }: { session: Session }) {
  return (
    <ProfileStack.Navigator screenOptions={sharedStackOptions}>
      <ProfileStack.Screen
        name="ProfileOverview"
        options={{ headerShown: false }}
      >
        {(props) => <ProfileScreen {...props} session={session} />}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{ headerTitle: "Edit Profile" }}
      />
      <ProfileStack.Screen
        name="FeedItemDetail"
        component={FeedItemDetailScreen}
        options={{ headerTitle: "Item Detail" }}
      />
      <ProfileStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerTitle: "Settings" }}
      />
    </ProfileStack.Navigator>
  );
}

export function RootNavigator({ session, navigationRef }: RootNavigatorProps) {
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          ...sharedStackOptions,
        }}
      >
        {session ? (
          <RootStack.Screen name="MainTabs">
            {() => <MainTabNavigator session={session} />}
          </RootStack.Screen>
        ) : (
          <RootStack.Screen name="Auth" component={AuthScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
