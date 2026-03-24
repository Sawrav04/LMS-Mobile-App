import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../lib/constants";
import { Format } from "../lib/format";
import type { Shipment } from "../hooks/useShipments";
import ShipmentDetailModal from "./ShipmentDetailModal";

// ─── Carrier status progression map ─────────────────────────────────────────
type CarrierAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const CARRIER_NEXT_ACTION: Record<string, CarrierAction> = {
  assigned: {
    key: "start_pickup",
    label: "Start Pickup",
    icon: "navigate",
    color: COLORS.primary,
  },
  ready_for_pickup: {
    key: "mark_picked_up",
    label: "Mark Picked Up",
    icon: "cube",
    color: COLORS.primary,
  },
  picked_up: {
    key: "mark_in_transit",
    label: "Mark In Transit",
    icon: "car",
    color: COLORS.primary,
  },
  "in-transit": {
    key: "out_for_delivery",
    label: "Out for Delivery",
    icon: "location",
    color: COLORS.primary,
  },
  out_for_delivery: {
    key: "mark_delivered",
    label: "Mark Delivered",
    icon: "checkmark-done",
    color: COLORS.success,
  },
};

// Progress percentage for each status (carrier 6-stage view)
function getProgress(status: string): number {
  const map: Record<string, number> = {
    pending: 0,
    assigned: 17,
    ready_for_pickup: 33,
    picked_up: 50,
    "in-transit": 66,
    out_for_delivery: 83,
    delivered: 100,
    cancelled: 100,
  };
  return map[status] ?? 0;
}

// Human-readable status label for the card footer
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Waiting",
    assigned: "Accepted",
    ready_for_pickup: "Heading to pickup",
    picked_up: "Package collected",
    "in-transit": "On the way",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

// Badge colour
function badgeColors(status: string): { bg: string; text: string } {
  if (status === "delivered")      return { bg: COLORS.successBg, text: COLORS.success };
  if (status === "cancelled")      return { bg: "#FFF4F4",        text: COLORS.danger };
  if (status === "assigned")       return { bg: "#EEF3FF",        text: COLORS.primary };
  if (status === "out_for_delivery") return { bg: "#EEF3FF",      text: COLORS.primary };
  if (status === "in-transit")     return { bg: "#EEF3FF",        text: COLORS.primary };
  return { bg: COLORS.warningBg, text: COLORS.warning };
}

interface Props {
  shipment: Shipment;
  onAction?: (action: string, shipment: Shipment) => void;
  /** Carrier execution mode — shows one contextual action button */
  showCarrierActions?: boolean;
  /** Legacy props kept for backward compat */
  showAccept?: boolean;
  showDeliver?: boolean;
  onUpdated?: () => void;
}

export default function ShipmentCard({
  shipment,
  onAction,
  showCarrierActions,
  showAccept,
  showDeliver,
  onUpdated,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const progress = getProgress(shipment.status);
  const { bg: statusBg, text: statusColor } = badgeColors(shipment.status);
  const nextAction = CARRIER_NEXT_ACTION[shipment.status];

  const displayStatus =
    shipment.status.charAt(0).toUpperCase() +
    shipment.status.slice(1).replace(/_/g, " ");

  return (
    <>
      <ShipmentDetailModal
        shipment={modalOpen ? shipment : null}
        onClose={() => setModalOpen(false)}
        onUpdated={onUpdated}
      />
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => setModalOpen(true)}
      >
        {/* Top Row */}
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: statusBg }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {displayStatus}
              </Text>
            </View>
            <Text style={styles.metaText}>
              {shipment.packageType || shipment.package_type}
              {"  |  "}
              {shipment.weight} kg
              {"  |  "}
              {shipment.priority || "Normal"}
            </Text>
          </View>
        </View>

        {/* ID + Icon */}
        <View style={styles.mainRow}>
          <View style={styles.trackingInfo}>
            <Text style={styles.trackingNumber}>
              #{Format.shortId(shipment.id).toUpperCase()}
            </Text>
          </View>
          <View style={styles.boxIconBg}>
            <Ionicons name="cube" size={26} color={COLORS.warning} />
          </View>
        </View>

        {/* Progress Bar — 3 milestone dots */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <View style={[styles.progressDot, { left: 0, backgroundColor: COLORS.text }]} />
          <View style={[styles.progressDot, {
            left: "50%",
            backgroundColor: progress >= 50 ? COLORS.text : COLORS.border,
          }]} />
          <View style={[styles.progressDot, {
            right: 0,
            backgroundColor: progress === 100 ? COLORS.text : COLORS.border,
          }]} />
        </View>

        {/* Details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailsColumn}>
            <View style={styles.detailItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="arrow-up" size={12} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Pickup</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {shipment.pickupAddress || shipment.pickup_address}
                </Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="arrow-down" size={12} color={COLORS.danger} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Delivery</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {shipment.deliveryAddress || shipment.delivery_address}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsColumnRight}>
            <View style={styles.detailItemRight}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {Format.date(shipment.createdAt || shipment.created_at || "")}
              </Text>
            </View>
            <View style={styles.detailItemRight}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={styles.detailValue}>{statusLabel(shipment.status)}</Text>
            </View>
          </View>
        </View>

        {/* ── Carrier execution mode: one contextual action button ── */}
        {showCarrierActions && nextAction && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: nextAction.color }]}
              onPress={() => onAction?.(nextAction.key, shipment)}
              activeOpacity={0.85}
            >
              <Ionicons name={nextAction.icon} size={16} color="#fff" />
              <Text style={styles.actionText}>{nextAction.label}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Legacy: Accept button (old find-tab usage) ── */}
        {showAccept && !showCarrierActions && !shipment.carrierId && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => onAction?.("accept", shipment)}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.actionText}>Accept Order</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Legacy: Deliver button ── */}
        {showDeliver && shipment.status === "in-transit" && !showCarrierActions && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
              onPress={() => onAction?.("deliver", shipment)}
            >
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={styles.actionText}>Mark Delivered</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    flexWrap: "wrap",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  metaText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },
  mainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  trackingInfo: { flex: 1 },
  trackingNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  boxIconBg: {
    width: 48,
    height: 48,
    backgroundColor: "#FFF9F0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
  },
  progressContainer: {
    height: 24,
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    width: "100%",
    position: "absolute",
    top: 10,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.text,
    borderRadius: 2,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: "absolute",
    top: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  detailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailsColumn: { flex: 2, gap: 16 },
  detailsColumnRight: { flex: 1, gap: 16, alignItems: "flex-end" },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailItemRight: { alignItems: "flex-end" },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  detailLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2, fontWeight: "500" },
  detailValue: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  actionText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
