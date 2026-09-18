"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { createTeam } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import {
  emptyMember,
  fieldsForStep,
  isReviewStep,
  MAX_MEMBERS,
  type RegistrationValues,
  registrationSchema,
  totalSteps,
} from "@/lib/validation/registration";
import { type Department, MemberFields } from "./member-fields";
import { StepIndicator } from "./step-indicator";
import { StepReview } from "./step-review";
import { StepTeam, type Track } from "./step-team";

const DRAFT_KEY = "ideaspark:register:draft";
const MEMBER_SLOTS = MAX_MEMBERS - 1;

/**
 * Indexed by step, but the review step is always last regardless of team size,
 * so it is appended rather than slotted in at a fixed position.
 */
const STEP_LABELS = [
  "Team leader details",
  "Team details",
  "Member 2 details",
  "Member 3 details",
  "Member 4 details",
];
const REVIEW_LABEL = "Review & submit";

function labelsFor(total: number) {
  return [...STEP_LABELS.slice(0, total - 1), REVIEW_LABEL];
}

/** Which step owns a given RHF path, so a server error can jump the wizard. */
function stepForPath(path: string) {
  if (path.startsWith("leader")) return 1;
  if (path.startsWith("team")) return 2;
  const match = path.match(/^members\.(\d+)/);
  return match ? Number(match[1]) + 3 : 1;
}

export function RegistrationForm({
  tracks,
  departments,
  defaultLeaderName,
}: {
  tracks: Track[];
  departments: Department[];
  defaultLeaderName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const restored = useRef(false);

  const form = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    mode: "onTouched",
    defaultValues: {
      leader: { ...emptyMember(), name: defaultLeaderName },
      team: { memberCount: 2, teamName: "", trackId: "" },
      members: Array.from({ length: MEMBER_SLOTS }, emptyMember),
    },
  });

  const memberCount = form.watch("team.memberCount");
  const total = totalSteps(memberCount);

  // Restore a draft once, after mount — reading localStorage during render
  // would desync the server-rendered markup.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<RegistrationValues>;
      form.reset({
        leader: { ...emptyMember(), name: defaultLeaderName, ...draft.leader },
        team: {
          memberCount: 2,
          teamName: "",
          trackId: "",
          ...draft.team,
        },
        members: Array.from({ length: MEMBER_SLOTS }, (_, index) => ({
          ...emptyMember(),
          ...draft.members?.[index],
        })),
      });
    } catch {
      // Corrupt draft — start clean rather than blocking registration.
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [form, defaultLeaderName]);

  // Debounced autosave. `form.watch` fires on every keystroke, so writing
  // straight through would hit localStorage far more than necessary.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const subscription = form.watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
        } catch {
          // Private mode or a full quota — the form still works without a draft.
        }
      }, 400);
    });
    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [form]);

  /** Wipe slots the new team size no longer uses, so stale values can't block submit. */
  const handleMemberCountChange = useCallback(
    (count: number) => {
      for (let index = count - 1; index < MEMBER_SLOTS; index += 1) {
        form.setValue(`members.${index}`, emptyMember());
        form.clearErrors(`members.${index}`);
      }
      setStep((current) => Math.min(current, totalSteps(count)));
    },
    [form],
  );

  // The review step is the only one that submits; every other step advances.
  const reviewing = isReviewStep(step, memberCount);

  const next = async () => {
    if (reviewing) return;
    const valid = await form.trigger(
      fieldsForStep(step, memberCount) as FieldPath<RegistrationValues>[],
      { shouldFocus: true },
    );
    if (valid) setStep((current) => Math.min(current + 1, total));
  };

  const back = () => setStep((current) => Math.max(current - 1, 1));

  const onSubmit = async (values: RegistrationValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await createTeam(values);

      if (!result.ok) {
        for (const issue of result.fieldErrors) {
          form.setError(issue.path as FieldPath<RegistrationValues>, {
            type: "server",
            message: issue.message,
          });
        }
        if (result.fieldErrors.length) {
          setStep(
            Math.min(
              ...result.fieldErrors.map((issue) => stepForPath(issue.path)),
            ),
          );
        }
        setFormError(result.formError ?? null);
        return;
      }

      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to clean up if storage is unavailable.
      }
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      console.error("Registration failed:", cause);
      setFormError(
        cause instanceof Error
          ? cause.message
          : "Could not submit your registration. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submit = form.handleSubmit(onSubmit);

  /**
   * One `<form>` backs every step, so a submit event can arrive from a step that
   * has no business submitting: Enter pressed in any field, or the browser
   * running a click's activation behaviour after React has already flipped the
   * Next button's `type` to `submit`. Only the review step submits; anywhere
   * else the intent is "next".
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!reviewing) {
      event.preventDefault();
      void next();
      return;
    }
    return submit(event);
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-1 mb-6">
          <h1 className="text-2xl tracking-tighter font-semibold">
            Register your team
          </h1>
        </div>
        <Card>
          <CardHeader className="">
            <StepIndicator
              current={step}
              total={total}
              labels={labelsFor(total)}
            />
          </CardHeader>

          <CardContent className="flex flex-col gap-8">
            {step === 1 ? (
              <MemberFields prefix="leader" departments={departments} />
            ) : null}

            {step === 2 ? (
              <StepTeam
                tracks={tracks}
                onMemberCountChange={handleMemberCountChange}
              />
            ) : null}

            {step >= 3 && !reviewing ? (
              <MemberFields
                // Remount on slot change so inputs don't carry the previous
                // member's DOM state across steps.
                key={`member-${step - 3}`}
                prefix={`members.${step - 3}`}
                departments={departments}
              />
            ) : null}

            {reviewing ? (
              <StepReview
                tracks={tracks}
                departments={departments}
                onEdit={setStep}
              />
            ) : null}

            {formError ? (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-foreground/15 border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={back}
                disabled={step === 1 || submitting}
              >
                <ArrowLeft aria-hidden />
                Back
              </Button>

              {/*
                Distinct keys, so React swaps the DOM node instead of rewriting
                `type` on the node whose click is still in flight — otherwise the
                last Next click lands on a button that has meanwhile become a
                submit button, and the browser posts the form.
              */}
              {reviewing ? (
                <Button key="submit" type="submit" disabled={submitting}>
                  {submitting ? (
                    <LoaderCircle aria-hidden className="animate-spin" />
                  ) : null}
                  {submitting ? "Submitting…" : "Submit registration"}
                </Button>
              ) : (
                <Button
                  key="next"
                  type="button"
                  onClick={next}
                  disabled={submitting}
                >
                  Next
                  <ArrowRight aria-hidden />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
