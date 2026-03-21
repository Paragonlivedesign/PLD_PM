export type TravelType =
  | "flight"
  | "train"
  | "bus"
  | "car_rental"
  | "rideshare"
  | "personal_vehicle"
  | "other";

export type TravelDirection = "outbound" | "return" | "inter_venue";

export type TravelStatus = "planned" | "booked" | "confirmed" | "cancelled";

export type TravelAccommodationJson = {
  hotel_name: string;
  address?: string | null;
  check_in_date: string;
  check_out_date: string;
  room_type?: string | null;
  confirmation_number?: string | null;
  nightly_rate?: string | number | null;
  total_cost?: string | number | null;
  sharing_with?: string | null;
  notes?: string | null;
};

export type TravelRecordResponse = {
  id: string;
  event_id: string;
  event_name: string;
  personnel_id: string;
  personnel_name: string;
  travel_type: TravelType;
  direction: TravelDirection;
  departure_location: string;
  arrival_location: string;
  departure_datetime: string;
  arrival_datetime: string;
  carrier: string | null;
  booking_reference: string | null;
  seat_preference: string | null;
  cost: string | null;
  currency: string;
  status: TravelStatus;
  notes: string | null;
  accommodation: TravelAccommodationResponse | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TravelAccommodationResponse = {
  hotel_name: string;
  address: string | null;
  check_in_date: string;
  check_out_date: string;
  room_type: string | null;
  confirmation_number: string | null;
  nightly_rate: string | null;
  total_nights: number;
  total_cost: string | null;
  sharing_with: string | null;
  sharing_with_name: string | null;
  notes: string | null;
};

export type DbTravelRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  personnel_id: string;
  travel_type: string;
  direction: string;
  departure_location: string;
  arrival_location: string;
  departure_datetime: Date;
  arrival_datetime: Date;
  carrier: string | null;
  booking_reference: string | null;
  seat_preference: string | null;
  cost: string | null;
  currency: string;
  status: string;
  notes: string | null;
  accommodation: TravelAccommodationJson | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  event_name?: string;
  personnel_first?: string;
  personnel_last?: string;
  share_first?: string | null;
  share_last?: string | null;
};
