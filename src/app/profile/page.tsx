
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getSessionUser } from "@/lib/auth/server";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login?next=%2Fprofile");
  }

  return (
    <>
      <PageHeader
        title="Profile"
        intro="Manage your personal information and account details."
      />

      <section className="container-page py-14">
        <div className="mx-auto max-w-3xl">
          <ProfileForm
            userId={user.id}
            email={user.email ?? ""}
            createdAt={user.created_at}
          />
        </div>
      </section>
    </>
  );
}
