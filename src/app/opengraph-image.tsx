import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TRACES_LOGO, VIEWBOX_LOGO } from "@/lib/logo";

/**
 * L'aperçu d'un lien vers Filloo partagé sur WhatsApp, Facebook ou
 * Messenger. Sans lui, « filloo.net » s'affichait sans image (constaté le
 * 2026-10-15). Une fiche produit ou boutique garde sa propre photo
 * (`generateMetadata`), et reprend celle-ci quand elle n'en a pas.
 *
 * Refaite le 2026-11-12 (choix du porteur du projet : une carte Filloo
 * plus travaillée, sans photo de produit). Tout est CENTRÉ : WhatsApp
 * montre souvent l'aperçu en petite vignette carrée découpée au milieu,
 * et « Filloo » doit y rester lisible.
 *
 * Les couleurs sont celles de `tokens.css`, en hexadécimal : le moteur de
 * `ImageResponse` ne lit pas `oklch`.
 */
export const alt = "Filloo — vêtements, chaussures et accessoires en Guinée";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Figtree, la police du site (`app/layout.tsx`) : sans elle, le moteur
   prend une police fine sans gras, et « Filloo » ne ressemble plus au
   logo. Fichiers `.woff` (le moteur ne lit pas le `.woff2`), sous-ensemble
   latin, accents français compris ; licence OFL dans `assets/fonts`. */
const police = (graisse: 700 | 800) =>
  readFile(join(process.cwd(), `assets/fonts/figtree-latin-${graisse}-normal.woff`));

const INDIGO = "#182b49";
const MANGUE = "#f4a62a";
const VERT = "#10b981";
const BLANC = "#ffffff";

/** Une pastille décorative, à moitié hors du cadre. */
function Rond({ taille, couleur, style }: { taille: number; couleur: string; style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: taille,
        height: taille,
        borderRadius: taille,
        background: couleur,
        ...style,
      }}
    />
  );
}

export default async function Image() {
  const [gras, extraGras] = await Promise.all([police(700), police(800)]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: INDIGO,
          color: BLANC,
          fontFamily: "Figtree",
        }}
      >
        <Rond taille={360} couleur={MANGUE} style={{ top: -170, left: -120, opacity: 0.95 }} />
        <Rond taille={260} couleur={VERT} style={{ bottom: -120, right: -60, opacity: 0.9 }} />
        <Rond taille={90} couleur={MANGUE} style={{ bottom: 70, left: 110 }} />

        {/* Le logo officiel (2026-11-13), à la place du mot écrit en Figtree. */}
        <svg width={381} height={240} viewBox={VIEWBOX_LOGO}>
          <g fill={BLANC} fillRule="evenodd">
            {TRACES_LOGO.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </svg>

        <div style={{ marginTop: 26, fontSize: 54, fontWeight: 700, textAlign: "center" }}>
          Achetez et vendez la mode en Guinée
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 36 }}>
          {["Vêtements", "Chaussures", "Accessoires"].map((mot) => (
            <div
              key={mot}
              style={{
                fontSize: 32,
                fontWeight: 700,
                padding: "10px 28px",
                borderRadius: 999,
                border: `3px solid ${BLANC}`,
              }}
            >
              {mot}
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", bottom: 36, fontSize: 30, fontWeight: 700, color: MANGUE }}>
          filloo.net
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Figtree", data: gras, weight: 700, style: "normal" },
        { name: "Figtree", data: extraGras, weight: 800, style: "normal" },
      ],
    },
  );
}
