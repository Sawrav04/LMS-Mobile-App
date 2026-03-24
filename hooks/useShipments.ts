import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";

export interface Shipment {
  id: string;
  shipper_id?: string;
  carrier_id?: string;
  pickup_address: string;
  delivery_address: string;
  receiver_name?: string;
  receiver_phone?: string;
  package_type: string;
  weight: number;
  dimensions?: string;
  value?: number;
  priority?: string;
  status: string;
  notes?: string;
  special_instructions?: string;
  blockchain_hash?: string;
  blockchain_block_index?: number;
  created_at: string;
  updated_at?: string;
  // Camel-case aliases used by some UI components
  shipperId?: string;
  carrierId?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  packageType?: string;
  blockchainHash?: string;
  blockchainBlockIndex?: number;
  createdAt?: string;
}

function normalizeShipment(s: any): Shipment {
  return {
    ...s,
    shipperId: s.shipper_id,
    carrierId: s.carrier_id,
    pickupAddress: s.pickup_address,
    deliveryAddress: s.delivery_address,
    packageType: s.package_type,
    blockchainHash: s.blockchain_hash,
    blockchainBlockIndex: s.blockchain_block_index,
    createdAt: s.created_at,
  };
}

interface Filters {
  shipperId?: string;
  carrierId?: string;
  status?: string;
  statuses?: string[];   // multi-status filter
  available?: boolean;
}

export function useShipments(filters: Filters = {}) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      let query = supabase.from("shipments").select("*");

      if (filters.available) {
        query = query.is("carrier_id", null).eq("status", "pending");
      } else {
        if (filters.shipperId) query = query.eq("shipper_id", filters.shipperId);
        if (filters.carrierId) query = query.eq("carrier_id", filters.carrierId);
      }

      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      } else if (filters.status) {
        query = query.eq("status", filters.status);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error: err } = await query;

      if (err) throw new Error(err.message);
      setShipments((data || []).map(normalizeShipment));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.shipperId, filters.carrierId, filters.status, filters.available,
      // stringify array so memo key stays stable across renders
      filters.statuses?.join(",")]); 

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 5000);
      return () => clearInterval(interval);
    }, [load])
  );

  return { shipments, loading, error, refresh: load };
}
