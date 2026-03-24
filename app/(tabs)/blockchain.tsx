import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { blockchainApi } from "../../lib/api";
import StatCard from "../../components/StatCard";
import { COLORS } from "../../lib/constants";
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

export default function BlockchainTab() {
  const [health, setHealth] = useState<BlockchainHealth | null>(null);
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [h, c] = await Promise.all([
        blockchainApi.get<BlockchainHealth>("/api/blockchain/health"),
        blockchainApi.get<{ chain: BlockData[] }>("/api/blockchain/chain"),
      ]);
      setHealth(h);
      setBlocks((c.chain || []).reverse().slice(0, 20));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.statsRow}>
        <StatCard
          title="Blocks"
          value={health?.chainLength ?? 0}
          icon="layers-outline"
          color={COLORS.primary}
          bgColor="#eff3ff"
        />
        <StatCard
          title="Valid"
          value={health?.isValid ? "Yes" : "No"}
          icon="shield-checkmark-outline"
          color={health?.isValid ? COLORS.success : COLORS.danger}
          bgColor={health?.isValid ? COLORS.successBg : COLORS.dangerBg}
        />
      </View>

      <Text style={styles.sectionTitle}>Recent Blocks</Text>

      {blocks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="link-outline" size={48} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No blocks yet</Text>
        </View>
      ) : (
        blocks.map((block) => (
          <View key={block.index} style={styles.blockCard}>
            <View style={styles.blockHeader}>
              <View style={styles.blockIndex}>
                <Text style={styles.blockIndexText}>#{block.index}</Text>
              </View>
              <View style={styles.blockType}>
                <Text style={styles.blockTypeText}>{block.data.type}</Text>
              </View>
            </View>
            <Text style={styles.blockHash} numberOfLines={1}>
              {block.hash}
            </Text>
            <Text style={styles.blockTime}>{Format.datetime(block.timestamp)}</Text>
            {block.data.shipmentId && (
              <Text style={styles.blockShipment}>
                Shipment: #{block.data.shipmentId.substring(0, 8)}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 12 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: COLORS.textTertiary, marginTop: 8 },
  blockCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  blockIndex: {
    backgroundColor: "#eff3ff",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  blockIndexText: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  blockType: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  blockTypeText: { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary },
  blockHash: { fontSize: 11, color: COLORS.textTertiary, fontFamily: "monospace" },
  blockTime: { fontSize: 11, color: COLORS.textTertiary, marginTop: 4 },
  blockShipment: { fontSize: 12, color: COLORS.info, marginTop: 4, fontWeight: "500" },
});
