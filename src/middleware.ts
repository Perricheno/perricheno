import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { type NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
    const response = intlMiddleware(request);

    // Strip :PORT from redirect Location so Cloudflare Tunnel
    // doesn't expose internal port in public-facing URLs
    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (location) {
            const fixed = location.replace(/:\d{4,5}(\/|$)/, "$1");
            if (fixed !== location) {
                const headers = new Headers(response.headers);
                headers.set("Location", fixed);
                return new NextResponse(null, { status: response.status, headers });
            }
        }
    }

    return response;
}

export const config = {
  matcher: [
    // Match locale-prefixed routes, skip api, _next, static assets
    "/(ru|en|kz)/:path*",
    // Redirect bare root and top-level paths to default locale
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)",
  ],
};
