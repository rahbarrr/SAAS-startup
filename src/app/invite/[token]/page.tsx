import { redirect } from "next/navigation";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteRedirectPage(props: InvitePageProps) {
  const resolvedParams = await props.params;
  const token = resolvedParams.token ? encodeURIComponent(resolvedParams.token) : "";
  redirect(`/onboarding?token=${token}`);
}

