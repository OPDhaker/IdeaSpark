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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { normalizeIndianPhone } from "@/lib/validation/primitives";
import type {
  MEMBER_FIELDS,
  RegistrationValues,
} from "@/lib/validation/registration";

export type Department = { code: string; label: string };

type MemberField = (typeof MEMBER_FIELDS)[number];

/** Every one of these resolves to a `string` value, unlike the full form path union. */
type MemberPath = `leader.${MemberField}` | `members.${number}.${MemberField}`;

/**
 * Phone entry with a fixed `+91` prefix. The country code is display only —
 * the column stores the 10 national digits — so anything the user pastes is
 * normalised back down on the way in.
 */
function PhoneInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, "type" | "inputMode"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>+91</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        type="tel"
        inputMode="numeric"
        maxLength={10}
        placeholder="9876543210"
        value={value}
        onChange={(event) => onChange(normalizeIndianPhone(event.target.value))}
        {...props}
      />
    </InputGroup>
  );
}

/**
 * The eight `members` columns, rendered for whichever slot `prefix` points at
 * (`leader` or `members.0` … `members.2`). Every member carries their own
 * faculty advisor, so the faculty block repeats per person.
 */
export function MemberFields({
  prefix,
  departments,
}: {
  prefix: "leader" | `members.${number}`;
  departments: Department[];
}) {
  const form = useFormContext<RegistrationValues>();
  const path = (field: MemberField) => `${prefix}.${field}` as MemberPath;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={path("name")}
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel className="font-semibold">Full name</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={path("raNumber")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">RA Number</FormLabel>
              <FormControl>
                <Input autoCapitalize="characters" placeholder="" {...field} />
              </FormControl>
              {/*<FormDescription>&quot;RA&quot; then 13 digits.</FormDescription>*/}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={path("netId")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Net ID</FormLabel>
              <FormControl>
                <Input autoCapitalize="none" placeholder="" {...field} />
              </FormControl>
              {/*<FormDescription>2 letters then 4 digits.</FormDescription>*/}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={path("phoneNumber")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Phone number</FormLabel>
              <FormControl>
                <PhoneInput
                  autoComplete="tel-national"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={path("departmentCode")}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department</FormLabel>
              <FormControl>
                <NativeSelect {...field}>
                  <NativeSelectOption value="" className="font-semibold">
                    Select a department
                  </NativeSelectOption>
                  {departments.map((department) => (
                    <NativeSelectOption
                      key={department.code}
                      value={department.code}
                    >
                      {department.code}-{department.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="flex flex-col gap-6 border-foreground/15 border-t pt-6">
        <p className="font-semibold text-muted-foreground text-sm">
          Faculty advisor details
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name={path("facultyName")}
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel className="font-semibold">Faculty name</FormLabel>
                <FormControl>
                  <Input placeholder="Dr. Grace Hopper" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={path("facultyPhone")}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Faculty phone</FormLabel>
                <FormControl>
                  <PhoneInput
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={path("facultyEmail")}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Faculty email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoCapitalize="none"
                    placeholder="advisor@srmist.edu.in"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
