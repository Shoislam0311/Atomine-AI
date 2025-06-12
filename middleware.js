import { NextResponse } from "next/server";

export const config = {
  matcher: "/integrations/:path*",
};

export function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-createxyz-project-id", "adf49d5f-688e-48e4-ab9e-39f2d61596a2");
  requestHeaders.set("x-createxyz-project-group-id", "a447c2ef-0ff3-4328-b16e-b8af11847466");


  request.nextUrl.href = `https://www.create.xyz/${request.nextUrl.pathname}`;

  return NextResponse.rewrite(request.nextUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}