/** @odoo-module **/
import { Component, onMounted, onWillStart, onWillUnmount, useRef, useState } from "@odoo/owl";
import { loadBundle } from "@web/core/assets";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

// Series colours validated for colour-vision deficiency (dataviz validator, light surface).
// Order matters: blue sits between green and orange, which protans confuse.
const GREEN = "#1f8a5b";
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GRID = "#eceae4";
const INK_MUTED = "#5f6b66";

export class EaExecutiveSummary extends Component {
    static template = "ea_desk.ExecutiveSummary";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.state = useState({ data: null, updated: "" });
        this.pipelineRef = useRef("pipeline");
        this.capacityRef = useRef("capacity");
        this.trendRef = useRef("trend");
        this.charts = [];
        onWillStart(async () => {
            await loadBundle("web.chartjs_lib");
            await this.load();
        });
        onMounted(() => this.renderCharts());
        onWillUnmount(() => this.destroyCharts());
    }

    async load() {
        this.state.data = await this.orm.call("ea.engagement", "get_executive_summary", []);
        this.state.updated = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    }

    async refresh() {
        await this.load();
        this.renderCharts();
    }

    get capacityPct() {
        const c = this.state.data.capacity;
        return c.limit ? Math.min(100, Math.round((c.total / c.limit) * 100)) : 0;
    }

    // ------------------------------------------------------------------ charts
    destroyCharts() {
        this.charts.forEach((c) => c.destroy());
        this.charts = [];
    }

    renderCharts() {
        this.destroyCharts();
        const d = this.state.data;
        if (!d || !window.Chart) {
            return;
        }
        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
        Chart.defaults.color = INK_MUTED;
        const axes = (horizontal) => ({
            x: horizontal
                ? { beginAtZero: true, ticks: { precision: 0 }, grid: { color: GRID }, border: { display: false } }
                : { grid: { display: false }, border: { color: GRID } },
            y: horizontal
                ? { grid: { display: false }, border: { color: GRID } }
                : { beginAtZero: true, ticks: { precision: 0 }, grid: { color: GRID }, border: { display: false } },
        });
        const bar = { borderRadius: 4, borderSkipped: "start", maxBarThickness: 44 };

        this.charts.push(new Chart(this.pipelineRef.el, {
            type: "bar",
            data: {
                labels: d.pipeline.map((s) => s.name),
                datasets: [{ label: "Engagement", data: d.pipeline.map((s) => s.count), backgroundColor: GREEN, ...bar }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, scales: axes(false),
                plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `${d.pipeline[i[0].dataIndex].name} · ${d.pipeline[i[0].dataIndex].title}` } } },
                onClick: (_e, els) => els.length && this.openEngagements([["stage_id", "=", d.pipeline[els[0].index].id], ["state", "in", ["active", "on_hold"]]], d.pipeline[els[0].index].name),
                onHover: (e, els) => (e.native.target.style.cursor = els.length ? "pointer" : "default"),
            },
        }));

        this.charts.push(new Chart(this.capacityRef.el, {
            type: "bar",
            data: {
                labels: d.capacity.modes.map((m) => m.name),
                datasets: [{ label: "Beban (poin)", data: d.capacity.modes.map((m) => m.load), backgroundColor: GREEN, ...bar, maxBarThickness: 22 }],
            },
            options: {
                indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: axes(true),
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => ` ${i.raw} poin · ${d.capacity.modes[i.dataIndex].count} engagement aktif` } } },
            },
        }));

        this.charts.push(new Chart(this.trendRef.el, {
            type: "bar",
            data: {
                labels: d.trend.labels,
                datasets: [
                    { label: "Gerbang dilewati", data: d.trend.gates, backgroundColor: GREEN, ...bar },
                    { label: "ADR disahkan", data: d.trend.adr_accepted, backgroundColor: BLUE, ...bar },
                    { label: "Engagement selesai", data: d.trend.closed, backgroundColor: ORANGE, ...bar },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false, scales: axes(false),
                datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.85 } },
                interaction: { mode: "index", intersect: false },
                plugins: { legend: { position: "top", align: "start", labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2 } } },
            },
        }));
    }

    // ------------------------------------------------------------------ navigation
    openEngagements(domain, name = "Engagement") {
        this.action.doAction({
            type: "ir.actions.act_window", name, res_model: "ea.engagement", domain,
            views: [[false, "list"], [false, "kanban"], [false, "form"]],
        });
    }

    openList(model, domain, name) {
        this.action.doAction({ type: "ir.actions.act_window", name, res_model: model, domain, views: [[false, "list"], [false, "form"]] });
    }

    openRecord(model, id) {
        if (id) {
            this.action.doAction({ type: "ir.actions.act_window", res_model: model, res_id: id, views: [[false, "form"]] });
        }
    }

    openTile(kind) {
        switch (kind) {
            case "active": return this.openEngagements([["state", "=", "active"]], "Engagement aktif");
            case "ready": return this.openEngagements([["gate_ready", "=", true]], "Siap gerbang");
            case "attention": return this.action.doAction("ea_desk.action_ea_attention");
            case "adr": return this.openList("ea.decision", [["state", "=", "proposed"]], "ADR menunggu keputusan");
            case "artifact": return this.openList("ea.artifact", [["state", "=", "draft"]], "Artefak Draft");
            case "foundation": return this.openList("ea.foundation.item", [["state", "!=", "done"]], "Masukan /foundation terbuka");
        }
    }

    openAttention(item) {
        if (item.kind === "adr") {
            return this.openRecord("ea.decision", item.decision_id);
        }
        this.openRecord("ea.engagement", item.id);
    }
}

registry.category("actions").add("ea_desk.executive_summary", EaExecutiveSummary);
