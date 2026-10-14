export interface PurchaseOrderLine {
  sku: string;
  description: string;
  supplierId: string;
  quantity: number;
  // Per-piece (split) ordering: when `orderedPerPiece` is true the line is written
  // as up to two ActiveOne lines — `quantity` whole cases (purchase unit) plus
  // `pieceQty` remainder pieces (base unit). `pieceQty` is 0 for a normal case line.
  pieceQty?: number;
  orderedPerPiece?: boolean;
  // Decision context for the history snapshot (ignored by the PO writer).
  path: "standard" | "stockout";
  orderPeriodDays: number;
  salesRate: number;
  sellingAreaDemand: number;
  sellingAreaNames: string[];
  effectiveAvailable: number | null;
  // Manually counted combined selling-area stock (purchase units), added on top
  // of `effectiveAvailable`; null when not entered. Standard path only.
  shelfOnHand?: number | null;
  dos: number | null;
  suggestedQty: number;
  // System-suggested remainder pieces for a split line (history override compare).
  suggestedPieceQty?: number;
  lastSoldDate?: string;
  stockoutDailyRate?: number;
  stockoutWindowUnits?: number;
  // Case (purchase) unit symbol; `baseUnitSymbol` labels the piece sub-line.
  unitSymbol?: string;
  baseUnitSymbol?: string;
  // Safety stock buffer at commit time (units + display percentage).
  safetyStockUnits: number;
  safetyStockPercent: number;
}

export interface BelowMinSupplier {
  supplierId: number;
  minOrderValue: number | null;
  minOrderQuantity: number | null;
  runningValue: number;
  runningQuantity: number;
}

export interface PurchaseOrder {
  poDate: string;
  locationId: number;
  lines: PurchaseOrderLine[];
  // Run-level context for the history snapshot.
  rounding: "up" | "down";
  salesRangeFrom: string | null;
  salesRangeTo: string | null;
  createdByUserId?: number;
  createdByName?: string;
  createdByEmployeeCode?: string;
  /** Suppliers that were below minimum at submit time; populated only when the user acknowledged the warning. */
  belowMinAck?: BelowMinSupplier[];
}

/**
 * Thrown when a submitted line's SKU does not resolve to an ActiveOne item.
 * Every replenishment line originates from an ActiveOne item, so an unknown
 * SKU means a stale or tampered payload — the submission is rejected before
 * anything is written (a NULL ITEM_ID PO would corrupt the ERP).
 */
export class UnknownSkuError extends Error {
  constructor(public readonly skus: string[]) {
    super(`Unknown item code(s): ${skus.join(", ")}`);
    this.name = "UnknownSkuError";
  }
}

/**
 * Raised when the submitting user has no linked ActiveOne employee. A replenishment
 * run cannot be saved without one — mirrors the Delivery module's receiver gate so
 * every committed run is attributable to an ActiveOne employee.
 */
export class CreatorNotLinkedError extends Error {
  constructor() {
    super("Your account is not linked to an ActiveOne employee. Saving is blocked.");
    this.name = "CreatorNotLinkedError";
  }
}

export interface PurchaseOrderResult {
  supplierId: string;
  supplierName: string;
  poNumber: string;
  itemCount: number;
  manufacturerName: string | null;
  runId?: number;
}
