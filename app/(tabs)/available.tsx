import React, { useState, useMemo } from "react";
import {
  View, Text, FlatList, TextInput,
  StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { useShipments, Shipment } from "../../hooks/useShipments";
import NotificationBell from "../../components/NotificationBell";
import ShipmentDetailModal from "../../components/ShipmentDetailModal";
import { supabase } from "../../lib/supabase";
import { blockchainApi } from "../../lib/api";
import {
  notify,
  notifyManagersShipmentUpdate,
} from "../../lib/notifications";
import { COLORS } from "../../lib/constants";
import { Format } from "../../lib/format";

// ─── Assigned Order Decision Card ────────────────────────────────────────────
function AssignedOrderCard({
  shipment,
  onAccept,
  onDecline,
  onDetail,
}: {
  shipment: Shipment;
  onAccept: () => void;
  onDecline: () => void;
  onDetail: () => void;
}) {
  return (
    <TouchableOpacity
      style={ac.card}
      activeOpacity={0.95}
      onPress={onDetail}
    >
      {/* Top row — ID + priority badge */}
      <View style={ac.topRow}>
        <View style={ac.idRow}>
          <View style={ac.iconBox}>
            <Ionicons name="cube" size={20} color={COLORS.primary} />
          </View>
          <View>
            <Text style={ac.idText}>#{Format.shortId(shipment.id).toUpperCase()}</Text>
            <Text style={ac.meta}>
              {shipment.packageType || shipment.package_type}
              {"  ·  "}
              {shipment.weight} kg
              {"  ·  "}
              {shipment.priority || "Normal"}
            </Text>
          </View>
        </View>
        <View style={ac.newBadge}>
          <Text style={ac.newBadgeText}>New</Text>
        </View>
      </View>

      {/* Microcopy callout */}
      <View style={ac.callout}>
        <Ionicons name="flash" size={14} color={COLORS.warning} />
        <Text style={ac.calloutText}>New shipment assigned. Accept now to start.</Text>
      </View>

      {/* Route */}
      <View style={ac.routeRow}>
        <View style={ac.routePoint}>
          <View style={[ac.dot, { backgroundColor: COLORS.primary }]} />
          <View style={{ flex: 1 }}>
            <Text style={ac.routeLabel}>Pickup</Text>
            <Text style={ac.routeAddr} numberOfLines={1}>
              {shipment.pickupAddress || shipment.pickup_address}
            </Text>
          </View>
        </View>
        <View style={ac.routeDivider} />
        <View style={ac.routePoint}>
          <View style={[ac.dot, { backgroundColor: COLORS.danger }]} />
          <View style={{ flex: 1 }}>
            <Text style={ac.routeLabel}>Delivery</Text>
            <Text style={ac.routeAddr} numberOfLines={1}>
              {shipment.deliveryAddress || shipment.delivery_address}
            </Text>
          </View>
        </View>
      </View>

      {/* Date */}
      <Text style={ac.dateText}>
        Assigned {Format.datetime(shipment.created_at)}
      </Text>

      {/* Action Buttons */}
      <View style={ac.btnRow}>
        <TouchableOpacity
          style={ac.declineBtn}
          onPress={(e) => { e.stopPropagation?.(); onDecline(); }}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={16} color={COLORS.danger} />
          <Text style={ac.declineTxt}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={ac.acceptBtn}
          onPress={(e) => { e.stopPropagation?.(); onAccept(); }}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={ac.acceptTxt}>Accept</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Find Tab ─────────────────────────────────────────────────────────────────
export default function FindTab() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);

  // Only show shipments assigned to this carrier but not yet accepted
  const { shipments, loading, refresh } = useShipments({
    carrierId: user?.id,
    status: "pending",
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

  async function handleAccept(shipment: Shipment) {
    Alert.alert(
      "Accept Shipment",
      `Accept order #${Format.shortId(shipment.id).toUpperCase()} and head to pickup?`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Accept ✅",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("shipments")
                .update({ status: "assigned" })
                .eq("id", shipment.id);
              if (error) throw new Error(error.message);

              // Blockchain record (best-effort)
              try {
                await blockchainApi.post(
                  `/api/blockchain/shipments/${shipment.id}/status`,
                  {
                    status: "assigned",
                    location: shipment.pickupAddress || shipment.pickup_address,
                    notes: `Carrier ${user?.email} accepted shipment`,
                  }
                );
              } catch { /* best-effort */ }

              // Notifications
              const shipperId = shipment.shipperId || shipment.shipper_id;
              if (user?.id) notify.carrier.shipmentAccepted(user.id, shipment.id);
              if (shipperId) notify.shipper.carrierAssigned(shipperId, shipment.id);
              notifyManagersShipmentUpdate(shipment.id);

              refresh();
              Alert.alert("Accepted ✅", "Head to the pickup location.");
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  }

  async function handleDecline(shipment: Shipment) {
    Alert.alert(
      "Decline Shipment",
      "Decline this order? It will be returned to the manager for reassignment.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Decline ❌",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("shipments")
                .update({ carrier_id: null, status: "pending" })
                .eq("id", shipment.id);
              if (error) throw new Error(error.message);

              // Notify manager so they can reassign
              notifyManagersShipmentUpdate(shipment.id);

              refresh();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find Orders</Text>
        <NotificationBell />
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search assigned orders…"
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

      {/* Count pill */}
      {shipments.length > 0 && (
        <View style={styles.pendingPill}>
          <Ionicons name="time-outline" size={14} color={COLORS.warning} />
          <Text style={styles.pendingText}>
            {shipments.length} order{shipments.length === 1 ? "" : "s"} awaiting your decision
          </Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AssignedOrderCard
            shipment={item}
            onAccept={() => handleAccept(item)}
            onDecline={() => handleDecline(item)}
            onDetail={() => setDetailShipment(item)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={56} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No new orders</Text>
            <Text style={styles.emptyHint}>
              When the manager assigns a shipment, it will appear here
            </Text>
          </View>
        }
      />

      {/* Detail modal */}
      <ShipmentDetailModal
        shipment={detailShipment}
        onClose={() => setDetailShipment(null)}
        onUpdated={refresh}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
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
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: COLORS.text },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pendingText: { fontSize: 12, fontWeight: "600", color: COLORS.warning },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textSecondary, marginTop: 14 },
  emptyHint: { fontSize: 13, color: COLORS.textTertiary, marginTop: 6, textAlign: "center" },
});

// ─── AssignedOrderCard styles ─────────────────────────────────────────────────
const ac = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  idRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF3FF",
    justifyContent: "center",
    alignItems: "center",
  },
  idText: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, fontWeight: "500" },
  newBadge: {
    backgroundColor: "#EEF3FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newBadgeText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  callout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.warningBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  calloutText: { fontSize: 12, fontWeight: "600", color: COLORS.warning, flex: 1 },
  routeRow: { gap: 0, marginBottom: 12 },
  routePoint: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeDivider: {
    width: 2,
    height: 18,
    backgroundColor: COLORS.border,
    marginLeft: 4,
    marginVertical: 2,
  },
  routeLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" },
  routeAddr: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 1 },
  dateText: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginBottom: 14,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: COLORS.danger + "20",
  },
  declineTxt: { fontSize: 14, fontWeight: "700", color: COLORS.danger },
  acceptBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  acceptTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
