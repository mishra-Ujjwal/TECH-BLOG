import Link from "next/link";
import { PageHeader } from "@/components/studio/page-header";
import { requireAdmin } from "@/lib/admin-auth";
import { getCategories } from "@/lib/site";
import { studioRows } from "../rows";

/** The categories, with how many posts each holds. */
export default async function CategoriesPage() {
  await requireAdmin();
  const rows = (await studioRows()).filter((r) => r.type !== "page");
  return (
    <>
      <PageHeader
        title="Categories"
        description={
          <>
            The sections in the menu and footer. Each post picks one when you write it. The names, descriptions,
            topics and brands live in <code>content/categories.json</code>.
          </>
        }
      />
      <div className="overflow-x-auto rounded-[14px] border border-rule bg-paper">
        <table className="data w-full min-w-[44rem]">
          <thead>
            <tr>
              <th scope="col" className="pl-5">Category</th>
              <th scope="col">Published</th>
              <th scope="col">Drafts</th>
              <th scope="col">Topics</th>
              <th scope="col" className="pr-5">
                <span className="sr-only">Links</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {getCategories().map((c) => {
              const mine = rows.filter((r) => r.category === c.slug);
              const pub = mine.filter((r) => r.status === "published").length;
              return (
                <tr key={c.slug}>
                  <td className="pl-5">
                    <span className="font-semibold">{c.name}</span>
                    <span className="block text-micro text-ink-3">/categories/{c.slug}</span>
                  </td>
                  <td className="num font-semibold">{pub}</td>
                  <td className="num text-ink-2">{mine.length - pub}</td>
                  <td className="text-micro text-ink-2">{c.topics.join(", ")}</td>
                  <td className="whitespace-nowrap pr-5 text-right text-small">
                    <a href={`/categories/${c.slug}`} target="_blank" className="link">
                      View
                    </a>
                    <Link href={`/studio/new?type=article&format=explainer`} className="link ml-3">
                      Write
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
