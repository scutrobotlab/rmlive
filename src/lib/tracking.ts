export function trackPageView(path: string) {
  try {
    _hmt?.push(['_trackPageview', path]);
  } catch { /* swallow: analytics script may not be loaded */ }
}

export function trackEvent(category: string, action: string, label?: string, value?: number) {
  try {
    _hmt?.push(['_trackEvent', category, action, label, value]);
  } catch { /* swallow: analytics script may not be loaded */ }
}
