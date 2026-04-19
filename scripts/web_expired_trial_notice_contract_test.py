import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parent.parent
DASHBOARD_SOURCE = (ROOT / "src" / "components" / "dashboard" / "DashboardContent.tsx").read_text(encoding="utf-8")


class WebExpiredTrialNoticeContractTest(unittest.TestCase):
    def test_dashboard_uses_persisted_expired_trial_modal(self) -> None:
        self.assertIn(
            "showExpiredTrialModal",
            DASHBOARD_SOURCE,
            "Expected DashboardContent to derive a dedicated expired-trial modal state.",
        )
        self.assertIn(
            "localStorage",
            DASHBOARD_SOURCE,
            "Expected DashboardContent to persist expired-trial acknowledgement in browser storage.",
        )
        self.assertIn(
            "Free trial expired",
            DASHBOARD_SOURCE,
            "Expected DashboardContent to render a clear expired-trial modal title.",
        )
        self.assertIn(
            "Upgrade to premium",
            DASHBOARD_SOURCE,
            "Expected DashboardContent to guide users toward premium from the expired-trial modal.",
        )
        self.assertIn(
            "Got it",
            DASHBOARD_SOURCE,
            "Expected DashboardContent to let users acknowledge the expired-trial notice.",
        )
        self.assertNotIn(
            "Your Premium Trial Has Ended",
            DASHBOARD_SOURCE,
            "Expected DashboardContent to remove the old persistent expired-trial card when switching to the modal-based flow.",
        )


if __name__ == "__main__":
    unittest.main()
