import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { type NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
    // Strip port from Host so next-intl redirect URLs don't include :3000
    const host = request.headers.get("host") ?? "";
    const cleanHost = host.replace(/:\d+$/, "");

    if (cleanHost !== host) {
        const headers = new Headers(request.headers);
        headers.set("host", cleanHost);
        const patched = new Request(request.url, {
            method: request.method,
            headers,
            body: request.body ?? undefined,
        });
        return intlMiddleware(patched as NextRequest);
    }

    return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match locale-prefixed routes, skip api, _next, static assets
    "/(ru|en|kz)/:path*",
    // Redirect bare root and top-level paths to default locale
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)",
  ],
};
