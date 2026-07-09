"""CLI utilities for managing Jupyter notebooks.

Commands
--------
clear   Strip all cell outputs from notebooks in-place.
export  Convert notebooks to Markdown (saved alongside the .ipynb files).
clean   Remove Python bytecode, test caches, and other generated artifacts.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import nbformat
from nbconvert import MarkdownExporter
from nbconvert.preprocessors import ClearOutputPreprocessor

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_DIR = ROOT / "notebooks"


def notebook_paths() -> list[Path]:
    """Return a sorted list of all .ipynb files in the notebooks directory."""
    return sorted(NOTEBOOK_DIR.glob("*.ipynb"))


def clear_outputs() -> None:
    """Strip all cell outputs from every notebook, saving in-place."""
    preprocessor = ClearOutputPreprocessor()
    for notebook_path in notebook_paths():
        notebook = nbformat.read(notebook_path, as_version=4)
        notebook, _ = preprocessor.preprocess(notebook, {})
        nbformat.write(notebook, notebook_path)
        print(f"Outputs cleared: {notebook_path.name}")


def export_markdown() -> None:
    """Export every notebook to a Markdown file in the same directory."""
    exporter = MarkdownExporter()
    for notebook_path in notebook_paths():
        notebook = nbformat.read(notebook_path, as_version=4)
        body, resources = exporter.from_notebook_node(notebook)
        markdown_path = notebook_path.with_suffix(".md")
        markdown_path.write_text(body, encoding="utf-8")
        outputs = resources.get("outputs", {})
        for filename, data in outputs.items():
            (markdown_path.parent / filename).write_bytes(data)
        print(f"Exported to Markdown: {markdown_path.name}")


def clean_generated() -> None:
    """Remove Python bytecode files and tool cache directories."""
    for path in ROOT.rglob("*.pyc"):
        if path.is_file():
            path.unlink()

    for cache_dir in (ROOT / ".pytest_cache", ROOT / ".ruff_cache"):
        if cache_dir.exists():
            for child in cache_dir.rglob("*"):
                if child.is_file():
                    child.unlink()
            for child in sorted(cache_dir.rglob("*"), reverse=True):
                if child.is_dir():
                    child.rmdir()
            cache_dir.rmdir()

    print("Clean completed.")


def main() -> None:
    """Parse CLI arguments and dispatch to the appropriate command."""
    parser = argparse.ArgumentParser(description="Notebook management utilities")
    parser.add_argument("action", choices={"clear", "export", "clean"})
    args = parser.parse_args()

    if args.action == "clear":
        clear_outputs()
    elif args.action == "export":
        export_markdown()
    else:
        clean_generated()


if __name__ == "__main__":
    main()
