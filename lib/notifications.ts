import { supabase } from "./supabase";

/** Notify all managers (e.g. when new carrier applies) */
export async function notifyAllManagers(type: "manager_new_carrier"): Promise<void> {
  try {
    const { data: managers } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "manager");
    if (!managers?.length) return;
    const payload =
      type === "manager_new_carrier"
        ? { type, title: "New Carrier Application", body: "New carrier waiting. Approve to activate." }
        : null;
    if (!payload) return;
    for (const m of managers) {
      await createNotification({
        userId: m.id,
        type: payload.type as NotificationType,
        title: payload.title,
        body: payload.body,
      });
    }
  } catch {}
}

/** Notify all managers of shipment in transit */
export async function notifyManagersShipmentUpdate(shipmentId: string): Promise<void> {
  try {
    const { data: managers } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "manager");
    if (!managers?.length) return;
    for (const m of managers) {
      await createNotification({
        userId: m.id,
        type: "manager_shipment_update",
        title: "Shipment Update",
        body: "Update: Shipment is in transit.",
        shipmentId,
      });
    }
  } catch {}
}

/** Notify all managers of delivery completed */
export async function notifyManagersDelivered(shipmentId: string): Promise<void> {
  try {
    const { data: managers } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "manager");
    if (!managers?.length) return;
    for (const m of managers) {
      await createNotification({
        userId: m.id,
        type: "manager_delivered",
        title: "Delivered",
        body: "Delivery completed 🎉",
        shipmentId,
      });
    }
  } catch {}
}

/** Notify all managers of new shipment */
export async function notifyManagersNewShipment(shipmentId: string): Promise<void> {
  try {
    const { data: managers } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "manager");
    if (!managers?.length) return;
    for (const m of managers) {
      await createNotification({
        userId: m.id,
        type: "manager_new_shipment",
        title: "New Shipment Request",
        body: "New shipment in. Assign a carrier now.",
        shipmentId,
      });
    }
  } catch {}
}

export type NotificationType =
  | "carrier_welcome"
  | "carrier_approved"
  | "carrier_shipment_assigned"
  | "carrier_shipment_accepted"
  | "carrier_pickup_reminder"
  | "carrier_out_for_delivery"
  | "carrier_delivered"
  | "shipper_welcome"
  | "shipper_first_shipment"
  | "shipper_shipment_created"
  | "shipper_carrier_assigned"
  | "shipper_picked_up"
  | "shipper_in_transit"
  | "shipper_out_for_delivery"
  | "shipper_delivered"
  | "manager_welcome"
  | "manager_new_carrier"
  | "manager_carrier_approved"
  | "manager_new_shipment"
  | "manager_shipment_assigned"
  | "manager_shipment_update"
  | "manager_delivered";

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  shipmentId?: string;
}

export async function createNotification(p: NotificationPayload): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      user_id: p.userId,
      type: p.type,
      title: p.title,
      body: p.body,
      shipment_id: p.shipmentId ?? null,
    });
  } catch {
    // best-effort, don't block main flow
  }
}

// Convenience creators for each notification type
export const notify = {
  carrier: {
    welcome: (userId: string) =>
      createNotification({
        userId,
        type: "carrier_welcome",
        title: "Welcome",
        body: "Welcome aboard 🚚 Let's get you approved and on the road.",
      }),
    approved: (userId: string) =>
      createNotification({
        userId,
        type: "carrier_approved",
        title: "Approved",
        body: "You're in! Start accepting shipments and earning now.",
      }),
    shipmentAssigned: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "carrier_shipment_assigned",
        title: "New Shipment Assigned",
        body: "New job in! Check details and accept now.",
        shipmentId,
      }),
    shipmentAccepted: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "carrier_shipment_accepted",
        title: "Shipment Accepted",
        body: "Locked in ✅ Head for pickup.",
        shipmentId,
      }),
    pickupReminder: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "carrier_pickup_reminder",
        title: "Pickup Reminder",
        body: "Pickup time coming up. Don't miss it.",
        shipmentId,
      }),
    outForDelivery: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "carrier_out_for_delivery",
        title: "Out for Delivery",
        body: "You're on the move 🚚 Deliver it smoothly.",
        shipmentId,
      }),
    delivered: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "carrier_delivered",
        title: "Delivered",
        body: "Delivered! Nice work 👏",
        shipmentId,
      }),
  },
  shipper: {
    welcome: (userId: string) =>
      createNotification({
        userId,
        type: "shipper_welcome",
        title: "Welcome",
        body: "Welcome! Let's ship your first order in minutes.",
      }),
    firstShipment: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "shipper_first_shipment",
        title: "First Shipment Created",
        body: "Shipment placed ✅ We're finding the best carrier for you.",
        shipmentId,
      }),
    shipmentCreated: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "shipper_shipment_created",
        title: "Shipment Created",
        body: "Done! Your shipment is live.",
        shipmentId,
      }),
    carrierAssigned: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "shipper_carrier_assigned",
        title: "Carrier Assigned",
        body: "Matched! Your carrier is on the job.",
        shipmentId,
      }),
    pickedUp: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "shipper_picked_up",
        title: "Picked Up",
        body: "Picked up 🚚 Your shipment is on its way.",
        shipmentId,
      }),
    inTransit: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "shipper_in_transit",
        title: "In Transit",
        body: "On the move. Tracking updated in real-time.",
        shipmentId,
      }),
    outForDelivery: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "shipper_out_for_delivery",
        title: "Out for Delivery",
        body: "Almost there! Delivery happening today.",
        shipmentId,
      }),
    delivered: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "shipper_delivered",
        title: "Delivered",
        body: "Delivered 🎉 Hope everything arrived perfectly.",
        shipmentId,
      }),
  },
  manager: {
    welcome: (userId: string) =>
      createNotification({
        userId,
        type: "manager_welcome",
        title: "Welcome",
        body: "Welcome! Let's keep shipments moving smoothly.",
      }),
    newCarrier: (userId: string) =>
      createNotification({
        userId,
        type: "manager_new_carrier",
        title: "New Carrier Application",
        body: "New carrier waiting. Approve to activate.",
      }),
    carrierApproved: (userId: string) =>
      createNotification({
        userId,
        type: "manager_carrier_approved",
        title: "Carrier Approved",
        body: "Carrier approved ✅ Ready to assign shipments.",
      }),
    newShipment: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "manager_new_shipment",
        title: "New Shipment Request",
        body: "New shipment in. Assign a carrier now.",
        shipmentId,
      }),
    shipmentAssigned: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "manager_shipment_assigned",
        title: "Shipment Assigned",
        body: "Assigned successfully. Tracking started.",
        shipmentId,
      }),
    shipmentUpdate: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "manager_shipment_update",
        title: "Shipment Update",
        body: "Update: Shipment is in transit.",
        shipmentId,
      }),
    delivered: (userId: string, shipmentId: string) =>
      createNotification({
        userId,
        type: "manager_delivered",
        title: "Delivered",
        body: "Delivery completed 🎉",
        shipmentId,
      }),
  },
};
