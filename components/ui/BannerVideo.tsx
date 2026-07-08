/**
 * Bee-field video backdrop for page title banners — the same clip as the
 * homepage hero, cropped by the banner's own height. Render inside a
 * `relative overflow-hidden` container, before the banner content.
 */
export function BannerVideo() {
  return (
    <>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/images/hero-albine-poster.jpg"
        className="absolute inset-0 w-full h-full object-cover blur-[2px] scale-[1.02] motion-reduce:hidden"
        aria-hidden="true"
      >
        <source src="/videos/hero-albine.mp4" type="video/mp4" />
      </video>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--hero-gradient)", opacity: 0.8 }}
        aria-hidden="true"
      />
      <div className="hero-light-dim absolute inset-0 pointer-events-none" aria-hidden="true" />
    </>
  );
}
