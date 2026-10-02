import Image from "next/image";
import { ROUTES } from "../lib/site";

const tools = [
  { title: "Image Generator", description: "Turn a description into an image.", href: "#image-workbench", image: "/examples/avatar.webp", note: "3 free images / day" },
  { title: "AI Video", description: "Create a short video from an idea.", href: ROUTES.fr, image: "/examples/landscape.webp", note: "French workspace · 5 seconds" },
  { title: "AI Photo Editor", description: "Upload a photo and describe a change.", href: ROUTES.frEdit, image: "/examples/sneaker.webp", note: "French workspace · image upload" },
];
// Keep the available model list explicit; add entries only when the workspace supports them.
const availableModels = [
  { name: "Flux Schnell", description: "Fast generation for everyday image creation.", details: "Text to image · square output · free daily allowance", href: "#image-workbench" },
];
const inspiration = [
  { src: "/examples/avatar.webp", name: "Portrait", detail: "Character, expression, color", alt: "Colorful illustrated character portrait" },
  { src: "/examples/sneaker.webp", name: "Product", detail: "Object, surface, light", alt: "Illustration of a white sneaker on a stone surface" },
  { src: "/examples/poster.svg", name: "Poster", detail: "Shape, balance, contrast", alt: "Original abstract poster concept with coral and mint geometric shapes" },
  { src: "/examples/interior.svg", name: "Interior", detail: "Space, materials, atmosphere", alt: "Original line illustration of a calm room with a chair and a large window" },
  { src: "/examples/landscape.webp", name: "Landscape", detail: "Place, season, time of day", alt: "Illustrated mountain landscape under a blue evening sky" },
  { src: "/examples/botanical.svg", name: "Illustration", detail: "A subject with a visual style", alt: "Original botanical illustration with mint leaves and a coral sun" },
];
const benefits = [
  { title: "No sign up", text: "Start your first image without an account or login.", icon: "M8 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M14 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 10l2 2 4-4" },
  { title: "Fast generation", text: "Flux Schnell gives a clear idea a quick visual starting point.", icon: "m14 3-9 11h7l-2 7 9-11h-7l2-7Z" },
  { title: "Simple controls", text: "One available model and a square format keep setup simple.", icon: "M4 7h16M4 17h16M8 4v6M16 14v6" },
  { title: "No profile needed", text: "Explore a first idea without filling out a personal profile.", icon: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3ZM8 12l3 3 5-6" },
  { title: "Multiple styles", text: "Describe a portrait, product scene, landscape or illustration.", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14l3 6h-6l3-6Z" },
  { title: "Browser based", text: "Describe, review and download in the same browser workspace.", icon: "M4 4h16v16H4zM4 9h16M7 6.5h.1M10 6.5h.1M9 14l-2 2 2 2M15 14l2 2-2 2" },
];

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="platform-heading"><p className="platform-eyebrow">{eyebrow}</p><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>;
}

export function HomePlatform() {
  return <div className="platform-sections">
    <section id="ai-tools" className="platform-section" aria-label="AI Tools">
      <SectionHeading eyebrow="AI Tools" title="A workspace for your next idea." description="Choose a real workflow. Keep the creative decisions yours." />
      <div className="platform-tool-grid">{tools.map(tool => <a className="platform-tool" href={tool.href} key={tool.title}>
        <div className="platform-tool-image"><Image src={tool.image} width={960} height={720} alt="" sizes="(max-width: 760px) 100vw, 33vw" loading="lazy" /><span>Explore <span aria-hidden="true">↗</span></span></div>
        <div className="platform-tool-copy"><h3>{tool.title}</h3><p>{tool.description}</p><small>{tool.note}</small></div>
      </a>)}</div>
      <p className="platform-note">Tool previews are concept illustrations. Video and photo editing currently open in French.</p>
    </section>
    <section id="ai-models" className="platform-section platform-model-section" aria-label="Available AI Models">
      <SectionHeading eyebrow="Available model" title="Less setup. More creating." description="The free image workspace uses one model, so you can focus on your prompt." />
      <div>{availableModels.map(model => <article className="platform-model" key={model.name}>
        <div className="model-monogram" aria-hidden="true">F<span>↗</span></div><div><span className="platform-status">Available now</span><h3>{model.name}</h3><p>{model.description}</p><small>{model.details}</small><a href={model.href}>Try it in the workspace <span aria-hidden="true">→</span></a></div>
      </article>)}</div>
    </section>
    <section id="inspiration" className="platform-section" aria-label="Inspiration">
      <SectionHeading eyebrow="Inspiration" title="Give your imagination a starting point." description="Six concept illustrations to help you think about subject, composition and mood. These are inspiration references, not a gallery of generated results." />
      <div className="inspiration-grid">{inspiration.map(item => <figure className="inspiration-card" key={item.name}>
        <Image src={item.src} width={960} height={720} alt={item.alt} sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw" loading="lazy" />
        <figcaption><strong>{item.name}</strong><span>{item.detail}</span></figcaption>
      </figure>)}</div>
    </section>
    <section id="core-benefits" className="platform-section" aria-label="Core benefits">
      <SectionHeading eyebrow="Made to be simple" title="A little less between you and the idea." />
      <div className="benefit-grid">{benefits.map(benefit => <article className="benefit" key={benefit.title}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={benefit.icon}/></svg><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}</div>
    </section>
    <section id="how-it-works" className="platform-section" aria-label="How it works">
      <SectionHeading eyebrow="How it works" title="From a thought to a file, in three steps." />
      <ol className="platform-process">{[
        { title: "Describe", text: "Write the subject, setting and mood you want." },
        { title: "Generate", text: "Ovanto turns your prompt into an image." },
        { title: "Download", text: "Review the result and save the finished file." },
      ].map((step, i) => <li key={step.title}><span className="process-number">0{i+1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    </section>
    <section id="advanced-features" className="platform-section" aria-label="Workspace features">
      <SectionHeading eyebrow="Inside the workspace" title="Small details that keep you moving." />
      <div className="platform-feature"><div><span className="platform-status">Example prompts</span><h3>A clear place to begin.</h3><p>Choose an editorial portrait, product scene or quiet landscape. The example fills the prompt for you; edit the subject and details to make it your own.</p><a href="#image-workbench">Try an example prompt <span aria-hidden="true">→</span></a></div>
        <div className="prompt-demonstration" aria-label="Example prompt preview"><span>Product scene · example prompt</span><p>A clean product scene on pale stone with one strong shadow</p><div className="prompt-structure"><span>Subject</span><span>Setting</span><span>Light</span></div><small>Edit the wording before you generate.</small></div>
      </div>
      <div className="platform-feature platform-feature-reverse"><div><span className="platform-status">Browser workflow</span><h3>Keep the prompt and result together.</h3><p>Review your image beside the idea that started it. Refine the wording, generate again within the daily allowance, and download the version you want to keep.</p><a href="#image-workbench">Start an image <span aria-hidden="true">→</span></a></div>
        <figure className="workflow-demonstration"><Image src="/examples/landscape.webp" width={960} height={720} alt="Concept illustration of a mountain landscape" sizes="(max-width: 760px) 100vw, 45vw" loading="lazy" /><figcaption>Concept illustration · a quiet landscape at blue hour</figcaption></figure>
      </div>
    </section>
  </div>;
}