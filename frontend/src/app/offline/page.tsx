export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        オフラインです
      </h1>
      <p style={{ color: "#475569", maxWidth: 360 }}>
        通信が回復したら自動的に再読み込みされます。打刻や報告の登録には接続が必要です。
      </p>
    </main>
  );
}
