# Course CardSwap artwork

Generated on 2026-10-16 with the built-in imagegen tool, one call per illustration. These are conceptual course illustrations, not anatomical reference diagrams. No external stock images are used.

Originals: `foundation.png`, `classics.png`, `meridians.png` in this directory. Project-ready images: `src/assets/courses/foundation.webp`, `classics.webp`, `meridians.webp` (same dimensions; WebP quality 0.88). The three delivered images total 691,682 bytes; original PNGs are retained here.

## Prompt set

Each full prompt is assembled using the shared prefix, one subject below, and the shared suffix, inserting the corresponding course key at the final position.

**Shared prefix:** Use case: stylized-concept. Asset type: a landscape editorial illustration for a Chinese medicine course card in the existing Qihuang knowledge cosmos website. Generate ONE finished artwork, not a UI mockup, no card frame. Subject:

**foundation:** a polished dark jade yin-yang disc hovering just above still ink-green water, fine restrained golden orbital lines suggesting the five phases, a single medicinal leaf and subtle mist, a powerful close-up sculptural composition

**classics:** an open antique Chinese thread-bound medical manuscript on a dark scholar's desk, a rolled scroll and inkstone, dramatic misty mountain silhouettes in the distance, delicate golden dust rising from the open book, exquisite tactile paper and green cloth textures

**meridians:** a small elegant translucent nephrite jade human statuette shown from waist up, fine understated gold pathways and a few tiny gold points representing interconnected knowledge across the body, framed by dark mist and a distant mountain, museum-quality sculptural rendering, artistic conceptual symbolism rather than an anatomical chart

**Shared suffix:** Composition: horizontal 3:2 image, central subject fully inside frame with generous dark breathing room, clear silhouette at small card size. Style: cinematic premium Chinese cultural still life, realistic materials, restrained fantastical scholarly atmosphere. Palette: near-black ink green #081312, deep jade #183b30, muted antique gold #c8b77d and pale stone highlights; cohesive low-key lighting with soft warm rim light. Detailed and rich but visually calm. No words, no lettering, no labels, no logos, no watermark, no collage. This must be a standalone image for the course COURSE_KEY; no screenshots or interface elements.

## Component provenance

`src/components/react-bits/CardSwap.jsx` and `CardSwap.css` are adapted from the complete JavaScript + CSS export supplied by the user in `已粘贴的文本.txt` on 2026-10-16. Upstream: https://github.com/DavidHDev/react-bits . Existing license: `third-party/REACT-BITS-LICENSE.md`.

Integration changes: remove unused sample icons/photos, use jade colors, reduce stack padding, expose the accessible label, keep nested course buttons independent of drag/click delegation, disable travel/autoplay for reduced motion (including live preference changes), and leave arrow keys inside form controls alone. No additional runtime dependencies were added. The original physics, drag, parallax, stacking and manual ref controls are retained.
