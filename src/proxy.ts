import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/login",
});

export const config = {
  matcher: [
    "/register/:path*",
    "/account/:path*",
    "/dashboard/:path*",
    "/panel/:path*",
    "/admin/:path*",
  ],
};
