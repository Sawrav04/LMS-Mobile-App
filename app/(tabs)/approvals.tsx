import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { useUsers } from "../../hooks/useUsers";
import { supabase } from "../../lib/supabase";
import { blockchainApi } from "../../lib/api";
import { notify } from "../../lib/notifications";
import { COLORS } from "../../lib/constants";
import { Format } from "../../lib/format";
import type { User } from "../../lib/auth";

function ApprovalRow({ carrier, managerId, onApprove }: { carrier: User; managerId?: string; onApprove: () => void }) {
  async function handleApprove() {
    Alert.alert(
      "Approve Carrier",
      `Approve ${carrier.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("profiles")
                .update({ status: "approved" })
                .eq("id", carrier.id);

              if (error) throw new Error(error.message);

              try {
                await blockchainApi.post(`/api/blockchain/carriers/${carrier.id}/approve`, {
                  approver: { role: "manager" },
                });
              } catch {
                // blockchain optional
              }
              notify.carrier.approved(carrier.id);
              if (managerId) notify.manager.carrierApproved(managerId);
              Alert.alert("Success", `${carrier.email} has been approved`);
              onApprove();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={22} color={COLORS.warning} />
        </View>
        <View style={styles.info}>
          <Text style={styles.email}>{carrier.email}</Text>
          <Text style={styles.date}>Applied {Format.date(carrier.created_at || carrier.createdAt || "")}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.btnText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ApprovalsTab() {
  const { user } = useAuth();
  const { users, loading, refresh } = useUsers("carrier");
  const pending = users.filter((u) => u.status === "pending");

  return (
    <View style={styles.container}>
      <FlatList
        data={pending}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ApprovalRow carrier={item} managerId={user?.id} onApprove={refresh} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No pending approvals</Text>
            <Text style={styles.emptyHint}>All carrier applications have been reviewed</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  row: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.warningBg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  info: { flex: 1 },
  email: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  date: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: COLORS.textTertiary, marginTop: 8, fontSize: 14, fontWeight: "600" },
  emptyHint: { color: COLORS.textTertiary, marginTop: 4, fontSize: 12 },
});
