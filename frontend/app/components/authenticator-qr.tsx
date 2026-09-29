"use client";
import { useEffect, useRef, useState } from "react";

export function AuthenticatorQr({ uri }: { uri: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const target = canvas.current;
    void import("qrcode")
      .then(async (qr) => {
        if (active && target)
          await qr.toCanvas(target, uri, {
            width: 224,
            margin: 4,
            errorCorrectionLevel: "M",
          });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      target?.getContext("2d")?.clearRect(0, 0, target.width, target.height);
    };
  }, [uri]);
  return (
    <div className="authenticator-qr">
      {failed ? (
        <p role="status">The QR code could not be displayed. Use the setup key below.</p>
      ) : (
        <canvas
          ref={canvas}
          role="img"
          aria-label="Authenticator setup QR code. Alternatively, enter the setup key below."
        />
      )}
    </div>
  );
}
