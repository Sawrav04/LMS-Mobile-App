import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { blockchainApi } from "../../lib/api";
import { COLORS, API_BASE_URL } from "../../lib/constants";
import { Format } from "../../lib/format";

interface BlockchainHealth {
  status: string;
  chainLength: number;
  isValid: boolean;
  difficulty: number;
  latestBlock: { index: number; timestamp: number; hash: string };
}

interface BlockData {
  index: number;
  timestamp: number;
  hash: string;
  previousHash: string;
  data: { type: string; shipmentId?: string; [key: string]: any };
}

export default function SettingsTab() {
  const { user, logout, updateProfile } = useAuth();
  const [health, setHealth] = useState<BlockchainHealth | null>(null);
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [bcLoading, setBcLoading] = useState(true);

  // Edit name modal
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [nameInput, setNameInput] = useState(user?.full_name || "");
  const [nameLoading, setNameLoading] = useState(false);

  async function handleSaveName() {
    if (!nameInput.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    setNameLoading(true);
    try {
      await updateProfile({ full_name: nameInput.trim() });
      setEditNameVisible(false);
      Alert.alert("Saved", "Your name has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setNameLoading(false);
    }
  }

  const loadBlockchain = useCallback(async () => {
    setBcLoading(true);
    try {
      const [h, c] = await Promise.all([
        blockchainApi.get<BlockchainHealth>("/api/blockchain/health"),
        blockchainApi.get<{ chain: BlockData[] }>("/api/blockchain/chain"),
      ]);
      setHealth(h);
      setBlocks((c.chain || []).reverse().slice(0, 10));
    } catch {
      setHealth(null);
      setBlocks([]);
    } finally {
      setBcLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBlockchain();
    }, [loadBlockchain])
  );

  function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Custom Header – outside scroll, matches Home / Find / History */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {(user?.full_name || user?.email || "?")[0].toUpperCase()}
          </Text>
        </View>
        {user?.full_name ? (
          <Text style={styles.fullName}>{user.full_name}</Text>
        ) : null}
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      {/* Account Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>

        {/* Full Name row — editable */}
        <TouchableOpacity style={styles.row} onPress={() => { setNameInput(user?.full_name || ""); setEditNameVisible(true); }}>
          <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Full Name</Text>
            <Text style={styles.rowValue}>{user?.full_name || "Tap to add your name"}</Text>
          </View>
          <Ionicons name="create-outline" size={16} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Ionicons name="shield-outline" size={20} color={COLORS.textSecondary} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Role</Text>
            <Text style={styles.rowValue}>
              {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ""}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.textSecondary} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Status</Text>
            <Text style={styles.rowValue}>{user?.status}</Text>
          </View>
        </View>
      </View>

      {/* Edit Name Modal */}
      <Modal visible={editNameVisible} transparent animationType="fade" onRequestClose={() => setEditNameVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Name</Text>
              <TouchableOpacity onPress={() => setEditNameVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Enter your full name"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="words"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalSaveBtn, nameLoading && { opacity: 0.7 }]}
              onPress={handleSaveName}
              disabled={nameLoading}
            >
              {nameLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Blockchain Token Section */}
      <View style={styles.card}>
        <View style={styles.bcHeader}>
          <View style={styles.bcTitleRow}>
            <Ionicons name="link-outline" size={20} color={COLORS.primary} />
            <Text style={styles.bcTitle}>Blockchain Token</Text>
          </View>
          {bcLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <TouchableOpacity onPress={loadBlockchain}>
              <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {health ? (
          <>
            <View style={styles.bcStatsRow}>
              <View style={styles.bcStatBox}>
                <Ionicons name="layers-outline" size={18} color={COLORS.primary} />
                <Text style={styles.bcStatValue}>{health.chainLength}</Text>
                <Text style={styles.bcStatLabel}>Blocks</Text>
              </View>
              <View style={styles.bcStatBox}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={health.isValid ? COLORS.success : COLORS.danger}
                />
                <Text style={[styles.bcStatValue, { color: health.isValid ? COLORS.success : COLORS.danger }]}>
                  {health.isValid ? "Valid" : "Invalid"}
                </Text>
                <Text style={styles.bcStatLabel}>Chain</Text>
              </View>
              <View style={styles.bcStatBox}>
                <Ionicons name="hardware-chip-outline" size={18} color={COLORS.info} />
                <Text style={styles.bcStatValue}>{health.difficulty}</Text>
                <Text style={styles.bcStatLabel}>Difficulty</Text>
              </View>
            </View>

            {blocks.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.bcSubtitle}>Recent Blocks</Text>
                {blocks.map((block) => (
                  <View key={block.index} style={styles.blockRow}>
                    <View style={styles.blockBadge}>
                      <Text style={styles.blockBadgeText}>#{block.index}</Text>
                    </View>
                    <View style={styles.blockInfo}>
                      <Text style={styles.blockType}>{block.data.type.replace(/_/g, " ")}</Text>
                      <Text style={styles.blockHash} numberOfLines={1}>{block.hash}</Text>
                      <Text style={styles.blockTime}>{Format.datetime(block.timestamp)}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        ) : !bcLoading ? (
          <View style={styles.bcOffline}>
            <Ionicons name="cloud-offline-outline" size={32} color={COLORS.textTertiary} />
            <Text style={styles.bcOfflineText}>Blockchain server offline</Text>
            <Text style={styles.bcOfflineHint}>Start the server at {API_BASE_URL}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>System</Text>

        <View style={styles.row}>
          <Ionicons name="cloud-outline" size={20} color={COLORS.textSecondary} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Database</Text>
            <Text style={styles.rowValue} numberOfLines={1}>Supabase</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Ionicons name="server-outline" size={20} color={COLORS.textSecondary} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Blockchain API</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{API_BASE_URL}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Ionicons name="code-slash-outline" size={20} color={COLORS.textSecondary} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>App Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#eff3ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarInitial: { fontSize: 28, fontWeight: "800", color: COLORS.primary },
  fullName: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 2 },
  email: { fontSize: 14, color: COLORS.textSecondary },

  // Edit name modal
  modalOverlay: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)", padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff", borderRadius: 20,
    padding: 24, width: "100%",
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  modalInput: {
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 14, height: 50,
    fontSize: 15, color: COLORS.text, marginBottom: 16,
  },
  modalSaveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    height: 50, justifyContent: "center", alignItems: "center",
  },
  modalSaveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  roleBadge: {
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  roleText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
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
  sectionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 12, color: COLORS.textTertiary },
  rowValue: { fontSize: 14, fontWeight: "500", color: COLORS.text, marginTop: 1 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  bcHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  bcTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bcTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  bcStatsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  bcStatBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 4,
  },
  bcStatValue: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  bcStatLabel: { fontSize: 11, color: COLORS.textTertiary, fontWeight: "500" },
  bcSubtitle: { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, marginTop: 10, marginBottom: 10 },
  blockRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + "60",
  },
  blockBadge: {
    backgroundColor: "#eff3ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  blockBadgeText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  blockInfo: { flex: 1 },
  blockType: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  blockHash: { fontSize: 10, color: COLORS.textTertiary, fontFamily: "monospace", marginTop: 2 },
  blockTime: { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
  bcOffline: { alignItems: "center", paddingVertical: 20, gap: 6 },
  bcOfflineText: { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary },
  bcOfflineHint: { fontSize: 12, color: COLORS.textTertiary },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.danger + "40",
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: COLORS.danger },
});
