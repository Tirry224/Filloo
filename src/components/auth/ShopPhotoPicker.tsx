"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { compresserPhoto } from "@/lib/compression";
import { createClient } from "@/lib/supabase/client";
import { SHOP_PHOTOS_BUCKET, shopPhotoUrl } from "@/lib/storage";

/**
 * La photo de profil d'une boutique, dans « Modifier ma boutique ».
 *
 * Même principe que `PhotoPicker` : le fichier part dès qu'on le choisit,
 * mais c'est l'ENREGISTREMENT du formulaire qui l'adopte
 * (`updateMerchantAction`). Quitter l'écran sans enregistrer laisse donc
 * la photo en ligne inchangée ; le fichier envoyé pour rien est effacé au
 * prochain enregistrement.
 *
 * `photoPath` vide = « pas de photo » : c'est ainsi que « Retirer »
 * voyage jusqu'au serveur.
 */
export function ShopPhotoPicker({
  merchantId,
  shopName,
  initialPath,
}: {
  merchantId: string;
  shopName: string;
  initialPath: string | null;
}) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [preview, setPreview] = useState<string | null>(initialPath ? shopPhotoUrl(initialPath) : null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    try {
      // Un avatar s'affiche à 64 px au plus : 512 px couvrent les écrans
      // denses sans envoyer une photo de 3 Mo depuis un forfait mobile.
      const { fichier, extension } = await compresserPhoto(file, { maxSizeMB: 0.2, maxWidthOrHeight: 512 });
      const newPath = `${merchantId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await createClient()
        .storage.from(SHOP_PHOTOS_BUCKET)
        .upload(newPath, fichier, { contentType: fichier.type });
      if (uploadError) throw uploadError;
      setPath(newPath);
    } catch (e) {
      console.error("[photo boutique] envoi échoué :", e);
      setError("Échec de l'envoi. Réessayez.");
      setPreview(path ? shopPhotoUrl(path) : null);
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    setPath(null);
    setPreview(null);
    setError(null);
  }

  return (
    <div className="flex items-center gap-3.5">
      <input type="hidden" name="photoPath" value={path ?? ""} />
      {uploading ? <input type="hidden" name="photoEnCours" value="1" /> : null}

      <div className="relative">
        {/* `<img>` brut pendant l'aperçu : une URL `blob:` que `next/image`
            ne sait pas servir (même raison que dans `PhotoPicker`). */}
        {preview?.startsWith("blob:") ? (
          <img src={preview} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <Avatar name={shopName} kind="shop" size={64} src={preview} />
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/40 text-2xs font-medium text-paper">
            Envoi…
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex cursor-pointer items-center gap-1.5 text-base font-semibold text-accent disabled:opacity-50"
        >
          <Camera size={16} strokeWidth={2.2} aria-hidden />
          {path ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {path && !uploading ? (
          <button type="button" onClick={remove} className="cursor-pointer text-sm text-ink-soft underline">
            Retirer la photo
          </button>
        ) : null}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
