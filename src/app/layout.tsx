import type { Metadata } from "next";
import { Instrument_Serif, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const interSans = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: ["400"],
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

/**
 * `applicationName`, `title` and the home page heading must all read
 * "IdeaSpark 3.0", identical to the Google OAuth consent screen — a mismatch
 * between the consent screen and the home page fails Google's review.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://ideaspark.thefoundersclub.tech"),
  applicationName: "IdeaSpark 3.0",
  // No `template` here: every page already spells its own "… — IdeaSpark 3.0".
  title: "IdeaSpark 3.0",
  description:
    "IdeaSpark 3.0 is the registration and evaluation site for the IdeaSpark 3.0 ideathon, run by the Founders Club at SRM Institute of Science and Technology. Teams register, submit an idea, and get judged on 5–6 October 2026.",
  icons: {
    icon: "/fc-icons/logo.svg",
  },
  openGraph: {
    type: "website",
    siteName: "IdeaSpark 3.0",
    title: "IdeaSpark 3.0",
    description:
      "Registration and evaluation for the IdeaSpark 3.0 ideathon by the Founders Club, SRM Institute of Science and Technology.",
    url: "https://ideaspark.thefoundersclub.tech",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${interSans.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
