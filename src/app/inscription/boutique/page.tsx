import { redirect } from "next/navigation";
import { ShopSignupForm } from "@/components/auth/ShopSignupForm";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { getCities } from "@/lib/data/reference";

export default async function ShopSignupPage() {
  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) redirect("/inscription");

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("profile_id", merchantProfile.id)
    .maybeSingle();
  if (merchant) redirect("/vendeur/attente");

  const cities = await getCities(supabase);

  return (
    <Screen>
      <TopBar title="Ma boutique" backHref="/inscription" />
      <ShopSignupForm cities={cities} />
    </Screen>
  );
}
