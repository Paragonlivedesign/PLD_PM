# Document template variables (`{{merge keys}}`)

When you generate a document from a template (`POST /api/v1/documents/generate`), the backend merges **placeholders** in the template content with data from the selected **event** (and related sources). Syntax:

```text
{{variable_name}}
```

Spaces inside the braces are allowed: `{{ event_name }}` works the same.

## Built-in keys

These keys are always available for the event context (see [`template-merge-catalog.ts`](../backend/src/modules/documents/template-merge-catalog.ts) for the canonical list). Values are **HTML-escaped** when substituted except where noted as pre-built HTML.

| Key | Kind | Description |
|-----|------|-------------|
| `event_name` | text | Event name |
| `event_start_date` | text | Start date (ISO from API) |
| `event_end_date` | text | End date (ISO from API) |
| `event_phase` | text | Lifecycle phase |
| `event_status` | text | Operational status |
| `event_description` | text | Description (may be empty) |
| `personnel_table` | html | Table of **tenant** personnel (name, role, email). **Not** filtered to the event’s crew assignments yet. |
| `custom_fields_list` | html | List of populated **event** custom fields (label + value). |
| `schedule_section` | html | **Stub** until scheduling output is wired. |
| `travel_section` | html | **Stub** until travel output is wired. |
| `financial_section` | html | **Stub** until financial output is wired. |

Use **`kind: html`** keys inside HTML templates (e.g. wrap `personnel_table` in a `<div>` if needed). For **`kind: text`** keys you can place them inside HTML as text nodes; angle brackets in the data are escaped.

## Custom data: `data_overrides`

The generate request accepts `data_overrides`: an object whose **top-level keys** become additional merge names.

- String values are substituted as-is after HTML escaping.
- Non-string values are JSON-stringified, then escaped.

Example body snippet:

```json
{
  "template_id": "...",
  "event_id": "...",
  "data_overrides": {
    "show_title": "Winter Tour 2026",
    "notes": "Load-in at dock C"
  }
}
```

Template:

```html
<h1>{{show_title}}</h1>
<p>{{notes}}</p>
```

**Security:** Treat `data_overrides` as user-supplied content. Do not pass untrusted HTML expecting it to render as markup; it will be escaped in the merge step.

## Machine-readable catalog

`GET /api/v1/templates/variable-catalog` returns the built-in catalog (keys, labels, categories, `stub` flags) for tools and the in-app template editor. See [`contracts/documents.contract.md`](../contracts/documents.contract.md).

## Template `variables` metadata

Creating/updating a template can store a `variables` array (metadata for authors). Today it does **not** automatically define which keys exist at merge time; built-ins and `data_overrides` do. Future work may validate template content against declared variables.
