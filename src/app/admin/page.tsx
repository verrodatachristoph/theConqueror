import { getPersons, getAchievementDefs } from "@/lib/data";
import { getPublicSettings } from "@/lib/settings";
import { listPlans } from "@/lib/plans";
import AdminPage from "@/components/AdminPage";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const [persons, settings, achievementDefs, plans] = await Promise.all([
    getPersons(),
    getPublicSettings(),
    getAchievementDefs(),
    listPlans(),
  ]);
  return (
    <AdminPage
      persons={persons}
      settings={settings}
      achievementDefs={achievementDefs}
      plans={plans}
    />
  );
}
