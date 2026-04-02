"""Cerebro Publishing Ingest — load editorial content into Cerebro.

This module provides functions for ingesting different types of
publishing content into Cerebro's vector database. Each function
chunks content appropriately, generates metadata, and calls the
Cerebro upsert API.

Usage:
    # From CLI
    python -m cerebro_ingest series-bible --file bible.md --series "Cascade Effect"
    python -m cerebro_ingest style-guide --file style.md --author "Anika Thorne"
    python -m cerebro_ingest editorial --file phase3-output.json --book "Starfall Protocol"
    python -m cerebro_ingest cover-spec --file specs/starfall.md --series "Cascade Effect"

    # From Python (for n8n Execute Command or agent integration)
    from cerebro_ingest import ingest_series_bible
    ingest_series_bible("bible.md", series_name="Cascade Effect")

Environment:
    CEREBRO_URL       — Cerebro Edge Function base URL
    CEREBRO_API_KEY   — Supabase service role key or anon key
    CEREBRO_MCP       — If "true", use MCP tool calls instead of HTTP

The ingest functions can also be called via MCP if Cerebro is
connected as an MCP server. In that case, set CEREBRO_MCP=true
and the functions will emit tool call JSON instead of HTTP requests.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import click

logger = logging.getLogger(__name__)

# Auto-load .env from project root (same pattern as scripts/dbsql.py)
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _val = _line.split("=", 1)
                os.environ.setdefault(_key.strip(), _val.strip())

# Supabase project URL (e.g. https://xyz.supabase.co) — used for PostgREST
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
# Service role key for PostgREST inserts (bypasses RLS)
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
# OpenRouter key for generating embeddings
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
USE_MCP = os.environ.get("CEREBRO_MCP", "").lower() == "true"

# Map collection names to Supabase table names
COLLECTION_TABLE: dict[str, str] = {
    "series-bible":      "cerebro_series_bible",
    "series_bible":      "cerebro_series_bible",
    "style-guide":       "cerebro_style_guide",
    "style_guide":       "cerebro_style_guide",
    "editorial-history": "cerebro_editorial_history",
    "editorial_history": "cerebro_editorial_history",
    "cover-specs":       "cerebro_cover_specs",
    "cover_specs":       "cerebro_cover_specs",
}

# Column promotion: metadata fields promoted to top-level columns per table
COLLECTION_COLUMNS: dict[str, list[str]] = {
    "cerebro_series_bible":      ["series_name", "category", "entity_name"],
    "cerebro_style_guide":       ["author_name", "section"],
    "cerebro_editorial_history": ["series_name", "book_title", "book_number",
                                   "pipeline_run_id", "phase", "finding_type",
                                   "severity", "chapter_ref"],
    "cerebro_cover_specs":       ["series_name", "book_title", "spec_type"],
}


def purge_series_bible(series_name: str) -> int:
    """Delete all series bible rows for a given series_name before re-ingesting.

    Used with --replace to avoid duplicate chunks when updating source files.
    Returns the number of rows deleted.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for purge")
        return 0
    try:
        import urllib.request
        import urllib.parse
        params = urllib.parse.urlencode({"series_name": f"eq.{series_name}"})
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/cerebro_series_bible?{params}",
            method="DELETE",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Prefer": "return=representation",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            deleted = json.loads(resp.read())
            count = len(deleted) if isinstance(deleted, list) else 0
            logger.info("Purged %d existing chunks for series: %s", count, series_name)
            return count
    except Exception as e:
        logger.error("Purge failed: %s", e)
        return 0


def purge_style_guide(author_name: str) -> int:
    """Delete all style guide rows for a given author_name before re-ingesting."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for purge")
        return 0
    try:
        import urllib.request
        import urllib.parse
        params = urllib.parse.urlencode({"author_name": f"eq.{author_name}"})
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/cerebro_style_guide?{params}",
            method="DELETE",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Prefer": "return=representation",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            deleted = json.loads(resp.read())
            count = len(deleted) if isinstance(deleted, list) else 0
            logger.info("Purged %d existing chunks for author: %s", count, author_name)
            return count
    except Exception as e:
        logger.error("Purge failed: %s", e)
        return 0


@dataclass
class Chunk:
    """A single piece of content to ingest into Cerebro."""
    collection: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


def upsert_chunks(chunks: list[Chunk]) -> int:
    """Send chunks to Cerebro for embedding and storage.

    If CEREBRO_MCP is true, outputs MCP tool call JSON to stdout
    for the calling agent to execute. Otherwise, calls the Cerebro
    Edge Function directly via HTTP.

    Args:
        chunks: List of content chunks to ingest.

    Returns:
        Number of chunks successfully ingested.
    """
    if USE_MCP:
        return _upsert_via_mcp(chunks)
    else:
        return _upsert_via_http(chunks)


def _get_embedding(text: str) -> list[float]:
    """Generate a 1536-dim embedding via OpenRouter (text-embedding-3-small)."""
    try:
        import urllib.request
        payload = json.dumps({
            "model": "openai/text-embedding-3-small",
            "input": text,
        }).encode()
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/embeddings",
            data=payload,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        return data["data"][0]["embedding"]
    except Exception as e:
        logger.error("Embedding generation failed: %s", e)
        return []


def _upsert_via_http(chunks: list[Chunk]) -> int:
    """Insert chunks into Supabase via PostgREST REST API.

    Generates embeddings via OpenRouter before inserting.
    Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return 0
    if not OPENROUTER_API_KEY:
        logger.error("OPENROUTER_API_KEY must be set for embedding generation")
        return 0

    try:
        import urllib.request
        import urllib.error
    except ImportError:
        logger.error("urllib not available")
        return 0

    success = 0
    for i, chunk in enumerate(chunks):
        table = COLLECTION_TABLE.get(chunk.collection)
        if not table:
            logger.error("Unknown collection: %s", chunk.collection)
            continue

        logger.info("[%d/%d] Embedding chunk for %s…", i + 1, len(chunks), table)
        embedding = _get_embedding(chunk.content)
        if not embedding:
            logger.error("Skipping chunk %d — no embedding", i + 1)
            continue

        # Build row: start with promoted columns, add content + embedding + metadata
        row: dict[str, Any] = {"content": chunk.content, "embedding": embedding, "metadata": chunk.metadata}
        for col in COLLECTION_COLUMNS.get(table, []):
            if col in chunk.metadata:
                row[col] = chunk.metadata[col]

        # Ensure required NOT NULL columns have fallback values
        if table == "cerebro_series_bible":
            row.setdefault("series_name", "unknown")
            row.setdefault("category", "general")
        elif table == "cerebro_style_guide":
            row.setdefault("author_name", "unknown")
            row.setdefault("section", "general")
        elif table == "cerebro_editorial_history":
            row.setdefault("series_name", "unknown")
            row.setdefault("book_title", "unknown")
            row.setdefault("phase", "summary")
            row.setdefault("finding_type", "general")
        elif table == "cerebro_cover_specs":
            row.setdefault("series_name", "unknown")
            row.setdefault("book_title", "unknown")
            row.setdefault("spec_type", "spec")

        try:
            payload = json.dumps(row).encode()
            req = urllib.request.Request(
                f"{SUPABASE_URL}/rest/v1/{table}",
                data=payload,
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201):
                    success += 1
                else:
                    logger.error("Insert failed for chunk %d: HTTP %d", i + 1, resp.status)
        except Exception as e:
            logger.error("Failed to insert chunk %d: %s", i + 1, e)

    logger.info("Successfully ingested %d/%d chunks", success, len(chunks))
    return success


def _upsert_via_mcp(chunks: list[Chunk]) -> int:
    """Output MCP tool calls for an agent to execute.

    When running inside a coding agent (Claude Code, OpenCode),
    the agent will see these tool calls and execute them against
    the connected Cerebro MCP server. Set CEREBRO_MCP=true to use.
    """
    for i, chunk in enumerate(chunks):
        tool_call = {
            "tool": "capture_publishing",
            "arguments": {
                "collection": chunk.collection.replace("-", "_"),
                "content": chunk.content,
                "metadata": chunk.metadata,
            },
        }
        print(json.dumps(tool_call))
        logger.debug("MCP upsert %d/%d: %s", i + 1, len(chunks), chunk.collection)

    logger.info("Emitted %d MCP upsert calls", len(chunks))
    return len(chunks)


# ============================================================
# Series Bible Ingest
# ============================================================

def ingest_series_bible(file_path: str, series_name: str) -> int:
    """Parse and ingest a series bible markdown file.

    Expected format: markdown with ## headings for categories
    (Characters, Worldbuilding, Timeline, Settings, Plot Arcs).
    Under each heading, ### sub-headings for individual entities.

    Example:
        ## Characters
        ### Mara Voss
        - Age: 32
        - Role: Xenolinguist
        - Eyes: Dark brown
        ...

        ## Worldbuilding
        ### FTL Drive
        The Alcubierre-variant drive requires...
    """
    path = Path(file_path)
    text = path.read_text(encoding="utf-8")

    chunks: list[Chunk] = []
    current_category = "general"
    current_entity = ""
    current_content_lines: list[str] = []

    def flush():
        if current_content_lines:
            content = "\n".join(current_content_lines).strip()
            if content:
                chunks.append(Chunk(
                    collection="series-bible",
                    content=content,
                    metadata={
                        "series_name": series_name,
                        "category": current_category,
                        "entity_name": current_entity or current_category,
                        "source_file": str(path.name),
                    },
                ))

    for line in text.splitlines():
        if line.startswith("## "):
            flush()
            current_category = _categorize_heading(line[3:].strip())
            current_entity = ""
            current_content_lines = []
        elif line.startswith("### "):
            flush()
            current_entity = line[4:].strip()
            current_content_lines = [f"# {current_entity}"]
        else:
            current_content_lines.append(line)

    flush()  # Don't forget the last section

    logger.info("Parsed %d chunks from series bible: %s", len(chunks), path)
    return upsert_chunks(chunks)


def _categorize_heading(heading: str) -> str:
    """Map a section heading to a standard category name.

    Strips Roman-numeral prefixes (I., II., III. …) and common numbering
    before matching, so headings like "## IV. Technology & Physics" and
    "## Technology & Physics" both resolve correctly.
    """
    import re as _re
    # Strip leading Roman numerals / numbers (e.g. "IV. ", "3. ", "B2 ")
    cleaned = _re.sub(r"^[IVXivx]+\.\s*|^\d+\.\s*|^[Bb]\d+[:\s—–-]*\s*", "", heading).strip()
    h = cleaned.lower()

    # ── character / relationship ──────────────────────────────────────────
    if any(k in h for k in (
        "character", "protagonist", "love interest", "antagonist",
        "ally", "shadow player", "secondary character", "relationship",
        "romance tracker", "twin bond tracker", "death list",
        "relationship matrix", "character status", "character registry",
        "twin protagonists",
    )):
        return "character"

    # ── timeline / history ────────────────────────────────────────────────
    if any(k in h for k in (
        "timeline", "chronolog", "history", "age of", "the founding",
        "silent centur", "handoff fact", "continuity log",
        "10,000-year", "standard era",
    )):
        return "timeline"

    # ── setting / location / cosmography ──────────────────────────────────
    if any(k in h for k in (
        "setting", "location", "location registry", "cosmograph",
        "shape of human space", "academy", "aurelius", "station",
        "geography", "place",
    )):
        return "setting"

    # ── plot / arc / structure ────────────────────────────────────────────
    if any(k in h for k in (
        "plot", "arc", "story", "act 1", "act 2", "act 3", "act i", "act ii", "act iii",
        "appendix", "overview", "revelation cascade", "political shift",
        "romance arc", "twin bond arc", "thematic", "series arc",
        "macro structure", "four-act", "four act",
        "opening state", "closing state", "climax", "midpoint",
        "book 1 ", "book 2 ", "book 3 ", "book 4 ",
        "communion consciousness tracker",
        "external threat", "elevator pitch", "what makes this",
        "next steps", "core themes", "series & book titles",
        "locked character", "locked plot",
    )):
        return "plot_arc"

    # ── worldbuilding / politics / technology ─────────────────────────────
    if any(k in h for k in (
        "world", "tech", "physics", "science", "communion",
        "neuralith", "spice", "calendar", "measurement", "daily life",
        "laws that bind", "universal rules", "dominion", "ascendancy",
        "covenant", "syndicate", "remnant", "pillar", "political",
        "conspiracy", "conspirac", "marriage", "betrothal",
        "inter-dominion", "power structure", "family web",
        "clan structure", "communion ability", "communion mechanic",
        "drift corridor", "communion network", "the four dominions",
        "dynastic", "asoiaf", "game of thrones",
        "technology & rules", "open items", "continuity flag",
        "additions —", "additions—",
    )):
        return "worldbuilding"

    return "general"


# ============================================================
# Style Guide Ingest
# ============================================================

def ingest_style_guide(file_path: str, author_name: str) -> int:
    """Parse and ingest an author style guide.

    Expected format: markdown with ## sections matching the
    style guide categories.

    Example:
        ## Voice
        Short, punchy sentences in action scenes.
        Longer, flowing prose in romantic moments.
        First person deep POV preferred.

        ## Words to Avoid
        - orbs (use "eyes")
        - ministrations
        - member (use specific terms or metaphor)

        ## Prose Examples
        ```
        The station shuddered around them, and Mara grabbed the
        console edge, knuckles white. Somewhere below, metal
        screamed against metal.
        ```
    """
    path = Path(file_path)
    text = path.read_text(encoding="utf-8")

    chunks: list[Chunk] = []
    current_section = "general"
    current_content_lines: list[str] = []

    section_map = {
        "voice": "voice",
        "tone": "voice",
        "words to avoid": "avoid_words",
        "avoid": "avoid_words",
        "banned words": "avoid_words",
        "preferred": "prefer_words",
        "words to use": "prefer_words",
        "examples": "examples",
        "prose examples": "examples",
        "good examples": "examples",
        "anti-examples": "anti_examples",
        "bad examples": "anti_examples",
        "what not to do": "anti_examples",
        "formatting": "formatting",
        "format": "formatting",
        "genre": "genre_conventions",
        "conventions": "genre_conventions",
        "heat level": "genre_conventions",
        "tropes": "genre_conventions",
    }

    def flush():
        if current_content_lines:
            content = "\n".join(current_content_lines).strip()
            if content:
                chunks.append(Chunk(
                    collection="style-guide",
                    content=content,
                    metadata={
                        "author_name": author_name,
                        "section": current_section,
                        "source_file": str(path.name),
                    },
                ))

    for line in text.splitlines():
        if line.startswith("## "):
            flush()
            heading = line[3:].strip().lower()
            current_section = section_map.get(heading, "general")
            current_content_lines = []
        else:
            current_content_lines.append(line)

    flush()

    logger.info("Parsed %d chunks from style guide: %s", len(chunks), path)
    return upsert_chunks(chunks)


# ============================================================
# Editorial History Ingest
# ============================================================

def ingest_editorial_history(
    file_path: str,
    series_name: str,
    book_title: str,
    book_number: int | None = None,
    phase: str = "summary",
) -> int:
    """Ingest editorial findings from a pipeline phase output.

    Accepts JSON (array of findings) or markdown (one finding per section).

    JSON format:
    [
        {
            "type": "voice",
            "severity": "major",
            "chapter": "Ch 3",
            "content": "Voice shifts to formal register in dialogue..."
        },
        ...
    ]
    """
    path = Path(file_path)
    text = path.read_text(encoding="utf-8")
    chunks: list[Chunk] = []

    # Try JSON first
    try:
        findings = json.loads(text)
        if isinstance(findings, list):
            for finding in findings:
                chunks.append(Chunk(
                    collection="editorial-history",
                    content=finding.get("content", str(finding)),
                    metadata={
                        "series_name": series_name,
                        "book_title": book_title,
                        "book_number": book_number,
                        "phase": phase,
                        "finding_type": finding.get("type", "general"),
                        "severity": finding.get("severity", "info"),
                        "chapter_ref": finding.get("chapter", ""),
                        "source_file": str(path.name),
                    },
                ))
    except json.JSONDecodeError:
        # Fall back to treating entire file as one chunk
        chunks.append(Chunk(
            collection="editorial-history",
            content=text,
            metadata={
                "series_name": series_name,
                "book_title": book_title,
                "book_number": book_number,
                "phase": phase,
                "finding_type": "summary",
                "source_file": str(path.name),
            },
        ))

    logger.info("Parsed %d findings for editorial history: %s", len(chunks), path)
    return upsert_chunks(chunks)


# ============================================================
# Cover Spec Ingest
# ============================================================

def ingest_cover_spec(file_path: str, series_name: str, book_title: str) -> int:
    """Ingest a cover spec markdown file into Cerebro.

    Stores the full spec as one chunk plus extracts key metadata
    (colors, fonts, dimensions) for quick retrieval.
    """
    path = Path(file_path)
    text = path.read_text(encoding="utf-8")

    chunks: list[Chunk] = []

    # Store the full spec
    chunks.append(Chunk(
        collection="cover-specs",
        content=text,
        metadata={
            "series_name": series_name,
            "book_title": book_title,
            "spec_type": "spec",
            "source_file": str(path.name),
        },
    ))

    logger.info("Parsed cover spec for ingest: %s", path)
    return upsert_chunks(chunks)


# ============================================================
# CLI Entry Point
# ============================================================

@click.group()
def cli():
    """Cerebro Publishing Ingest — load editorial content into Cerebro."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")


@cli.command("series-bible")
@click.option("--file", "file_path", required=True, help="Path to series bible markdown")
@click.option("--series", "series_name", required=True, help="Series name")
@click.option("--replace", "replace", is_flag=True, default=False,
              help="Delete existing chunks for this series before ingesting (avoids duplicates on re-ingest)")
def cmd_series_bible(file_path: str, series_name: str, replace: bool):
    """Ingest a series bible document."""
    if replace:
        purged = purge_series_bible(series_name)
        click.echo(f"Purged {purged} existing chunks for '{series_name}'")
    count = ingest_series_bible(file_path, series_name)
    click.echo(f"Ingested {count} chunks into series-bible")


@cli.command("style-guide")
@click.option("--file", "file_path", required=True, help="Path to style guide markdown")
@click.option("--author", "author_name", required=True, help="Author pen name")
@click.option("--replace", "replace", is_flag=True, default=False,
              help="Delete existing chunks for this author before ingesting")
def cmd_style_guide(file_path: str, author_name: str, replace: bool):
    """Ingest an author style guide."""
    if replace:
        purged = purge_style_guide(author_name)
        click.echo(f"Purged {purged} existing chunks for '{author_name}'")
    count = ingest_style_guide(file_path, author_name)
    click.echo(f"Ingested {count} chunks into style-guide")


@cli.command("editorial")
@click.option("--file", "file_path", required=True, help="Path to findings JSON or markdown")
@click.option("--series", "series_name", required=True, help="Series name")
@click.option("--book", "book_title", required=True, help="Book title")
@click.option("--number", "book_number", type=int, default=None, help="Book number")
@click.option("--phase", default="summary", help="Pipeline phase that produced these findings")
def cmd_editorial(file_path: str, series_name: str, book_title: str, book_number: int | None, phase: str):
    """Ingest editorial findings from a pipeline run."""
    count = ingest_editorial_history(file_path, series_name, book_title, book_number, phase)
    click.echo(f"Ingested {count} findings into editorial-history")


@cli.command("cover-spec")
@click.option("--file", "file_path", required=True, help="Path to cover spec markdown")
@click.option("--series", "series_name", required=True, help="Series name")
@click.option("--book", "book_title", required=True, help="Book title")
def cmd_cover_spec(file_path: str, series_name: str, book_title: str):
    """Ingest a cover specification."""
    count = ingest_cover_spec(file_path, series_name, book_title)
    click.echo(f"Ingested {count} chunks into cover-specs")


if __name__ == "__main__":
    cli()
