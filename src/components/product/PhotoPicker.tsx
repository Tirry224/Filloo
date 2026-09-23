"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { productImageUrl } from "@/lib/storage";

type Slot = {
  id: string;
  previewUrl: string;
  path: string | null;
  uploading: boolean;
  error: string | null;
};

/**
 * `productId` est généré par `ProductForm` avant l'envoi : le chemin imposé
 * par le RLS du stockage (`{merchant_id}/{product_id}/…`, 0004) n'attend
 * donc pas que la ligne `products` existe.
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
   * Retirer une photo du formulaire — et RIEN d'autre : supprimer le
   * fichier ici casserait la vignette d'un produit publié dès qu'on quitte
   * l'écran sans enregistrer. C'est l'ENREGISTREMENT qui tranche
   * (`updateProductAction`).
   */
  function removeSlot(id: string) {
    setSlots((s) => s.filter((x) => x.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* `flex-wrap` pour les très petits téléphones : trois vignettes de
          100 px et deux écarts font 324 px, quand un écran de 320 px n'en
          offre que 288 une fois les marges prises. Sans ça, la troisième
          photo sortait de l'écran. */}
      <div className="flex flex-wrap gap-3">
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
