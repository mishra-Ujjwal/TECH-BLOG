import { OpenOnHash } from "./open-on-hash";

/**
 * The writing guide on the studio home page: how to fill in a post, field by field,
 * and what happens when you press Publish. Plain static content; keep it in step with
 * lib/content/schema.ts when fields change.
 */

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Pick what you are writing",
    body: (
      <>
        Under <em>Start something new</em>, choose the kind of post. An <strong>Explainer</strong> explains how
        something works. A <strong>How-to</strong> is numbered steps you followed yourself. A{" "}
        <strong>Comparison</strong> puts two to four products side by side. <strong>Troubleshooting</strong> is a
        problem and the fixes that worked. A <strong>Review</strong> is one product you used, with a verdict. Each
        one opens a form with exactly the fields that kind of post needs.
      </>
    ),
  },
  {
    title: "Fill in the basics",
    body: (
      <>
        Write the <strong>Title</strong> first; the <strong>Slug</strong> (the web address) fills itself in from
        it. Choose the <strong>Category</strong>, which decides where the post appears in the menu. Then write the{" "}
        <strong>Excerpt</strong> (the short summary shown on the home page) and the{" "}
        <strong>Meta description</strong> (the snippet under your title in Google). The counter beside each box
        turns orange when it is too short or too long.
      </>
    ),
  },
  {
    title: "Lead with the answer",
    body: (
      <>
        Articles have an <strong>Answer</strong> box. Answer the title in two or three plain sentences, as if a
        friend asked. It is shown first on the page and is often what Google quotes.
      </>
    ),
  },
  {
    title: "Write the body in sections",
    body: (
      <>
        Under <strong>Sections</strong>, press <em>Add section</em> for each part of the post. Give each one a{" "}
        <strong>Heading</strong> and write the <strong>Body</strong>. Use <strong>Up</strong> and{" "}
        <strong>Down</strong> to reorder. How-tos also have <strong>Steps</strong>, one per action, ideally each
        with a screenshot.
      </>
    ),
  },
  {
    title: "Add pictures",
    body: (
      <>
        In any <strong>Media</strong> list, press <em>Add</em>, then <strong>Upload</strong> to choose an image
        from your computer. It is saved in <code>public/images/&lt;slug&gt;/</code> and its size is filled in for
        you. Always write <strong>Alt text</strong> that describes what the picture shows, and keep the credit as{" "}
        <em>Own photo</em> or <em>Own screenshot</em> for your own pictures.
      </>
    ),
  },
  {
    title: "List your sources and FAQs",
    body: (
      <>
        Under <strong>Sources</strong>, add every website you took a fact from: a short id, its name, the link and
        its licence (for GOV.UK, <em>Open Government Licence v3.0</em>; for most sites,{" "}
        <em>Facts only, linked to the original</em>). Never copy another site&rsquo;s wording. Under{" "}
        <strong>FAQ</strong>, add two or three questions readers really ask.
      </>
    ),
  },
  {
    title: "Save, check, publish",
    body: (
      <>
        Press <strong>Save draft</strong> at any time; drafts never appear on the site. The panel on the right
        lists anything still missing; click an item to jump to it. When it says <em>Ready to publish</em>, press{" "}
        <strong>Publish</strong>. The post appears on the home page, its category and in search straight away.
      </>
    ),
  },
];

export function StudioGuide({ open = false }: { open?: boolean }) {
  return (
    <section id="guide" aria-labelledby="guide-title" className={open ? "" : "mt-14 scroll-mt-6"}>
      <OpenOnHash id="guide" />
      <details open={open} className={`group ${open ? "" : "rounded-[10px] border border-rule"}`}>
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
          <span>
            <span id="guide-title" className="block text-h3 font-semibold">
              How to write and publish a post
            </span>
            <span className="mt-0.5 block text-small text-ink-2">
              What goes in each part of the form, step by step.
            </span>
          </span>
          <span className="shrink-0 text-small text-accent group-open:hidden">Show guide</span>
          <span className="hidden shrink-0 text-small text-accent group-open:inline">Hide guide</span>
        </summary>

        <div className="border-t border-rule px-5 py-6">
          <ol className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-paper-3 text-small font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-small leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">Formatting the body text</h3>
              <p className="mt-1 text-small text-ink-2">Body boxes use Markdown. Type it like this:</p>
              <table className="data mt-3 w-full text-small">
                <thead>
                  <tr>
                    <th scope="col">You type</th>
                    <th scope="col">You get</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>**bold**</code></td>
                    <td><strong>bold</strong></td>
                  </tr>
                  <tr>
                    <td><code>*italic*</code></td>
                    <td><em>italic</em></td>
                  </tr>
                  <tr>
                    <td><code>[link text](/categories/phones)</code></td>
                    <td className="text-accent underline">link text</td>
                  </tr>
                  <tr>
                    <td><code>- item</code> on each line</td>
                    <td>a bulleted list</td>
                  </tr>
                  <tr>
                    <td><code>1. item</code> on each line</td>
                    <td>a numbered list</td>
                  </tr>
                  <tr>
                    <td>an empty line</td>
                    <td>a new paragraph</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="font-semibold">What each kind of post must have</h3>
              <ul className="mt-3 space-y-2 text-small text-ink-2">
                <li>
                  <strong className="text-ink">Explainer:</strong> an answer, at least one section, and sources
                  for the facts.
                </li>
                <li>
                  <strong className="text-ink">How-to:</strong> at least two steps and a testing block naming the
                  exact app or OS version you used.
                </li>
                <li>
                  <strong className="text-ink">Comparison:</strong> two to four products and a testing block.
                </li>
                <li>
                  <strong className="text-ink">Troubleshooting:</strong> a testing block saying what you tried it
                  on.
                </li>
                <li>
                  <strong className="text-ink">News analysis:</strong> a source with a link and one section ticked
                  as opinion.
                </li>
                <li>
                  <strong className="text-ink">Review:</strong> product, verdict with at least one con and one
                  &ldquo;skip if&rdquo;, testing block and two sections.
                </li>
              </ul>
              <p className="mt-3 text-small text-ink-2">
                Publishing is refused while any field still contains <code>TODO</code>,{" "}
                <code>[GAP: ...]</code>, <code>[UNVERIFIED: ...]</code> or <code>REPLACE:</code>. Drafts can be saved
                with these, and with missing parts, so you can import a draft and finish it later.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="font-semibold">Posting with JSON</h3>
              <p className="mt-1 text-small leading-relaxed text-ink-2">
                Everything the form does can also be done in JSON. Use <strong>Import JSON</strong> to paste or upload
                one post or many; <em>Start from a template</em> gives you every field to fill. In the editor, the{" "}
                <strong>JSON</strong> tab shows a post exactly as saved, with <strong>Copy</strong> and{" "}
                <strong>Download</strong> buttons, and the list can download any selection as JSON.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Publishing many at once</h3>
              <p className="mt-1 text-small leading-relaxed text-ink-2">
                In the list below, use the filters, tick <strong>Select all</strong>, then press{" "}
                <strong>Publish</strong>, <strong>Move to draft</strong> or <strong>Delete</strong>. Each post is
                checked exactly as if you had published it on its own.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Deleting and restoring</h3>
              <p className="mt-1 text-small leading-relaxed text-ink-2">
                Deleted posts move to <code>content/.trash/</code>. To bring one back, move its file into{" "}
                <code>content/articles/</code> (or reviews, pillars, pages) and remove the date from the end of its
                name. A post that another post links to cannot be deleted until the link is removed.
              </p>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
