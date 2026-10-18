import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { GraduationCap } from "lucide-react";
import { Year } from "@/components/site/year";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden w-1/2 flex-col justify-between bg-hero p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25"><GraduationCap className="h-6 w-6" /></span>
          <span className="font-display text-xl font-extrabold">iCET Admin</span>
        </div>
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white text-balance">Everything behind icet.lk, in one place.</h1>
          <p className="mt-4 max-w-md text-slate-200">Manage pages, programmes, events, workshops, applications, certificates and inquiries. Changes publish instantly to the live site.</p>
        </div>
        <p className="text-xs text-slate-400">© <Year /> Institute of Computer Engineering Technology</p>
      </div>
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white"><GraduationCap className="h-5 w-5" /></span>
            <span className="font-display text-lg font-extrabold text-slate-900">iCET Admin</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your staff email and password.</p>
          <Suspense><LoginForm /></Suspense>
        </div>
      </div>
    </div>
  );
}
