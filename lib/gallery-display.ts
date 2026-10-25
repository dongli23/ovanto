export type GalleryImage = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  theme: string;
  summary: string;
  prompt: string;
  caption: string;
};

export const HOME_GALLERY: readonly GalleryImage[] = [
  {
    id: "image-01",
    src: "/gallery/image/pet-portrait-window.webp",
    width: 1024,
    height: 1024,
    alt: "A brown-and-white dog beside a sleeping ginger cat in window light.",
    theme: "pet-portrait",
    summary: "warm window light",
    prompt:
      "A gentle portrait of a fictional rescue dog beside a sleepy cat in soft window light, soft side lighting, centered square composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Pet portrait · warm window light",
  },
  {
    id: "image-03",
    src: "/gallery/image/ceramic-cup-morning.webp",
    width: 1024,
    height: 1024,
    alt: "A sculptural ceramic cup and folded linen on a quiet sunlit table.",
    theme: "product-still-life",
    summary: "morning light",
    prompt:
      "A sculptural ceramic cup and folded linen on a quiet sunlit table, soft side lighting, centered square composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Product still life · morning light",
  },
  {
    id: "image-05",
    src: "/gallery/image/coffee-shop-morning.webp",
    width: 1024,
    height: 1024,
    alt: "A warm European coffee shop interior with empty tables and morning light.",
    theme: "interior-space",
    summary: "warm morning light",
    prompt:
      "A calm European coffee shop interior with warm morning light and empty tables, soft side lighting, centered square composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Interior space · warm morning light",
  },
  {
    id: "image-08",
    src: "/gallery/image/fruit-tart-daylight.webp",
    width: 1024,
    height: 1024,
    alt: "A rustic fruit tart with berries on a handmade plate in close view.",
    theme: "food-close-up",
    summary: "fresh daylight",
    prompt:
      "A close-up of a rustic fruit tart with fresh berries on a handmade plate, cool window rim light, balanced off-center composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Food close-up · fresh daylight",
  },
  {
    id: "image-10",
    src: "/gallery/image/alpine-lake-dawn.webp",
    width: 1024,
    height: 1024,
    alt: "Misty alpine hills and a clear lake at dawn.",
    theme: "landscape",
    summary: "misty dawn",
    prompt:
      "Misty alpine hills and a clear lake at dawn, wide cinematic landscape, cool window rim light, balanced off-center composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Landscape · misty dawn",
  },
  {
    id: "image-11",
    src: "/gallery/image/stone-courtyard-afternoon.webp",
    width: 896,
    height: 896,
    alt: "A contemporary stone courtyard with arches, plants and long shadows.",
    theme: "architecture",
    summary: "afternoon shadows",
    prompt:
      "A contemporary stone courtyard with arches, plants, and long afternoon shadows, soft side lighting, centered square composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Architecture · afternoon shadows",
  },
  {
    id: "image-14",
    src: "/gallery/image/woven-backpack-studio.webp",
    width: 1024,
    height: 1024,
    alt: "A woven travel backpack photographed against a neutral studio background.",
    theme: "ecommerce-product",
    summary: "neutral studio",
    prompt:
      "A neutral studio product photograph of a woven travel backpack with no markings, cool window rim light, balanced off-center composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "E-commerce product · neutral studio",
  },
  {
    id: "image-15",
    src: "/gallery/image/bicycle-flat-sun.webp",
    width: 1024,
    height: 1024,
    alt: "A flat geometric bicycle illustration with leaves and a bright sun.",
    theme: "flat-illustration",
    summary: "bright geometric color",
    prompt:
      "A flat geometric illustration of a bicycle, leaves, and a bright sun, soft side lighting, centered square composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Flat illustration · bright geometric color",
  },
  {
    id: "image-17",
    src: "/gallery/image/glass-terrarium-softlight.webp",
    width: 1024,
    height: 1024,
    alt: "A translucent glass terrarium displayed on a plain pedestal in soft light.",
    theme: "three-d-render",
    summary: "soft studio light",
    prompt:
      "A small translucent glass terrarium rendered in polished 3D on a plain pedestal, soft side lighting, centered square composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "3D rendered object · soft studio light",
  },
  {
    id: "image-20",
    src: "/gallery/image/anonymous-street-backview.webp",
    width: 512,
    height: 512,
    alt: "A person in a wool coat seen from behind in bright daylight.",
    theme: "vintage-film-portrait",
    summary: "quiet street",
    prompt:
      "A fictional person seen from behind in a wool coat on a quiet street, vintage film grain, cool window rim light, balanced off-center composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Vintage film portrait · quiet street",
  },
  {
    id: "image-22",
    src: "/gallery/image/autumn-forest-overcast.webp",
    width: 1024,
    height: 1024,
    alt: "An autumn forest path with amber leaves and distant hills.",
    theme: "seasonal-landscape",
    summary: "autumn forest",
    prompt:
      "An autumn forest path with amber leaves, distant hills, and soft overcast light, cool window rim light, balanced off-center composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Seasonal landscape · autumn forest",
  },
  {
    id: "image-23",
    src: "/gallery/image/mineral-pigment-macro.webp",
    width: 512,
    height: 512,
    alt: "A macro mineral texture with layered teal, ochre and cream pigments.",
    theme: "abstract-texture",
    summary: "layered mineral color",
    prompt:
      "An abstract macro texture of layered mineral pigments in teal, ochre, and cream, soft side lighting, centered square composition, tactile editorial detail, natural color; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    caption: "Abstract texture · layered mineral color",
  },
] as const satisfies readonly GalleryImage[];

export type GalleryEditPair = {
  id: string;
  beforeSrc: string;
  afterSrc: string;
  width: number;
  height: number;
  beforeAlt: string;
  afterAlt: string;
  instruction: string;
  summary: string;
  theme: string;
};

export const EDIT_GALLERY: readonly GalleryEditPair[] = [
  {
    id: "edit-01",
    beforeSrc: "/gallery/edit/edit-01-before.webp",
    afterSrc: "/gallery/edit/edit-01-after.webp",
    width: 1024,
    height: 1024,
    beforeAlt: "A plain ceramic vase on a small table in a studio setting.",
    afterAlt: "The same ceramic vase against a warm ivory solid background.",
    instruction:
      "Remove the background and replace it with a single warm ivory solid color while preserving the vase, framing, and shadows. Apply the camera centered with gentle left-side light treatment while preserving the original composition. Keep the same seed semantics.; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    summary: "Background replaced with warm ivory.",
    theme: "background-solid",
  },
  {
    id: "edit-03",
    beforeSrc: "/gallery/edit/edit-03-before.webp",
    afterSrc: "/gallery/edit/edit-03-after.webp",
    width: 1024,
    height: 1024,
    beforeAlt: "A stone courtyard with a leafy arch and clear daylight.",
    afterAlt: "The same courtyard under warm blue-and-amber dusk light.",
    instruction:
      "Change the daylight to a warm blue-and-amber dusk while preserving the exact architecture, camera angle, and composition. Apply the camera centered with gentle left-side light treatment while preserving the original composition. Keep the same seed semantics.; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    summary: "Daylight shifted to blue-and-amber dusk.",
    theme: "day-to-dusk",
  },
  {
    id: "edit-05",
    beforeSrc: "/gallery/edit/edit-05-before.webp",
    afterSrc: "/gallery/edit/edit-05-after.webp",
    width: 1024,
    height: 1024,
    beforeAlt: "A faded picnic scene with distant anonymous figures seen from behind.",
    afterAlt: "A restored picnic scene with gentle contrast and anonymous silhouettes.",
    instruction:
      "Restore gentle contrast, remove dust and scratches, and preserve the original framing and anonymous silhouettes without adding any faces. Apply the camera centered with gentle left-side light treatment while preserving the original composition. Keep the same seed semantics.; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    summary: "Faded photo restored with gentle contrast.",
    theme: "photo-restoration",
  },
  {
    id: "edit-07",
    beforeSrc: "/gallery/edit/edit-07-before.webp",
    afterSrc: "/gallery/edit/edit-07-after.webp",
    width: 640,
    height: 640,
    beforeAlt: "A mountain cabin beside green trees under a clear summer sky.",
    afterAlt: "The same mountain cabin in a snowy winter landscape.",
    instruction:
      "Turn the season into a snowy winter scene while preserving the cabin, camera position, and composition. Apply the camera centered with gentle left-side light treatment while preserving the original composition. Keep the same seed semantics.; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    summary: "Summer scene changed to snowy winter.",
    theme: "summer-to-winter",
  },
  {
    id: "edit-09",
    beforeSrc: "/gallery/edit/edit-09-before.webp",
    afterSrc: "/gallery/edit/edit-09-after.webp",
    width: 1024,
    height: 1024,
    beforeAlt: "Pears, linen cloth and a ceramic bowl arranged on a plain table.",
    afterAlt: "The same still life rendered as a delicate watercolor illustration.",
    instruction:
      "Transform the same composition into a delicate watercolor illustration while preserving object placement and proportions. Apply the camera centered with gentle left-side light treatment while preserving the original composition. Keep the same seed semantics.; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    summary: "Still life transformed into watercolor.",
    theme: "watercolor",
  },
  {
    id: "edit-11",
    beforeSrc: "/gallery/edit/edit-11-before.webp",
    afterSrc: "/gallery/edit/edit-11-after.webp",
    width: 1024,
    height: 1024,
    beforeAlt: "An unmarked glass bottle on a neutral studio surface.",
    afterAlt: "The same unmarked bottle on a soft pale-blue studio background.",
    instruction:
      "Place the same unmarked bottle on a soft pale-blue studio background while preserving its silhouette, position, and lighting direction. Apply the camera centered with gentle left-side light treatment while preserving the original composition. Keep the same seed semantics.; No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.",
    summary: "Bottle placed on a pale-blue background.",
    theme: "product-background",
  },
] as const satisfies readonly GalleryEditPair[];
