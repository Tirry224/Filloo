import { ImageResponse } from "next/og";

/**
 * L'aperçu d'un lien vers Filloo partagé sur WhatsApp, Facebook ou
 * Messenger. Sans lui, « filloo.net » s'affichait sans image (constaté le
 * 2026-10-15). Une fiche produit ou boutique garde sa propre photo
 * (`generateMetadata`).
 *
 * Les couleurs sont celles de `tokens.css`, en hexadécimal : le moteur de
 * `ImageResponse` ne lit pas `oklch`.
 */
export const alt = "Filloo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#f1f5fa",
          color: "#182b49",
        }}
      >
        <div style={{ fontSize: 150, fontWeight: 800, color: "#182b49", letterSpacing: -4 }}>Filloo</div>
        <div style={{ marginTop: 24, fontSize: 56, fontWeight: 600, lineHeight: 1.2 }}>
          Trouvez des produits et des commerçants près de chez vous
        </div>
        <div style={{ marginTop: 32, fontSize: 36, color: "#334155" }}>
          Parcourez le catalogue, contactez le vendeur. En Guinée.
        </div>
      </div>
    ),
    size,
  );
}
