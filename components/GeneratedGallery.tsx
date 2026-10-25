"use client";

import Image from "next/image";
import { useState } from "react";
import {
  EDIT_GALLERY,
  HOME_GALLERY,
  type GalleryEditPair,
  type GalleryImage,
} from "../lib/gallery-display";
import styles from "./GeneratedGallery.module.css";

type GalleryPromptDetail = {
  prompt: string;
  kind: "image";
};

function selectGalleryPrompt(prompt: string) {
  window.dispatchEvent(
    new CustomEvent<GalleryPromptDetail>("ovanto:gallery-prompt", {
      detail: { prompt, kind: "image" },
    }),
  );
}

function GalleryImageCard({ image, index }: { image: GalleryImage; index: number }) {
  const isPriority = index < 3;

  return (
    <figure className={styles.imageCard}>
      <button
        type="button"
        className={styles.imageButton}
        onClick={() => selectGalleryPrompt(image.prompt)}
        aria-label={`Use the ${image.theme} prompt`}
      >
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw"
          unoptimized
          fetchPriority={isPriority ? "high" : "auto"}
          loading={isPriority ? "eager" : "lazy"}
          decoding={isPriority ? "auto" : "async"}
        />
      </button>
      <figcaption className={styles.imageCaption}>{image.caption}</figcaption>
    </figure>
  );
}

export function GeneratedImageGallery() {
  return (
    <div className={styles.imageGrid} aria-label="Generated image gallery">
      {HOME_GALLERY.map((image, index) => (
        <GalleryImageCard key={image.id} image={image} index={index} />
      ))}
    </div>
  );
}

function EditComparison({ pair }: { pair: GalleryEditPair }) {
  const [value, setValue] = useState(50);
  const clipPath = `inset(0 0 0 ${value}%)`;

  return (
    <figure className={styles.editCard}>
      <div
        className={styles.comparison}
        style={{ aspectRatio: `${pair.width} / ${pair.height}` }}
      >
        <Image
          className={styles.comparisonImage}
          src={pair.beforeSrc}
          alt={pair.beforeAlt}
          width={pair.width}
          height={pair.height}
          sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw"
          unoptimized
          loading="lazy"
          decoding="async"
        />
        <div className={styles.afterLayer} style={{ clipPath }}>
          <Image
            className={styles.comparisonImage}
            src={pair.afterSrc}
            alt={pair.afterAlt}
            width={pair.width}
            height={pair.height}
            sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw"
            unoptimized
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className={styles.comparisonLabels} aria-hidden="true">
          <span>Before</span>
          <span>After</span>
        </div>
        <div
          className={styles.comparisonDivider}
          style={{ left: `${value}%` }}
          aria-hidden="true"
        />
        <input
          className={styles.comparisonRange}
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          aria-label={`Compare original and edited photo: ${pair.theme}`}
          aria-valuetext={`${value}% original, ${100 - value}% edited`}
          aria-describedby={`edit-caption-${pair.id}`}
        />
      </div>
      <figcaption id={`edit-caption-${pair.id}`} className={styles.editCaption}>
        <strong>{pair.theme}</strong>
        <span>{pair.summary}</span>
      </figcaption>
    </figure>
  );
}

export function GeneratedEditGallery() {
  return (
    <div className={styles.editGrid} aria-label="Before and after image gallery">
      {EDIT_GALLERY.map((pair) => (
        <EditComparison key={pair.id} pair={pair} />
      ))}
    </div>
  );
}
