import React, { useState, useMemo } from "react";
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, RefreshControl, ScrollView, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { useShipments } from "../../hooks/useShipments";
import ShipmentCard from "../../components/ShipmentCard";
import NotificationBell from "../../components/NotificationBell";
import { COLORS } from "../../lib/constants";

// "active" bucket covers all carrier-side in-progress statuses
const MANAGER_FILTERS = [
  { id: "all",        label: "All",        icon: "layers-outline" as const },
  { id: "pending",    label: "Pending",    icon: "time-outline" as const },
  { id: "assigned",   label: "Assigned",   icon: "person-outline" as const },
  { id: "active",     label: "In Transit", icon: "car-outline" as const },
  { id: "delivered",  label: "Delivered",  icon: "checkmark-circle-outline" as const },
  { id: "cancelled",  label: "Issues",     icon: "alert-circle-outline" as const },
];

const ACTIVE_STATUSES = ["ready_for_pickup", "picked_up", "in-transit", "out_for_delivery"];

const SHIPPER_FILTERS = [
  { id: "all",        label: "All",       icon: "layers-outline" as const },
  { id: "pending",    label: "Pending",   icon: "time-outline" as const },
  { id: "in-transit", label: "Transit",   icon: "car-outline" as const },
  { id: "delivered",  label: "Delivered", icon: "checkmark-circle-outline" as const },
];

export default function ShipmentsTab() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const FILTERS = isManager ? MANAGER_FILTERS : SHIPPER_FILTERS;

  const { shipments, loading, refresh } = useShipments(
    isManager ? {} : { shipperId: user?.id }
  );
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = shipments;
    if (activeFilter === "active") {
      list = list.filter(s => ACTIVE_STATUSES.includes(s.status));
    } else if (activeFilter !== "all") {
      list = list.filter(s => s.status === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        s =>
          s.id.toLowerCase().includes(q) ||
          (s.pickup_address || s.pickupAddress || "").toLowerCase().includes(q) ||
          (s.delivery_address || s.deliveryAddress || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [shipments, activeFilter, search]);

  // Badge counts
  const counts = useMemo(() => ({
    pending:    shipments.filter(s => s.status === "pending").length,
    assigned:   shipments.filter(s => s.status === "assigned").length,
    active:     shipments.filter(s => ACTIVE_STATUSES.includes(s.status)).length,
    delivered:  shipments.filter(s => s.status === "delivered").length,
    cancelled:  shipments.filter(s => s.status === "cancelled").length,
  }), [shipments]);

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <NotificationBell />
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by ID, address…"
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabsContent}
      >
        {FILTERS.map(f => {
          const isActive = activeFilter === f.id;
          const badge = f.id !== "all" ? counts[f.id as keyof typeof counts] : null;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveFilter(f.id)}
            >
              <Ionicons
                name={f.icon}
                size={14}
                color={isActive ? "#fff" : COLORS.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {f.label}
              </Text>
              {!!badge && badge > 0 && (
                <View style={[styles.tabBadge, isActive ? styles.tabBadgeActive : undefined]}>
                  <Text style={[styles.tabBadgeText, isActive && { color: COLORS.primary }]}>
                    {badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results summary */}
      <Text style={styles.resultCount}>
        {filtered.length} shipment{filtered.length !== 1 ? "s" : ""}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ShipmentCard shipment={item} onUpdated={refresh} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={56} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No shipments found</Text>
            <Text style={styles.emptyHint}>
              {search ? "Try a different search term" : "Pull down to refresh"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.text },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: COLORS.text },

  tabsRow: { flexGrow: 0, marginBottom: 4 },
  tabsContent: { paddingHorizontal: 16, gap: 8 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  tabTextActive: { color: "#fff" },
  tabBadge: {
    marginLeft: 5,
    backgroundColor: COLORS.primary + "18",
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: "#ffffff30" },
  tabBadgeText: { fontSize: 10, fontWeight: "700", color: COLORS.primary },

  resultCount: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontWeight: "500",
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },

  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textSecondary, marginTop: 14 },
  emptyHint: { fontSize: 13, color: COLORS.textTertiary, marginTop: 6 },
});
