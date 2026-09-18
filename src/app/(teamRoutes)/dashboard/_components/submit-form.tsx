"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUp, LoaderCircle } from "lucide-react";
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
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <ArrowUp aria-hidden className="size-12 stroke-1 text-primary" />

        <h2 className="mt-4 font-serif text-3xl leading-none tracking-[-0.02em]">
          Upload
        </h2>
        <p className="mt-3 text-muted-foreground text-sm">
          Share the deck for this round. Make sure the link is viewable by
          anyone.
        </p>

        <div className="mt-6 flex flex-col gap-4">
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
                    placeholder="https://docs.google.com/presentation/..."
                    disabled={submitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {formError ? (
          <p role="alert" className="mt-4 text-destructive text-sm">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="mt-6 w-full" disabled={submitting}>
          {submitting ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : null}
          {submitting ? "Submitting…" : "Submit idea"}
        </Button>
      </form>
    </Form>
  );
}
