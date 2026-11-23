"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * Draws a QR code for `text` (generated in the browser, nothing is sent anywhere).
 * Medium error correction keeps it scannable even when the label is a bit worn.
 */
export function QrImage({ text, size = 160, alt }: { text: string; size?: number; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, { width: size * 2, margin: 1, errorCorrectionLevel: "M" })
      .then((dataUrl) => { if (!cancelled) setUrl(dataUrl); })
      .catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [text, size]);

  if (!url) return <div style={{ width: size, height: size }} className="animate-pulse rounded bg-muted" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} width={size} height={size} />;
}
