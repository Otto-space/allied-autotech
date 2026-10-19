"use client";
import Image from "next/image";
import { useState } from "react";
import { reviewerInitials } from "@/lib/reviews/presentation";
import "./reviewer-avatar.css";

export function ReviewerAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="reviewer-avatar" aria-hidden="true">
      {photoUrl && !failed ? (
        <Image
          src={photoUrl}
          alt=""
          width={48}
          height={48}
          unoptimized
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        reviewerInitials(name)
      )}
    </span>
  );
}
