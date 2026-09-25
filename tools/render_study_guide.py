"""Render a Markdown interview study guide as a shareable, navigable PDF.

Usage:
    python tools/render_study_guide.py guide.md guide.pdf

Dependencies: reportlab and mistune 3. The bundled Codex Python includes both.
"""

from __future__ import annotations

import argparse
import html
import re
import textwrap
from pathlib import Path
from urllib.parse import urlparse

import mistune
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    LongTable,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


PAGE_WIDTH, PAGE_HEIGHT = A4
SIDE_MARGIN = 48
TOP_MARGIN = 62
BOTTOM_MARGIN = 52
BODY_WIDTH = PAGE_WIDTH - 2 * SIDE_MARGIN

NAVY = colors.HexColor("#142744")
BLUE = colors.HexColor("#235FBE")
BODY = colors.HexColor("#243347")
MUTED = colors.HexColor("#617083")
PALE = colors.HexColor("#EEF4FD")
LINE = colors.HexColor("#D7E1EC")
CODE_BG = colors.HexColor("#F3F6FA")


def register_fonts() -> None:
    """Use familiar Windows typefaces while retaining a portable fallback."""
    win_fonts = Path("C:/Windows/Fonts")
    candidates = [
        ("Arial", "arial.ttf"),
        ("Arial-Bold", "arialbd.ttf"),
        ("Arial-Italic", "ariali.ttf"),
        ("Arial-BoldItalic", "arialbi.ttf"),
        ("Consolas", "consola.ttf"),
        ("Consolas-Bold", "consolab.ttf"),
    ]
    alternatives = {
        "Arial": "DejaVuSans.ttf",
        "Arial-Bold": "DejaVuSans-Bold.ttf",
        "Arial-Italic": "DejaVuSans-Oblique.ttf",
        "Arial-BoldItalic": "DejaVuSans-BoldOblique.ttf",
        "Consolas": "DejaVuSansMono.ttf",
        "Consolas-Bold": "DejaVuSansMono-Bold.ttf",
    }
    linux_font_dirs = [
        Path("/usr/share/fonts/truetype/dejavu"),
        Path("/usr/local/share/fonts"),
    ]
    for family, filename in candidates:
        path = win_fonts / filename
        if not path.exists():
            for directory in linux_font_dirs:
                alternative = directory / alternatives[family]
                if alternative.exists():
                    path = alternative
                    break
        if not path.exists():
            raise FileNotFoundError(f"No usable font for {family}: {path}")
        pdfmetrics.registerFont(TTFont(family, str(path)))
    pdfmetrics.registerFontFamily(
        "Arial", normal="Arial", bold="Arial-Bold",
        italic="Arial-Italic", boldItalic="Arial-BoldItalic",
    )
    pdfmetrics.registerFontFamily(
        "Consolas", normal="Consolas", bold="Consolas-Bold",
    )


def clean_text(value: str) -> str:
    """Keep useful punctuation and replace emoji with readable labels."""
    substitutions = {
        "✅": "[done]", "☑": "[done]", "☐": "[ ]", "❌": "[x]",
        "🔴": "[red]", "🟡": "[yellow]", "🟢": "[green]",
        "🚀": "", "💡": "Tip: ", "📌": "Note: ", "⚠": "Caution: ",
    }
    for old, new in substitutions.items():
        value = value.replace(old, new)
    for dash in ("\u2010", "\u2011", "\u2012", "\u2013", "\u2014", "\u2212"):
        value = value.replace(dash, "-")
    value = value.replace("\u200b", "").replace("\ufe0f", "").replace("\u200d", "")
    # Astral pictographs are unlikely to exist in Arial/Consolas PDF fonts.
    value = re.sub(r"[\U0001F000-\U0001FAFF]", "", value)
    return value


def plain_inline(nodes: list[dict] | None) -> str:
    parts = []
    for node in nodes or []:
        kind = node.get("type")
        if kind in {"text", "codespan", "inline_html"}:
            parts.append(node.get("raw", ""))
        elif kind in {"softbreak", "linebreak"}:
            parts.append(" ")
        elif node.get("children"):
            parts.append(plain_inline(node["children"]))
    return clean_text("".join(parts)).strip()


def inline_markup(nodes: list[dict] | None) -> str:
    parts = []
    for node in nodes or []:
        kind = node.get("type")
        if kind == "text":
            parts.append(html.escape(clean_text(node.get("raw", ""))))
        elif kind == "codespan":
            content = html.escape(clean_text(node.get("raw", "")))
            parts.append(f'<font name="Consolas" color="#214F91">{content}</font>')
        elif kind in {"strong", "emphasis", "strikethrough"}:
            inner = inline_markup(node.get("children"))
            tag = "b" if kind == "strong" else "i" if kind == "emphasis" else "strike"
            parts.append(f"<{tag}>{inner}</{tag}>")
        elif kind in {"link", "image"}:
            label = inline_markup(node.get("children")) or html.escape(
                clean_text(node.get("attrs", {}).get("url", ""))
            )
            url = node.get("attrs", {}).get("url", "")
            if urlparse(url).scheme.lower() in {"http", "https", "mailto"}:
                safe_url = html.escape(url, quote=True)
                parts.append(f'<link href="{safe_url}" color="#235FBE">{label}</link>')
            else:
                parts.append(label)
        elif kind == "linebreak":
            parts.append("<br/>")
        elif kind == "softbreak":
            parts.append(" ")
        elif kind == "inline_html":
            parts.append(html.escape(clean_text(node.get("raw", ""))))
        elif node.get("children"):
            parts.append(inline_markup(node["children"]))
    return "".join(parts)


def make_styles() -> dict[str, ParagraphStyle]:
    base = ParagraphStyle(
        "Body", fontName="Arial", fontSize=9.25, leading=13.8,
        textColor=BODY, spaceAfter=6.5, allowWidows=0,
        allowOrphans=0, splitLongWords=1,
    )
    return {
        "body": base,
        "title": ParagraphStyle(
            "Title", parent=base, fontName="Arial-Bold", fontSize=23,
            leading=27, textColor=NAVY, spaceBefore=1, spaceAfter=14,
            keepWithNext=1,
        ),
        "chapter": ParagraphStyle(
            "Chapter", parent=base, fontName="Arial-Bold", fontSize=16,
            leading=20, textColor=NAVY, spaceBefore=18, spaceAfter=8,
            keepWithNext=1,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base, fontName="Arial-Bold", fontSize=11.5,
            leading=15, textColor=BLUE, spaceBefore=11, spaceAfter=5,
            keepWithNext=1,
        ),
        "h3": ParagraphStyle(
            "H3", parent=base, fontName="Arial-Bold", fontSize=10,
            leading=13.5, textColor=NAVY, spaceBefore=9, spaceAfter=4,
            keepWithNext=1,
        ),
        "h4": ParagraphStyle(
            "H4", parent=base, fontName="Arial-Bold", fontSize=10,
            leading=13, textColor=NAVY, spaceBefore=8, spaceAfter=4,
            keepWithNext=1,
        ),
        "quote": ParagraphStyle(
            "Quote", parent=base, leftIndent=14, rightIndent=9,
            borderColor=BLUE, borderWidth=2, borderPadding=7,
            backColor=PALE, spaceBefore=4, spaceAfter=8,
        ),
        "code": ParagraphStyle(
            "Code", fontName="Consolas", fontSize=7.75, leading=10.2,
            textColor=NAVY, spaceBefore=0, spaceAfter=0,
        ),
        "table": ParagraphStyle(
            "TableCell", parent=base, fontSize=8.2, leading=11.2,
            spaceAfter=0,
        ),
        "table_head": ParagraphStyle(
            "TableHead", parent=base, fontName="Arial-Bold", fontSize=8.2,
            leading=11.2, textColor=NAVY, spaceAfter=0,
        ),
        "toc_head": ParagraphStyle(
            "TocHead", parent=base, fontName="Arial-Bold", fontSize=10.5,
            leading=14, textColor=NAVY, spaceBefore=4, spaceAfter=5,
        ),
        "toc_entry": ParagraphStyle(
            "TocEntry", parent=base, fontSize=8.8, leading=12,
            textColor=BLUE, leftIndent=6, firstLineIndent=-6,
            rightIndent=22, spaceAfter=3,
        ),
    }


class StudyGuideDoc(BaseDocTemplate):
    def __init__(self, filename: str, *, title: str):
        super().__init__(
            filename, pagesize=A4, leftMargin=SIDE_MARGIN,
            rightMargin=SIDE_MARGIN, topMargin=TOP_MARGIN,
            bottomMargin=BOTTOM_MARGIN, title=title,
            author="Interview Prep Studio",
        )
        self.display_title = title
        frame = Frame(
            SIDE_MARGIN, BOTTOM_MARGIN, BODY_WIDTH,
            PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN,
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        )
        self.addPageTemplates(PageTemplate(id="guide", frames=[frame], onPage=self.draw_page))

    def draw_page(self, canvas, doc) -> None:
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.65)
        canvas.line(SIDE_MARGIN, PAGE_HEIGHT - 39, PAGE_WIDTH - SIDE_MARGIN, PAGE_HEIGHT - 39)
        canvas.setFont("Arial-Bold", 7.7)
        canvas.setFillColor(MUTED)
        title = self.display_title
        while title and pdfmetrics.stringWidth(title, "Arial-Bold", 7.7) > BODY_WIDTH - 12:
            title = title[:-1]
        if title != self.display_title:
            title = title.rstrip() + "..."
        canvas.drawString(SIDE_MARGIN, PAGE_HEIGHT - 31, title)
        canvas.line(SIDE_MARGIN, 39, PAGE_WIDTH - SIDE_MARGIN, 39)
        canvas.setFont("Arial", 7.6)
        canvas.drawString(SIDE_MARGIN, 27, "Interview study guide")
        canvas.drawRightString(PAGE_WIDTH - SIDE_MARGIN, 27, f"Page {doc.page}")
        canvas.restoreState()

    def afterFlowable(self, flowable) -> None:
        if isinstance(flowable, Paragraph) and hasattr(flowable, "_bookmark_name"):
            name = flowable._bookmark_name
            self.canv.bookmarkPage(name)
            label = getattr(flowable, "_heading_text", "Section")
            outline_level = getattr(flowable, "_outline_level", 0)
            self.canv.addOutlineEntry(label, name, level=outline_level, closed=False)
            if hasattr(flowable, "_toc_level"):
                self.notify("TOCEntry", (flowable._toc_level, label, self.page, name))


class MarkdownBuilder:
    def __init__(self, styles: dict[str, ParagraphStyle]):
        self.styles = styles
        self.story = []
        self.heading_index = 0
        self.title_seen = False
        self.title_story_index = None

    def heading(self, node: dict) -> None:
        level = min(int(node.get("attrs", {}).get("level", 4)), 4)
        label = plain_inline(node.get("children")) or "Section"
        is_title = level == 1 and not self.title_seen
        is_chapter = level == 1 and self.title_seen
        style = self.styles["title" if is_title else "chapter" if is_chapter else f"h{level}"]
        para = Paragraph(inline_markup(node.get("children")), style)
        self.heading_index += 1
        if is_title or is_chapter:
            para._bookmark_name = f"section-{self.heading_index}"
            para._heading_text = label
            para._outline_level = 0 if is_title else 1
        if is_chapter:
            para._toc_level = 0
        if is_title:
            self.title_seen = True
            self.title_story_index = len(self.story)
        self.story.append(para)

    def code_block(self, node: dict) -> None:
        code = clean_text(node.get("raw", "")).rstrip("\n")
        if not code:
            return
        # Keep code inside the text frame. Chunks can flow across pages.
        max_width = BODY_WIDTH - 22
        char_width = pdfmetrics.stringWidth("M", "Consolas", 7.75)
        max_chars = max(40, int(max_width / char_width))
        wrapped = []
        for line in code.replace("\t", "    ").splitlines():
            if len(line) <= max_chars:
                wrapped.append(line)
            else:
                indent = len(line) - len(line.lstrip(" "))
                continuation = " " * min(indent + 2, 16)
                wrapped.extend(textwrap.wrap(
                    line, width=max_chars, subsequent_indent=continuation,
                    expand_tabs=False, replace_whitespace=False,
                    drop_whitespace=False, break_long_words=True,
                    break_on_hyphens=False,
                ))
        for start in range(0, len(wrapped), 42):
            chunk = "\n".join(wrapped[start:start + 42])
            content = Preformatted(chunk, self.styles["code"])
            table = Table([[content]], colWidths=[BODY_WIDTH], hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
                ("BOX", (0, 0), (-1, -1), 0.35, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]))
            self.story.extend([table, Spacer(1, 8)])

    def list_block(self, node: dict, depth: int = 0) -> None:
        ordered = node.get("attrs", {}).get("ordered", False)
        start = int(node.get("attrs", {}).get("start", 1))
        for number, item in enumerate(node.get("children", []), start):
            item_style = ParagraphStyle(
                f"List{depth}", parent=self.styles["body"],
                leftIndent=18 + depth * 15, bulletIndent=2 + depth * 15,
                spaceAfter=3,
            )
            checked = item.get("attrs", {}).get("checked")
            marker = "[x]" if checked is True else "[ ]" if checked is False else (
                f"{number}." if ordered else "\u2022"
            )
            first = True
            for child in item.get("children", []):
                kind = child.get("type")
                if kind in {"block_text", "paragraph"}:
                    paragraph = Paragraph(
                        inline_markup(child.get("children")), item_style,
                        bulletText=marker if first else None,
                    )
                    self.story.append(paragraph)
                    first = False
                elif kind == "list":
                    self.list_block(child, depth + 1)
                else:
                    if first:
                        self.story.append(Paragraph(" ", item_style, bulletText=marker))
                        first = False
                    self.block(child)

    def table_block(self, node: dict) -> None:
        rows = []
        for part in node.get("children", []):
            if part.get("type") == "table_head":
                rows.append((True, part.get("children", [])))
            elif part.get("type") == "table_body":
                for row in part.get("children", []):
                    rows.append((False, row.get("children", [])))
        if not rows:
            return
        column_count = max(len(cells) for _, cells in rows)
        if column_count == 0:
            return
        # LongTable splits by row when a comparison spans multiple pages.
        data = []
        for is_head, cells in rows:
            cell_style = self.styles["table_head" if is_head else "table"]
            formatted = [Paragraph(inline_markup(c.get("children")), cell_style) for c in cells]
            data.append(formatted + [""] * (column_count - len(formatted)))
        table = LongTable(
            data, colWidths=[BODY_WIDTH / column_count] * column_count,
            repeatRows=1 if rows[0][0] else 0, hAlign="LEFT",
        )
        commands = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.35, LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]
        if rows[0][0]:
            commands.append(("BACKGROUND", (0, 0), (-1, 0), PALE))
        table.setStyle(TableStyle(commands))
        self.story.extend([table, Spacer(1, 9)])

    def block(self, node: dict) -> None:
        kind = node.get("type")
        if kind == "heading":
            self.heading(node)
        elif kind in {"paragraph", "block_text"}:
            content = inline_markup(node.get("children"))
            if content.strip():
                self.story.append(Paragraph(content, self.styles["body"]))
        elif kind == "block_code":
            self.code_block(node)
        elif kind == "list":
            self.list_block(node)
            self.story.append(Spacer(1, 3))
        elif kind == "table":
            self.table_block(node)
        elif kind == "block_quote":
            for child in node.get("children", []):
                if child.get("type") in {"paragraph", "block_text"}:
                    self.story.append(Paragraph(
                        inline_markup(child.get("children")), self.styles["quote"]
                    ))
                else:
                    self.block(child)
        elif kind == "thematic_break":
            self.story.extend([
                Spacer(1, 5), HRFlowable(width="100%", thickness=0.7, color=LINE),
                Spacer(1, 8),
            ])
        elif kind in {"block_html", "html_block"}:
            # Some Markdown sources include harmless HTML tags; show their text.
            raw = re.sub(r"<[^>]+>", "", node.get("raw", ""))
            if raw.strip():
                self.story.append(Paragraph(html.escape(clean_text(raw)), self.styles["body"]))


def markdown_to_pdf(source: Path, destination: Path, title_override: str | None = None) -> None:
    register_fonts()
    markdown = mistune.create_markdown(
        renderer="ast", plugins=["table", "strikethrough", "url", "task_lists"]
    )
    nodes = markdown(source.read_text(encoding="utf-8-sig"))
    first_title = next(
        (plain_inline(node.get("children")) for node in nodes
         if node.get("type") == "heading" and node.get("attrs", {}).get("level") == 1),
        "Interview Study Guide",
    )
    title = clean_text(title_override or first_title or "Interview Study Guide")
    styles = make_styles()
    builder = MarkdownBuilder(styles)
    for node in nodes:
        builder.block(node)
    if not builder.story:
        raise ValueError("The Markdown file has no renderable content.")

    # The TOC lists chapters (later H1s) and is populated on a second pass.
    chapter_count = sum(
        node.get("type") == "heading" and node.get("attrs", {}).get("level") == 1
        for node in nodes
    )
    if chapter_count > 1 and builder.title_story_index is not None:
        toc = TableOfContents()
        toc.levelStyles = [styles["toc_entry"]]
        toc.dotsMinLevel = 0
        insert_at = builder.title_story_index + 1
        builder.story[insert_at:insert_at] = [
            Paragraph("Contents", styles["toc_head"]), toc, Spacer(1, 9),
        ]

    destination.parent.mkdir(parents=True, exist_ok=True)
    doc = StudyGuideDoc(str(destination), title=title)
    doc.multiBuild(builder.story)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("markdown", type=Path, help="Input UTF-8 Markdown file")
    parser.add_argument("pdf", type=Path, help="Output PDF file")
    parser.add_argument("--title", help="Optional PDF title/header override")
    args = parser.parse_args()
    markdown_to_pdf(args.markdown, args.pdf, title_override=args.title)
    print(args.pdf.resolve())


if __name__ == "__main__":
    main()
