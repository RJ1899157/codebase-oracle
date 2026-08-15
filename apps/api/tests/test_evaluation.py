from app.evaluation.service import (
    EvalTestCase,
    evaluate_context_precision,
    evaluate_faithfulness,
    run_evaluation,
)
from app.models import CodeChunk, GraphBatch, GraphNode


def test_evaluate_metrics_standalone() -> None:
    faith = evaluate_faithfulness(
        answer="The auth token is validated",
        retrieved_texts=["def auth token is validated here"],
    )
    assert faith > 0.5

    prec = evaluate_context_precision(
        expected_files=["auth.py"],
        citations=["auth.py", "utils.py"],
    )
    assert prec == 1.0


def test_run_evaluation_pipeline() -> None:
    chunks = [
        CodeChunk(
            id="1",
            text="class Calculator:\n    def add(self, a, b): return a + b",
            file_path="calculator.py",
            start_line=1,
            end_line=2,
        )
    ]
    batch = GraphBatch(
        nodes=[
            GraphNode(
                id="symbol::calculator.py::class::Calculator",
                kind="class",
                name="Calculator",
                file_path="calculator.py",
                start_line=1,
                end_line=2,
            )
        ],
        edges=[],
    )

    cases = [
        EvalTestCase(
            question="Where is Calculator defined?",
            ground_truth_answer="In calculator.py",
            expected_files=["calculator.py"],
            should_refuse=False,
        ),
        EvalTestCase(
            question="Where is rocket science quantum logic?",
            ground_truth_answer="",
            expected_files=[],
            should_refuse=True,
        ),
    ]

    report = run_evaluation(cases, chunks, batch)

    assert report.total_cases == 2
    assert report.passed_cases >= 1
    assert report.refusal_accuracy == 1.0