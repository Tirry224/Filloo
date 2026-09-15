"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { productImageUrl } from "@/lib/storage";

type Slot = {
  id: string;
  previewUrl: string;
  /** Chemin dans Storage une fois l'envoi terminé ; `null` en cours d'envoi
   * ou en cas d'échec. */
  path: string | null;
  uploading: boolean;
  error: string | null;
};

/**
 * Sélecteur de 1 à 3 photos — écran 24, décision 15 de docs/SPEC.md.
 *
 * La compression tourne dans le navigateur, dans un worker
 * (`useWebWorker: true`) pour ne pas geler l'interface sur un téléphone
 * d'entrée de gamme, PUIS l'envoi vers Supabase Storage se fait aussi
 * depuis le navigateur — directement, sans repasser par le serveur Next,
 * qui n'aurait fait que relayer un fichier déjà prêt. Seul le CHEMIN
 * obtenu voyage ensuite dans le formulaire (`imagePaths`, un champ caché
 * par photo), lu par `createProductAction` / `updateProductAction`.
 *
 * `productId` est déjà connu au moment où cette photo s'envoie — généré
 * côté navigateur par `ProductForm` pour un nouveau produit — ce qui
 * respecte la convention de chemin imposée par le RLS du stockage
 * (`product-images/{merchant_id}/{product_id}/{fichier}`, voir
 * 0004_storage.sql) sans attendre que la ligne `products` existe.
 */
export function PhotoPicker({
  merchantId,
  productId,
  initialPaths = [],
}: {
  merchantId: string;
  productId: string;
  initialPaths?: string[];
}) {
  const [slots, setSlots] = useState<Slot[]>(
    initialPaths.map((path) => ({
      id: path,
      previewUrl: productImageUrl(path),
      path,
      uploading: false,
      error: null,
    })),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const room = 3 - slots.length;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, room);

    const added: Slot[] = files.map((file) => ({
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      path: null,
      uploading: true,
      error: null,
    }));
    setSlots((s) => [...s, ...added]);

    await Promise.all(
      files.map(async (file, i) => {
        const slot = added[i];
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
            fileType: "image/webp",
          });
          const path = `${merchantId}/${productId}/${slot.id}.webp`;
          const supabase = createClient();
          const { error } = await supabase.storage
            .from("product-images")
            .upload(path, compressed, { contentType: "image/webp" });
          if (error) throw error;
          setSlots((s) => s.map((x) => (x.id === slot.id ? { ...x, path, uploading: false } : x)));
        } catch {
          setSlots((s) =>
            s.map((x) => (x.id === slot.id ? { ...x, uploading: false, error: "Échec de l'envoi." } : x)),
          );
        }
      }),
    );
  }

  /**
   * Retirer une photo du formulaire — et RIEN d'autre.
   *
   * Le fichier était supprimé de Storage ici même, au clic. Sur un produit
   * qu'on modifie, ses photos sont déjà référencées par `product_images` :
   * retirer une photo puis quitter l'écran sans enregistrer — ou perdre le
   * réseau à l'enregistrement — détruisait le fichier en laissant la ligne
   * en base. Le produit restait publié avec une vignette cassée dans le
   * catalogue public, et rien ne pouvait plus la réparer : le fichier
   * n'existait plus nulle part.
   *
   * Le formulaire ne décide donc plus de rien : il propose une liste, et
   * c'est l'ENREGISTREMENT qui tranche. `updateProductAction` remplace les
   * lignes `product_images`, puis supprime dans Storage les fichiers que
   * plus aucune ligne ne référence — dans cet ordre, jamais l'inverse.
   *
   * Le cas symétrique reste ouvert et il est bénin : une photo envoyée puis
   * retirée avant tout enregistrement laisse un fichier orphelin dans
   * Storage. Un octet en trop ne casse aucun écran ; une référence morte,
   * si. Entre les deux erreurs possibles, on choisit celle qui ne se voit
   * pas.
   */
  function removeSlot(id: string) {
    setSlots((s) => s.filter((x) => x.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        {slots.map((slot) => (
          <div key={slot.id} className="relative">
            {slot.path ? <input type="hidden" name="imagePaths" value={slot.path} /> : null}
            {/* `<img>` brut plutôt que le composant `Photo` (qui passe par
                `next/image`) : un aperçu local est une URL `blob:`, que
                `next/image` ne sait pas optimiser — et il n'y a ici rien à
                optimiser, l'image finale sera servie depuis Storage. */}
            <img
              src={slot.previewUrl}
              alt=""
              className="size-25 rounded-lg object-cover"
            />
            {slot.uploading ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-ink/40 text-2xs font-medium text-paper">
                Envoi…
              </div>
            ) : null}
            {slot.error ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-danger/80 p-1 text-center text-2xs font-medium text-paper">
                {slot.error}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => removeSlot(slot.id)}
              aria-label="Retirer la photo"
              className="absolute -top-1.5 -right-1.5 flex size-6 cursor-pointer items-center justify-center rounded-full bg-ink text-paper"
            >
              <X size={13} strokeWidth={2.6} aria-hidden />
            </button>
          </div>
        ))}
        {room > 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Ajouter une photo"
            className="flex size-25 cursor-pointer items-center justify-center rounded-lg border border-dashed border-line text-ink-soft"
          >
            <Plus size={24} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {slots.length === 0 ? (
        <p className="text-xs text-danger">Sans photo, un produit ne se vend pas.</p>
      ) : null}
    </div>
  );
}
