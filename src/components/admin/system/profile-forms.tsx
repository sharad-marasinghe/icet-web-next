"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Save, KeyRound, Eye, EyeOff } from "lucide-react";
import { AField, AInput, SubmitButton, ActionToast, initialActionState } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/media-picker";
import { updateProfile, changePassword } from "@/app/admin/(dashboard)/profile/actions";

export function ProfileForm({ initial }: { initial: { full_name: string; avatar_url: string } }) {
  const [state, action] = useActionState(updateProfile, initialActionState);
  const [avatar, setAvatar] = React.useState(initial.avatar_url);
  const router = useRouter();
  React.useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={action} className="space-y-5">
      <ActionToast state={state} />
      <AField label="Full name" htmlFor="pf-name" required error={state?.errors?.full_name}><AInput id="pf-name" name="full_name" defaultValue={initial.full_name} required autoComplete="name" /></AField>
      <ImageField label="Profile photo" name="avatar_url" value={avatar} onChange={setAvatar} hint="Square image works best." />
      {state?.errors?.avatar_url && <p className="text-xs font-medium text-rose-600">{state.errors.avatar_url}</p>}
      <div className="flex justify-end"><SubmitButton size="sm"><Save className="h-4 w-4" /> Save profile</SubmitButton></div>
    </form>
  );
}

function PwInput({ id, name, label, error, autoComplete }: { id: string; name: string; label: string; error?: string; autoComplete: string }) {
  const [show, setShow] = React.useState(false);
  return (
    <AField label={label} htmlFor={id} required error={error}>
      <div className="relative">
        <AInput id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required className="pr-10" />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100" aria-label={show ? "Hide" : "Show"}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      </div>
    </AField>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, initialActionState);
  const ref = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <ActionToast state={state} />
      <PwInput id="cp-current" name="current_password" label="Current password" autoComplete="current-password" error={state?.errors?.current_password} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PwInput id="cp-new" name="new_password" label="New password" autoComplete="new-password" error={state?.errors?.new_password} />
        <PwInput id="cp-confirm" name="confirm_password" label="Confirm new password" autoComplete="new-password" error={state?.errors?.confirm_password} />
      </div>
      <p className="text-xs text-slate-500">At least 10 characters including letters and numbers.</p>
      <div className="flex justify-end"><SubmitButton size="sm" pendingText="Updating…"><KeyRound className="h-4 w-4" /> Change password</SubmitButton></div>
    </form>
  );
}
