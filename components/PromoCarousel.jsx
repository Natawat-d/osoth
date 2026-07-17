"use client";
import { useState, useEffect, useRef } from "react";

// carousel รูปโปรโมชั่น/course วิ่งอัตโนมัติ (หน้าร้าน)
// items: [{ image, title, subtitle, kind }] — image = URL หรือ data URL (ว่างได้ = สไลด์ gradient)
export default function PromoCarousel({ items = [], interval = 4500 }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);
  const n = items.length;

  useEffect(() => {
    if (n <= 1 || paused) return;
    timer.current = setInterval(() => setI((x) => (x + 1) % n), interval);
    return () => clearInterval(timer.current);
  }, [n, paused, interval]);

  // ถ้าจำนวน slide ลดลง กัน index เกิน
  useEffect(() => {
    if (i >= n && n > 0) setI(0);
  }, [n, i]);

  if (n === 0) {
    return (
      <div className="promo-carousel empty">
        <div className="pc-empty">
          <div className="pc-empty-ico">🧧</div>
          <div>ยังไม่มีรูปโปรโมชั่น</div>
          <div className="muted">ตั้งค่ารูปได้ที่เมนู “โปรโมชั่น” หรือ “คอร์ส”</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="promo-carousel corner-cn"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pc-track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {items.map((it, idx) => (
          <div className="pc-slide" key={idx}>
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image} alt={it.title || "promo"} />
            ) : (
              <div className="pc-fallback">
                <span className="pc-fallback-mark">☯</span>
              </div>
            )}
            <div className="pc-caption">
              {it.kind && <span className="pc-kind">{it.kind}</span>}
              <div className="pc-title">{it.title}</div>
              {it.subtitle && <div className="pc-sub">{it.subtitle}</div>}
            </div>
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button className="pc-arrow left" onClick={() => setI((x) => (x - 1 + n) % n)} aria-label="prev">‹</button>
          <button className="pc-arrow right" onClick={() => setI((x) => (x + 1) % n)} aria-label="next">›</button>
          <div className="pc-dots">
            {items.map((_, idx) => (
              <button
                key={idx}
                className={`pc-dot ${idx === i ? "on" : ""}`}
                onClick={() => setI(idx)}
                aria-label={`slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
