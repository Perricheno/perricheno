import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { type NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
    const response = intlMiddleware(request);

    // Strip :PORT from redirect Location only for external (public) requests.
    // Internal requests (localhost, health checks) must keep the port so wget
    // follows the redirect to the correct port instead of defaulting to :80.
    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        const requestHost = request.headers.get("host") ?? "";
        const isInternal = requestHost.startsWith("localhost") || requestHost.startsWith("127.");

        if (location && !isInternal) {
            try {
                const locUrl = new URL(location);
                if (locUrl.port) {
                    locUrl.port = "";
                    const headers = new Headers(response.headers);
                    headers.set("Location", locUrl.toString());
                    return new NextResponse(null, { status: response.status, headers });
                }
            } catch {}
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
