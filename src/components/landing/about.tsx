import Link from "next/link";

/**
 * Plain-language description of what this site is and what signing in does.
 *
 * It exists for two audiences at once: a student landing here for the first
 * time, and Google's OAuth reviewer, who checks that the home page names the
 * app exactly as the consent screen does ("IdeaSpark 3.0"), explains the app's
 * purpose, and links to the privacy policy and terms. Keep the name and the
 * Google paragraph in sync with the consent screen configuration.
 */
export function About() {
  return (
    <section
      id="about"
      className="w-full bg-background px-6 py-12 text-foreground md:px-16"
    >
      <div className="mx-auto flex w-full max-w-section flex-col gap-8 md:flex-row md:gap-16">
        <div className="flex flex-col gap-4 md:max-w-[560px]">
          <h2 className="text-[clamp(1.75rem,4vw,40px)] font-bold leading-tight tracking-[-0.04em]">
            What is IdeaSpark 3.0?
          </h2>
          <p className="text-base leading-relaxed text-foreground/80 md:text-lg">
            <strong className="font-semibold text-foreground">
              IdeaSpark 3.0
            </strong>{" "}
            is the official registration and evaluation site for the IdeaSpark
            3.0 ideathon, run by the Founders Club at SRM Institute of Science
            and Technology on 5–6 October 2026.
          </p>
          <p className="text-base leading-relaxed text-foreground/80 md:text-lg">
            Students form a team of 2 to 4, pick a track, and submit an idea for
            each evaluation round. Once an idea is accepted the team pays the
            registration fee, then gets scanned in for attendance and scored by
            judges at the event. Team leaders use this site to register their
            team, track its review status and see results.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-[32px] bg-foreground/5 p-6 md:max-w-[420px] md:p-8">
          <h3 className="text-xl font-bold tracking-[-0.02em]">
            Signing in with Google
          </h3>
          <p className="text-base leading-relaxed text-foreground/80">
            Only the team leader signs in, and Google is the only sign-in
            method. We ask Google for your name, email address and profile
            picture — nothing else. We never request access to Gmail, Drive,
            Calendar or contacts, and we do not post anything to your account.
          </p>
          <p className="text-base leading-relaxed text-foreground/80">
            Your email identifies your team and is how the organisers reach you
            about your registration.
          </p>
          <p className="text-base leading-relaxed text-foreground/80">
            Questions about your data:{" "}
            <a
              href="mailto:opdhaker2007@gmail.com"
              className="underline underline-offset-4 hover:opacity-70"
            >
              opdhaker2007@gmail.com
            </a>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-base font-medium">
            <Link
              href="/privacy-policy"
              className="underline underline-offset-4 hover:opacity-70"
            >
              Privacy Policy
            </Link>
            <Link
              href="/tos"
              className="underline underline-offset-4 hover:opacity-70"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
