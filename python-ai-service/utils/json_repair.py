"""
JSON Repair Utility — học từ gpt-researcher/skills/deep_research.py
Ref: deep_research.py _load_repaired_json() + JSON_BLOCK_PATTERNS

Vấn đề thực tế: LLM thỉnh thoảng xuất JSON sai format (thiếu quote, thừa comma,
có text trước/sau JSON block). json-repair library xử lý các case này.
"""

import json
import logging
import re
from typing import Any, Optional

try:
    import json_repair
    _HAS_JSON_REPAIR = True
except ImportError:
    _HAS_JSON_REPAIR = False

logger = logging.getLogger(__name__)

# Học trực tiếp từ deep_research.py JSON_BLOCK_PATTERNS
_JSON_BLOCK_PATTERNS = [
    re.compile(r"```(?:json)?\s*(?P<payload>[\s\S]*?)```", re.IGNORECASE),
    re.compile(r"(?P<payload>\[[\s\S]*\])"),
    re.compile(r"(?P<payload>\{[\s\S]*\})"),
]


def _extract_json_candidates(response: str) -> list[str]:
    """Trích xuất các đoạn JSON tiềm năng từ response của LLM"""
    candidates: list[str] = []
    seen: set[str] = set()
    for pattern in _JSON_BLOCK_PATTERNS:
        for match in pattern.finditer(response):
            candidate = match.group("payload").strip()
            if candidate and candidate not in seen:
                candidates.append(candidate)
                seen.add(candidate)
    return candidates


def safe_parse_json(response: str) -> Optional[Any]:
    """
    Parse JSON từ LLM output, kể cả khi format sai.

    Thứ tự thử:
    1. json.loads() thẳng
    2. json_repair.loads() (nếu có)
    3. Extract + parse từng JSON block
    """
    # Thử parse thẳng trước
    try:
        return json.loads(response.strip())
    except json.JSONDecodeError:
        pass

    # Thử json_repair
    if _HAS_JSON_REPAIR:
        for candidate in [response.strip(), *_extract_json_candidates(response)]:
            if not candidate:
                continue
            try:
                return json_repair.loads(candidate)
            except Exception:
                continue

    # Thử extract và parse thủ công
    for candidate in _extract_json_candidates(response):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    logger.debug("[JsonRepair] Failed to parse JSON from response: %s...", response[:100])
    return None
