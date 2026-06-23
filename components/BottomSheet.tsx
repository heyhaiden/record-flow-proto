"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { color, radius, shadow } from "@/lib/design/tokens";

interface SheetLayout {
  sheetHeight: number;
  bodyMaxHeight: number;
  bodyScrollable: boolean;
}

/**
 * Slide-up sheet anchored inside the 480px frame. Used for the parcel switcher
 * and the voice gap-fill prompt. Tapping the scrim or the grab handle dismisses.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<SheetLayout | null>(null);

  useEffect(() => {
    if (!open) {
      setLayout(null);
      return;
    }

    const measure = () => {
      const parent = sheetRef.current?.parentElement;
      const containerHeight = parent?.clientHeight ?? window.innerHeight;
      const maxSheetHeight = Math.floor(containerHeight * 0.8);

      const handleHeight = handleRef.current?.offsetHeight ?? 0;
      const titleHeight = titleRef.current?.offsetHeight ?? 0;
      const footerHeight = footerRef.current?.offsetHeight ?? 0;
      const fixedHeight = handleHeight + titleHeight + footerHeight;
      const bodyNatural = bodyRef.current?.scrollHeight ?? 0;
      const bodyMaxHeight = Math.max(80, maxSheetHeight - fixedHeight);
      const bodyUsed = Math.min(bodyNatural, bodyMaxHeight);

      setLayout({
        sheetHeight: fixedHeight + bodyUsed,
        bodyMaxHeight,
        bodyScrollable: bodyNatural > bodyMaxHeight,
      });
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (bodyRef.current) observer.observe(bodyRef.current);
    if (titleRef.current) observer.observe(titleRef.current);
    if (footerRef.current) observer.observe(footerRef.current);
    if (sheetRef.current?.parentElement) observer.observe(sheetRef.current.parentElement);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children, footer, open, title]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(28,28,26,.28)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .25s ease",
          zIndex: 40,
        }}
      />
      <div
        ref={sheetRef}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: color.surface,
          borderRadius: `${radius.xxl} ${radius.xxl} 0 0`,
          boxShadow: shadow.sheet,
          transform: open ? "translateY(0)" : "translateY(110%)",
          transition: "transform .3s cubic-bezier(.34,1.2,.5,1), height .28s cubic-bezier(.22,1,.36,1)",
          zIndex: 41,
          height: layout ? `${layout.sheetHeight}px` : undefined,
          maxHeight: "80%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          ref={handleRef}
          onClick={onClose}
          style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", cursor: "grab", flex: "none" }}
        >
          <div style={{ width: "42px", height: "5px", borderRadius: "3px", background: "#d8d5cd" }} />
        </div>
        {title && (
          <div
            ref={titleRef}
            style={{
              padding: "4px 20px 12px",
              fontSize: "15px",
              fontWeight: 600,
              color: color.ink,
              borderBottom: `1.5px solid ${color.borderSoft}`,
              flex: "none",
            }}
          >
            {title}
          </div>
        )}
        <div
          ref={bodyRef}
          style={{
            flex: "none",
            maxHeight: layout?.bodyMaxHeight,
            overflowY: layout?.bodyScrollable ? "auto" : "visible",
            WebkitOverflowScrolling: "touch",
            padding: footer ? "12px 18px 8px" : "12px 18px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            ref={footerRef}
            style={{
              flex: "none",
              borderTop: `1.5px solid ${color.borderSoft}`,
              background: color.surface,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
