"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { submitSubmission } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { isDriveUrl } from "@/lib/drive";
import { RestrictedLinkDialog } from "./restricted-link-dialog";

/**
 * The title is not decoration: an admin reviewing a list of untitled Drive
 * links has nothing to go on. The URL check is a convenience — the server
 * action is the real boundary.
 */
const schema = z.object({
  title: z.string().trim().min(1, "Give your idea a title.").max(255),
  driveLink: z
    .string()
    .trim()
    .min(1, "Paste the link to your deck.")
    .pipe(z.url("That doesn't look like a link."))
    .refine(isDriveUrl, "Paste a Google Drive or Slides link."),
});

type Values = z.infer<typeof schema>;

export function SubmitForm({ roundId }: { roundId: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  // The link the Drive check refused, held for the modal's "Open my deck".
  const [restrictedLink, setRestrictedLink] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { title: "", driveLink: "" },
  });

  const submitting = form.formState.isSubmitting;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      // One call checks the link and, if judges can open it, submits it. On
      // success `revalidatePath` swaps this form for the submitted card.
      const result = await submitSubmission(
        roundId,
        values.title,
        "",
        values.driveLink,
      );
      if (result.ok) {
        setRestrictedLink(null);
      } else if (result.reason === "restricted") {
        setRestrictedLink(values.driveLink);
      } else {
        setRestrictedLink(null);
        form.setError("driveLink", { message: result.message });
      }
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : "Could not submit your idea. Please try again.",
      );
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-8"
      >
        <div className="flex gap-4 items-center">
          <Image
            src="https://thesvg.org/icons/google-drive-2026/default.svg"
            alt="Google Drive (2026)"
            width={56}
            height={56}
          />
          <h2 className="text-5xl leading-none tracking-tight font-serif">
            Upload
          </h2>
        </div>
        <p className="text-muted-foreground text-base">
          Paste your deck&apos;s Drive link. In Drive, set it to Share | General
          access | Anyone with the link | Viewer, or judges can&apos;t open it.
          We check this when you submit.{" "}
          <span className="text-destructive font-medium">
            This action cannot be undone. Please do it very carefully.
          </span>
        </p>

        <div className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Idea title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="What are you building?"
                    disabled={submitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="driveLink"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deck link</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://slides.google.com/presentation/..."
                    disabled={submitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {formError ? (
            <p role="alert" className="mt-4 text-destructive text-sm">
              {formError}
            </p>
          ) : null}

          <Button type="submit" className="mt-4 w-full" disabled={submitting}>
            {submitting ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : null}
            {submitting ? "Checking your link…" : "Submit idea"}
          </Button>
        </div>
      </form>

      <RestrictedLinkDialog
        open={restrictedLink !== null}
        onOpenChange={(open) => {
          if (!open) setRestrictedLink(null);
        }}
        link={restrictedLink ?? ""}
        checking={submitting}
        onCheckAgain={form.handleSubmit(onSubmit)}
      />
    </Form>
  );
}
