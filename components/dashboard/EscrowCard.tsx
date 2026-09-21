"use client";

import { useState } from "react";
import MintButton from "@/components/dashboard/MintButton";

const BORDER = "#e4e4e7";
const CHARCOAL = "#151b1d";
const MUTED = "#71717b";
const GREEN = "#257b5a";
const MINT = "#00c950";
const MINT_SOFT = "rgba(0, 201, 80, 0.10)";
const MINT_BDR = "rgba(0, 201, 80, 0.20)";

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
  onTopupSuccess?: (newBalance: number) => void;
}

const CARD_SHADOW = "0 8px 24px rgba(37, 123, 90, 0.06)";
const BG_CARD = "#ffffff";

const COIN_PACKS = [
  { coins: 500, inr: 500, label: "Starter Pack" },
  { coins: 2500, inr: 2500, label: "Pro Sprint" },
  { coins: 10000, inr: 10000, label: "Enterprise Vault" },
];

export default function EscrowCard({
  disbursals,
  vaultAmount,
  lockedAmount,
  disbursedAmount,
  nextInvoiceDate,
  onTopupSuccess,
}: EscrowCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedCoins, setSelectedCoins] = useState(2500);
  const [customCoins, setCustomCoins] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const purchaseAmount = customCoins ? parseInt(customCoins, 10) || 0 : selectedCoins;

  const handlePurchase = async () => {
    if (purchaseAmount <= 0) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: purchaseAmount, currency: "INR" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusMsg(json.error || "Failed to purchase GIG Coins.");
      } else {
        setStatusMsg(`Success! Purchased ${purchaseAmount} GIG Coins.`);
        if (onTopupSuccess && json.newBalance !== undefined) {
          onTopupSuccess(json.newBalance);
        }
        setTimeout(() => {
          setShowModal(false);
          setStatusMsg(null);
          window.location.reload();
        }, 1200);
      }
    } catch {
      setStatusMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
                Escrow Vault Treasury
              </p>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: GREEN,
                  backgroundColor: MINT_SOFT,
                  border: `1px solid ${MINT_BDR}`,
                  borderRadius: 9999,
                  padding: "2px 8px",
                }}
              >
                GIG Coins
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.04em", color: CHARCOAL }}>
              {vaultAmount}
              <span style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginLeft: 6 }}>Coins</span>
            </p>
          </div>

          <div style={{ paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: MUTED }}>Locked in Active Bounties</span>
              <span style={{ fontWeight: 600, color: CHARCOAL }}>{lockedAmount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: MUTED }}>Disbursed to Developers</span>
              <span style={{ fontWeight: 700, color: GREEN }}>{disbursedAmount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: MUTED }}>Auto-Replenish Cycle</span>
              <span style={{ fontWeight: 500, color: CHARCOAL }}>{nextInvoiceDate}</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                style={{
                  width: "100%",
                  height: 40,
                  backgroundColor: MINT,
                  border: "none",
                  borderRadius: 8,
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                + Purchase GIG Coins
              </button>
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
            {disbursals.length === 0 ? (
              <p style={{ padding: 20, margin: 0, color: MUTED, fontSize: 13 }}>No disbursals yet.</p>
            ) : (
              disbursals.map((d, idx) => (
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
              ))
            )}
          </div>
        </div>
      </div>

      {/* GIG Coin Purchase Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 14,
              maxWidth: 480,
              width: "100%",
              padding: 28,
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: CHARCOAL }}>
                  Purchase GIG Coins
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>
                  Coins are held in your Escrow Vault and locked when issues are posted.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: MUTED }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, margin: "20px 0 16px" }}>
              {COIN_PACKS.map((pack) => {
                const isSelected = !customCoins && selectedCoins === pack.coins;
                return (
                  <button
                    key={pack.coins}
                    type="button"
                    onClick={() => {
                      setSelectedCoins(pack.coins);
                      setCustomCoins("");
                    }}
                    style={{
                      border: isSelected ? `2px solid ${GREEN}` : `1px solid ${BORDER}`,
                      backgroundColor: isSelected ? MINT_SOFT : "#ffffff",
                      borderRadius: 8,
                      padding: "12px 8px",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: CHARCOAL }}>
                      {pack.coins.toLocaleString()}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>
                      ₹{pack.inr.toLocaleString()}
                    </p>
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: CHARCOAL, marginBottom: 6 }}>
                Or enter custom coin amount
              </label>
              <input
                type="number"
                min="100"
                step="100"
                placeholder="e.g. 5000"
                value={customCoins}
                onChange={(e) => setCustomCoins(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {statusMsg && (
              <p
                style={{
                  fontSize: 13,
                  padding: "8px 12px",
                  borderRadius: 6,
                  marginBottom: 16,
                  backgroundColor: statusMsg.startsWith("Success") ? MINT_SOFT : "rgba(234, 67, 53, 0.1)",
                  color: statusMsg.startsWith("Success") ? GREEN : "#ea4335",
                }}
              >
                {statusMsg}
              </p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  height: 40,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: "#ffffff",
                  color: CHARCOAL,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || purchaseAmount <= 0}
                onClick={handlePurchase}
                style={{
                  height: 40,
                  padding: "0 20px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: MINT,
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Processing..." : `Confirm (₹${purchaseAmount.toLocaleString()})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}