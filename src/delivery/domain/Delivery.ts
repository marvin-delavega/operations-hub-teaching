/** Per-line receiving status, derived continuously from ordered vs. received. */
export type LineStatus =
  | "exact"
  | "over_served"
  | "under_served"
  | "not_ordered"
  | "new_item";

/**
 * Classify a received line. `inMasterlist` distinguishes a scanned item that exists
 * in the ActiveOne masterlist (Not Ordered) from an unknown SKU (New Item) when the
 * line was never on the PO. Pure — shared by the receiving UI and the commit writer.
 */
export function classifyLine(
  orderedQuantity: number,
  receivedQuantity: number,
  inMasterlist: boolean,
): LineStatus {
  if (orderedQuantity > 0) {
    if (receivedQuantity === orderedQuantity) return "exact";
    if (receivedQuantity > orderedQuantity) return "over_served";
    return "under_served";
  }
  return inMasterlist ? "not_ordered" : "new_item";
}

export interface StatusBreakdown {
  exact: number;
  overServed: number;
  underServed: number;
  notOrdered: number;
  newItem: number;
}

/** A selectable open PO on the Delivery landing screen. */
export interface OpenPurchaseOrder {
  poId: number;
  poCode: string;
  poDate: string;
  expectedDeliveryDate: string;
  supplierName: string;
  totalItems: number;
  totalQuantity: number;
}

/** An ordered line of a PO loaded for receiving. */
export interface PurchaseOrderLine {
  itemId: number | null;
  code: string | null;
  description: string;
  orderedQuantity: number;
  unitSymbol: string;
}

/** A PO loaded for a single receiving session. */
export interface PurchaseOrderForReceiving {
  poId: number;
  poCode: string;
  supplierId: number;
  supplierName: string;
  locationId: number;
  lines: PurchaseOrderLine[];
}

/** A cached masterlist entry used to classify scans client-side. */
export interface MasterlistItem {
  code: string;
  description: string;
}

/** A flagged line (Over or Not-Ordered with received > 0). Derived server-side at commit to
 *  decide whether the blind-delivery discrepancy gate applies. */
export interface FlaggedLine {
  code: string;
  receivedQuantity: number;
}

/** Records a single Return-Excess snap for the audit trail. */
export interface ReturnExcessEvent {
  code: string;
  receivedQuantity: number;   // before snap
  returnedToQuantity: number; // after snap (ordered qty, or 0 for Not-Ordered)
}

/**
 * Extracts the Over-served and Not-Ordered lines (received > 0) from a line set.
 * Used identically by the client (invalidation) and server (gate).
 */
export function flaggedFrom(
  lines: { code: string | null; orderedQuantity: number; receivedQuantity: number; inMasterlist: boolean }[],
): FlaggedLine[] {
  return lines
    .filter((l) => {
      if (l.code === null) return false;
      const status = classifyLine(l.orderedQuantity, l.receivedQuantity, l.inMasterlist);
      return (status === "over_served" || status === "not_ordered") && l.receivedQuantity > 0;
    })
    .map((l) => ({ code: l.code as string, receivedQuantity: l.receivedQuantity }));
}

/** Commit payload: client has already split real-item lines from unknown New Items. */
export interface DeliveryCommit {
  poId: number;
  receiverUserId: number;
  receiverEmployeeCode: string;
  lines: { code: string; receivedQuantity: number }[];
  newItems: { code: string; quantity: number }[];
  blindDelivery: boolean;
  continuousScanning: boolean;
  /** Whether the committing user holds the "Approve Delivery Discrepancies" permission.
   *  The committer is the recorded approver (no cross-user authorize-as). */
  canApproveDiscrepancies: boolean;
  returnExcessEvents: ReturnExcessEvent[];
}

export interface DeliveryResult {
  newPoCode: string;
  closedOriginalPoCode: string;
  statusBreakdown: StatusBreakdown;
}

/** Raised when the original PO is no longer open at commit time (FR-20). */
export class PurchaseOrderAlreadyReceivedError extends Error {
  constructor() {
    super("This purchase order has already been received by someone else.");
    this.name = "PurchaseOrderAlreadyReceivedError";
  }
}

/** Raised when the committing user has no linked ActiveOne employee (FR-19). */
export class ReceiverNotLinkedError extends Error {
  constructor() {
    super("Your account is not linked to an ActiveOne employee. Saving is blocked.");
    this.name = "ReceiverNotLinkedError";
  }
}

/** Raised when a blind delivery has Over/Not-Ordered lines but no valid admin approval. */
export class DiscrepancyApprovalRequiredError extends Error {
  constructor() {
    super("This delivery contains discrepancies that require admin approval before saving.");
    this.name = "DiscrepancyApprovalRequiredError";
  }
}
