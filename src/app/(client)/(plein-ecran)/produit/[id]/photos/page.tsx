import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Image as ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/data/products";
import { cn } from "@/lib/cn";

/**
 * Écran 9 — galerie plein écran.
 *
 * Seul écran de l'application sur fond sombre : quand on regarde une
 * photo, tout le reste doit disparaître. Les couleurs sont donc écrites
 * ici en clair et non prises dans les tokens — c'est une exception
 * assumée, pas un oubli. Si elle se reproduisait ailleurs, il faudrait en
 * faire des tokens.
 */
export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photo?: string }>;
}) {
  const { id } = await params;
  const { photo = "1" } = await searchParams;
  const supabase = await createClient();
  const product = await getProduct(supabase, id);
  if (!product) notFound();

  const photos = product.imageUrls;
  /* `?photo=99` ou `?photo=chat` : on ramène dans les bornes plutôt que
     d'afficher une erreur. Une URL bricolée à la main ne doit pas casser
     l'écran, juste montrer une photo qui existe. */
  const current = Math.min(Math.max(Number(photo) || 1, 1), Math.max(photos.length, 1));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-app flex-col bg-[#12100e]">
      <div className="flex shrink-0 items-center justify-between p-4">
        <Link href={`/produit/${product.id}`} aria-label="Fermer" className="text-white">
          <X size={24} strokeWidth={2} />
        </Link>
        <span className="text-sm font-medium text-white/65">
          {current} / {photos.length}
        </span>
        <span className="w-6" />
      </div>

      <div className="relative flex flex-1 items-center justify-center text-white/25">
        {photos.length > 0 ? (
          /* `object-contain` et non `cover` : dans une galerie on veut voir
             la photo entière, quitte à laisser des bandes noires. Rogner le
             produit qu'on cherche justement à examiner serait absurde. */
          <Image
            src={photos[current - 1]}
            alt={`${product.title} — photo ${current}`}
            fill
            sizes="100vw"
            priority
            className="object-contain"
          />
        ) : (
          <ImageIcon size={56} strokeWidth={1.2} aria-hidden />
        )}
      </div>

      {photos.length > 1 ? (
        <div className="flex shrink-0 gap-2.5 p-4">
          {photos.map((url, i) => (
            <Link
              key={url}
              href={`/produit/${product.id}/photos?photo=${i + 1}`}
              aria-label={`Photo ${i + 1}`}
              className={cn(
                "relative size-16 overflow-hidden rounded-md bg-white/10",
                i + 1 === current && "ring-2 ring-white",
              )}
            >
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
