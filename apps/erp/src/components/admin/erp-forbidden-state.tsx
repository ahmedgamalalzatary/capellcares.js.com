"use client";

export function ErpForbiddenState({ message }: { message: string }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>غير مصرح</h2>
      <p style={{ marginBottom: 0 }}>{message}</p>
    </div>
  );
}
