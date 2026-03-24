import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TextInput, TouchableOpacity, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useShipments, Shipment } from "../../hooks/useShipments";
import { useUsers } from "../../hooks/useUsers";
import ShipmentCard from "../../components/ShipmentCard";
import NotificationBell from "../../components/NotificationBell";
import { supabase } from "../../lib/supabase";
import { blockchainApi } from "../../lib/api";
import {
  notify,
  notifyManagersShipmentUpdate,
  notifyManagersDelivered,
} from "../../lib/notifications";
import { COLORS } from "../../lib/constants";
import { Format } from "../../lib/format";

// ─── Manager status colour map ────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  pending:           COLORS.warning,
  assigned:          COLORS.primary,
  ready_for_pickup:  COLORS.primary,
  picked_up:         COLORS.primary,
  "in-transit":      COLORS.primary,
  out_for_delivery:  COLORS.primary,
  delivered:         COLORS.success,
  cancelled:         COLORS.danger,
};

// ─── Manager Command Center ───────────────────────────────────────────────────
function ManagerHome() {
  const { user } = useAuth();
  const { shipments: all, loading, refresh } = useShipments({});
  const { users: carriers } = useUsers("carrier");

  const pending   = all.filter(s => s.status === "pending");
  // All carrier-active statuses grouped as "in transit" for the manager overview
  const inTransit = all.filter(s =>
    ["assigned", "ready_for_pickup", "picked_up", "in-transit", "out_for_delivery"].includes(s.status)
  );
  const delivered = all.filter(s => s.status === "delivered");
  const pendingCarriers = carriers.filter(c => c.status === "pending");
  const recentActivity  = all.slice(0, 6);

  const displayName = user?.full_name || user?.company_name || (user?.email || "").split("@")[0] || "Manager";

  const quickActions = [
    {
      label: "All Orders", icon: "cube" as const,
      onPress: () => router.navigate("/(tabs)/shipments"),
    },
    {
      label: "Carriers", icon: "people" as const,
      onPress: () => router.navigate("/(tabs)/carriers"),
    },
    {
      label: "Stats", icon: "bar-chart" as const,
      onPress: () => router.navigate("/(tabs)/analytics"),
    },
  ];

  return (
    <View style={ms.container}>
      {/* Header */}
      <View style={ms.header}>
        <View>
          <Text style={ms.headerLabel}>Manager Portal</Text>
          <View style={ms.nameRow}>
            <Text style={ms.headerName} numberOfLines={1}>{displayName}</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.text} />
          </View>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        style={ms.scroll}
        contentContainerStyle={ms.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Row */}
        <View style={ms.statsRow}>
          <View style={[ms.statBox, { borderLeftColor: COLORS.primary }]}>
            <Text style={ms.statValue}>{inTransit.length}</Text>
            <Text style={ms.statLabel}>In Transit</Text>
          </View>
          <View style={[ms.statBox, { borderLeftColor: COLORS.warning }]}>
            <Text style={ms.statValue}>{pending.length}</Text>
            <Text style={ms.statLabel}>Pending</Text>
          </View>
          <View style={[ms.statBox, { borderLeftColor: COLORS.success }]}>
            <Text style={ms.statValue}>{delivered.length}</Text>
            <Text style={ms.statLabel}>Delivered</Text>
          </View>
        </View>

        {/* Action Required */}
        {(pending.length > 0 || pendingCarriers.length > 0) && (
          <View style={ms.actionCard}>
            <View style={ms.actionCardHeader}>
              <View style={ms.actionTitleRow}>
                <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
                <Text style={ms.actionCardTitle}>Action Required</Text>
              </View>
              <View style={ms.actionBadge}>
                <Text style={ms.actionBadgeText}>
                  {pending.length + pendingCarriers.length}
                </Text>
              </View>
            </View>

            {pending.length > 0 && (
              <TouchableOpacity
                style={ms.actionItem}
                onPress={() => router.navigate("/(tabs)/shipments")}
              >
                <View style={ms.actionItemIcon}>
                  <Ionicons name="cube-outline" size={16} color={COLORS.primary} />
                </View>
                <Text style={ms.actionItemText} numberOfLines={1}>
                  {pending.length} shipment{pending.length !== 1 ? "s" : ""} need carrier assignment
                </Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}

            {pendingCarriers.length > 0 && (
              <TouchableOpacity
                style={ms.actionItem}
                onPress={() => router.navigate("/(tabs)/carriers")}
              >
                <View style={ms.actionItemIcon}>
                  <Ionicons name="person-outline" size={16} color={COLORS.primary} />
                </View>
                <Text style={ms.actionItemText} numberOfLines={1}>
                  {pendingCarriers.length} carrier application{pendingCarriers.length !== 1 ? "s" : ""} awaiting approval
                </Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <Text style={ms.sectionTitle}>Quick Actions</Text>
        <View style={ms.quickRow}>
          {quickActions.map(a => (
            <TouchableOpacity
              key={a.label}
              style={ms.quickBtn}
              onPress={a.onPress}
              activeOpacity={0.75}
            >
              <View style={ms.quickIconWrap}>
                <Ionicons name={a.icon} size={22} color={COLORS.primary} />
              </View>
              <Text style={ms.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Live Shipments */}
        <View style={ms.sectionHeader}>
          <Text style={ms.sectionTitle}>Live Shipments</Text>
          <TouchableOpacity onPress={() => router.navigate("/(tabs)/shipments")}>
            <Text style={ms.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {inTransit.length === 0 ? (
          <View style={ms.emptyCard}>
            <Ionicons name="car-outline" size={36} color={COLORS.textTertiary} />
            <Text style={ms.emptyCardText}>No live shipments right now</Text>
          </View>
        ) : (
          inTransit.slice(0, 4).map(s => (
            <ShipmentCard key={s.id} shipment={s} onUpdated={refresh} />
          ))
        )}

        {/* Activity Feed */}
        <View style={ms.sectionHeader}>
          <Text style={ms.sectionTitle}>Recent Activity</Text>
        </View>
        {recentActivity.length === 0 ? (
          <View style={ms.emptyCard}>
            <Ionicons name="time-outline" size={36} color={COLORS.textTertiary} />
            <Text style={ms.emptyCardText}>No recent activity</Text>
          </View>
        ) : (
          <View style={ms.activityCard}>
            {recentActivity.map((s, i) => (
              <View
                key={s.id}
                style={[ms.activityRow, i < recentActivity.length - 1 && ms.activityBorder]}
              >
                <View style={[ms.activityDot, { backgroundColor: STATUS_COLOR[s.status] || COLORS.textTertiary }]} />
                <View style={ms.activityInfo}>
                  <Text style={ms.activityId}>#{Format.shortId(s.id)}</Text>
                  <Text style={ms.activityAddr} numberOfLines={1}>
                    {s.delivery_address || s.deliveryAddress}
                  </Text>
                </View>
                <View style={ms.activityRight}>
                  <View style={[ms.statusPill, { backgroundColor: (STATUS_COLOR[s.status] || COLORS.textTertiary) + "18" }]}>
                    <Text style={[ms.statusPillText, { color: STATUS_COLOR[s.status] || COLORS.textTertiary }]}>
                      {s.status}
                    </Text>
                  </View>
                  <Text style={ms.activityTime}>{Format.date(s.created_at || s.createdAt || "")}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Status progression for carrier ─────────────────────────────────────────
const CARRIER_NEXT_STATUS: Record<string, string> = {
  start_pickup:     "ready_for_pickup",
  mark_picked_up:   "picked_up",
  mark_in_transit:  "in-transit",
  out_for_delivery: "out_for_delivery",
  mark_delivered:   "delivered",
};

const CARRIER_ACTIVE_STATUSES = [
  "assigned", "ready_for_pickup", "picked_up", "in-transit", "out_for_delivery",
];

// ─── Default Home (carrier / shipper) ────────────────────────────────────────
function DefaultHome() {
  const { user } = useAuth();
  const role = user?.role;
  const [searchQuery, setSearchQuery] = useState("");

  // Carrier: fetch all active (non-delivered) shipments
  // Shipper: fetch all their shipments
  const carrierFilters = { carrierId: user?.id, statuses: CARRIER_ACTIVE_STATUSES };
  const shipperFilters = { shipperId: user?.id };
  const filters = role === "carrier" ? carrierFilters : role === "shipper" ? shipperFilters : {};

  const { shipments, loading, refresh } = useShipments(filters);

  const displayShipments = shipments
    .filter(s => s.id.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 20);

  const rawEmail = user?.email || "";
  const displayName = user?.full_name || user?.company_name || rawEmail.split("@")[0] || "User";

  // ── Carrier: advance shipment through the lifecycle ──────────────────────
  async function handleCarrierAction(action: string, shipment: Shipment) {
    const nextStatus = CARRIER_NEXT_STATUS[action];
    if (!nextStatus) return;

    const labels: Record<string, string> = {
      start_pickup:     "Start heading to pickup location?",
      mark_picked_up:   "Confirm you have collected the package?",
      mark_in_transit:  "Mark this shipment as in transit?",
      out_for_delivery: "Mark as out for delivery?",
      mark_delivered:   "Confirm this shipment has been delivered?",
    };

    Alert.alert(
      "Update Status",
      labels[action] ?? "Update shipment status?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("shipments")
                .update({ status: nextStatus })
                .eq("id", shipment.id);
              if (error) throw new Error(error.message);

              // Blockchain record (best-effort)
              try {
                await blockchainApi.post(
                  `/api/blockchain/shipments/${shipment.id}/status`,
                  {
                    status: nextStatus,
                    location: shipment.pickupAddress || shipment.pickup_address,
                    notes: `Carrier updated status to ${nextStatus}`,
                  }
                );
              } catch { /* best-effort */ }

              // Notifications per status
              const shipperId = shipment.shipperId || shipment.shipper_id;
              if (nextStatus === "picked_up" && shipperId) {
                notify.shipper.pickedUp(shipperId, shipment.id);
              }
              if (nextStatus === "in-transit") {
                if (shipperId) notify.shipper.inTransit(shipperId, shipment.id);
                notifyManagersShipmentUpdate(shipment.id);
              }
              if (nextStatus === "out_for_delivery") {
                if (user?.id) notify.carrier.outForDelivery(user.id, shipment.id);
                if (shipperId) notify.shipper.outForDelivery(shipperId, shipment.id);
              }
              if (nextStatus === "delivered") {
                if (user?.id) notify.carrier.delivered(user.id, shipment.id);
                if (shipperId) notify.shipper.delivered(shipperId, shipment.id);
                notifyManagersDelivered(shipment.id);
              }

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
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Welcome back</Text>
          <View style={styles.addressRow}>
            <Text style={styles.headerAddress} numberOfLines={1}>{displayName}</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.text} />
          </View>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by shipment ID…"
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity>
            <Ionicons name="scan-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {role === "carrier" ? "Active Deliveries" : "Current Tracking"}
          </Text>
          {role === "carrier" && displayShipments.length > 0 && (
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>{displayShipments.length} active</Text>
            </View>
          )}
        </View>

        {displayShipments.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>
              {role === "carrier"
                ? "No active deliveries\nAccept orders from the Find tab"
                : "No active shipments"}
            </Text>
          </View>
        ) : (
          displayShipments.map(s => (
            <ShipmentCard
              key={s.id}
              shipment={s}
              showCarrierActions={role === "carrier"}
              onAction={role === "carrier" ? handleCarrierAction : undefined}
              onUpdated={refresh}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export default function OverviewTab() {
  const { user } = useAuth();
  if (user?.role === "manager") return <ManagerHome />;
  return <DefaultHome />;
}

// ─── Manager styles ───────────────────────────────────────────────────────────
const ms = StyleSheet.create({
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
  headerLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerName: { fontSize: 16, fontWeight: "700", color: COLORS.text, maxWidth: 200 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 100 },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: "500" },

  // Action Required
  actionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  actionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionCardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  actionBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  actionBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EEF3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  actionItemText: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: "500" },

  // Quick Actions
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  seeAll: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  quickBtn: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EEF3FF",
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 11, fontWeight: "700", textAlign: "center", color: COLORS.primary },

  // Empty card
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 32,
    marginBottom: 20,
  },
  emptyCardText: { color: COLORS.textTertiary, fontSize: 13, marginTop: 8 },

  // Activity feed
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityInfo: { flex: 1 },
  activityId: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  activityAddr: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  activityRight: { alignItems: "flex-end", gap: 4 },
  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  activityTime: { fontSize: 10, color: COLORS.textTertiary },
});

// ─── Default (carrier / shipper) styles ──────────────────────────────────────
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
  headerLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerAddress: { fontSize: 16, fontWeight: "700", color: COLORS.text, maxWidth: 200 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, color: COLORS.text },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  seeAll: { fontSize: 14, color: COLORS.textSecondary, fontWeight: "500" },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    backgroundColor: "#fff",
    borderRadius: 24,
  },
  emptyText: {
    color: COLORS.textTertiary,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  activePill: {
    backgroundColor: "#EEF3FF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activePillText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
});
