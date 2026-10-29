"use client";
import Image from "next/image";
import { CameraOff } from "lucide-react";
import { useState } from "react";
import referencePhotos from "@/lib/aircraft-photos.json";
type ReferencePhoto = {
  src: string;
  label: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
  title: string;
  changes: string;
};
export function AircraftImage({
  registration,
  type,
  exactPhoto,
  exactThumbnail,
  model,
  variant = "panel",
  priority = true,
}: {
  registration?: string;
  type?: string;
  exactPhoto?: string;
  exactThumbnail?: string;
  model: string;
  variant?: "panel" | "thumbnail";
  priority?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const reference = (referencePhotos as Record<string, ReferencePhoto>)[
    type?.toUpperCase() ?? ""
  ];
  const exact = [exactPhoto, exactThumbnail].filter(
    (src): src is string => !!src && /^https?:\/\//.test(src),
  );
  const candidates = [
    ...exact.map((src) => ({ src, exact: true })),
    ...(reference ? [{ src: reference.src, exact: false }] : []),
  ];
  const photo = candidates.find((p) => !failed.includes(p.src));
  if (variant === "thumbnail")
    return (
      <span
        className="aircraft-thumbnail"
        title={
          reference
            ? `${reference.label} reference. Photo: ${reference.author}, ${reference.license}. Expand to see aircraft photos and credits.`
            : "No reference photo available"
        }
      >
        {photo ? (
          <Image
            src={photo.src}
            alt={`${reference?.label || model} reference photograph`}
            fill
            sizes="(max-width:700px) 60px, 96px"
            unoptimized
            loading="lazy"
            onError={() => setFailed((previous) => [...previous, photo.src])}
          />
        ) : (
          <CameraOff size={19} />
        )}
      </span>
    );
  return (
    <figure className="aircraft-photo">
      {photo ? (
        <>
          <a
            className="aircraft-photo-frame"
            href={photo.exact ? photo.src : reference.source}
            target="_blank"
            rel="noreferrer"
            aria-label={
              photo.exact
                ? `Open photo of ${registration || model}`
                : `Open ${reference.label} reference photo and credits`
            }
          >
            <Image
              src={photo.src}
              alt={
                photo.exact
                  ? `${registration || "Selected aircraft"} — registration-matched photograph`
                  : `${reference.label} — representative model photo; different registration or livery`
              }
              fill
              sizes="(max-width:700px) 350px, 400px"
              unoptimized
              priority={priority}
              onError={() =>
                setFailed((previous) =>
                  previous.includes(photo.src)
                    ? previous
                    : [...previous, photo.src],
                )
              }
            />
          </a>
          <figcaption>
            {photo.exact ? (
              <>
                <span>{registration || "Aircraft photograph"}</span>
                <a
                  href="https://www.airport-data.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Airport-data via ADSBDB ↗
                </a>
              </>
            ) : (
              <>
                <a
                  href={reference.source}
                  target="_blank"
                  rel="noreferrer"
                  title={`${reference.title}. Photo by ${reference.author}. ${reference.changes}`}
                >
                  Photo: {reference.author}
                </a>
                <a
                  href={reference.licenseUrl || reference.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  {reference.license}
                </a>
              </>
            )}
          </figcaption>
        </>
      ) : (
        <div className="aircraft-photo-unavailable">
          <CameraOff size={21} />
          <span>No photo available</span>
          <small>{model}</small>
        </div>
      )}
    </figure>
  );
}
