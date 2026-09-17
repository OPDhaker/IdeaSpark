"use client";

import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  MAX_MEMBERS,
  MIN_MEMBERS,
  type RegistrationValues,
} from "@/lib/validation/registration";

export type Track = { id: string; name: string };

export function StepTeam({
  tracks,
  onMemberCountChange,
}: {
  tracks: Track[];
  onMemberCountChange: (count: number) => void;
}) {
  const form = useFormContext<RegistrationValues>();

  const counts = Array.from(
    { length: MAX_MEMBERS - MIN_MEMBERS + 1 },
    (_, index) => MIN_MEMBERS + index,
  );

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="team.teamName"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel className="font-semibold">Team name</FormLabel>
            <FormControl>
              <Input placeholder="The Founding Four" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="team.memberCount"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-semibold">Team size</FormLabel>
            <FormControl>
              {/* Kept as a number in form state so the schema needs no coercion. */}
              <NativeSelect
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={String(field.value)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  field.onChange(next);
                  onMemberCountChange(next);
                }}
              >
                {counts.map((count) => (
                  <NativeSelectOption key={count} value={String(count)}>
                    {count} members
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormControl>
            {/*<FormDescription>Including you, the team leader.</FormDescription>*/}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="team.trackId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-semibold">Track</FormLabel>
            <FormControl>
              <NativeSelect {...field}>
                <NativeSelectOption value="">Select a track</NativeSelectOption>
                {tracks.map((track) => (
                  <NativeSelectOption key={track.id} value={track.id}>
                    {track.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
