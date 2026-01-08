export default function ArmStyles() {
  return (
    <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap");

        :root {
          --bg: #eef3f9;
          --panel: #ffffff;
          --panel2: #f4f7ff;
          --stroke: #d9e3f4;
          --text: #1b2a4a;
          --muted: #6c7c9c;
          --brand: #1c4bb6;
          --brand-2: #20b5c6;
          --brand-3: #65e3b5;
        }

        html,
        body {
          height: 100%;
        }
        body {
          margin: 0;
          background: radial-gradient(1100px 500px at 60% 0%, #e9f1ff 0%, transparent 70%),
            radial-gradient(900px 600px at 0% 70%, #f4fbff 0%, transparent 65%),
            var(--bg);
          color: var(--text);
          font-family: "Manrope", "Segoe UI", system-ui, -apple-system, sans-serif;
          overflow-x: hidden;
        }
        * {
          box-sizing: border-box;
        }

        .armShell.medShell {
          min-height: 100vh;
          display: flex;
        }

        .medSidebar {
          width: 260px;
          padding: 22px 18px;
          border-right: 1px solid var(--stroke);
          background: #f7faff;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .medLogoCard {
          background: #fff;
          border: 1px solid var(--stroke);
          border-radius: 18px;
          padding: 18px 12px;
          text-align: center;
          box-shadow: 0 12px 24px rgba(28, 75, 182, 0.08);
        }
        .medLogoImg {
          width: 86px;
          height: auto;
          display: block;
          margin: 0 auto 10px;
        }
        .medLogoTitle {
          font-weight: 800;
          color: var(--brand);
          font-size: 20px;
          letter-spacing: -0.02em;
        }
        .medLogoTag {
          margin-top: 4px;
          font-size: 11px;
          color: var(--brand);
          letter-spacing: 0.18em;
        }

        .medNav {
          display: grid;
          gap: 10px;
        }
        .medNavItem {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid transparent;
          background: #fff;
          color: var(--text);
          text-decoration: none;
          font-weight: 600;
          box-shadow: 0 8px 18px rgba(17, 39, 89, 0.06);
        }
        .medNavItem:hover {
          border-color: #d9e3f4;
          background: #f5f9ff;
        }
        .medNavItem.active {
          border-color: rgba(28, 75, 182, 0.35);
          box-shadow: 0 10px 22px rgba(28, 75, 182, 0.18);
          background: linear-gradient(90deg, #e9f2ff 0%, #ffffff 100%);
        }
        .medNavIcon {
          width: 26px;
          height: 26px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #edf3ff;
        }

        .medSidebarCard {
          background: #fff;
          border: 1px solid var(--stroke);
          border-radius: 16px;
          padding: 12px 14px;
          box-shadow: 0 10px 20px rgba(17, 39, 89, 0.06);
        }
        .medSidebarTitle {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .medSidebarStatus {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .medPill {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          background: #f1f5ff;
          border: 1px solid #dbe7ff;
          color: var(--brand);
        }
        .medDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #ffb647;
          box-shadow: 0 0 0 4px rgba(255, 182, 71, 0.15);
        }
        .medShortcutList {
          font-size: 12px;
          color: var(--muted);
          display: grid;
          gap: 6px;
        }

        .medContent {
          flex: 1;
          padding: 24px 28px 32px;
        }
        .medContent.medContentFull {
          width: 100%;
        }

        .medTopbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 18px;
        }
        .medTopTitle {
          display: grid;
          gap: 6px;
        }
        .medPageTitle {
          font-size: 24px;
          font-weight: 800;
          color: var(--brand);
        }
        .medPageSub {
          color: var(--muted);
          font-size: 13px;
        }
        .medTopActions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .medAvatar {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: #e9f1ff;
          border: 1px solid #d6e2f4;
        }
        .medSearch {
          min-width: 260px;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid #cfe0f8;
          background: #f5f9ff;
          box-shadow: inset 0 0 0 2px rgba(28, 75, 182, 0.08);
          outline: none;
        }

        .medMain {
          display: grid;
          gap: 18px;
        }
        .medCenteredContent {
          max-width: 980px;
          margin: 0 auto;
          width: 100%;
        }
        .trackShell {
          display: grid;
          gap: 16px;
        }
        .trackHero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .trackStatus {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: #e9f2ff;
          border: 1px solid #cfe0f8;
          color: var(--brand);
          font-weight: 700;
          font-size: 12px;
        }
        .trackMapCard {
          padding: 0;
          overflow: hidden;
        }
        .trackMapWrap {
          width: 100%;
          height: 520px;
          background: #f1f5ff;
        }
        .trackSheet {
          display: grid;
          gap: 12px;
        }
        .trackDriver {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .trackDriverAvatar {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          background: #e9f2ff;
          border: 1px solid #d6e2f4;
          display: grid;
          place-items: center;
          font-size: 20px;
        }
        .trackStatRow {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .trackEta {
          font-size: 26px;
          font-weight: 800;
          color: var(--brand);
        }

        .kpiRow {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .kpiCard {
          background: linear-gradient(135deg, #ffffff 0%, #f4f9ff 100%);
          border: 1px solid var(--stroke);
          border-radius: 18px;
          padding: 14px 16px;
          box-shadow: 0 12px 24px rgba(17, 39, 89, 0.06);
        }
        .kpiLabel {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          font-weight: 700;
        }
        .kpiValue {
          font-size: 24px;
          font-weight: 800;
          color: var(--brand);
          margin-top: 6px;
        }
        .kpiHint {
          font-size: 12px;
          color: var(--muted);
          margin-top: 6px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 16px;
          align-items: start;
        }
        .rightCol {
          display: grid;
          gap: 16px;
        }

        .card {
          background: var(--panel);
          border: 1px solid var(--stroke);
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 16px 28px rgba(17, 39, 89, 0.08);
        }
        .cardHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .cardTitle {
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
          margin-top: 4px;
        }
        .cardBody {
          margin-top: 12px;
        }
        .cardBody.p-0 {
          padding: 0;
          margin-top: 0;
        }
        .cardFoot {
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          border-radius: 12px;
          padding: 10px 12px;
          border: 1px solid #d6e2f4;
          background: #f7faff;
          color: var(--text);
          outline: none;
        }
        .textarea {
          min-height: 140px;
          resize: vertical;
        }
        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: rgba(28, 75, 182, 0.5);
          box-shadow: 0 0 0 3px rgba(28, 75, 182, 0.15);
        }

        .pager {
          border-radius: 12px;
          padding: 8px 10px;
          border: 1px solid #d6e2f4;
          background: #f7faff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          color: var(--muted);
          font-size: 13px;
        }
        .pagerBtns {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .btn {
          border-radius: 999px;
          padding: 9px 14px;
          border: 1px solid transparent;
          background: var(--brand);
          color: #fff;
          cursor: pointer;
          transition: transform 0.06s ease, background 0.2s ease, box-shadow 0.2s ease;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 8px 18px rgba(28, 75, 182, 0.18);
        }
        .btn:hover {
          background: #163f9f;
          color: #fff;
        }
        .btn:active {
          transform: translateY(1px);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }
        .btnGhost {
          background: #fff;
          color: var(--brand);
          border-color: #d6e2f4;
          box-shadow: none;
        }
        .btnGhost:hover {
          background: #e9f2ff;
          color: var(--brand);
          border-color: #c8dbff;
        }
        .btnBlue {
          background: var(--brand);
        }
        .btnGreen {
          background: linear-gradient(135deg, #3bd5b3 0%, #20b5c6 100%);
          box-shadow: 0 8px 18px rgba(32, 181, 198, 0.2);
        }
        .btnRed {
          background: #ef4444;
        }

        .btnRow {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }

        .tableWrap {
          margin-top: 12px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #d6e2f4;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .table thead th {
          text-align: left;
          padding: 10px;
          background: #f1f5ff;
          color: #5c6c8c;
          font-weight: 700;
        }
        .table tbody td {
          padding: 10px;
          border-top: 1px solid #e6eef9;
          vertical-align: top;
        }
        .row {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .row:hover {
          background: #f7faff;
        }
        .row.active {
          background: #eef4ff;
        }
        .empty {
          padding: 18px 10px !important;
          text-align: center;
          color: #7a8bb1;
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .strong {
          font-weight: 800;
        }
        .muted {
          color: var(--muted);
        }
        .small {
          font-size: 12px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 12px;
          white-space: nowrap;
          font-weight: 700;
        }
        .badgePrioHigh {
          background: #fde8ea;
          border-color: #f9c4cd;
          color: #c03346;
        }
        .badgePrioMed {
          background: #fff2dd;
          border-color: #ffd9a3;
          color: #b56b00;
        }
        .badgePrioLow {
          background: #eef1ff;
          border-color: #d7def9;
          color: #4b58b8;
        }
        .badgeStatusNew {
          background: #e6f9f2;
          border-color: #b9f0dc;
          color: #0f8a6a;
        }
        .badgeStatusProgress {
          background: #e9f2ff;
          border-color: #c8dbff;
          color: #1c4bb6;
        }
        .badgeStatusClosed {
          background: #f0f4f9;
          border-color: #d9e3f4;
          color: #6b7c9c;
        }

        .badgesCol {
          display: grid;
          gap: 8px;
          justify-items: end;
        }

        .noteBox {
          margin-top: 10px;
          background: #f4f7ff;
          border: 1px solid #d9e3f4;
          border-radius: 16px;
          padding: 10px;
        }
        .noteText {
          margin-top: 6px;
          white-space: pre-line;
          color: #4d5e7d;
          font-size: 13px;
          line-height: 1.4;
        }
        .stack > * + * {
          margin-top: 12px;
        }
        .dividerTop {
          border-top: 1px solid #e3ecfb;
          padding-top: 12px;
          margin-top: 12px;
        }

        .mapWrap {
          margin-top: 12px;
          height: 360px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #d9e3f4;
          background: #f1f5ff;
        }

        .modalRoot {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
        }
        .modalBackdrop {
          position: absolute;
          inset: 0;
          background: rgba(18, 29, 56, 0.45);
          border: 0;
        }
        .modalCard {
          position: relative;
          width: min(640px, 92vw);
          border-radius: 18px;
          border: 1px solid #d9e3f4;
          background: #fff;
          box-shadow: 0 24px 70px rgba(17, 39, 89, 0.3);
          padding: 16px;
        }
        .modalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .modalTitle {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: var(--brand);
        }
        .modalBody {
          margin-top: 12px;
        }

        .form {
          display: grid;
          gap: 10px;
        }
        .label {
          font-size: 12px;
          color: #5f6f90;
          font-weight: 700;
        }

        @media (max-width: 1100px) {
          .armShell.medShell {
            flex-direction: column;
          }
          .medSidebar {
            width: 100%;
            flex-direction: row;
            flex-wrap: wrap;
          }
          .medContent {
            padding: 20px;
          }
          .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .medTopbar {
            flex-direction: column;
            align-items: flex-start;
          }
          .medTopActions {
            width: 100%;
            flex-wrap: wrap;
          }
          .medSearch {
            width: 100%;
            min-width: 0;
          }
          .trackMapWrap {
            height: 360px;
          }
        }
        @media (max-width: 700px) {
          .trackHero {
            align-items: flex-start;
          }
          .trackStatus {
            width: 100%;
            justify-content: center;
          }
          .trackMapWrap {
            height: 60vh;
            min-height: 320px;
          }
          .trackSheet {
            position: sticky;
            bottom: 0;
            background: #fff;
            border-radius: 20px 20px 0 0;
            box-shadow: 0 -18px 30px rgba(17, 39, 89, 0.12);
          }
          .trackDriver {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        .medCentered {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .medMessageCard {
          max-width: 480px;
          width: 100%;
          background: #fff;
          border: 1px solid var(--stroke);
          border-radius: 18px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 16px 28px rgba(17, 39, 89, 0.08);
        }
        .medMessageTitle {
          font-size: 18px;
          font-weight: 800;
          color: var(--brand);
          margin-top: 6px;
        }
        .medMessageText {
          margin-top: 10px;
          color: var(--muted);
          font-size: 14px;
        }
        .medFooterNote {
          margin-top: 10px;
          padding: 12px 16px;
          border-radius: 14px;
          background: #f5f9ff;
          border: 1px solid #d9e3f4;
          color: var(--muted);
          font-size: 13px;
          text-align: center;
        }
      `}</style>
  );
}
