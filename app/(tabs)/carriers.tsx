import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, Modal, Pressable,
  TouchableOpacity, RefreshControl, Alert, TextInput,
  ScrollView, ActivityIndicator, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { useUsers } from "../../hooks/useUsers";
import { supabase } from "../../lib/supabase";
import { blockchainApi } from "../../lib/api";
import { notify } from "../../lib/notifications";
import NotificationBell from "../../components/NotificationBell";
import { COLORS } from "../../lib/constants";
import { Format } from "../../lib/format";
import type { User } from "../../lib/auth";

const SCREEN_HEIGHT = Dimensions.get("window").height;

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: "all",         label: "All" },
  { id: "pending",     label: "Pending" },
  { id: "approved",    label: "Active" },
  { id: "deactivated", label: "Inactive" },
];

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  approved:    COLORS.success,
  pending:     COLORS.primary,
  deactivated: COLORS.textTertiary,
  rejected:    COLORS.danger,
};
const STATUS_BG: Record<string, string> = {
  approved:    COLORS.successBg,
  pending:     "#EEF3FF",
  deactivated: "#F0F0F0",
  rejected:    COLORS.dangerBg,
};

// ─── Carrier Detail Bottom Sheet ─────────────────────────────────────────────
interface CarrierStats {
  delivered:   number;
  inTransit:   number;
  total:       number;
  currentShipment: { id: string; delivery_address: string } | null;
}

function CarrierDetailSheet({
  carrier,
  managerId,
  visible,
  onClose,
  onRefresh,
}: {
  carrier: User | null;
  managerId?: string;
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [stats, setStats]     = useState<CarrierStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!carrier?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("shipments")
        .select("id, status, delivery_address")
        .eq("carrier_id", carrier.id);

      const rows = data || [];
      const currentShipment = rows.find(s => s.status === "in-transit") ?? null;
      setStats({
        total:      rows.length,
        delivered:  rows.filter(s => s.status === "delivered").length,
        inTransit:  rows.filter(s => s.status === "in-transit").length,
        currentShipment,
      });
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [carrier?.id]);

  useEffect(() => {
    if (visible) fetchStats();
    else setStats(null);
  }, [visible, fetchStats]);

  async function handleApprove() {
    if (!carrier) return;
    Alert.alert("Approve Carrier", `Approve ${carrier.email}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("profiles").update({ status: "approved" }).eq("id", carrier.id);
            if (error) throw new Error(error.message);
            try {
              await blockchainApi.post(`/api/blockchain/carriers/${carrier.id}/approve`, { approver: { role: "manager" } });
            } catch { /* best-effort */ }
            notify.carrier.approved(carrier.id);
            if (managerId) notify.manager.carrierApproved(managerId);
            Alert.alert("Approved ✓", `${carrier.email} is now active.`);
            onRefresh();
            onClose();
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  }

  async function handleDeactivate() {
    if (!carrier) return;
    Alert.alert("Deactivate Carrier", `Deactivate ${carrier.email}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate", style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("profiles").update({ status: "deactivated" }).eq("id", carrier.id);
            if (error) throw new Error(error.message);
            Alert.alert("Done", `${carrier.email} has been deactivated.`);
            onRefresh();
            onClose();
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  }

  async function handleReactivate() {
    if (!carrier) return;
    Alert.alert("Reactivate Carrier", `Reactivate ${carrier.email}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reactivate",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("profiles").update({ status: "approved" }).eq("id", carrier.id);
            if (error) throw new Error(error.message);
            Alert.alert("Reactivated ✓", `${carrier.email} is active again.`);
            onRefresh();
            onClose();
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  }

  if (!carrier) return null;

  const sColor   = STATUS_COLOR[carrier.status ?? ""] || COLORS.textTertiary;
  const sBg      = STATUS_BG[carrier.status ?? ""]    || "#F0F0F0";
  const initials = (carrier.email || "?")[0].toUpperCase();
  const isPending     = carrier.status === "pending";
  const isActive      = carrier.status === "approved";
  const isDeactivated = carrier.status === "deactivated";

  const isOnDelivery = (stats?.inTransit ?? 0) > 0;
  const activityColor = isOnDelivery ? COLORS.info : COLORS.success;
  const activityBg    = isOnDelivery ? COLORS.infoBg : COLORS.successBg;
  const activityLabel = isOnDelivery ? "On Delivery" : "Idle";
  const activityIcon  = isOnDelivery ? "car" as const : "checkmark-circle" as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sh.wrapper}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Sheet */}
        <View style={sh.sheet}>
          {/* Drag handle */}
          <View style={sh.handle} />

          {/* Close button */}
          <TouchableOpacity style={sh.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sh.content}>
            {/* Avatar + identity */}
            <View style={sh.identity}>
              <View style={[sh.avatar, { backgroundColor: sColor + "22" }]}>
                <Text style={[sh.avatarText, { color: sColor }]}>{initials}</Text>
              </View>
              <Text style={sh.emailText}>{carrier.email}</Text>
              {carrier.company_name ? (
                <Text style={sh.companyText}>{carrier.company_name}</Text>
              ) : null}
              <View style={[sh.statusBadge, { backgroundColor: sBg }]}>
                <Text style={[sh.statusBadgeText, { color: sColor }]}>
                  {carrier.status === "approved" ? "Active" : carrier.status}
                </Text>
              </View>
            </View>

            {/* Activity pill */}
            {isActive && (
              <View style={[sh.activityPill, { backgroundColor: activityBg }]}>
                <Ionicons name={activityIcon} size={16} color={activityColor} />
                <Text style={[sh.activityText, { color: activityColor }]}>{activityLabel}</Text>
                {isOnDelivery && stats?.currentShipment && (
                  <Text style={[sh.activitySub, { color: activityColor }]} numberOfLines={1}>
                    · {stats.currentShipment.delivery_address}
                  </Text>
                )}
              </View>
            )}

            {/* Stats row */}
            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
            ) : (
              <View style={sh.statsRow}>
                <View style={sh.statBox}>
                  <Text style={sh.statValue}>{stats?.delivered ?? 0}</Text>
                  <Text style={sh.statLabel}>Delivered</Text>
                </View>
                <View style={[sh.statBox, sh.statBoxMid]}>
                  <Text style={sh.statValue}>{stats?.inTransit ?? 0}</Text>
                  <Text style={sh.statLabel}>In Transit</Text>
                </View>
                <View style={sh.statBox}>
                  <Text style={sh.statValue}>{stats?.total ?? 0}</Text>
                  <Text style={sh.statLabel}>Total Orders</Text>
                </View>
              </View>
            )}

            {/* Info rows */}
            <View style={sh.infoCard}>
              <InfoRow icon="mail-outline" label="Email" value={carrier.email || "—"} />
              <InfoRow icon="calendar-outline" label="Joined" value={Format.date(carrier.created_at || carrier.createdAt || "")} />
              <InfoRow
                icon="shield-checkmark-outline"
                label="Account Status"
                value={carrier.status === "approved" ? "Active" : carrier.status ?? "—"}
                valueColor={sColor}
              />
              {isActive && (
                <InfoRow
                  icon="radio-button-on-outline"
                  label="Current Activity"
                  value={activityLabel}
                  valueColor={activityColor}
                  last
                />
              )}
            </View>

            {/* Actions */}
            <View style={sh.actions}>
              {isPending && (
                <TouchableOpacity style={[sh.actionBtn, sh.approveBtn]} onPress={handleApprove}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={sh.actionBtnTextWhite}>Approve Carrier</Text>
                </TouchableOpacity>
              )}
              {isActive && (
                <TouchableOpacity style={[sh.actionBtn, sh.deactivateBtn]} onPress={handleDeactivate}>
                  <Ionicons name="pause-circle-outline" size={18} color={COLORS.danger} />
                  <Text style={[sh.actionBtnText, { color: COLORS.danger }]}>Deactivate</Text>
                </TouchableOpacity>
              )}
              {isDeactivated && (
                <TouchableOpacity style={[sh.actionBtn, sh.reactivateBtn]} onPress={handleReactivate}>
                  <Ionicons name="play-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={[sh.actionBtnText, { color: COLORS.primary }]}>Reactivate</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({
  icon, label, value, valueColor, last,
}: {
  icon: any; label: string; value: string; valueColor?: string; last?: boolean;
}) {
  return (
    <View style={[sh.infoRow, !last && sh.infoRowBorder]}>
      <View style={sh.infoIconWrap}>
        <Ionicons name={icon} size={16} color={COLORS.textSecondary} />
      </View>
      <Text style={sh.infoLabel}>{label}</Text>
      <Text style={[sh.infoValue, valueColor ? { color: valueColor } : undefined]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ─── Carrier list card ────────────────────────────────────────────────────────
function CarrierCard({
  carrier,
  onPress,
}: {
  carrier: User;
  onPress: () => void;
}) {
  const initials = (carrier.email || "?")[0].toUpperCase();
  const sColor   = STATUS_COLOR[carrier.status ?? ""] || COLORS.textTertiary;
  const sBg      = STATUS_BG[carrier.status ?? ""]    || "#F0F0F0";

  return (
    <TouchableOpacity style={cs.card} onPress={onPress} activeOpacity={0.75}>
      <View style={cs.cardTop}>
        <View style={[cs.avatar, { backgroundColor: sColor + "22" }]}>
          <Text style={[cs.avatarText, { color: sColor }]}>{initials}</Text>
        </View>
        <View style={cs.info}>
          <Text style={cs.email} numberOfLines={1}>{carrier.email}</Text>
          <Text style={cs.date}>Joined {Format.date(carrier.created_at || carrier.createdAt || "")}</Text>
        </View>
        <View style={cs.rightCol}>
          <View style={[cs.badge, { backgroundColor: sBg }]}>
            <Text style={[cs.badgeText, { color: sColor }]}>
              {carrier.status === "approved" ? "Active" : carrier.status}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} style={{ marginTop: 4 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CarriersTab() {
  const { user } = useAuth();
  const { users, loading, refresh } = useUsers("carrier");
  const [activeTab, setActiveTab]     = useState("all");
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<User | null>(null);

  const filtered = useMemo(() => {
    let list = users;
    if (activeTab !== "all") list = list.filter(u => u.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => (u.email || "").toLowerCase().includes(q));
    }
    return list;
  }, [users, activeTab, search]);

  const counts = useMemo(() => ({
    all:         users.length,
    pending:     users.filter(u => u.status === "pending").length,
    approved:    users.filter(u => u.status === "approved").length,
    deactivated: users.filter(u => u.status === "deactivated").length,
  }), [users]);

  return (
    <View style={cs.container}>
      {/* Header */}
      <View style={cs.header}>
        <Text style={cs.headerTitle}>Carriers</Text>
        <NotificationBell />
      </View>

      {/* Search */}
      <View style={cs.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={cs.searchInput}
          placeholder="Search by email…"
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

      {/* Tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={cs.tabsRow} contentContainerStyle={cs.tabsContent}
      >
        {TABS.map(t => {
          const isActive = activeTab === t.id;
          const count    = counts[t.id as keyof typeof counts];
          return (
            <TouchableOpacity
              key={t.id}
              style={[cs.tab, isActive && cs.tabActive]}
              onPress={() => setActiveTab(t.id)}
            >
              <Text style={[cs.tabText, isActive && cs.tabTextActive]}>{t.label}</Text>
              {count > 0 && (
                <View style={[cs.tabBadge, isActive && cs.tabBadgeActive]}>
                  <Text style={[cs.tabBadgeText, isActive && { color: "#fff" }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pending alert pill */}
      {counts.pending > 0 && activeTab !== "pending" && (
        <TouchableOpacity style={cs.pendingPill} onPress={() => setActiveTab("pending")}>
          <Ionicons name="alert-circle" size={14} color={COLORS.primary} />
          <Text style={cs.pendingPillText}>
            {counts.pending} carrier{counts.pending !== 1 ? "s" : ""} awaiting approval — Tap to review
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <CarrierCard carrier={item} onPress={() => setSelected(item)} />
        )}
        contentContainerStyle={cs.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={cs.empty}>
            <Ionicons name="people-outline" size={56} color={COLORS.textTertiary} />
            <Text style={cs.emptyTitle}>
              No {activeTab !== "all" ? activeTab : ""} carriers
            </Text>
            <Text style={cs.emptyHint}>
              {activeTab === "pending"
                ? "No applications awaiting review"
                : "Carriers will appear here once registered"}
            </Text>
          </View>
        }
      />

      {/* Detail bottom sheet */}
      <CarrierDetailSheet
        carrier={selected}
        managerId={user?.id}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onRefresh={refresh}
      />
    </View>
  );
}

// ─── Bottom sheet styles ──────────────────────────────────────────────────────
const sh = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    height: SCREEN_HEIGHT * 0.72,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  closeBtn: {
    position: "absolute",
    top: 16, right: 16,
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // Identity
  identity: { alignItems: "center", paddingTop: 8, paddingBottom: 20 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "800" },
  emailText:  { fontSize: 16, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  companyText:{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge:{
    marginTop: 8,
    paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },

  // Activity pill
  activityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  activityText: { fontSize: 13, fontWeight: "700" },
  activitySub:  { fontSize: 12, fontWeight: "500", flex: 1 },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
  },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statBoxMid: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: "500" },

  // Info card
  infoCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    gap: 10,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: "600", color: COLORS.text, maxWidth: "55%" },

  // Action buttons
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  approveBtn:         { backgroundColor: COLORS.success },
  deactivateBtn:      { backgroundColor: "#FFF4F4", borderWidth: 1, borderColor: COLORS.danger + "20" },
  reactivateBtn:      { backgroundColor: "#EEF3FF", borderWidth: 1, borderColor: COLORS.primary + "40" },
  actionBtnTextWhite: { fontSize: 15, fontWeight: "700", color: "#fff" },
  actionBtnText:      { fontSize: 15, fontWeight: "700" },
});

// ─── List card styles ─────────────────────────────────────────────────────────
const cs = StyleSheet.create({
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
  tabsRow:     { flexGrow: 0, marginBottom: 8 },
  tabsContent: { paddingHorizontal: 16, gap: 8 },
  tab: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#fff",
    borderWidth: 1, borderColor: COLORS.border,
  },
  tabActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText:       { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  tabTextActive: { color: "#fff" },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: COLORS.primary + "18",
    borderRadius: 8, minWidth: 18, height: 18,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: "#ffffff30" },
  tabBadgeText:   { fontSize: 10, fontWeight: "700", color: COLORS.primary },
  pendingPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#EEF3FF",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  pendingPillText: { fontSize: 12, fontWeight: "600", color: COLORS.primary, flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTop:   { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: "800" },
  info:       { flex: 1 },
  email:      { fontSize: 14, fontWeight: "600", color: COLORS.text },
  date:       { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  rightCol:   { alignItems: "flex-end" },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  empty:     { alignItems: "center", paddingVertical: 60 },
  emptyTitle:{ fontSize: 16, fontWeight: "700", color: COLORS.textSecondary, marginTop: 14 },
  emptyHint: { fontSize: 13, color: COLORS.textTertiary, marginTop: 6, textAlign: "center" },
});
