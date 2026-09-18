import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — IdeaSpark 3.0",
  description: "Terms for participating in IdeaSpark 3.0.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="19 September 2026">
      <h2>Acceptance</h2>
      <p>
        By registering for IdeaSpark 3.0 — a student event run by the Founders
        Club at SRM Institute of Science and Technology — you agree to these
        terms.
      </p>

      <h2>Eligibility</h2>
      <p>
        Participation is open to students of SRM Institute of Science and
        Technology. Teams are 2 to 4 members with exactly one leader. Only the
        leader signs in and manages the team.
      </p>

      <h2>Your account</h2>
      <p>
        Sign-in is through Google. Keep your account secure; you are responsible
        for what happens under it. Details you enter for your team must be
        accurate — false or duplicate entries may be rejected or removed.
      </p>

      <h2>Submissions</h2>
      <p>
        You keep ownership of the ideas you submit. You grant the organisers
        permission to read, evaluate and display your submission for judging and
        for event coverage. Submit only your own work.
      </p>

      <h2>Payments</h2>
      <p>
        The registration fee is payable after your submission is accepted, at
        the amount shown at checkout, through Razorpay. Fees are non-refundable
        except where the organisers cancel the event. Payment locks your team
        roster — members cannot be added or removed afterwards.
      </p>

      <h2>Conduct</h2>
      <p>
        No plagiarism, harassment, impersonation, or attempts to disrupt or gain
        unauthorised access to this site. The organisers may disqualify a team
        for breaking these rules, and their decisions on evaluation and results
        are final.
      </p>

      <h2>Changes</h2>
      <p>
        Event dates, rounds, tracks and these terms may change; updates are
        posted on this site.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The site is provided as is, without warranty. To the extent permitted by
        law, the organisers are not liable for indirect or incidental losses
        arising from your use of the site or participation in the event.
      </p>

      <h2>Contact</h2>
      <p>
        Questions:{" "}
        <a href="mailto:support@thefoundersclub.in">
          support@thefoundersclub.in
        </a>{" "}
        or <a href="mailto:fc.dei@srmist.edu.in">fc.dei@srmist.edu.in</a>.
      </p>
    </LegalPage>
  );
}
