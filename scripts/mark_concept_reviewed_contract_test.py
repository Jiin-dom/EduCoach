import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parent.parent
LEARNING_HOOK = ROOT / "src" / "hooks" / "useLearning.ts"
CONCEPTS_TAB = ROOT / "src" / "components" / "files" / "ConceptsTab.tsx"
FILE_VIEWER = ROOT / "src" / "components" / "files" / "FileViewer.tsx"
LEARNING_CONTENT = ROOT / "src" / "components" / "learning-path" / "LearningPathContent.tsx"
LEARNING_CALENDAR = ROOT / "src" / "components" / "learning-path" / "LearningPathCalendar.tsx"


class WebMarkConceptReviewedContractTest(unittest.TestCase):
    def test_learning_hook_updates_only_tapped_concept_mastery_row(self) -> None:
        content = LEARNING_HOOK.read_text(encoding="utf-8")

        self.assertIn("useMarkConceptReviewed", content)
        self.assertIn("last_reviewed_at: reviewedAt", content)
        self.assertIn("due_date: schedule.dueDate", content)
        self.assertIn(".eq('user_id', user.id)", content)
        self.assertIn(".eq('concept_id', input.conceptId)", content)
        self.assertNotIn(".eq('document_id', input.documentId)", content)
        self.assertIn("queryClient.invalidateQueries({ queryKey: learningKeys.all })", content)
        self.assertIn("queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })", content)

    def test_concepts_tab_exposes_per_concept_mark_reviewed_action(self) -> None:
        content = CONCEPTS_TAB.read_text(encoding="utf-8")

        self.assertIn("useConceptMasteryByDocument(documentId)", content)
        self.assertIn("useMarkConceptReviewed", content)
        self.assertIn("focusedConceptId", content)
        self.assertIn("Mark Reviewed", content)
        self.assertIn("markConceptReviewed.mutate", content)
        self.assertIn("const focusedIndex = list.findIndex((concept) => concept.id === focusedConceptId)", content)
        self.assertIn("list.unshift(...list.splice(focusedIndex, 1))", content)
        self.assertIn("[concepts, search, sortBy, focusedConceptId]", content)
        self.assertRegex(
            content,
            re.compile(r"concept\.id === focusedConceptId", re.MULTILINE),
            "Expected focus styling to be based on the tapped concept id.",
        )

    def test_learning_path_routes_include_concept_query_param(self) -> None:
        viewer = FILE_VIEWER.read_text(encoding="utf-8")
        content = LEARNING_CONTENT.read_text(encoding="utf-8")
        calendar = LEARNING_CALENDAR.read_text(encoding="utf-8")

        self.assertIn("focusedConceptId={searchParams.get('concept') ?? undefined}", viewer)
        self.assertIn("`/files/${item.documentId}?tab=concepts&concept=${item.conceptId}`", content)
        self.assertIn("`/files/${task.documentId}?tab=concepts&concept=${task.conceptIds[0]}`", content)
        self.assertIn("`/files/${session.documentId}?tab=concepts&concept=${session.conceptId}`", calendar)


if __name__ == "__main__":
    unittest.main()
