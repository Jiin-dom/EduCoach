import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB_GOAL_SCHEDULING = ROOT / "src" / "services" / "goalWindowScheduling.ts"
MOBILE_GOAL_SCHEDULING = ROOT.parent / "educoach-mobile" / "src" / "services" / "goalWindowScheduling.ts"
WEB_LEARNING_ALGORITHMS = ROOT / "src" / "lib" / "learningAlgorithms.ts"
MOBILE_LEARNING_ALGORITHMS = ROOT.parent / "educoach-mobile" / "src" / "lib" / "learningAlgorithms.ts"
MIGRATION = ROOT / "supabase" / "migrations" / "032_study_day_aware_adaptive_scheduling.sql"


class StudyDaySchedulingContractTest(unittest.TestCase):
    def test_client_schedulers_use_local_app_date_not_utc_iso_today(self) -> None:
        for path in (WEB_GOAL_SCHEDULING, MOBILE_GOAL_SCHEDULING):
            content = path.read_text(encoding="utf-8")
            self.assertIn("function todayLocalDateString()", content)
            self.assertIn("const windowStart = todayLocalDateString()", content)
            self.assertIn("const today = todayLocalDateString()", content)

        for path in (WEB_LEARNING_ALGORITHMS, MOBILE_LEARNING_ALGORITHMS):
            content = path.read_text(encoding="utf-8")
            self.assertIn("export function todayUTC(): string", content)
            self.assertIn("getFullYear()", content)
            self.assertIn("getMonth() + 1", content)
            self.assertNotIn("return new Date().toISOString().split('T')[0]", content)
            self.assertNotIn('return new Date().toISOString().split("T")[0]', content)

    def test_supabase_adaptive_sync_moves_tasks_to_next_available_study_day(self) -> None:
        content = MIGRATION.read_text(encoding="utf-8")

        self.assertIn("CREATE OR REPLACE FUNCTION public.next_available_study_date", content)
        self.assertIn("available_study_days", content)
        self.assertIn("Asia/Manila", content)
        self.assertIn("v_app_today DATE := (NOW() AT TIME ZONE 'Asia/Manila')::DATE", content)
        self.assertIn("GREATEST(v_scheduled_date, v_app_today)", content)
        self.assertIn("public.next_available_study_date(p_user_id", content)
        self.assertNotIn("CURRENT_DATE", content)


if __name__ == "__main__":
    unittest.main()

