import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { blockchainApi } from "../../lib/api";
import { notify, notifyManagersNewShipment } from "../../lib/notifications";
import { COLORS } from "../../lib/constants";

const PACKAGE_TYPES = ["standard", "fragile", "hazardous", "perishable", "electronics"];
const PRIORITIES = ["normal", "high", "urgent"];

export default function CreateShipmentTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [packageType, setPackageType] = useState("standard");
  const [weight, setWeight] = useState("");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");

  async function handleCreate() {
    if (!pickupAddress.trim() || !deliveryAddress.trim() || !weight.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { count: prevCount } = await supabase
        .from("shipments")
        .select("*", { count: "exact", head: true })
        .eq("shipper_id", user?.id);
      const isFirstShipment = (prevCount ?? 0) === 0;

      const { data: newShipment, error } = await supabase
        .from("shipments")
        .insert({
          shipper_id: user?.id,
          pickup_address: pickupAddress.trim(),
          delivery_address: deliveryAddress.trim(),
          package_type: packageType,
          weight: parseFloat(weight),
          priority,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      try {
        const blockRes = await blockchainApi.post("/api/blockchain/shipments", {
          shipmentId: newShipment.id,
          origin: newShipment.pickup_address,
          destination: newShipment.delivery_address,
          metadata: {
            packageType: newShipment.package_type,
            weight: newShipment.weight,
            priority: newShipment.priority,
            shipperId: user?.id,
            status: "pending",
          },
        });

        await supabase
          .from("shipments")
          .update({
            blockchain_hash: blockRes.blockHash,
            blockchain_block_index: blockRes.blockIndex,
          })
          .eq("id", newShipment.id);
      } catch {
        // blockchain recording is best-effort
      }

      if (user?.id) {
        if (isFirstShipment) {
          notify.shipper.firstShipment(user.id, newShipment.id);
        } else {
          notify.shipper.shipmentCreated(user.id, newShipment.id);
        }
        notifyManagersNewShipment(newShipment.id);
      }

      Alert.alert("Success", "Shipment created and recorded on blockchain!");
      setPickupAddress("");
      setDeliveryAddress("");
      setWeight("");
      setNotes("");
      setPackageType("standard");
      setPriority("normal");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }

  const displayLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup & Delivery</Text>

          <Text style={styles.label}>Pickup Address *</Text>
          <View style={styles.inputGroup}>
            <Ionicons name="location-outline" size={18} color={COLORS.success} />
            <TextInput
              style={styles.input}
              placeholder="Enter pickup address"
              placeholderTextColor={COLORS.textTertiary}
              value={pickupAddress}
              onChangeText={setPickupAddress}
            />
          </View>

          <Text style={styles.label}>Delivery Address *</Text>
          <View style={styles.inputGroup}>
            <Ionicons name="navigate-outline" size={18} color={COLORS.danger} />
            <TextInput
              style={styles.input}
              placeholder="Enter delivery address"
              placeholderTextColor={COLORS.textTertiary}
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Package Details</Text>

          <Text style={styles.label}>Package Type</Text>
          <View style={styles.chipRow}>
            {PACKAGE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, packageType === t && styles.chipActive]}
                onPress={() => setPackageType(t)}
              >
                <Text style={[styles.chipText, packageType === t && styles.chipTextActive]}>
                  {displayLabel(t)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Weight (kg) *</Text>
          <View style={styles.inputGroup}>
            <Ionicons name="scale-outline" size={18} color={COLORS.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={COLORS.textTertiary}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={styles.label}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, priority === p && styles.chipActive]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>
                  {displayLabel(p)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Notes (optional)</Text>
          <View style={[styles.inputGroup, { height: 80, alignItems: "flex-start", paddingTop: 12 }]}>
            <TextInput
              style={[styles.input, { textAlignVertical: "top", height: 56 }]}
              placeholder="Any special instructions..."
              placeholderTextColor={COLORS.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Create Shipment</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6, marginTop: 8 },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: { flex: 1, fontSize: 14, color: COLORS.text },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: "#eff3ff" },
  chipText: { fontSize: 13, fontWeight: "500", color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
