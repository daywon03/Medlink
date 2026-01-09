declare global {
  interface Window {
    google?: any;
  }
}

let loaderPromise: Promise<void> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires a browser context."));
  }

  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (!apiKey) {
    return Promise.reject(new Error("Missing Google Maps API key."));
  }

  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Maps JS."));
      document.head.appendChild(script);
    });
  }

  return loaderPromise;
}

export function createPinIcon(maps: any, color: string) {
  const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2c-7.2 0-13 5.8-13 13 0 9.4 11.2 22.2 12 23.1a1.3 1.3 0 0 0 2 0C21.8 37.2 33 24.4 33 15 33 7.8 27.2 2 20 2z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="20" cy="15" r="6" fill="#fff"/>
    </svg>
  `.trim();

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(40, 40),
    anchor: new maps.Point(20, 38),
  };
}

export function createInfoWindowContent(title: string) {
  const safeTitle = title || "";
  return `<div style="font-weight:600;">${safeTitle}</div>`;
}
