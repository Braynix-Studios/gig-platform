"use client";

const BORDER = "#e4e4e7";
const CHARCOAL = "#151b1d";
const MUTED = "#71717b";
const MINT = "#00c950";
const MINT_SOFT = "rgba(0, 201, 80, 0.10)";
const MINT_BDR = "rgba(0, 201, 80, 0.20)";
const GREEN = "#257b5a";
const VIOLET = "#6048a8";
const VIOLET_SOFT = "rgba(96, 72, 168, 0.12)";
const VIOLET_BDR = "rgba(96, 72, 168, 0.28)";
const AMBER = "#c98a00";
const AMBER_SOFT = "rgba(246, 182, 11, 0.12)";
const AMBER_BDR = "rgba(246, 182, 11, 0.28)";
const RED = "#ea4335";
const RED_SOFT = "rgba(234, 67, 53, 0.12)";
const RED_BDR = "rgba(234, 67, 53, 0.28)";

interface DevTask {
  id: string;
  title: string;
  repo: string;
  status: "Locked" | "In Progress" | "Submitted" | "Verified";
  assignee?: string;
  lockedAmount?: string;
  lockExpiry?: string;
}

interface BizTask {
  id: string;
  title: string;
  repo: string;
  budget: string;
  applicantsCount: number;
  status: "Active" | "Reviewing" | "Open for Bids" | "Queued";
  assignee?: string;
  priority: "Critical" | "High" | "Standard";
  targetRelease: string;
}

function statusChip(status: DevTask["status"] | BizTask["status"]) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    Locked: { bg: VIOLET_SOFT, color: VIOLET, border: VIOLET_BDR },
    "In Progress": { bg: AMBER_SOFT, color: AMBER, border: AMBER_BDR },
    Submitted: { bg: MINT_SOFT, color: GREEN, border: MINT_BDR },
    Verified: { bg: MINT_SOFT, color: GREEN, border: MINT_BDR },
    Active: { bg: VIOLET_SOFT, color: VIOLET, border: VIOLET_BDR },
    Reviewing: { bg: AMBER_SOFT, color: AMBER, border: AMBER_BDR },
    "Open for Bids": { bg: MINT_SOFT, color: GREEN, border: MINT_BDR },
    Queued: { bg: "rgba(113,113,123,0.08)", color: MUTED, border: BORDER },
  };
  const s = map[status] || map["Queued"];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 9999,
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function priorityChip(priority: BizTask["priority"]) {
  const map: Record<BizTask["priority"], { bg: string; color: string; border: string }> = {
    Critical: { bg: RED_SOFT, color: RED, border: RED_BDR },
    High: { bg: AMBER_SOFT, color: AMBER, border: AMBER_BDR },
    Standard: { bg: "rgba(113,113,123,0.08)", color: MUTED, border: BORDER },
  };
  const s = map[priority];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 6,
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {priority}
    </span>
  );
}

interface TaskTableProps {
  tasks: DevTask[] | BizTask[];
  isBusiness: boolean;
}

export default function TaskTable({ tasks, isBusiness }: TaskTableProps) {
  if (isBusiness) {
    const bizTasks = tasks as BizTask[];
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.02)" }}>
              {["Task Specification", "Repository", "Budget", "Assignee / Bids", "Priority", "Status"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: "12px 16px",
                    textAlign: i === 5 ? "right" : "left",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bizTasks.map((task, idx) => (
              <tr key={task.id} style={{ borderTop: idx === 0 ? "none" : `1px solid ${BORDER}` }}>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 600, color: CHARCOAL, lineHeight: 1.4 }}>{task.title}</div>
                  <div style={{ marginTop: 3, fontSize: 11, color: MUTED, fontFamily: "monospace" }}>
                    Target: {task.targetRelease}
                  </div>
                </td>
                <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>
                  {task.repo}
                </td>
                <td style={{ padding: "14px 16px", fontWeight: 700, color: CHARCOAL, whiteSpace: "nowrap" }}>
                  {task.budget}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  {task.assignee ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: CHARCOAL, fontWeight: 500, fontSize: 13 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: MINT, flexShrink: 0 }} />
                      {task.assignee}
                    </span>
                  ) : (
                    <span style={{ color: MUTED, fontSize: 12 }}>
                      {task.applicantsCount} candidate{task.applicantsCount === 1 ? "" : "s"}
                    </span>
                  )}
                </td>
                <td style={{ padding: "14px 16px" }}>{priorityChip(task.priority)}</td>
                <td style={{ padding: "14px 16px", textAlign: "right" }}>{statusChip(task.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const devTasks = tasks as DevTask[];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.02)" }}>
            {["Task", "Repository", "Status", "Assignee", "Locked Amount", "Lock Expiry"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: MUTED,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {devTasks.map((task, idx) => (
            <tr key={task.id} style={{ borderTop: idx === 0 ? "none" : `1px solid ${BORDER}` }}>
              <td style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 600, color: CHARCOAL, lineHeight: 1.4 }}>{task.title}</div>
              </td>
              <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>
                {task.repo}
              </td>
              <td style={{ padding: "14px 16px" }}>{statusChip(task.status)}</td>
              <td style={{ padding: "14px 16px", color: CHARCOAL, fontSize: 13 }}>{task.assignee || "—"}</td>
              <td style={{ padding: "14px 16px", fontWeight: 700, color: CHARCOAL }}>{task.lockedAmount || "—"}</td>
              <td style={{ padding: "14px 16px", fontSize: 12, color: MUTED }}>{task.lockExpiry || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}