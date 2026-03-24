import { Platform } from "react-native";

const DEV_API_HOST = Platform.select({
  android: "10.0.2.2",
  default: "localhost",
});

export const API_BASE_URL = __DEV__
  ? `http://${DEV_API_HOST}:3001`
  : "https://your-api.example.com";

export const SUPABASE_URL = "https://urzqaxhseyzmyyfzehhu.supabase.co";

export const COLORS = {
  primary: "#1E65FF",
  primaryDark: "#104CDA",
  secondary: "#FF9F0A",
  success: "#34C759",
  successBg: "#E5F9E9",
  warning: "#FF9F0A",
  warningBg: "#FFF5E5",
  danger: "#FF3B30",
  dangerBg: "#FFEBEA",
  info: "#5AC8FA",
  infoBg: "#EAF9FF",
  text: "#1C1C1E",
  textSecondary: "#8E8E93",
  textTertiary: "#C7C7CC",
  background: "#F8F9FA",
  card: "#FFFFFF",
  border: "#E5E5EA",
  white: "#FFFFFF",
} as const;

export const STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  "in-transit": COLORS.info,
  delivered: COLORS.success,
  cancelled: COLORS.danger,
  approved: COLORS.success,
};

export const STATUS_ICONS: Record<string, string> = {
  pending: "time-outline",
  "in-transit": "car-outline",
  delivered: "checkmark-circle-outline",
  cancelled: "close-circle-outline",
};
