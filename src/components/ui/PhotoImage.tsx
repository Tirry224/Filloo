"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";

export function PhotoImage({
  src,
  alt,
  sizes,
  priority,
  iconSize,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority: boolean;
  iconSize: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ImageIcon size={iconSize} strokeWidth={1.5} aria-hidden />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
