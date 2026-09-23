import { type ChangeEvent, type SubmitEvent, type SyntheticEvent, useRef, useState } from "react";

import { useLoginMutation } from "../queries/session.ts";

const OTP_LENGTH = 6;

const sanitizeOtp = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, OTP_LENGTH);

const getCaretIndex = (e: SyntheticEvent<HTMLInputElement>) =>
  e.currentTarget.selectionStart ?? e.currentTarget.value.length;

export const LoginForm = () => {
  const [otp, setOtp] = useState("");
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const login = useLoginMutation();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeOtp(e.target.value);
    setOtp(next);
    setCaret(next.length);
    if (next.length === OTP_LENGTH) login.mutate(next);
  };

  const focusInputAt = (index: number) => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const pos = Math.min(index, otp.length);
    el.setSelectionRange(pos, pos);
    setCaret(pos);
  };

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    login.mutate(otp);
  };

  const activeIndex = focused ? Math.min(caret, OTP_LENGTH - 1) : -1;

  return (
    <div className="p-2 flex flex-col items-center gap-6 mt-12">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-xl font-semibold">Enter your code</h1>
        <p className="text-sm text-zinc-400">
          Enter the {OTP_LENGTH}-character code sent to you on Slack.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
        <div className="relative">
          <input
            ref={inputRef}
            id="otp"
            value={otp}
            onChange={handleChange}
            onSelect={(e) => setCaret(getCaretIndex(e))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={OTP_LENGTH}
            autoFocus
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            aria-label={`${OTP_LENGTH}-character login code`}
            className="absolute inset-0 h-full w-full opacity-0"
          />
          <div className="flex gap-2" aria-hidden="true">
            {Array.from({ length: OTP_LENGTH }, (_, i) => {
              const char = otp[i];
              const isActive = activeIndex === i;
              return (
                <div
                  key={i}
                  onClick={() => focusInputAt(i)}
                  className={`flex h-14 w-11 items-center justify-center rounded-lg border font-mono text-xl uppercase ${
                    isActive ? "border-white ring-2 ring-white/30" : "border-zinc-600"
                  } bg-zinc-800`}
                >
                  {char ?? (isActive && <span className="h-6 w-px animate-pulse bg-white" />)}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={otp.length !== OTP_LENGTH || login.isPending}
          className="border rounded px-4 py-1.5 disabled:opacity-50"
        >
          Log in
        </button>
      </form>

      <p aria-live="polite">
        {login.isSuccess && "Logged in."}
        {login.isError && "Invalid or expired code."}
      </p>
    </div>
  );
};
