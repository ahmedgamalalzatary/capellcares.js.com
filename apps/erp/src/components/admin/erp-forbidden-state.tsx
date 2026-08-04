"use client";

export function ErpForbiddenState({ message }: { message: string }) {
  return (
    <div className="card forbidden-state">
      <h2>غير مصرح</h2>
      <p>{message}</p>
    </div>
  );
}
