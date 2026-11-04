import { redirect } from "next/navigation";
import { configProblem, isAdmin } from "@/lib/admin-auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/studio");
  const problem = configProblem();

  return (
    <div className="mx-auto max-w-[24rem] px-5 py-16">
      <h1 className="text-h1 font-semibold tracking-tight">Studio sign in</h1>
      <p className="mt-2 text-small text-ink-2">Only the site owner can write and publish here.</p>
      <LoginForm disabled={Boolean(problem)} />
      {problem && (
        <div className="mt-8 rounded-[10px] border border-rule p-4 text-small text-ink-2">
          <p className="font-medium text-caution">Sign-in is not set up: {problem}.</p>
          <p className="mt-2">
            Add these to <code>.env.local</code>, then restart <code>npm run dev</code>:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-paper-2 p-3 text-micro">
            {"ADMIN_USERNAME=\"your-login-id\"\nADMIN_PASSWORD=\"a long password, 12+ characters\""}
          </pre>
        </div>
      )}
    </div>
  );
}
