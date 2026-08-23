import { api } from "./client";
import type {
  User,
  TokenResponse,
  UserListResponse,
  Vehicle,
  VehicleListResponse,
  Shipment,
  ShipmentListResponse,
  WriteResponse,
  ShipmentHistory,
  Checkpoint,
  CustodyTransfer,
} from "../types/api";

const unwrap = <T,>(promise: Promise<{ data: T }>) => promise.then((res) => res.data);

export const authApi = {
  login: (email: string, password: string) =>
    unwrap(api.post<TokenResponse>("/auth/login", { email, password })),

  register: (data: {
    name: string;
    email: string;
    password: string;
    role: User["role"];
    wallet_address?: string;
  }) => unwrap(api.post<TokenResponse>("/auth/register", data)),

  refresh: (refresh_token: string) =>
    unwrap(api.post<TokenResponse>("/auth/refresh", { refresh_token })),

  getProfile: () => unwrap(api.get<User>("/users/me")),

  updateWallet: (wallet_address: string | null) =>
    unwrap(api.patch<User>("/users/me", { wallet_address })),
};

export const usersApi = {
  list: (role?: User["role"], skip = 0, limit = 100) =>
    unwrap(api.get<UserListResponse>("/users", { params: { role, skip, limit } })),
};

export const vehiclesApi = {
  create: (plate_number: string, type: string) =>
    unwrap(api.post<Vehicle>("/vehicles", { plate_number, type })),

  list: (transporter_id?: string, skip = 0, limit = 100) =>
    unwrap(api.get<VehicleListResponse>("/vehicles", { params: { transporter_id, skip, limit } })),
};

export const shipmentsApi = {
  create: (data: {
    origin: string;
    destination: string;
    cargo_description: string;
    quantity: number;
  }) => unwrap(api.post<WriteResponse>("/shipments", data)),

  assign: (id: string, transporter_id: string, vehicle_id?: string) =>
    unwrap(api.post<WriteResponse>(`/shipments/${id}/assign`, { transporter_id, vehicle_id })),

  pickup: (id: string) =>
    unwrap(api.post<WriteResponse>(`/shipments/${id}/pickup`, {})),

  checkpoint: (id: string, location: string, note?: string) =>
    unwrap(api.post<WriteResponse>(`/shipments/${id}/checkpoint`, { location, note })),

  handoff: (id: string, to_user_id: string) =>
    unwrap(api.post<WriteResponse>(`/shipments/${id}/handoff`, { to_user_id })),

  deliver: (id: string) =>
    unwrap(api.post<WriteResponse>(`/shipments/${id}/deliver`, {})),

  get: (id: string) => unwrap(api.get<Shipment>(`/shipments/${id}`)),

  getByQR: (qr_value: string) => unwrap(api.get<Shipment>(`/shipments/qr/${qr_value}`)),

  list: (params?: { skip?: number; limit?: number; status_filter?: Shipment["status"] }) =>
    unwrap(api.get<ShipmentListResponse>("/shipments", { params })),

  history: (id: string) => unwrap(api.get<ShipmentHistory>(`/shipments/${id}/history`)),
};

export const healthApi = {
  check: () => unwrap(api.get<{ status: string }>("../../health")),
};