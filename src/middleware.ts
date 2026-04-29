import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Добавь сюда пути, которые сейчас в разработке
// Например: ['/agent', '/billing', '/some-new-feature']
const UNDER_CONSTRUCTION_ROUTES: string[] = [
  // '/example-route'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Если текущий путь начинается с одного из путей "в разработке",
  // перенаправляем на специальную страницу.
  const isUnderConstruction = UNDER_CONSTRUCTION_ROUTES.some(route => 
    pathname.startsWith(route)
  );

  if (isUnderConstruction && pathname !== '/under-construction') {
    return NextResponse.redirect(new URL('/under-construction', request.url));
  }

  return NextResponse.next();
}

// Указываем, для каких путей работает middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
