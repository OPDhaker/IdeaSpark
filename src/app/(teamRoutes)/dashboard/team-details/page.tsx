import { Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { getTeamRoster } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { CardTitle, DashCard, Detail } from "../_components/panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team Details — IdeaSpark 3.0",
};

type Roster = NonNullable<Awaited<ReturnType<typeof getTeamRoster>>>;
type Member = Roster["members"][number];

/**
 * The mentor is stored per member, but in practice a team has one. Collapse it
 * to a single block unless the rows actually disagree.
 */
function sharedMentor(members: Member[]) {
  const [first] = members;
  if (!first) return null;
  const same = members.every(
    (member) =>
      member.facultyName === first.facultyName &&
      member.facultyEmail === first.facultyEmail &&
      member.facultyPhone === first.facultyPhone,
  );
  return same ? first : null;
}

function MemberCard({ member }: { member: Member }) {
  return (
    <DashCard>
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-medium text-lg">{member.name}</h3>
        {member.isLeader ? <Badge variant="secondary">Leader</Badge> : null}
      </div>

      <dl className="mt-6 flex flex-col gap-5">
        <Detail label="RA number" value={member.raNumber} />
        <Detail label="Net ID" value={member.netId} />
        <Detail label="Phone" value={`+91 ${member.phoneNumber}`} />
        <Detail
          label="Department"
          value={member.departmentLabel ?? member.departmentCode}
        />
      </dl>
    </DashCard>
  );
}

export default async function TeamDetailsPage() {
  const roster = await getTeamRoster();
  if (!roster) redirect("/register");

  const mentor = sharedMentor(roster.members);

  return (
    <div className="p-6 md:p-12">
      <div className="mx-auto grid w-full max-w-[820px] gap-16">
        <header>
          <h1 className="font-serif text-5xl leading-none tracking-[-0.03em]">
            {roster.team.teamName}
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">
            {roster.trackName ?? "No track set"} · {roster.members.length}{" "}
            members
          </p>

          {roster.rosterLocked ? (
            <p className="mt-5 flex items-center gap-2 text-muted-foreground text-sm">
              <Lock aria-hidden className="size-4" />
              Your roster is locked — attendance passes have already been issued
              against these names.
            </p>
          ) : null}
        </header>

        <div className="grid gap-16 md:grid-cols-2">
          {roster.members.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>

        {mentor ? (
          <DashCard>
            <CardTitle>Faculty mentor</CardTitle>
            <dl className="mt-6 flex flex-col gap-5">
              <Detail label="Name" value={mentor.facultyName} />
              <Detail label="Email" value={mentor.facultyEmail} />
              <Detail label="Phone" value={`+91 ${mentor.facultyPhone}`} />
            </dl>
          </DashCard>
        ) : (
          <DashCard>
            <CardTitle>Faculty mentors</CardTitle>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              {roster.members.map((member) => (
                <dl key={member.id} className="flex flex-col gap-4">
                  <Detail label={member.name} value={member.facultyName} />
                  <Detail label="Email" value={member.facultyEmail} />
                  <Detail label="Phone" value={`+91 ${member.facultyPhone}`} />
                </dl>
              ))}
            </div>
          </DashCard>
        )}
      </div>
    </div>
  );
}
