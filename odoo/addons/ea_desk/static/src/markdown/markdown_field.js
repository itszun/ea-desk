/** @odoo-module **/
/* global marked */
import { Component, markup, useRef } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { escape } from "@web/core/utils/strings";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

// Raw HTML inside a template is shown as text, never executed.
const renderer = new marked.Renderer();
renderer.html = (html) => escape(typeof html === "string" ? html : html.text || "");
renderer.link = (href, title, text) => {
    const safe = /^(https?:|mailto:|#|\/)/i.test(href || "") ? href : "#";
    return `<a href="${escape(safe)}" target="_blank" rel="noopener"${title ? ` title="${escape(title)}"` : ""}>${text}</a>`;
};

export function renderMarkdown(source) {
    return marked.parse(source || "", { gfm: true, breaks: false, renderer });
}

// Inline styles survive a paste into Word / Google Docs, where stylesheets do not.
const PASTE_STYLES = {
    table: "border-collapse:collapse;width:100%;margin:6pt 0;",
    th: "border:1px solid #7f8c85;padding:4pt 6pt;background:#e8f4ee;text-align:left;font-weight:bold;vertical-align:top;",
    td: "border:1px solid #7f8c85;padding:4pt 6pt;vertical-align:top;",
    blockquote: "border-left:3px solid #1f7a52;margin:6pt 0;padding:2pt 10pt;color:#44514b;",
    code: "font-family:Consolas,'Courier New',monospace;",
};

export function htmlForClipboard(html) {
    const box = document.createElement("div");
    box.innerHTML = html;
    for (const [tag, style] of Object.entries(PASTE_STYLES)) {
        box.querySelectorAll(tag).forEach((el) => el.setAttribute("style", style));
    }
    return `<html><head><meta charset="utf-8"></head><body>${box.innerHTML}</body></html>`;
}

export class EaMarkdownField extends Component {
    static template = "ea_desk.MarkdownField";
    static props = { ...standardFieldProps, showToolbar: { type: Boolean, optional: true } };
    static defaultProps = { showToolbar: true };

    setup() {
        this.notification = useService("notification");
        this.contentRef = useRef("content");
    }

    get source() {
        return this.props.record.data[this.props.name] || "";
    }

    get html() {
        return markup(renderMarkdown(this.source));
    }

    async copyFormatted() {
        const html = htmlForClipboard(renderMarkdown(this.source));
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([this.source], { type: "text/plain" }),
                }),
            ]);
        } catch {
            // Older browsers / insecure context: copy the rendered selection instead.
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(this.contentRef.el);
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand("copy");
            selection.removeAllRanges();
        }
        this.notification.add(_t("Tersalin dengan format. Tempel ke Word atau Google Docs."), { type: "success" });
    }

    async copyMarkdown() {
        await navigator.clipboard.writeText(this.source);
        this.notification.add(_t("Markdown tersalin."), { type: "info" });
    }
}

registry.category("fields").add("ea_markdown", {
    component: EaMarkdownField,
    supportedTypes: ["text"],
    extractProps: ({ options }) => ({ showToolbar: options.toolbar !== false }),
});
