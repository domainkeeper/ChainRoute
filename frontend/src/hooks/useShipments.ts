import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shipmentsApi, usersApi, vehiclesApi } from "@/api";
import type { Shipment, User } from "@/types/api";

export function useShipments(params?: { skip?: number; limit?: number; status_filter?: Shipment["status"] }) {
  return useQuery({
    queryKey: ["shipments", params],
    queryFn: () => shipmentsApi.list(params),
  });
}

export function useShipment(id: string) {
  return useQuery({
    queryKey: ["shipment", id],
    queryFn: () => shipmentsApi.get(id),
    enabled: !!id,
  });
}

export function useShipmentByQR(qr_value: string) {
  return useQuery({
    queryKey: ["shipment", "qr", qr_value],
    queryFn: () => shipmentsApi.getByQR(qr_value),
    enabled: !!qr_value,
  });
}

export function useShipmentHistory(id: string) {
  return useQuery({
    queryKey: ["shipment", id, "history"],
    queryFn: () => shipmentsApi.history(id),
    enabled: !!id,
  });
}

export function useCreateShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: shipmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
    },
  });
}

export function useAssignTransporter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transporter_id, vehicle_id }: { id: string; transporter_id: string; vehicle_id?: string }) =>
      shipmentsApi.assign(id, transporter_id, vehicle_id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["shipment", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["shipment", variables.id, "history"] });
    },
  });
}

export function usePickup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shipmentsApi.pickup(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["shipment", id] });
      queryClient.invalidateQueries({ queryKey: ["shipment", id, "history"] });
    },
  });
}

export function useCheckpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, location, note }: { id: string; location: string; note?: string }) =>
      shipmentsApi.checkpoint(id, location, note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["shipment", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["shipment", variables.id, "history"] });
    },
  });
}

export function useHandoff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to_user_id }: { id: string; to_user_id: string }) =>
      shipmentsApi.handoff(id, to_user_id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["shipment", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["shipment", variables.id, "history"] });
    },
  });
}

export function useDeliver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shipmentsApi.deliver(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["shipment", id] });
      queryClient.invalidateQueries({ queryKey: ["shipment", id, "history"] });
    },
  });
}

export function useUsers(role?: User["role"]) {
  return useQuery({
    queryKey: ["users", role],
    queryFn: () => usersApi.list(role),
  });
}

export function useVehicles(transporter_id?: string) {
  return useQuery({
    queryKey: ["vehicles", transporter_id],
    queryFn: () => vehiclesApi.list(transporter_id),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plate_number, type }: { plate_number: string; type: string }) =>
      vehiclesApi.create(plate_number, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}