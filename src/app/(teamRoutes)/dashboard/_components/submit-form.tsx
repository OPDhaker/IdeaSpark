"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
    .pipe(z.url("That doesn't look like a link.")),
});

type Values = z.infer<typeof schema>;

export function SubmitForm({ roundId }: { roundId: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { title: "", driveLink: "" },
  });

  const submitting = form.formState.isSubmitting;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await submitSubmission(roundId, values.title, "", values.driveLink);
      router.refresh();
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
          Upload drive link and make sure it is set to "Everyone with this link
          can view.".{" "}
          <span className="text-destructive font-medium">
            This action cannot be undone. Pleae do it very carefully.
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
            {submitting ? "Submitting…" : "Submit idea"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
