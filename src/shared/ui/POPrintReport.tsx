"use client";

interface POPrintLine {
  itemCode: string | null;
  itemDescription: string;
  unitSymbol: string;
  finalQty: number;
  pieceQty: number;
  orderedPerPiece: boolean;
  baseUnitSymbol?: string;
}

interface POData {
  poCode: string;
  supplierName: string;
  manufacturerName: string | null;
  lines: POPrintLine[];
}

interface POPrintReportProps {
  pos: POData[];
  companyName: string;
  printedByName: string;
  printedAt: Date | null;
  poDate: string;
  locationName?: string;
}

const MANILA_OFFSET = 8 * 60 * 60 * 1000;

function toManilaDatetime(isoStr: string): string {
  const d = new Date(isoStr.endsWith("Z") ? isoStr : isoStr + "Z");
  const manila = new Date(d.getTime() + MANILA_OFFSET);
  return manila.toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "UTC",
  });
}

function formatQty(line: POPrintLine): string {
  if (line.orderedPerPiece && line.pieceQty > 0) {
    return `${line.finalQty} + ${line.pieceQty}`;
  }
  return String(line.finalQty);
}

function POPrintColgroup() {
  return (
    <colgroup>
      {/* SKU */}
      <col style={{ width: "15%" }} />
      {/* Description */}
      <col />
      {/* UoM */}
      <col style={{ width: "10%" }} />
      {/* Qty */}
      <col style={{ width: "20%" }} />
    </colgroup>
  );
}

export function POPrintReport({
  pos,
  companyName,
  printedByName,
  printedAt,
  locationName,
}: POPrintReportProps) {
  const resolvedPrintedAt = printedAt ?? new Date();

  return (
    <div className="hidden print:block po-print-report">
      {pos.map((po, poIndex) => (
        <div key={poIndex} className="po-print-page">
          <div className="po-print-doc-header">
            <div className="po-print-doc-title">Purchase Order</div>
            <div className="po-print-company-name">{companyName}</div>
            <div className="po-print-meta-grid">
              <span><strong>Date:</strong> {toManilaDatetime(resolvedPrintedAt.toISOString())}</span>
              <span><strong>Printed by:</strong> {printedByName}</span>
              <span><strong>Supplier:</strong> {po.supplierName}</span>
              <span><strong>PO:</strong> {po.poCode}</span>
              <span><strong>Manufacturer:</strong> {po.manufacturerName ?? "No Brand"}</span>
              <span><strong>Location:</strong> {locationName ?? "—"}</span>
            </div>
          </div>
          <table className="po-print-table">
            <POPrintColgroup />
            <thead>
              <tr>
                <th className="po-print-th-left">SKU</th>
                <th className="po-print-th-left">Description</th>
                <th className="po-print-th-left">UoM</th>
                <th className="po-print-th-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line, idx) => (
                <tr key={idx} className="po-print-line-row">
                  <td className="po-print-td-mono">{line.itemCode ?? "—"}</td>
                  <td className="po-print-td-left">{line.itemDescription}</td>
                  <td className="po-print-td-mono">{line.unitSymbol}</td>
                  <td className="po-print-td-right">{formatQty(line)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 12mm 12mm 14mm;
          }

          /* Hide all non-report content */
          body > * { display: none !important; }
          body > *:has(.po-print-report) { display: block !important; }
          .po-print-report { display: block !important; }
          .po-print-report * {
            color: #000 !important;
            background: transparent !important;
          }

          /* Each PO on its own page */
          .po-print-page {
            break-before: page;
          }
          .po-print-page:first-child {
            break-before: auto;
          }

          /* Document header */
          .po-print-doc-header {
            margin-bottom: 4mm;
          }
          .po-print-doc-title {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 1mm;
            text-align: left;
          }
          .po-print-company-name {
            font-size: 10pt;
            text-align: left;
            margin-bottom: 2mm;
          }
          .po-print-meta-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 2mm 8mm;
            font-size: 8.5pt;
            margin-bottom: 2mm;
            justify-content: flex-start;
          }

          /* PO inline header */
          .print-po-inline-header {
            font-size: 8pt;
            font-weight: bold;
            background: #f5f5f5;
            padding: 1.5mm 2mm;
            border-bottom: 1px solid #000;
          }
          .print-po-code {
            font-family: var(--font-mono), ui-monospace, monospace;
          }

          /* Table */
          .po-print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 9pt;
          }
          .po-print-table thead {
            display: table-header-group;
          }
          .po-print-table tr {
            break-inside: avoid;
          }
          .po-print-th-left,
          .po-print-th-right {
            border-bottom: 2px solid #000;
            padding: 1.5mm 2mm;
            font-weight: bold;
            font-size: 8pt;
          }
          .po-print-th-left { text-align: left; }
          .po-print-th-right { text-align: right; }

          .po-print-td-left,
          .po-print-td-right,
          .po-print-td-mono {
            border-bottom: 1px solid #ccc;
            padding: 1.5mm 2mm;
            font-size: 9pt;
            overflow-wrap: break-word;
          }
          .po-print-td-left { text-align: left; }
          .po-print-td-right,
          .po-print-td-mono { text-align: right; font-family: var(--font-mono), ui-monospace, monospace; }
          .po-print-td-mono { text-align: left; }

          .po-print-line-row:last-child td {
            border-bottom: 2px solid #000;
          }
        }
      `}</style>
    </div>
  );
}