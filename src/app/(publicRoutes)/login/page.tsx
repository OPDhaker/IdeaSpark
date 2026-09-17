import Image from "next/image";
import { redirect } from "next/navigation";
import { getMyTeam } from "@/app/actions";
import { GoogleSignIn } from "./_components/google-sign-in";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log In — IdeaSpark 3.0",
};

/** `getMyTeam` throws when there is no session; `/login` is the one route that
 * has to tolerate that, so the throw is swallowed here rather than loosening
 * `requireLead` for the actions that depend on it. */
async function getMyTeamOrNull() {
  try {
    return await getMyTeam();
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const team = await getMyTeamOrNull();
  if (team) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh gap-2 bg-background p-2">
      <div className="relative hidden overflow-hidden rounded-2xl md:block md:w-[42%]">
        <Image
          src="/landing/footer.webp"
          alt=""
          fill
          priority
          sizes="42vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-[32px] font-bold leading-[39px] tracking-[-0.02em] text-foreground">
          Log In
        </h1>
        <GoogleSignIn />
      </div>
    </main>
  );
}
