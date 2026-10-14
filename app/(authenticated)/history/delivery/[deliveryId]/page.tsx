"use client";

import { useState, useEffect, use, useCallback } from "react";
import { getSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import type { DeliverySessionDetail, DeliveryLineDetail } from "@/history/domain/DeliverySessionSummary";

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

const STATUS_META: Record<
  DeliveryLineDetail["status"],
  { label: string; variant: "success" | "warning" | "incoming" | "critical" | "neutral" }
> = {
  exact: { label: "Exact", variant: "success" },
  over: { label: "Over Served", variant: "warning" },
  under: { label: "Under Served", variant: "neutral" },
  not_ordered: { label: "Not Ordered", variant: "incoming" },
  new_item: { label: "New Item", variant: "critical" },
};

function statusLabel(status: DeliveryLineDetail["status"]): string {
  return STATUS_META[status]?.label ?? status;
}

function exportCsv(session: DeliverySessionDetail) {
  const lineHeaders = ["Item Code", "Description", "Ordered Qty", "Received Qty", "Status"];
  const lineRows = session.lines.map((l) => [
    l.itemCode, l.itemDescription, String(l.orderedQty), String(l.receivedQty),
    statusLabel(l.status),
  ]);
  const newItemRows = session.newItems.map((n) => [
    n.code, n.description, "0", String(n.quantity), "New Item",
  ]);

  const sections: string[][] = [[lineHeaders.join(",")], ...lineRows.map((r) => [r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")]), ...newItemRows.map((r) => [r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")])];

  if (session.returnExcess.length > 0) {
    sections.push([""]);
    sections.push([["Item Code", "Received Qty (before return)", "Returned-to Qty"].join(",")]);
    for (const e of session.returnExcess) {
      sections.push([`"${e.itemCode}",${e.receivedQty},${e.returnedToQty}`]);
    }
  }

  const csv = sections.flat().join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `delivery-${session.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface PrintReportProps {
  session: DeliverySessionDetail;
  companyName: string;
  printedByName: string;
  printedAt: Date | null;
}

function PrintReport({ session, companyName, printedByName, printedAt }: PrintReportProps) {
  const totalReceived =
    session.lines.reduce((sum, l) => sum + l.receivedQty, 0) +
    session.newItems.reduce((sum, n) => sum + n.quantity, 0);
  const totalLines = session.lines.length + session.newItems.length;
  const resolvedPrintedAt = printedAt ?? new Date();
  const isEmpty = session.lines.length === 0 && session.newItems.length === 0;

  return (
    <div className="hidden print:block print-report">
      <div className="print-running-header">
        <span>Delivery Session Report</span>
        <span className="print-running-ref">PO {session.newPoCode}</span>
      </div>

      <div className="print-running-footer">
        <span>PO {session.newPoCode}</span>
      </div>

      <div className="print-doc-header">
        <div className="print-doc-title">Delivery Session Report</div>
        <div className="print-company-name">{companyName}</div>
        <div className="print-run-ref">
          {(session.originalPoCode ?? "—")} → {session.newPoCode}
        </div>
        <div className="print-meta-grid">
          <span><strong>Location:</strong> {session.locationName ?? "Unknown Location"}</span>
          <span><strong>Supplier:</strong> {session.supplierName ?? "Unknown Supplier"}</span>
          <span><strong>Session date:</strong> {toManilaDatetime(session.createdAt)}</span>
          <span><strong>Received by:</strong> {session.receiverName ?? "Unknown"}</span>
          <span><strong>Blind delivery:</strong> {session.blindDelivery ? "Yes" : "No"}</span>
          <span><strong>Continuous scanning:</strong> {session.continuousScanning ? "Yes" : "No"}</span>
          {session.discrepancyApproved && session.approverName && session.approvedAt && (
            <span><strong>Discrepancy approved by:</strong> {session.approverName} · {toManilaDatetime(session.approvedAt)}</span>
          )}
        </div>
        <div className="print-printed-line">
          Printed on {toManilaDatetime(resolvedPrintedAt.toISOString())} by {printedByName}
        </div>
      </div>

      {isEmpty ? (
        <p className="print-empty">No line detail recorded for this session.</p>
      ) : (
        <>
          {session.lines.length > 0 && (
            <section className="print-po">
              <div className="print-po-header">Received Lines</div>
              <table className="print-table">
                <colgroup>
                  {/* Item Code */}
                  <col style={{ width: "14%" }} />
                  {/* Description — auto */}
                  <col />
                  {/* Ordered */}
                  <col style={{ width: "12%" }} />
                  {/* Received */}
                  <col style={{ width: "12%" }} />
                  {/* Status */}
                  <col style={{ width: "16%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="print-th-left">Item Code</th>
                    <th className="print-th-left">Description</th>
                    <th className="print-th-right">Ordered</th>
                    <th className="print-th-right">Received</th>
                    <th className="print-th-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {session.lines.map((line) => (
                    <tr key={line.id} className="print-line-row">
                      <td className="print-td-mono">{line.itemCode}</td>
                      <td className="print-td-left">{line.itemDescription}</td>
                      <td className="print-td-right">{line.orderedQty}</td>
                      <td className="print-td-right print-received-qty">{line.receivedQty}</td>
                      <td className="print-td-left">{statusLabel(line.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {session.newItems.length > 0 && (
            <section className="print-po">
              <div className="print-po-header">New Items (Unknown SKUs)</div>
              <table className="print-table">
                <colgroup>
                  {/* Code */}
                  <col style={{ width: "14%" }} />
                  {/* Description — auto */}
                  <col />
                  {/* Qty */}
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="print-th-left">Code</th>
                    <th className="print-th-left">Description</th>
                    <th className="print-th-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {session.newItems.map((item) => (
                    <tr key={item.id} className="print-line-row">
                      <td className="print-td-mono">{item.code}</td>
                      <td className="print-td-left">{item.description}</td>
                      <td className="print-td-right print-received-qty">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Return-Excess events in print (FR-30) */}
          {session.returnExcess.length > 0 && (
            <section className="print-po">
              <div className="print-po-header">Return-Excess Events</div>
              <table className="print-table">
                <colgroup>
                  {/* Item Code */}
                  <col style={{ width: "14%" }} />
                  {/* Received Before Return — auto */}
                  <col />
                  {/* Returned To */}
                  <col style={{ width: "22%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="print-th-left">Item Code</th>
                    <th className="print-th-right">Received Before Return</th>
                    <th className="print-th-right">Returned To</th>
                  </tr>
                </thead>
                <tbody>
                  {session.returnExcess.map((e, i) => (
                    <tr key={i} className="print-line-row">
                      <td className="print-td-mono">{e.itemCode}</td>
                      <td className="print-td-right">{e.receivedQty}</td>
                      <td className="print-td-right print-received-qty">{e.returnedToQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <div className="print-grand-total">
            <div>Total lines: {totalLines}</div>
            <div>Total received qty: {totalReceived}</div>
            <div>New items: {session.newItems.length}</div>
            {session.discrepancyApproved && <div>[*] Admin-approved discrepancy</div>}
          </div>
        </>
      )}
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ deliveryId: string }> }) {
  const { deliveryId } = use(params);
  const [session, setSession] = useState<DeliverySessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("Operations Hub");
  const [printedByName, setPrintedByName] = useState("");
  const [printedAt, setPrintedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/history/delivery/api/${deliveryId}`);
      if (res.status === 404) { setError("Delivery session not found."); return; }
      if (!res.ok) throw new Error();
      setSession(await res.json());
    } catch {
      setError("Failed to load delivery details.");
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/login/api")
      .then((r) => r.json())
      .then((data) => { if (data.companyName?.trim()) setCompanyName(data.companyName.trim()); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getSession().then((s) => {
      if (s?.user?.name) setPrintedByName(s.user.name);
    });
  }, []);

  useEffect(() => {
    const handler = () => setPrintedAt(new Date());
    window.addEventListener("beforeprint", handler);
    return () => window.removeEventListener("beforeprint", handler);
  }, []);

  function handlePrint() {
    setPrintedAt(new Date());
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: landscape;
            /* Top/bottom margins hold the fixed running header/footer, which
               are pulled into these margin bands so flowing content never
               underlaps them on any page. */
            margin: 20mm 12mm 16mm;
          }

          body > * { display: none !important; }
          body > *:has(.print-report) { display: block !important; }
          .print-report { display: block !important; }

          .print-running-header {
            position: fixed;
            top: -15mm;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            border-bottom: 1px solid #000;
            padding-bottom: 3mm;
            font-size: 8pt;
            color: #000;
          }

          .print-running-footer {
            position: fixed;
            bottom: -11mm;
            left: 0;
            right: 0;
            display: flex;
            justify-content: flex-end;
            border-top: 1px solid #000;
            padding-top: 2mm;
            font-size: 7pt;
            color: #000;
          }

          .print-report {
            color: #000;
            background: #fff;
          }

          .print-report * {
            color: #000 !important;
            background: transparent !important;
          }

          .print-doc-header { margin-bottom: 6mm; }
          .print-doc-title { font-size: 13pt; font-weight: bold; margin-bottom: 1mm; }
          .print-company-name { font-size: 9pt; margin-bottom: 1mm; }
          .print-run-ref { font-size: 16pt; font-weight: bold; margin-bottom: 3mm; font-family: var(--font-mono), ui-monospace, monospace; }
          .print-meta-grid {
            display: flex; flex-wrap: wrap; gap: 2mm 8mm;
            font-size: 8pt; margin-bottom: 2mm;
          }
          .print-printed-line { font-size: 7pt; color: #444; margin-top: 2mm; }

          .print-po { margin-top: 5mm; break-inside: auto; }
          .print-po-header {
            font-size: 9pt; font-weight: bold;
            border-bottom: 1px solid #000; padding-bottom: 1mm; margin-bottom: 0; break-after: avoid;
          }

          /* Fixed layout + per-section colgroups keep the leading Item Code
             column aligned across sections and stop content-driven jitter. */
          .print-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8pt; }
          .print-table thead { display: table-header-group; }
          .print-table tr, .print-table tfoot { break-inside: avoid; }
          .print-th-left, .print-th-right {
            border-bottom: 1px solid #000; padding: 1mm 2mm;
            font-weight: bold; font-size: 7.5pt;
          }
          .print-th-left { text-align: left; }
          .print-th-right { text-align: right; }
          .print-td-left, .print-td-right, .print-td-mono {
            border-bottom: 1px solid #ccc; padding: 1mm 2mm; font-size: 8pt;
            overflow-wrap: break-word;
          }
          .print-td-left { text-align: left; }
          .print-td-right { text-align: right; font-family: var(--font-mono), ui-monospace, monospace; }
          .print-td-mono { text-align: left; font-family: var(--font-mono), ui-monospace, monospace; }
          .print-received-qty { font-weight: bold; }

          .print-grand-total {
            margin-top: 6mm; padding-top: 3mm; border-top: 2px solid #000;
            font-size: 8.5pt; font-weight: bold;
            display: flex; flex-wrap: wrap; gap: 2mm 8mm;
          }
          .print-empty { margin-top: 6mm; font-size: 9pt; }
        }
      `}</style>

      <main className="mx-auto max-w-screen-lg space-y-4 p-4 pb-16 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/history/delivery" className="type-body text-muted-foreground transition-colors hover:text-foreground">
            ← Delivery History
          </Link>
        </div>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        )}

        {!loading && error && (
          <div className="py-10 text-center">
            <p className="type-body text-destructive">{error}</p>
            <Button variant="link" size="sm" onClick={load}>Retry</Button>
          </div>
        )}

        {!loading && !error && session && (
          <>
            {/* Session header */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="type-page-title">{session.locationName ?? "Unknown Location"}</h1>
                  <p className="type-body mt-0.5">{session.supplierName ?? "Unknown Supplier"}</p>
                  <p className="type-caption text-muted-foreground mt-1">
                    {toManilaDatetime(session.createdAt)} · Received by {session.receiverName ?? "Unknown"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handlePrint}>Print</Button>
                  <Button variant="secondary" size="sm" onClick={() => exportCsv(session)}>Export CSV</Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 type-caption text-muted-foreground">
                <p>
                  Original PO: <span className="type-data text-foreground">{session.originalPoCode ?? "—"}</span>
                </p>
                <p>·</p>
                <p>
                  New PO: <span className="type-data text-foreground">{session.newPoCode}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={session.blindDelivery ? "incoming" : "neutral"}>
                  {session.blindDelivery ? "Blind Delivery" : "Visible Delivery"}
                </Badge>
                <Badge variant={session.continuousScanning ? "incoming" : "neutral"}>
                  {session.continuousScanning ? "Continuous Scanning" : "Manual Qty"}
                </Badge>
                {session.discrepancyApproved && (
                  <Badge variant="warning">Approved discrepancy</Badge>
                )}
              </div>

              {/* Approver info (FR-29) */}
              {session.discrepancyApproved && session.approverName && session.approvedAt && (
                <p className="type-caption text-muted-foreground">
                  Approved by <span className="font-medium text-foreground">{session.approverName}</span>
                  {" · "}{toManilaDatetime(session.approvedAt)}
                </p>
              )}
            </div>

            {/* Return-Excess events (FR-30) */}
            {session.returnExcess.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted px-4 py-2">
                  <p className="type-section-title">Return-Excess Events</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-border bg-muted/40">
                      <tr>
                        <th className="px-3 py-2 text-left type-label">Item Code</th>
                        <th className="px-3 py-2 text-right type-label">Received Before Return</th>
                        <th className="px-3 py-2 text-right type-label">Returned To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.returnExcess.map((e, i) => (
                        <tr key={i} className="border-t border-border/60">
                          <td className="px-3 py-2 type-data text-muted-foreground">{e.itemCode}</td>
                          <td className="px-3 py-2 text-right tabular-nums type-body">{e.receivedQty}</td>
                          <td className="px-3 py-2 text-right tabular-nums type-body font-semibold">{e.returnedToQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Lines */}
            {session.lines.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted px-4 py-2">
                  <p className="type-section-title">Received Lines</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-border bg-muted/40">
                      <tr>
                        <th className="px-3 py-2 text-left type-label">Item Code</th>
                        <th className="px-3 py-2 text-left type-label">Description</th>
                        <th className="px-3 py-2 text-right type-label">Ordered</th>
                        <th className="px-3 py-2 text-right type-label">Received</th>
                        <th className="px-3 py-2 text-left type-label">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.lines.map((line) => {
                        const meta = STATUS_META[line.status];
                        return (
                          <tr key={line.id} className="border-t border-border/60">
                            <td className="px-3 py-2 type-data text-muted-foreground">{line.itemCode}</td>
                            <td className="px-3 py-2 type-body">{line.itemDescription}</td>
                            <td className="px-3 py-2 text-right tabular-nums type-body">{line.orderedQty}</td>
                            <td className="px-3 py-2 text-right tabular-nums type-body font-semibold">{line.receivedQty}</td>
                            <td className="px-3 py-2">
                              <Badge variant={meta?.variant ?? "neutral"}>{meta?.label ?? line.status}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* New Items */}
            {session.newItems.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted px-4 py-2">
                  <p className="type-section-title">New Items (Unknown SKUs)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-border bg-muted/40">
                      <tr>
                        <th className="px-3 py-2 text-left type-label">Code</th>
                        <th className="px-3 py-2 text-left type-label">Description</th>
                        <th className="px-3 py-2 text-right type-label">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.newItems.map((item) => (
                        <tr key={item.id} className="border-t border-border/60">
                          <td className="px-3 py-2 type-data text-muted-foreground">{item.code}</td>
                          <td className="px-3 py-2 type-body text-muted-foreground">{item.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums type-body">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {session.lines.length === 0 && session.newItems.length === 0 && (
              <p className="py-8 text-center type-body text-muted-foreground">No line detail recorded for this session.</p>
            )}
          </>
        )}
      </main>

      {session && (
        <PrintReport
          session={session}
          companyName={companyName}
          printedByName={printedByName}
          printedAt={printedAt}
        />
      )}
    </>
  );
}
