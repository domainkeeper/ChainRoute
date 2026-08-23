export type UserRole = "admin" | "transporter" | "warehouse_operator" | "distributor" | "receiver" | "viewer";

export type ShipmentStatus =
  | "CREATED" | "ASSIGNED" | "PICKED_UP" | "IN_TRANSIT"
  | "AT_WAREHOUSE" | "CUSTODY_TRANSFERRED" | "DELIVERED";

export type EventType = "CREATED" | "ASSIGNED" | "PICKED_UP" | "CHECKPOINT" | "CUSTODY_TRANSFER" | "DELIVERED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  wallet_address: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  type: string;
  transporter_id: string;
}

export interface Shipment {
  id: string;
  chain_shipment_ref: number;
  manufacturer_id: string;
  origin: string;
  destination: string;
  cargo_description: string;
  quantity: number;
  current_transporter_id: string | null;
  current_custodian_id: string | null;
  vehicle_id: string | null;
  status: ShipmentStatus;
  qr_code_value: string;
  creation_tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface Checkpoint {
  id: string;
  shipment_id: string;
  recorded_by: string;
  location: string;
  note: string | null;
  tx_hash: string | null;
  created_at: string;
}

export interface CustodyTransfer {
  id: string;
  shipment_id: string;
  from_user_id: string;
  to_user_id: string;
  tx_hash: string | null;
  created_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  event_type: EventType;
  actor_id: string;
  tx_hash: string | null;
  created_at: string;
}

export interface WriteResponse {
  shipment: Shipment;
  tx_hash: string;
  block_number: number;
}

export interface ShipmentHistory {
  events: ShipmentEvent[];
  checkpoints: Checkpoint[];
  custody_transfers: CustodyTransfer[];
}

export interface ApiError {
  error: { code: string; message: string };
}

export interface ShipmentListResponse {
  shipments: Shipment[];
  total: number;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

export interface VehicleListResponse {
  vehicles: Vehicle[];
  total: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}