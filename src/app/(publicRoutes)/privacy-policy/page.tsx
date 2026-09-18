import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — IdeaSpark 3.0",
  description: "How IdeaSpark 3.0 collects and uses participant data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="19 September 2026">
      <h2>Who we are</h2>
      <p>
        IdeaSpark 3.0 is a student event run by the Founders Club at SRM
        Institute of Science and Technology. This site handles registration,
        idea submission and evaluation for the event.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Google account data</strong> — name, email address and profile
          picture, received when a team leader signs in with Google. We request
          no other Google scopes and never read your Gmail, Drive or contacts.
        </li>
        <li>
          <strong>Registration data</strong> — team name, track, and each
          member&apos;s name, registration number, department, year, phone
          number and email.
        </li>
        <li>
          <strong>Event data</strong> — idea submissions, evaluation scores,
          attendance scans and payment status.
        </li>
        <li>
          <strong>Payment data</strong> — payments are processed by Razorpay. We
          store only the order and payment reference; we never see or store your
          card, UPI or bank details.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <p>
        To create and manage your team, verify eligibility, run evaluation
        rounds, confirm your registration fee, mark attendance and contact you
        about the event. We do not use your data for advertising.
      </p>

      <h2>Who we share it with</h2>
      <p>
        Only with the people and services needed to run the event: Founders Club
        organisers and judges, our database and authentication provider (Neon),
        our hosting provider, and Razorpay for payments. We do not sell your
        data.
      </p>

      <h2>Retention</h2>
      <p>
        Event data is kept for the duration of IdeaSpark 3.0 and for a
        reasonable period afterwards for records and certificates, then deleted
        on request or when no longer needed.
      </p>

      <h2>Your choices</h2>
      <p>
        Write to us to access, correct or delete your data, or to withdraw your
        team from the event. Revoking this app&apos;s access in your{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer noopener"
        >
          Google account permissions
        </a>{" "}
        stops further sign-in.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy:{" "}
        <a href="mailto:support@thefoundersclub.in">
          support@thefoundersclub.in
        </a>{" "}
        or <a href="mailto:fc.dei@srmist.edu.in">fc.dei@srmist.edu.in</a>.
      </p>
    </LegalPage>
  );
}
