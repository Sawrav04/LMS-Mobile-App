import React, { useMemo, useState } from "react";
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { useShipments } from "../../hooks/useShipments";
import ShipmentCard from "../../components/ShipmentCard";
import NotificationBell from "../../components/NotificationBell";
import { COLORS } from "../../lib/constants";

export default function HistoryTab() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { shipments, loading, refresh } = useShipments({
    carrierId: user?.id,
    status: "delivered",
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return shipments;
    const q = search.toLowerCase();
    return shipments.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        (s.pickupAddress  || s.pickup_address  || "").toLowerCase().includes(q) ||
        (s.deliveryAddress || s.delivery_address || "").toLowerCase().includes(q)
    );
  }, [shipments, search]);

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <NotificationBell />
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search deliveries…"
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Ionicons
            name="close-circle"
            size={18}
            color={COLORS.textTertiary}
            onPress={() => setSearch("")}
          />
        )}
      </View>

      {/* Summary pill */}
      {shipments.length > 0 && (
        <View style={styles.summaryPill}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
          <Text style={styles.summaryText}>
            {shipments.length} completed deliver{shipments.length === 1 ? "y" : "ies"}
          </Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ShipmentCard shipment={item} onUpdated={refresh} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No deliveries yet</Text>
            <Text style={styles.emptyHint}>Your completed deliveries will appear here</Text>
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
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: COLORS.text },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  summaryText: { fontSize: 12, fontWeight: "600", color: COLORS.success },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textSecondary, marginTop: 14 },
  emptyHint: { fontSize: 13, color: COLORS.textTertiary, marginTop: 6, textAlign: "center" },
});
