export interface DeliverySessionSummary {
  id: number;
  locationId: number;
  locationName: string | null;
  supplierId: number;
  supplierName: string | null;
  originalPoCode: string | null;
  newPoCode: string;
  receiverName: string | null;
  discrepancyApproved: boolean; // true if an admin approved Over/Not-Ordered lines (FR-32)
  createdAt: string; // ISO datetime (UTC); display in Asia/Manila
}

export interface ReturnExcessDetail {
  itemCode: string;
  receivedQty: number;
  returnedToQty: number;
}

export interface DeliverySessionDetail {
  id: number;
  locationId: number;
  locationName: string | null;
  supplierId: number;
  supplierName: string | null;
  originalPoId: number;
  originalPoCode: string | null;
  newPoId: number;
  newPoCode: string;
  receivedByUserId: number;
  receiverName: string | null;
  blindDelivery: boolean;
  continuousScanning: boolean;
  discrepancyApproved: boolean;
  approvedByUserId: number | null;
  approverName: string | null;
  approvedAt: string | null;
  returnExcess: ReturnExcessDetail[];
  createdAt: string;
  lines: DeliveryLineDetail[];
  newItems: DeliveryNewItemDetail[];
}

export interface DeliveryLineDetail {
  id: number;
  itemCode: string;
  itemDescription: string;
  orderedQty: number;
  receivedQty: number;
  status: "exact" | "over" | "under" | "not_ordered" | "new_item";
}

export interface DeliveryNewItemDetail {
  id: number;
  code: string;
  description: string;
  quantity: number;
}
