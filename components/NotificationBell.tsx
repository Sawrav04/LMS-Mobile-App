import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "../hooks/useNotifications";
import { useAuth } from "../lib/auth";
import { COLORS } from "../lib/constants";
import { Format } from "../lib/format";
import type { Notification } from "../hooks/useNotifications";

interface Props {
  style?: object;
}

export default function NotificationBell({ style }: Props) {
  const { user } = useAuth();
  const { notifications, loading, unreadCount, refresh, markAsRead, markAllAsRead } =
    useNotifications(user?.id);
  const [modalVisible, setModalVisible] = useState(false);

  const hasNotifications = notifications.length > 0;
  const hasUnread = unreadCount > 0;

  return (
    <>
      <TouchableOpacity
        style={[styles.bellBtn, style]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        {/* Zero state: bell-outline, no dot */}
        {/* All read: bell (filled), no dot */}
        {/* Unread: bell with orange dot */}
        {!hasNotifications ? (
          <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
        ) : hasUnread ? (
          <View>
            <Ionicons name="notifications" size={24} color={COLORS.text} />
            <View style={styles.unreadDot}>
              {unreadCount > 9 ? (
                <Text style={styles.unreadCount}>9+</Text>
              ) : (
                <Text style={styles.unreadCount}>{unreadCount}</Text>
              )}
            </View>
          </View>
        ) : (
          <Ionicons name="notifications-outline" size={24} color={COLORS.textSecondary} />
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {hasUnread && (
            <TouchableOpacity style={styles.markAll} onPress={markAllAsRead}>
              <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : !hasNotifications ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="notifications-off-outline" size={48} color={COLORS.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyHint}>You're all caught up</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <NotificationRow
                  item={item}
                  onPress={() => {
                    markAsRead(item.id);
                  }}
                />
              )}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

function NotificationRow({ item, onPress }: { item: Notification; onPress: () => void }) {
  const isUnread = !item.read_at;
  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, isUnread && styles.rowIconUnread]}>
        <Ionicons
          name={getIconForType(item.type)}
          size={18}
          color={isUnread ? COLORS.primary : COLORS.textSecondary}
        />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, isUnread && styles.rowTitleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.rowBody} numberOfLines={2}>
          {item.body || ""}
        </Text>
        <Text style={styles.rowTime}>{Format.datetime(item.created_at)}</Text>
      </View>
      {isUnread && <View style={styles.rowDot} />}
    </TouchableOpacity>
  );
}

function getIconForType(type: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    carrier_welcome: "car",
    carrier_approved: "checkmark-circle",
    carrier_shipment_assigned: "cube",
    carrier_shipment_accepted: "checkmark-done",
    carrier_pickup_reminder: "time",
    carrier_out_for_delivery: "car",
    carrier_delivered: "checkmark-done-circle",
    shipper_welcome: "cube",
    shipper_first_shipment: "cube",
    shipper_shipment_created: "cube",
    shipper_carrier_assigned: "person",
    shipper_picked_up: "cube",
    shipper_in_transit: "car",
    shipper_out_for_delivery: "car",
    shipper_delivered: "checkmark-done-circle",
    manager_welcome: "grid",
    manager_new_carrier: "person-add",
    manager_carrier_approved: "checkmark-circle",
    manager_new_shipment: "cube",
    manager_shipment_assigned: "checkmark",
    manager_shipment_update: "car",
    manager_delivered: "checkmark-done-circle",
  };
  return map[type] || "notifications";
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.danger,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  unreadCount: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  closeBtn: {
    padding: 4,
  },
  markAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  emptyHint: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 6,
  },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: COLORS.background,
  },
  rowUnread: {
    backgroundColor: "#F0F7FF",
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rowIconUnread: {
    backgroundColor: "#E8F0FF",
  },
  rowContent: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  rowTitleUnread: {
    color: COLORS.text,
    fontWeight: "700",
  },
  rowBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rowTime: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 6,
  },
  rowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    marginTop: 6,
    marginLeft: 8,
  },
});
