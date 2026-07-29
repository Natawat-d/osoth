"use client";
// แผ่นเซ็นลายเซ็นบนจอ (แท็บเล็ต/มือถือ/เมาส์) → PNG data URL
// ใช้กับใบยินยอม OPD (คำตอบข้อ 13: อัปโหลด + เซ็นบนจอ ทั้งคู่)
import { useEffect, useRef, useState } from "react";

export default function SignaturePad({ onConfirm, height = 180 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // ตั้ง resolution ตามขนาดจริง (กันเบลอบนจอ retina)
    const rect = c.getBoundingClientRect();
    c.width = rect.width * 2;
    c.height = height * 2;
    const ctx = c.getContext("2d");
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a2e";
  }, [height]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setDirty(true);
  };
  const end = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    const rect = c.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
    setDirty(false);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="border rounded-3 w-100 bg-white"
        style={{ height, touchAction: "none", cursor: "crosshair" }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={clear}>
          <i className="bi bi-eraser me-1" /> ล้าง
        </button>
        <button type="button" className="btn btn-primary btn-sm ms-auto" disabled={!dirty}
          onClick={() => onConfirm(canvasRef.current.toDataURL("image/png"))}>
          <i className="bi bi-check2 me-1" /> ใช้ลายเซ็นนี้
        </button>
      </div>
    </div>
  );
}
