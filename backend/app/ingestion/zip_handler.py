import os
import zipfile
from typing import BinaryIO, Union
from app.ingestion.exceptions import InvalidZipError, PathTraversalError


class ZipHandler:
    """Handles safe validation and extraction of uploaded ZIP archives."""

    @staticmethod
    def extract_safely(file_source: Union[str, BinaryIO], target_dir: str) -> str:
        """
        Safely extracts ZIP archive to target_dir after checking for path traversal attacks.
        Returns target_dir on success.
        """
        target_dir_abs = os.path.abspath(target_dir)

        try:
            with zipfile.ZipFile(file_source, 'r') as zip_ref:
                # Validate all members for path traversal (Zip Slip vulnerability)
                for member in zip_ref.infolist():
                    member_path = member.filename
                    
                    # Prevent absolute path or parent relative path escape
                    if member_path.startswith("/") or member_path.startswith("\\") or ".." in member_path.split("/"):
                        raise PathTraversalError(f"Path traversal detected in ZIP entry: '{member_path}'")

                    resolved_target = os.path.abspath(os.path.join(target_dir_abs, member_path))
                    
                    if not resolved_target.startswith(target_dir_abs + os.sep) and resolved_target != target_dir_abs:
                        raise PathTraversalError(f"Zip extraction path '{resolved_target}' escapes destination '{target_dir_abs}'")

                # Perform actual extraction after safety validation
                zip_ref.extractall(target_dir_abs)

        except zipfile.BadZipFile:
            raise InvalidZipError("Uploaded file is not a valid or readable ZIP archive.")
        except PathTraversalError:
            raise
        except Exception as exc:
            raise InvalidZipError(f"Failed to process ZIP archive: {str(exc)}")

        return target_dir_abs
