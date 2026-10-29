"use client";
import { useEffect, useRef, useState } from "react";
import { AircraftImage } from "@/components/aircraft-image";
type PhotoDetails = {
  registration?: string;
  icao_type?: string;
  type?: string;
  url_photo?: string;
  url_photo_thumbnail?: string;
};
// Expanded visits share a lookup by registration. Only on-screen visits fetch.
const photoLookups = new Map<string, Promise<PhotoDetails | null>>();
function lookupPhoto(registration: string) {
  const cached = photoLookups.get(registration);
  if (cached) return cached;
  const pending = fetch(
    `/api/details?registration=${encodeURIComponent(registration)}`,
  )
    .then(async (response) => {
      if (!response.ok) throw new Error("Photo lookup unavailable");
      const data = (await response.json()) as {
        aircraft?: PhotoDetails | null;
      };
      return data.aircraft ?? null;
    })
    .catch(() => {
      photoLookups.delete(registration);
      return null;
    });
  if (photoLookups.size >= 200)
    photoLookups.delete(photoLookups.keys().next().value!);
  photoLookups.set(registration, pending);
  return pending;
}
export function SightingPhoto({
  registration,
  type,
  model,
}: {
  registration?: string;
  type: string;
  model: string;
}) {
  const node = useRef<HTMLDivElement>(null),
    [photo, setPhoto] = useState<PhotoDetails | null>(null);
  useEffect(() => {
    if (!registration || !node.current) return;
    let active = true;
    const load = () => {
      void lookupPhoto(registration).then((value) => {
        if (active) setPhoto(value);
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(node.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [registration]);
  const normalize = (value?: string) =>
    value?.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const matches =
    !!registration &&
    normalize(photo?.registration) === normalize(registration);
  return (
    <div ref={node} className="sighting-photo">
      <AircraftImage
        registration={registration}
        type={type === "UNKNOWN" ? photo?.icao_type : type}
        model={model}
        exactPhoto={matches ? photo?.url_photo : undefined}
        exactThumbnail={matches ? photo?.url_photo_thumbnail : undefined}
        priority={false}
      />
    </div>
  );
}
