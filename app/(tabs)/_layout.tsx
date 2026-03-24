import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/constants";
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from "react-native";

function TabItem({ label, iconName, color }: { label: string; iconName: any; color: string }) {
  return (
    <View style={tabItemStyles.wrapper}>
      <Ionicons name={iconName} size={22} color={color} />
      <Text
        style={[tabItemStyles.label, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </Text>
    </View>
  );
}

const tabItemStyles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", width: "100%" },
  label: { fontSize: 9, fontWeight: "600", marginTop: 3, textAlign: "center" },
});

export default function TabLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  const role = user.role;
  const isCarrier = role === "carrier";
  const isShipper = role === "shipper";
  const isManager = role === "manager";

  // FAB for shipper create tab — returns null for other roles
  const CustomTabBarButton = ({ children, onPress }: any) => {
    if (!isShipper) return null;
    return (
      <TouchableOpacity style={styles.fabContainer} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.fabButton}>{children}</View>
      </TouchableOpacity>
    );
  };

  // Completely collapse a tab — removes its space from the bar
  const hidden = { width: 0, overflow: "hidden", display: "none" } as const;

  return (
    <Tabs
      key={role ?? "loading"}
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: COLORS.border,
          height: 80,
          paddingBottom: 10,
          paddingTop: 8,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerStyle: { backgroundColor: "#fff", elevation: 0, shadowOpacity: 0 },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: "700", fontSize: 20 },
        headerTitleAlign: "left",
      }}
    >
      {/* ── Tab 1: Home – all roles ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabItem label="Home" iconName="home" color={color} />,
        }}
      />

      {/* ── Tab 2: Find – carriers only ── */}
      <Tabs.Screen
        name="available"
        options={{
          title: "Find",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabItem label="Find" iconName="compass" color={color} />,
          href: isCarrier ? undefined : null,
          tabBarItemStyle: !isCarrier ? hidden : undefined,
        }}
      />

      {/* ── Tab 3: Orders – shippers + managers only ── */}
      <Tabs.Screen
        name="shipments"
        options={{
          title: "Orders",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabItem label="Orders" iconName="receipt" color={color} />,
          href: isCarrier ? null : undefined,
          tabBarItemStyle: isCarrier ? hidden : undefined,
        }}
      />

      {/* ── Tab 4: Create FAB – shippers only ── */}
      <Tabs.Screen
        name="create"
        options={{
          title: "",
          tabBarIcon: () => <Ionicons name="add" size={32} color="#fff" />,
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
          tabBarItemStyle: !isShipper ? hidden : undefined,
        }}
      />

      {/* ── Tab 5: History – carriers only ── */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabItem label="History" iconName="time" color={color} />,
          href: isCarrier ? undefined : null,
          tabBarItemStyle: !isCarrier ? hidden : undefined,
        }}
      />

      {/* ── Tab 6: Carriers – managers only ── */}
      <Tabs.Screen
        name="carriers"
        options={{
          title: "Carriers",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabItem label="Carriers" iconName="people" color={color} />,
          href: isManager ? undefined : null,
          tabBarItemStyle: !isManager ? hidden : undefined,
        }}
      />

      {/* ── Tab 7: Stats – shippers + managers only ── */}
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabItem label="Stats" iconName="bar-chart" color={color} />,
          href: isCarrier ? null : undefined,
          tabBarItemStyle: isCarrier ? hidden : undefined,
        }}
      />

      {/* ── Tab 8: Profile – all roles ── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabItem label="Profile" iconName="person" color={color} />,
        }}
      />

      {/* ── Hidden utility tabs ── */}
      <Tabs.Screen name="scan"      options={{ href: null }} />
      <Tabs.Screen name="approvals" options={{ href: null }} />
      <Tabs.Screen name="blockchain" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabContainer: { top: -24, justifyContent: "center", alignItems: "center" },
  fabButton: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: "center", alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
});
