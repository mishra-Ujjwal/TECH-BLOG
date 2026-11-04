# AdSense readiness checks (design)

Approved in chat on 2026-10-28.

## Goal
Help the editor find and fix what AdSense reviewers reject (thin or generic content,
missing policy pages, too few posts, policy-risk topics) before applying. Advice only:
nothing edits or publishes a post.

No tool can prove text is AI-written. The "AI-like" score estimates how generic the
prose reads; Google judges value, not authorship.

## Pieces
1. `lib/adsense-check.ts`: free rule-based checks, no API key.
   - Per post: word count (<300 fail, <600 warn), AI-like phrase score (reuses
     `localCheck`), first-hand evidence, images, sources, author, headings,
     placeholders, near-duplicate titles, policy-risk wording. Overall risk low/medium/high.
   - Site: privacy/about/contact/terms published, privacy policy mentions cookies,
     Google and advertising, real contact email, 20+ substantial published posts,
     no high AI-like posts, named author, publisher ID / ads.txt, Search Console,
     certified consent banner (manual).
2. Claude review (when `ANTHROPIC_API_KEY` is set) gains an `adsense` block:
   risk plus problems with fixes. Claude never invents experience.
3. UI: new `/studio/adsense` page (site checklist + all posts worst first, free checks
   only) and an AdSense section in the editor's Writing check.

## Testing
Run the checks over existing content, `npm run check`, open both screens in dev.
