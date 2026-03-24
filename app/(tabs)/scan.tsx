import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { blockchainApi } from "../../lib/api";
import { notify, notifyManagersDelivered } from "../../lib/notifications";
import { COLORS } from "../../lib/constants";

export default function ScanTab() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.permText}>Camera permission is required to scan QR codes</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    try {
      let shipmentId = data;
      try {
        const parsed = JSON.parse(data);
        if (parsed.id) shipmentId = parsed.id;
      } catch {
        // raw string ID
      }

      const { data: shipment, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("id", shipmentId)
        .single();

      if (error || !shipment) {
        Alert.alert("Not Found", "Shipment not found");
        return;
      }

      if (shipment.status === "in-transit" && shipment.carrier_id === user?.id) {
        Alert.alert(
          "Update Shipment",
          `Mark shipment #${shipmentId.substring(0, 8)} as delivered?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Mark Delivered",
              onPress: async () => {
                const { error: updateErr } = await supabase
                  .from("shipments")
                  .update({ status: "delivered" })
                  .eq("id", shipmentId);
                if (updateErr) {
                  Alert.alert("Error", updateErr.message);
                  return;
                }
                try {
                  await blockchainApi.post(`/api/blockchain/shipments/${shipmentId}/deliver`, {
                    deliveredBy: user?.id,
                    deliveredAt: new Date().toISOString(),
                  });
                } catch {
                  // blockchain best-effort
                }
                const shipperId = shipment.shipper_id;
                const carrierId = shipment.carrier_id || user?.id;
                if (carrierId) notify.carrier.delivered(carrierId, shipmentId);
                if (shipperId) notify.shipper.delivered(shipperId, shipmentId);
                notifyManagersDelivered(shipmentId);
                Alert.alert("Success", "Shipment marked as delivered!");
              },
            },
            {
              text: "View Details",
              onPress: () => router.push(`/shipment/${shipmentId}`),
            },
          ]
        );
      } else {
        router.push(`/shipment/${shipmentId}`);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Invalid QR code");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.frame} />
          <Text style={styles.hint}>Point camera at a shipment QR code</Text>
        </View>
      </CameraView>

      {scanned && (
        <TouchableOpacity style={styles.scanAgain} onPress={() => setScanned(false)}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={styles.scanAgainText}>Scan Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 32,
  },
  permText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 20,
  },
  permBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  frame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 20,
  },
  hint: {
    color: "#fff",
    fontSize: 14,
    marginTop: 20,
    fontWeight: "500",
  },
  scanAgain: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
  },
  scanAgainText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
