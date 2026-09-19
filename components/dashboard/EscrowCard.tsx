"use client";

const BORDER = "#e4e4e7";
const CHARCOAL = "#151b1d";
const MUTED = "#71717b";
const GREEN = "#257b5a";

interface EscrowDisbursal {
  id: string;
  date: string;
  recipient: string;
  taskTitle: string;
  amount: string;
  status: "Settled" | "Processing";
  txHash: string;
}

interface EscrowCardProps {
  disbursals: EscrowDisbursal[];
  vaultAmount: string;
  lockedAmount: string;
  disbursedAmount: string;
  nextInvoiceDate: string;
}

const CARD_SHADOW = "0 8px 24px rgba(37, 123, 90, 0.06)";
const BG_CARD = "#ffffff";

export default function EscrowCard({ disbursals, vaultAmount, lockedAmount, disbursedAmount, nextInvoiceDate }: EscrowCardProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
      {/* Vault summary card */}
      <div
        style={{
          backgroundColor: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          boxShadow: CARD_SHADOW,
          overflow: "hidden",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
            Escrow Vault Treasury
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.04em", color: CHARCOAL }}>
            {vaultAmount}
            <span style={{ fontSize: 12, fontWeight: 400, color: MUTED, marginLeft: 6 }}>USDC</span>
          </p>
        </div>

        <div style={{ paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: MUTED }}>Locked in Active Bounties</span>
            <span style={{ fontWeight: 600, color: CHARCOAL }}>{lockedAmount}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: MUTED }}>Disbursed This Month</span>
            <span style={{ fontWeight: 700, color: GREEN }}>{disbursedAmount}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: MUTED }}>Enterprise Invoicing</span>
            <span style={{ fontWeight: 500, color: CHARCOAL }}>{nextInvoiceDate}</span>
          </div>
        </div>
      </div>

      {/* Disbursal history card */}
      <div
        style={{
          backgroundColor: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          boxShadow: CARD_SHADOW,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "rgba(0,0,0,0.02)",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: CHARCOAL }}>
            Disbursal Settlement History
          </span>
          <span style={{ fontSize: 11, color: MUTED }}>Real-Time Settlement Log</span>
        </div>

        <div>
          {disbursals.map((d, idx) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "14px 20px",
                borderTop: idx === 0 ? "none" : `1px solid ${BORDER}`,
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: CHARCOAL }}>{d.taskTitle}</p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: MUTED, fontFamily: "monospace" }}>
                  {d.recipient} · {d.txHash} · {d.date}
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, color: GREEN, fontSize: 14 }}>{d.amount}</p>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: MUTED,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {d.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}