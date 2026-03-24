import React, { useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  Dimensions, RefreshControl, TouchableOpacity,
} from "react-native";
import { PieChart, BarChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { useShipments, Shipment } from "../../hooks/useShipments";
import NotificationBell from "../../components/NotificationBell";
import { COLORS } from "../../lib/constants";

const SCREEN_WIDTH  = Dimensions.get("window").width;
const CHART_WIDTH   = SCREEN_WIDTH - 32;   // full content width (pie + bar)

const TIME_FILTERS = [
  { id: "today", label: "Today" },
  { id: "week",  label: "Week" },
  { id: "month", label: "Month" },
  { id: "all",   label: "All Time" },
];

function isWithin(dateStr: string, period: string): boolean {
  const date = new Date(dateStr);
  const now  = new Date();
  if (period === "today") {
    return date.toDateString() === now.toDateString();
  }
  if (period === "week") {
    const week = new Date(now);
    week.setDate(now.getDate() - 7);
    return date >= week;
  }
  if (period === "month") {
    const month = new Date(now);
    month.setMonth(now.getMonth() - 1);
    return date >= month;
  }
  return true; // "all"
}

export default function AnalyticsTab() {
  const { user } = useAuth();
  const role = user?.role;
  const [timePeriod, setTimePeriod] = useState("week");

  const baseFilters =
    role === "shipper"  ? { shipperId: user?.id }
    : role === "carrier" ? { carrierId: user?.id }
    : {};

  const { shipments: allShipments, loading, refresh } = useShipments(baseFilters);

  // Filter by time period
  const shipments: Shipment[] = useMemo(
    () => allShipments.filter(s => isWithin(s.created_at || s.createdAt || "", timePeriod)),
    [allShipments, timePeriod]
  );

  const ACTIVE_STATUSES = ["assigned", "ready_for_pickup", "picked_up", "in-transit", "out_for_delivery"];

  const total     = shipments.length;
  const pending   = shipments.filter(s => s.status === "pending").length;
  const inTransit = shipments.filter(s => ACTIVE_STATUSES.includes(s.status)).length;
  const delivered = shipments.filter(s => s.status === "delivered").length;
  const cancelled = shipments.filter(s => s.status === "cancelled").length;
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  const chartConfig = {
    backgroundColor: "#fff",
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(30, 101, 255, ${opacity})`,
    labelColor: () => COLORS.textSecondary,
    propsForBackgroundLines: { stroke: COLORS.border },
  };

  const pieData = [
    { name: "Pending",    population: pending,   color: COLORS.warning, legendFontColor: COLORS.textSecondary, legendFontSize: 11 },
    { name: "In Transit", population: inTransit, color: COLORS.info,    legendFontColor: COLORS.textSecondary, legendFontSize: 11 },
    { name: "Delivered",  population: delivered, color: COLORS.success, legendFontColor: COLORS.textSecondary, legendFontSize: 11 },
    { name: "Cancelled",  population: cancelled, color: COLORS.danger,  legendFontColor: COLORS.textSecondary, legendFontSize: 11 },
  ].filter(d => d.population > 0);

  // Bar chart – last 7 days from ALL shipments (ignoring time filter so the chart stays useful)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const barLabels = last7Days.map(d => d.toLocaleDateString("en-US", { weekday: "short" }));
  const barData   = last7Days.map(day =>
    allShipments.filter(s => new Date(s.created_at || s.createdAt || "").toDateString() === day.toDateString()).length
  );

  const statCards = [
    { label: "Total",      value: total,               icon: "cube-outline" as const,             color: COLORS.primary,  bg: "#EEF3FF" },
    { label: "Delivered",  value: delivered,           icon: "checkmark-circle-outline" as const, color: COLORS.success,  bg: COLORS.successBg },
    { label: "In Transit", value: inTransit,           icon: "car-outline" as const,              color: COLORS.primary,  bg: "#EEF3FF" },
    { label: "Pending",    value: pending,             icon: "time-outline" as const,             color: COLORS.warning,  bg: COLORS.warningBg },
    { label: "Delivery %", value: `${deliveryRate}%`,  icon: "trending-up-outline" as const,      color: COLORS.success,  bg: COLORS.successBg },
    { label: "Cancelled",  value: cancelled,           icon: "close-circle-outline" as const,     color: COLORS.danger,   bg: COLORS.dangerBg },
  ];

  // Compute clean Y-axis segments so labels are evenly spaced integers
  const maxBarVal = Math.max(...barData, 0);
  const barSegments = maxBarVal === 0 ? 1
    : maxBarVal <= 5  ? maxBarVal        // 1-per-step  e.g. 0,1,2,3
    : maxBarVal <= 10 ? Math.ceil(maxBarVal / 2) // 2-per-step e.g. 0,2,4,6
    : Math.ceil(maxBarVal / 5);          // 5-per-step for bigger values

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <NotificationBell />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Time Filter */}
        <View style={styles.timeFilterRow}>
          {TIME_FILTERS.map(t => {
            const isActive = timePeriod === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.timeBtn, isActive && styles.timeBtnActive]}
                onPress={() => setTimePeriod(t.id)}
              >
                <Text style={[styles.timeBtnText, isActive && styles.timeBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Stat Cards Grid */}
        <View style={styles.statsGrid}>
          {statCards.map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <View style={[styles.statIconWrap, { backgroundColor: s.color + "22" }]}>
                <Ionicons name={s.icon} size={18} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Pie Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status Distribution</Text>
          {pieData.length > 0 ? (
            <PieChart
              data={pieData}
              width={CHART_WIDTH}
              height={180}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
            />
          ) : (
            <View style={styles.noDataWrap}>
              <Ionicons name="pie-chart-outline" size={40} color={COLORS.textTertiary} />
              <Text style={styles.noData}>No data for this period</Text>
            </View>
          )}
        </View>

        {/* Bar Chart */}
        <View style={styles.barCard}>
          <Text style={styles.cardTitle}>Shipments — Last 7 Days</Text>
          <BarChart
            data={{ labels: barLabels, datasets: [{ data: barData.length ? barData : [0, 0, 0, 0, 0, 0, 0] }] }}
            width={SCREEN_WIDTH - 32}
            height={210}
            segments={barSegments}
            chartConfig={chartConfig}
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
            showBarTops={false}
            style={styles.barChart}
          />
        </View>

        {/* Summary row */}
        <View style={styles.summaryRow}>
          {[
            { label: "Total",     value: allShipments.length,                                           color: COLORS.text },
            { label: "Delivered", value: allShipments.filter(s => s.status === "delivered").length,     color: COLORS.success },
            { label: "Active",    value: allShipments.filter(s => ["assigned","ready_for_pickup","picked_up","in-transit","out_for_delivery"].includes(s.status)).length,    color: COLORS.info },
            { label: "Pending",   value: allShipments.filter(s => s.status === "pending").length,       color: COLORS.warning },
          ].map(item => (
            <View key={item.label} style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },

  // Time filter
  timeFilterRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  timeBtnActive: { backgroundColor: COLORS.primary },
  timeBtnText:   { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  timeBtnTextActive: { color: "#fff" },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: "30%",
    flexGrow: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: "600", textAlign: "center" },

  // Chart cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  // Bar chart card: no horizontal padding so chart fills full width
  barCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 8,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 12, paddingHorizontal: 16 },
  barChart:  { borderRadius: 0 },
  noDataWrap:{ alignItems: "center", paddingVertical: 24, gap: 8 },
  noData:    { color: COLORS.textTertiary, fontSize: 13 },

  // Summary
  summaryRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryItem:  { alignItems: "center" },
  summaryValue: { fontSize: 20, fontWeight: "700" },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: "500" },
});
