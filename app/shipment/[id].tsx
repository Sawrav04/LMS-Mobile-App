import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { blockchainApi } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";
import { COLORS } from "../../lib/constants";
import { Format } from "../../lib/format";
import type { Shipment } from "../../hooks/useShipments";

interface BlockchainEvent {
  blockIndex: number;
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

export default function ShipmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShipment();
  }, [id]);

  async function loadShipment() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw new Error(error.message);

      const s = {
        ...data,
        shipperId: data.shipper_id,
        carrierId: data.carrier_id,
        pickupAddress: data.pickup_address,
        deliveryAddress: data.delivery_address,
        packageType: data.package_type,
        blockchainHash: data.blockchain_hash,
        blockchainBlockIndex: data.blockchain_block_index,
        createdAt: data.created_at,
      };
      setShipment(s);

      try {
        const evRes = await blockchainApi.get<{ events: BlockchainEvent[] }>(
          `/api/blockchain/shipments/${id}/events`
        );
        setEvents(evRes.events || []);
      } catch {
        // blockchain optional
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    Alert.alert("Cancel Shipment", "Are you sure?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("shipments")
            .update({ status: "cancelled" })
            .eq("id", id);
          if (error) {
            Alert.alert("Error", error.message);
            return;
          }
          try {
            await blockchainApi.post(`/api/blockchain/shipments/${id}/status`, {
              status: "cancelled",
              notes: "Shipment cancelled by shipper",
            });
          } catch {
            // blockchain best-effort
          }
          loadShipment();
        },
      },
    ]);
  }

  async function handleAccept() {
    const { error } = await supabase
      .from("shipments")
      .update({ carrier_id: user?.id, status: "in-transit" })
      .eq("id", id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    try {
      await blockchainApi.post(`/api/blockchain/shipments/${id}/status`, {
        status: "in-transit",
        notes: `Carrier ${user?.email} accepted shipment`,
      });
    } catch {
      // blockchain best-effort
    }

    Alert.alert("Success", "Shipment accepted!");
    loadShipment();
  }

  async function handleDeliver() {
    const { error } = await supabase
      .from("shipments")
      .update({ status: "delivered" })
      .eq("id", id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    try {
      await blockchainApi.post(`/api/blockchain/shipments/${id}/deliver`, {
        deliveredBy: user?.id,
        deliveredAt: new Date().toISOString(),
      });
    } catch {
      // blockchain best-effort
    }

    Alert.alert("Success", "Shipment delivered!");
    loadShipment();
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!shipment) return null;

  const isMyShipment = shipment.shipperId === user?.id;
  const isMyDelivery = shipment.carrierId === user?.id;

  return (
    <>
      <Stack.Screen
        options={{
          title: `Shipment #${Format.shortId(shipment.id)}`,
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: "#fff",
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.shipmentId}>#{Format.shortId(shipment.id)}</Text>
            <StatusBadge status={shipment.status} />
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color={COLORS.success} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Pickup</Text>
              <Text style={styles.detailValue}>{shipment.pickupAddress}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="navigate-outline" size={18} color={COLORS.danger} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Delivery</Text>
              <Text style={styles.detailValue}>{shipment.deliveryAddress}</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Package</Text>
              <Text style={styles.metaValue}>{shipment.packageType}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Weight</Text>
              <Text style={styles.metaValue}>{shipment.weight} kg</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Priority</Text>
              <Text style={styles.metaValue}>{shipment.priority || "normal"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Created</Text>
              <Text style={styles.metaValue}>{Format.date(shipment.createdAt || "")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {isMyShipment && shipment.status === "pending" && (
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={handleCancel}>
              <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
              <Text style={[styles.actionText, { color: COLORS.danger }]}>Cancel</Text>
            </TouchableOpacity>
          )}
          {user?.role === "carrier" && !shipment.carrierId && shipment.status === "pending" && (
            <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={handleAccept}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={[styles.actionText, { color: "#fff" }]}>Accept</Text>
            </TouchableOpacity>
          )}
          {isMyDelivery && shipment.status === "in-transit" && (
            <TouchableOpacity style={[styles.actionBtn, styles.deliverBtn]} onPress={handleDeliver}>
              <Ionicons name="checkmark-done" size={18} color="#fff" />
              <Text style={[styles.actionText, { color: "#fff" }]}>Mark Delivered</Text>
            </TouchableOpacity>
          )}
        </View>

        {events.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Blockchain Events</Text>
            {events.map((ev, i) => (
              <View key={i} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventType}>{ev.type.replace(/_/g, " ")}</Text>
                  <Text style={styles.eventTime}>{Format.datetime(ev.timestamp)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {shipment.blockchainHash && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Blockchain</Text>
            <Text style={styles.hashLabel}>Block Hash</Text>
            <Text style={styles.hash} numberOfLines={2}>{shipment.blockchainHash}</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  shipmentId: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  detailInfo: { flex: 1 },
  detailLabel: { fontSize: 12, color: COLORS.textTertiary, fontWeight: "500" },
  detailValue: { fontSize: 14, color: COLORS.text, fontWeight: "500", marginTop: 2 },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    marginTop: 4,
  },
  metaItem: { width: "50%", marginBottom: 12 },
  metaLabel: { fontSize: 12, color: COLORS.textTertiary },
  metaValue: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  cancelBtn: { backgroundColor: "#FFF4F4", borderWidth: 1, borderColor: COLORS.danger + "20" },
  acceptBtn: { backgroundColor: COLORS.success },
  deliverBtn: { backgroundColor: COLORS.info },
  actionText: { fontSize: 14, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 12 },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  eventInfo: { flex: 1 },
  eventType: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  eventTime: { fontSize: 11, color: COLORS.textTertiary, marginTop: 1 },
  hashLabel: { fontSize: 12, color: COLORS.textTertiary, marginBottom: 4 },
  hash: { fontSize: 11, color: COLORS.textSecondary, fontFamily: "monospace" },
});
