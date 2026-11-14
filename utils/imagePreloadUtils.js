// utils/imagePreloadUtils.js — Image pre-caching and asset warm-up [WP-02]
import { Image } from 'react-native';

export const CORE_THEME_ASSET_MODULES = [
  require('../assets/80.jpg'),
  require('../assets/Airplanemode.jpg'),
  require('../assets/childhood.jpg'),
  require('../assets/ex.jpg'),
  require('../assets/funnyrap.jpg'),
  require('../assets/yaas.jpg'),
  require('../assets/joie.jpg'),
  require('../assets/reality.jpg'),
  require('../assets/underrated.jpg'),
  require('../assets/badday.jpg'),
  require('../assets/notfriday.jpg'),
  require('../assets/margarita.jpg'),
  require('../assets/halfgood.jpg'),
  require('../assets/bestworst.jpg'),
];

export async function preloadCoreThemeAssets(customUrls = []) {
  try {
    const urlsToPrefetch = [];

    if (Array.isArray(customUrls)) {
      for (const url of customUrls) {
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
          urlsToPrefetch.push(url);
        }
      }
    }

    for (const mod of CORE_THEME_ASSET_MODULES) {
      try {
        const resolved = Image.resolveAssetSource ? Image.resolveAssetSource(mod) : null;
        if (resolved?.uri) {
          urlsToPrefetch.push(resolved.uri);
        }
      } catch (_) {}
    }

    const uniqueUris = Array.from(new Set(urlsToPrefetch));
    await Promise.allSettled(
      uniqueUris.map((uri) => {
        if (typeof Image?.prefetch === 'function') {
          return Image.prefetch(uri).catch(() => {});
        }
        return Promise.resolve();
      })
    );
  } catch (err) {
    console.warn('Theme asset preloading notice:', err?.message);
  }
}
