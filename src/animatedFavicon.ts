import marioRunGif from './assets/mario-run-fast.gif';

export function startAnimatedFavicon() {
  const img = new Image();
  img.src = marioRunGif;
  // Must be in the DOM for the browser to animate GIF frames
  img.style.position = 'fixed';
  img.style.left = '-9999px';
  img.style.width = '1px';
  img.style.height = '1px';
  img.style.opacity = '0.01';
  img.style.pointerEvents = 'none';
  document.body.appendChild(img);

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    ?? document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  if (!link.parentNode) document.head.appendChild(link);

  // Redraw the GIF frame to canvas periodically and update the favicon.
  // The in-DOM img cycles GIF frames; we capture the current frame each tick.
  img.onload = () => {
    setInterval(() => {
      ctx.clearRect(0, 0, 32, 32);
      ctx.drawImage(img, 0, 0, 32, 32);
      link.href = canvas.toDataURL('image/png');
    }, 120);
  };
}
