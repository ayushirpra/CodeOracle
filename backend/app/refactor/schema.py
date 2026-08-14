"""
Refactor Schema — Phase 7.
Data models for breaking change warnings, refactored files, and project-level refactor proposals.
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class BreakingChangeWarning(BaseModel):
    """Represents a single detected breaking change between original and refactored code."""
    __test__ = False

    severity: Literal["HIGH", "MEDIUM", "LOW"] = "MEDIUM"
    change_type: str  # e.g. "function_removed", "parameter_added", "parameter_renamed"
    symbol: str       # Name of the affected function/class/import
    description: str  # Human-readable explanation
    original_signature: Optional[str] = None
    proposed_signature: Optional[str] = None
    migration_hint: str = ""


class RefactoredFile(BaseModel):
    """Holds original code, proposed refactored code, unified diff, and warnings for one file."""
    __test__ = False

    file_path: str
    language: str
    original_code: str
    proposed_code: str
    unified_diff: str           # difflib.unified_diff output as a string
    breaking_changes: List[BreakingChangeWarning] = Field(default_factory=list)
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    refactor_summary: str = ""  # Brief plain-language summary of what was modernised


class ProjectRefactorProposal(BaseModel):
    """Aggregated refactoring proposal for the entire project."""
    __test__ = False

    total_files_refactored: int = 0
    total_warnings: int = 0
    high_warnings: int = 0
    medium_warnings: int = 0
    low_warnings: int = 0
    files: List[RefactoredFile] = Field(default_factory=list)
    error: Optional[str] = None
