import type { ReplenishmentRepository } from "../domain/ReplenishmentRepository";
import type { ReplenishmentItem, SupplierGroup } from "../domain/ReplenishmentItem";
import { MAX_ORDER_PERIOD } from "../domain/orderPeriods";

interface SeedItem {
  sku: string;
  description: string;
  supplierId: string;
  supplierName: string;
  supplierLeadTime: number;
  availableStock: number;
  incoming: number;
  dailySalesRate: number;
  unitSymbol: string;
  unitId: number;
}

const SEED_ITEMS: SeedItem[] = [
  {
    sku: "GW-001", description: "Colgate Toothpaste 150g",
    supplierId: "SUP-PG", supplierName: "Procter & Gamble", supplierLeadTime: 7,
    availableStock: 20, incoming: 0, dailySalesRate: 1,
    unitSymbol: "cs", unitId: 2,
  },
  {
    sku: "GW-002", description: "Tide Powder Detergent 1kg",
    supplierId: "SUP-PG", supplierName: "Procter & Gamble", supplierLeadTime: 7,
    availableStock: 14, incoming: 0, dailySalesRate: 2.5,
    unitSymbol: "pk", unitId: 3,
  },
  {
    sku: "GW-003", description: "Ariel Liquid Detergent 1L",
    supplierId: "SUP-PG", supplierName: "Procter & Gamble", supplierLeadTime: 7,
    availableStock: 4, incoming: 0, dailySalesRate: 2,
    unitSymbol: "cs", unitId: 2,
  },
  {
    // incoming covers 7d: 2*(7+7)-28=0 → hidden at 7d, surfaces at longer periods
    sku: "GW-011", description: "Safeguard Bar Soap 135g",
    supplierId: "SUP-PG", supplierName: "Procter & Gamble", supplierLeadTime: 7,
    availableStock: 8, incoming: 1, dailySalesRate: 2,
    unitSymbol: "bx", unitId: 4,
  },
  {
    // incoming reduces suggestion
    sku: "GW-005", description: "Bear Brand Milk 300g",
    supplierId: "SUP-NES", supplierName: "Nestlé Philippines", supplierLeadTime: 5,
    availableStock: 10, incoming: 4, dailySalesRate: 1.5,
    unitSymbol: "cs", unitId: 2,
  },
  {
    sku: "GW-006", description: "Milo 3-in-1 Sachet x10",
    supplierId: "SUP-NES", supplierName: "Nestlé Philippines", supplierLeadTime: 5,
    availableStock: 33, incoming: 0, dailySalesRate: 4,
    unitSymbol: "pk", unitId: 3,
  },
  {
    sku: "GW-009", description: "Eden Cheese 165g",
    supplierId: "SUP-NES", supplierName: "Nestlé Philippines", supplierLeadTime: 5,
    availableStock: 30, incoming: 0, dailySalesRate: 10,
    unitSymbol: "cs", unitId: 2,
  },
  {
    sku: "GW-014", description: "Coffee Mate Creamer 450g",
    supplierId: "SUP-NES", supplierName: "Nestlé Philippines", supplierLeadTime: 5,
    availableStock: 5, incoming: 0, dailySalesRate: 1,
    unitSymbol: "cs", unitId: 2,
  },
  {
    sku: "GW-015", description: "Alaska Evaporated Milk 370ml",
    supplierId: "SUP-NES", supplierName: "Nestlé Philippines", supplierLeadTime: 5,
    availableStock: 4, incoming: 0, dailySalesRate: 1,
    unitSymbol: "cs", unitId: 2,
  },
  {
    // incoming reduces suggestion
    sku: "GW-004", description: "Lucky Me Pancit Canton 60g x24",
    supplierId: "SUP-SMC", supplierName: "San Miguel Corporation", supplierLeadTime: 3,
    availableStock: 2, incoming: 4, dailySalesRate: 1,
    unitSymbol: "bx", unitId: 4,
  },
  {
    sku: "GW-007", description: "San Miguel Beer 330ml x24",
    supplierId: "SUP-SMC", supplierName: "San Miguel Corporation", supplierLeadTime: 3,
    availableStock: 3, incoming: 0, dailySalesRate: 0.5,
    unitSymbol: "cs", unitId: 2,
  },
  {
    sku: "GW-008", description: "Marlboro Red Box x10",
    supplierId: "SUP-SMC", supplierName: "San Miguel Corporation", supplierLeadTime: 3,
    availableStock: 30, incoming: 0, dailySalesRate: 3,
    unitSymbol: "cs", unitId: 2,
  },
  {
    sku: "GW-010", description: "C2 Green Tea 500ml x24",
    supplierId: "SUP-SMC", supplierName: "San Miguel Corporation", supplierLeadTime: 3,
    availableStock: 3, incoming: 0, dailySalesRate: 2,
    unitSymbol: "cs", unitId: 2,
  },
  {
    sku: "GW-012", description: "Energizer AA Battery x4",
    supplierId: "SUP-SMC", supplierName: "San Miguel Corporation", supplierLeadTime: 3,
    availableStock: 7, incoming: 0, dailySalesRate: 1,
    unitSymbol: "cs", unitId: 2,
  },
  {
    sku: "GW-013", description: "Champion Detergent Bar 370g",
    supplierId: "SUP-SMC", supplierName: "San Miguel Corporation", supplierLeadTime: 3,
    availableStock: 10, incoming: 0, dailySalesRate: 2,
    unitSymbol: "cs", unitId: 2,
  },
];

export class SeedReplenishmentRepository implements ReplenishmentRepository {
  async getGroups(
    _from: Date,
    _to: Date,
    _locationId: number,
    supplierIds: number[],
    _sellingAreaIds: number[],
    showAllItems = false,
    manufacturerPairs?: { supplierId: number; manufacturerId: number | null }[],
    worksheet = false,
    _safetyStock?: unknown,
    _includeIncoming?: boolean,
    _requireLocationPresence?: boolean,
  ): Promise<SupplierGroup[]> {
    const supplierMap = new Map<string, { supplierName: string; leadTimeDays: number; items: ReplenishmentItem[] }>();
    const supplierFilter = new Set(supplierIds.map(String));
    // Seed items always have manufacturerId = null ("nb"); seed supplierId is a
    // non-numeric placeholder ("SUP-PG" etc.), so a real numeric-supplierId pair can
    // only ever match the "nb" bucket — this repo is unused in wiring (container.ts
    // always uses MySQLReplenishmentRepository) but must still type-check/behave
    // consistently with the port's filter semantics.
    const manufacturerFilterKeys =
      manufacturerPairs && manufacturerPairs.length > 0
        ? new Set(manufacturerPairs.map((p) => `${p.supplierId}:${p.manufacturerId ?? "nb"}`))
        : null;

    for (const seed of SEED_ITEMS) {
      if (!worksheet && seed.dailySalesRate === 0) continue;
      if (supplierFilter.size > 0 && !supplierFilter.has(seed.supplierId)) continue;
      if (manufacturerFilterKeys && !manufacturerFilterKeys.has(`${seed.supplierId}:nb`)) continue;

      const effectiveAvailable = seed.availableStock + seed.incoming;
      // Filter at the largest selectable period so the result is the superset of
      // candidates; the client narrows per-supplier as the order period changes.
      // When showAllItems or worksheet is on, skip this filter so items with
      // sufficient stock still reach the client (worksheet needs every active item).
      if (!showAllItems && !worksheet) {
        const rawOrder = seed.dailySalesRate * (MAX_ORDER_PERIOD + seed.supplierLeadTime) - effectiveAvailable;
        if (rawOrder <= 0) continue;
      }

      const daysOfSupply =
        seed.dailySalesRate > 0 ? Math.round((effectiveAvailable / seed.dailySalesRate) * 10) / 10 : null;
      const isCritical = daysOfSupply !== null && daysOfSupply < seed.supplierLeadTime;

      const item: ReplenishmentItem = {
        sku: seed.sku,
        description: seed.description,
        supplierId: seed.supplierId,
        supplierName: seed.supplierName,
        supplierLeadTime: seed.supplierLeadTime,
        availableStock: seed.availableStock,
        incoming: seed.incoming,
        underservedQuantity: 0,
        dailySalesRate: seed.dailySalesRate,
        sellingAreaDemand: 0,
        sellingAreaNames: [],
        daysOfSupply,
        isCritical,
        unitSymbol: seed.unitSymbol,
        unitId: seed.unitId,
        baseUnitSymbol: "pc",
        conversionFactor: 12,
        manufacturerId: null,
        manufacturerName: null,
        unitCost: 10, // Seed placeholder: ₱10/pc (~₱120/case)
        safetyStockUnits: 0,
      };

      if (!supplierMap.has(seed.supplierId)) {
        supplierMap.set(seed.supplierId, {
          supplierName: seed.supplierName,
          leadTimeDays: seed.supplierLeadTime,
          items: [],
        });
      }
      supplierMap.get(seed.supplierId)!.items.push(item);
    }

    const groups: SupplierGroup[] = [];
    for (const [supplierId, group] of supplierMap) {
      group.items.sort((a, b) => a.description.localeCompare(b.description));
      groups.push({ supplierId, ...group });
    }

    return groups;
  }
}
