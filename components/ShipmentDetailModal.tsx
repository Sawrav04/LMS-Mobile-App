import React, { useEffect, useState } from "react";
import { useUsers } from "../hooks/useUsers";
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { blockchainApi } from "../lib/api";
import { notify, notifyManagersDelivered, notifyManagersShipmentUpdate } from "../lib/notifications";
import { COLORS } from "../lib/constants";
import { Format } from "../lib/format";
import type { Shipment } from "../hooks/useShipments";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;

interface BlockchainEvent {
  blockIndex: number;
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

interface Props {
  shipment: Shipment | null;
  onClose: () => void;
  onUpdated?: () => void;
}

// Map status → step index for the 3-dot progress bar
function statusStep(status: string) {
  if (status === "delivered") return 2;
  if (status === "in-transit") return 1;
  return 0;
}

// Human-readable event label
function eventLabel(type: string) {
  const map: Record<string, string> = {
    SHIPMENT_CREATED: "Packing",
    STATUS_UPDATE: "Status updated",
    SHIPMENT_DELIVERED: "Delivered",
  };
  return map[type] || type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Status badge colour
function statusColor(status: string) {
  if (status === "delivered")  return { bg: "#E5F9E9", text: "#34C759" };
  if (status === "in-transit") return { bg: "#EAF9FF", text: "#0A84FF" };
  if (status === "cancelled")  return { bg: "#FFEBEA", text: "#FF3B30" };
  return { bg: "#FFF5E5", text: "#FF9F0A" };
}

export default function ShipmentDetailModal({ shipment, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const { users: carriers } = useUsers("carrier");
  const approvedCarriers = carriers.filter((c) => c.status === "approved");
  const [overrideShipment, setOverrideShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    setOverrideShipment(null);
    setEvents([]);
    if (shipment?.id) fetchEvents(shipment.id);
  }, [shipment?.id]);

  const s = overrideShipment ?? shipment;

  async function fetchEvents(id: string) {
    setEventsLoading(true);
    try {
      const res = await blockchainApi.get<{ events: BlockchainEvent[] }>(
        `/api/blockchain/shipments/${id}/events`
      );
      setEvents(res.events || []);
    } catch { } finally { setEventsLoading(false); }
  }

  async function reloadFromDB(id: string) {
    try {
      const { data, error } = await supabase.from("shipments").select("*").eq("id", id).single();
      if (error || !data) return;
      setOverrideShipment({
        ...data,
        shipperId: data.shipper_id, carrierId: data.carrier_id,
        pickupAddress: data.pickup_address, deliveryAddress: data.delivery_address,
        packageType: data.package_type, blockchainHash: data.blockchain_hash,
        blockchainBlockIndex: data.blockchain_block_index, createdAt: data.created_at,
      });
    } catch { }
  }

  async function handleAssignCarrier(carrierId: string) {
    if (!s) return;
    const { error } = await supabase
      .from("shipments")
      .update({ carrier_id: carrierId })
      .eq("id", s.id);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    notify.carrier.shipmentAssigned(carrierId, s.id);
    if (user?.id) notify.manager.shipmentAssigned(user.id, s.id);
    Alert.alert("Success", "Carrier assigned!");
    reloadFromDB(s.id);
    onUpdated?.();
  }

  async function handleCancel() {
    if (!s) return;
    Alert.alert("Cancel Shipment", "Are you sure?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel", style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("shipments").update({ status: "cancelled" }).eq("id", s.id);
          if (error) { Alert.alert("Error", error.message); return; }
          try { await blockchainApi.post(`/api/blockchain/shipments/${s.id}/status`, { status: "cancelled" }); } catch { }
          reloadFromDB(s.id); onUpdated?.();
        },
      },
    ]);
  }

  async function handleAccept() {
    if (!s) return;
    const shipperId = s.shipperId || s.shipper_id;
    const { error } = await supabase.from("shipments").update({ carrier_id: user?.id, status: "in-transit" }).eq("id", s.id);
    if (error) { Alert.alert("Error", error.message); return; }
    try { await blockchainApi.post(`/api/blockchain/shipments/${s.id}/status`, { status: "in-transit", notes: `Carrier ${user?.email} accepted` }); } catch { }
    if (user?.id) notify.carrier.shipmentAccepted(user.id, s.id);
    if (shipperId) {
      notify.shipper.carrierAssigned(shipperId, s.id);
      notify.shipper.inTransit(shipperId, s.id);
    }
    notifyManagersShipmentUpdate(s.id);
    Alert.alert("Success", "Shipment accepted!");
    reloadFromDB(s.id); onUpdated?.();
  }

  async function handleDeliver() {
    if (!s) return;
    const shipperId = s.shipperId || s.shipper_id;
    const carrierId = s.carrierId || s.carrier_id || user?.id;
    const { error } = await supabase.from("shipments").update({ status: "delivered" }).eq("id", s.id);
    if (error) { Alert.alert("Error", error.message); return; }
    try { await blockchainApi.post(`/api/blockchain/shipments/${s.id}/deliver`, { deliveredBy: user?.id, deliveredAt: new Date().toISOString() }); } catch { }
    if (carrierId) notify.carrier.delivered(carrierId, s.id);
    if (shipperId) notify.shipper.delivered(shipperId, s.id);
    notifyManagersDelivered(s.id);
    Alert.alert("Success", "Shipment delivered!");
    reloadFromDB(s.id); onUpdated?.();
  }

  const isMyShipment = s?.shipperId === user?.id || s?.shipper_id === user?.id;
  const isMyDelivery = s?.carrierId === user?.id || s?.carrier_id === user?.id;
  const step         = statusStep(s?.status || "pending");
  const pickupAddr   = s?.pickupAddress  || s?.pickup_address  || "—";
  const deliveryAddr = s?.deliveryAddress || s?.delivery_address || "—";
  const packageType  = s?.packageType    || s?.package_type    || "—";
  const createdAt    = s?.createdAt      || s?.created_at      || "";
  const blockHash    = s?.blockchainHash  || s?.blockchain_hash;
  const blockIdx     = s?.blockchainBlockIndex ?? s?.blockchain_block_index;
  const sColor       = statusColor(s?.status || "pending");

  // Build a unified timeline from blockchain events + current status
  const timeline: { label: string; sub: string; time: string; active: boolean }[] = [];
  if (events.length > 0) {
    events.slice().reverse().forEach((ev, i) => {
      timeline.push({
        label: eventLabel(ev.type),
        sub: ev.data?.location || ev.data?.notes || "",
        time: Format.datetime(ev.timestamp),
        active: i === 0,
      });
    });
  } else if (s) {
    // Fallback static timeline from shipment data
    if (s.status === "delivered" || s.status === "in-transit" || s.status === "pending") {
      timeline.push({ label: "Packing", sub: pickupAddr, time: Format.date(createdAt), active: false });
    }
    if (s.status === "in-transit" || s.status === "delivered") {
      timeline.push({ label: "Picked up", sub: pickupAddr, time: Format.date(createdAt), active: false });
      timeline.push({ label: "In transit", sub: pickupAddr, time: Format.date(createdAt), active: true });
    }
    if (s.status === "delivered") {
      timeline.push({ label: "Delivered", sub: deliveryAddr, time: Format.date(createdAt), active: true });
    }
    if (s.status === "cancelled") {
      timeline.push({ label: "Cancelled", sub: "Shipment was cancelled", time: Format.date(createdAt), active: false });
    }
    timeline.reverse();
  }

  return (
    <Modal visible={!!shipment} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.wrapper}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          {/* ── Drag handle ── */}
          <View style={styles.handle} />

          {/* ── Sheet header ── */}
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>Shipment Details</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {!s ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <>
                {/* ─────────────────────────────── */}
                {/* TOP INFO CARD                   */}
                {/* ─────────────────────────────── */}
                <View style={styles.infoCard}>
                  {/* Booking ID row */}
                  <View style={styles.bookingRow}>
                    <View>
                      <Text style={styles.bookingLabel}>Booking id</Text>
                      <Text style={styles.bookingId}>#{Format.shortId(s.id).toUpperCase()}-{s.id.substring(8, 11).toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={styles.bookingLabel}>Status</Text>
                      <View style={[styles.statusBadge, { backgroundColor: sColor.bg }]}>
                        <Text style={[styles.statusText, { color: sColor.text }]}>
                          {s.status === "in-transit" ? "Transit" : s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 3-dot progress bar */}
                  <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: step === 0 ? "0%" : step === 1 ? "50%" : "100%" }]} />
                    </View>
                    {[0, 1, 2].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.progressDot,
                          { left: i === 0 ? 0 : i === 1 ? "50%" : undefined, right: i === 2 ? 0 : undefined },
                          i <= step ? styles.dotActive : styles.dotInactive,
                        ]}
                      />
                    ))}
                  </View>

                  {/* 2-column info grid */}
                  <View style={styles.infoGrid}>
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>From</Text>
                      <Text style={styles.infoValue} numberOfLines={2}>{pickupAddr}</Text>
                    </View>
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>To</Text>
                      <Text style={styles.infoValue} numberOfLines={2}>{deliveryAddr}</Text>
                    </View>
                  </View>

                  <View style={[styles.infoGrid, { marginTop: 14 }]}>
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>Created</Text>
                      <Text style={styles.infoValue}>{Format.date(createdAt)}</Text>
                    </View>
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>Package</Text>
                      <Text style={styles.infoValue}>{packageType} · {s.weight} kg</Text>
                    </View>
                  </View>

                  <View style={[styles.infoGrid, { marginTop: 14 }]}>
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>Priority</Text>
                      <Text style={[styles.infoValue, { color: s.priority === "high" ? COLORS.danger : COLORS.text }]}>
                        {s.priority || "Normal"}
                      </Text>
                    </View>
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>Notes</Text>
                      <Text style={styles.infoValue} numberOfLines={2}>{s.notes || "—"}</Text>
                    </View>
                  </View>

                  {/* Blockchain hash */}
                  {blockHash && (
                    <View style={styles.hashRow}>
                      <Ionicons name="hardware-chip-outline" size={13} color={COLORS.primary} />
                      <Text style={styles.hashText} numberOfLines={1}> Block #{blockIdx} · {blockHash.substring(0, 20)}…</Text>
                    </View>
                  )}
                </View>

                {/* Manager: Assign Carrier */}
                {user?.role === "manager" && s.status === "pending" && !(s.carrierId || s.carrier_id) && (
                  <View style={styles.assignSection}>
                    <Text style={styles.assignTitle}>Assign Carrier</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carrierScroll}>
                      {approvedCarriers.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.carrierChip}
                          onPress={() => handleAssignCarrier(c.id)}
                        >
                          <Ionicons name="person" size={14} color={COLORS.primary} />
                          <Text style={styles.carrierChipText} numberOfLines={1}>
                            {c.company_name || c.email?.split("@")[0] || c.id.substring(0, 8)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {approvedCarriers.length === 0 && (
                        <Text style={styles.noCarriers}>No approved carriers</Text>
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* ─────────────────────────────── */}
                {/* ACTION BUTTONS                  */}
                {/* ─────────────────────────────── */}
                {(isMyShipment || user?.role === "carrier" || isMyDelivery) && (
                  <View style={styles.actions}>
                    {isMyShipment && s.status === "pending" && (
                      <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={handleCancel}>
                        <Ionicons name="close-circle-outline" size={17} color={COLORS.danger} />
                        <Text style={[styles.actionText, { color: COLORS.danger }]}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    {user?.role === "carrier" && !(s.carrierId || s.carrier_id) && s.status === "pending" && (
                      <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={handleAccept}>
                        <Ionicons name="checkmark" size={17} color="#fff" />
                        <Text style={[styles.actionText, { color: "#fff" }]}>Accept Order</Text>
                      </TouchableOpacity>
                    )}
                    {isMyDelivery && s.status === "in-transit" && (
                      <TouchableOpacity style={[styles.actionBtn, styles.deliverBtn]} onPress={handleDeliver}>
                        <Ionicons name="checkmark-done" size={17} color="#fff" />
                        <Text style={[styles.actionText, { color: "#fff" }]}>Mark Delivered</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* ─────────────────────────────── */}
                {/* TIMELINE                        */}
                {/* ─────────────────────────────── */}
                <View style={styles.timelineSection}>
                  {eventsLoading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 16 }} />
                  ) : (
                    timeline.map((item, idx) => (
                      <View key={idx} style={styles.timelineItem}>
                        {/* Left: dot + vertical line */}
                        <View style={styles.timelineLeft}>
                          <View style={[styles.timelineDot, item.active && styles.timelineDotActive]}>
                            {item.active && <View style={styles.timelineDotInner} />}
                          </View>
                          {idx < timeline.length - 1 && <View style={styles.timelineLine} />}
                        </View>

                        {/* Right: content */}
                        <View style={styles.timelineContent}>
                          <View style={styles.timelineRow}>
                            <Text style={[styles.timelineLabel, item.active && { color: COLORS.text }]}>
                              {item.label}
                            </Text>
                            <Text style={styles.timelineTime}>{item.time}</Text>
                          </View>
                          {!!item.sub && (
                            <Text style={styles.timelineSub} numberOfLines={1}>{item.sub}</Text>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: "#F5F5F0",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#D1D1D6",
    alignSelf: "center",
    marginTop: 12, marginBottom: 4,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  topBarTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: "center", alignItems: "center",
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  loadingBox: { height: 300, justifyContent: "center", alignItems: "center" },

  /* ── Info Card ── */
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  bookingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  bookingLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500", marginBottom: 4 },
  bookingId: { fontSize: 26, fontWeight: "800", color: COLORS.text, letterSpacing: 0.5 },
  statusBadge: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, alignSelf: "flex-start",
  },
  statusText: { fontSize: 13, fontWeight: "700" },

  /* Progress bar */
  progressWrap: {
    height: 28, justifyContent: "center",
    position: "relative", marginBottom: 20,
  },
  progressTrack: {
    height: 4, backgroundColor: "#E5E5EA",
    borderRadius: 2, width: "100%",
    position: "absolute", top: 12,
  },
  progressFill: {
    height: "100%", backgroundColor: COLORS.text, borderRadius: 2,
  },
  progressDot: {
    width: 16, height: 16, borderRadius: 8,
    position: "absolute", top: 6,
    borderWidth: 3, borderColor: "#fff",
  },
  dotActive: { backgroundColor: COLORS.text },
  dotInactive: { backgroundColor: "#E5E5EA" },

  /* Info grid */
  infoGrid: { flexDirection: "row" },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500", marginBottom: 3 },
  infoValue: { fontSize: 14, fontWeight: "700", color: COLORS.text },

  /* Hash row */
  hashRow: {
    flexDirection: "row", alignItems: "center",
    marginTop: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "#F0F0F5",
  },
  hashText: { fontSize: 11, color: COLORS.textSecondary, flex: 1 },

  /* ── Actions ── */
  actions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    paddingVertical: 15, borderRadius: 16,
  },
  cancelBtn: { backgroundColor: "#FFF4F4", borderWidth: 1, borderColor: "#FF3B3020" },
  acceptBtn: { backgroundColor: COLORS.primary },
  deliverBtn: { backgroundColor: COLORS.success },
  actionText: { fontSize: 14, fontWeight: "700" },

  assignSection: { marginBottom: 14 },
  assignTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  carrierScroll: { marginHorizontal: -4 },
  carrierChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F0FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  carrierChipText: { fontSize: 13, fontWeight: "600", color: COLORS.primary, maxWidth: 120 },
  noCarriers: { fontSize: 13, color: COLORS.textTertiary, fontStyle: "italic" },

  /* ── Timeline ── */
  timelineSection: {
    backgroundColor: "#fff",
    borderRadius: 24, padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 14,
  },
  timelineLeft: {
    alignItems: "center",
    width: 18,
  },
  timelineDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#E5E5EA",
    justifyContent: "center", alignItems: "center",
  },
  timelineDotActive: {
    backgroundColor: COLORS.primary,
  },
  timelineDotInner: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#fff",
  },
  timelineLine: {
    width: 2, flex: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 4, minHeight: 24,
  },
  timelineContent: {
    flex: 1, paddingBottom: 20,
  },
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  timelineLabel: {
    fontSize: 14, fontWeight: "600",
    color: COLORS.textSecondary, flex: 1,
  },
  timelineTime: {
    fontSize: 11, color: COLORS.textSecondary,
    fontWeight: "500", marginLeft: 8,
  },
  timelineSub: {
    fontSize: 12, color: COLORS.textTertiary,
    marginTop: 3,
  },
});
