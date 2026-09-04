import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { type NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
    const response = intlMiddleware(request);

    // Traefik terminates plain HTTP between Cloudflare and the app (Cloudflare
    // does the real TLS termination), so Next.js/next-intl see an http://
    // request and build both redirect Locations and the hreflang alternate
    // Link header with that scheme - browsers flag/block the redirect as
    // mixed content, and the Link header advertises the wrong scheme for SEO.
    // Internal requests (localhost, health checks) must keep the port/scheme
    // as-is so wget still follows redirects to the correct internal port.
    const requestHost = request.headers.get("host") ?? "";
    const isInternal = requestHost.startsWith("localhost") || requestHost.startsWith("127.");
    if (isInternal) return response;

    const headers = new Headers(response.headers);
    let changed = false;

    if (response.status >= 300 && response.status < 400) {
        const location = headers.get("Location");
        if (location) {
            try {
                const locUrl = new URL(location);
                if (locUrl.port || locUrl.protocol !== "https:") {
                    locUrl.port = "";
                    locUrl.protocol = "https:";
                    headers.set("Location", locUrl.toString());
                    changed = true;
                }
            } catch {}
        }
    }

    // next-intl adds a `Link: <http://host/path>; rel="alternate"; hreflang="x"`
    // entry per locale on every response - all same-origin, safe to blanket-fix.
    const link = headers.get("Link");
    if (link && link.includes(`http://${requestHost}`)) {
        headers.set("Link", link.replaceAll(`http://${requestHost}`, `https://${requestHost}`));
        changed = true;
    }

    if (!changed) return response;
    return new NextResponse(response.body, { status: response.status, headers });
}

export const config = {
  matcher: [
    // Match locale-prefixed routes, skip api, _next, static assets
    "/(ru|en|kz)/:path*",
    // Redirect bare root and top-level paths to default locale
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)",
  ],
};
