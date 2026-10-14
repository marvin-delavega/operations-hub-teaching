import type {
  DeliveryCommit,
  DeliveryResult,
  OpenPurchaseOrder,
  PurchaseOrderForReceiving,
} from "./Delivery";

export interface DeliveryRepository {
  listOpenPurchaseOrders(): Promise<OpenPurchaseOrder[]>;
  getPurchaseOrderForReceiving(poId: number): Promise<PurchaseOrderForReceiving | null>;
  /** Linked ActiveOne employee code for an app user, or null if unset (FR-19). */
  getReceiverEmployeeCode(userId: number): Promise<string | null>;
  /**
   * Supersede the original PO atomically: write the new open PO, close the original,
   * persist our delivery records. Throws PurchaseOrderAlreadyReceivedError if the
   * original is no longer open at commit time (FR-20).
   */
  commit(input: DeliveryCommit): Promise<DeliveryResult>;
}
