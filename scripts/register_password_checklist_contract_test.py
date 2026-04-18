import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTER_FORM_SOURCE = (ROOT / "src" / "components" / "forms" / "RegisterForm.tsx").read_text(encoding="utf-8")
AUTH_VALIDATION_SOURCE = (ROOT / "src" / "lib" / "authValidation.ts").read_text(encoding="utf-8")


class WebRegisterPasswordChecklistContractTest(unittest.TestCase):
    def test_web_register_uses_password_requirement_checklist(self) -> None:
        self.assertIn(
            "getPasswordRequirementChecks",
            REGISTER_FORM_SOURCE,
            "Expected RegisterForm to use a shared password requirement checklist helper.",
        )
        self.assertIn(
            "Password must contain",
            REGISTER_FORM_SOURCE,
            "Expected RegisterForm to render a checklist heading for password requirements.",
        )
        self.assertIn(
            "requirement.met",
            REGISTER_FORM_SOURCE,
            "Expected RegisterForm to render each password requirement as its own checklist row.",
        )

    def test_web_auth_validation_exports_requirement_helper(self) -> None:
        self.assertIn(
            "PASSWORD_REQUIREMENTS",
            AUTH_VALIDATION_SOURCE,
            "Expected web auth validation to define reusable password requirements.",
        )
        self.assertIn(
            "getPasswordRequirementChecks",
            AUTH_VALIDATION_SOURCE,
            "Expected web auth validation to export checklist-ready password requirement statuses.",
        )


if __name__ == "__main__":
    unittest.main()
