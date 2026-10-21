# RoadGlas - what was done (Phase 1)

- The single `index.html` (design-tool "x-dc" component, 10 screens in one file) is split into one static HTML file per page:
  `index.html`, `solutions.html`, `paving-mat.html`, `reinforcement-grid.html`, `applications.html`, `project-highlights.html`,
  `project-highlight-1/2/3.html`, `resources.html`, `contact.html`, `lunch-learn.html`, `credit-application.html`.
  Same look; no framework at run time. Interactions (tabs, filters, FAQ, gallery, forms, slider, menu) are in `js/site.js`.
- Images converted to WebP (27 MB -> 4.1 MB, same pixel size; PNG logos lossless). Originals are in `_original/images`.
- Responsive: hamburger menu + mobile layout (<= 1100 / 768 / 600 / 380 px) and scaling for 1920 / 2400 / 3000 / 3600 px+ screens (4K) in `css/site.css`.
- `_original/` keeps the old index.html, css and design-tool scripts. `tools/` has the scripts used:
    node tools/build-pages.js      regenerate the pages from _original/index.original.html (edit the original or the script, then rebuild)
    node tools/convert-images.js   JPG/PNG -> WebP
    node tools/test-pages.js       click-through test of the interactions
    node tools/test-responsive.js  horizontal-overflow check at many widths
    node tools/shot.js             screenshot of a page at an exact width
- Do not deploy `tools/` and `_original/` (Netlify publishes "."): they are only for working on the site.

## Footer + CMS login link
- One footer for every page (`tools/footer.html`, inserted by `node tools/build-pages.js`): brand + short about + Build America badge, link columns (Explore, Products, Support), contact details, brochure download, copyright line, a **CMS Login** button (`login.html`) and "Back to top". Responsive (5 columns -> 3 -> 2).
- `login.html` (generated; noindex): email/password form that posts to `/api/admin/login` (the site's own path, to be routed to `https://cmsapi.qpaix.com/roadglas/...`). The editor itself comes with the CMS step; until then it shows "CMS server is not available yet".
- Removed the design-tool `<helmet>` block (it pulled `js/image-slot.js`, which no longer exists) and added favicon / apple-touch-icon.
- Footer tweak: "CMS Login" moved into the Support column (below Apply for Credit); the "Industrial Fabrics, Inc." link there was removed; the bottom bar now only has the copyright line and "Back to top".

## CMS login wiring
- `tools/dev-server.js` (port 5180): static server + proxy of `/api/*` and `/admin/*` to `https://cmsapi.qpaix.com/roadglas/...`. Start it with `node tools/dev-server.js 5180`. (A plain file server answers the login POST with 405.)
- `netlify.toml` redirects and a new `vercel.json` do the same in production (use whichever host you deploy to).
- Login page: eye button to show / hide the password.
- Test admin (local DB, roadglas schema): test@roadglas.com / Roadglas@123 - change or remove before going live.

## CMS like ind-fab / baselok: live editing (phase 2)
- **Login** (`login.html`, `css/login.css`, `js/login.js`): split screen like the ind-fab CMS (hero panel + "Admin Login" panel, email, password with eye, "I'm not a robot" tick box, Cancel / Login, "Login Successful!" popup). After login the website opens with the CMS tools.
- **Live editor** (`js/cms.js`, `css/cms.css`, on every public page): once signed in an admin bar appears (SAVE, DASHBOARD, SWITCH TO EDIT / PREVIEW, LOGOUT). In edit mode every text can be clicked and changed (bold / italic / underline / link buttons in the bar), every photo has a "Change image" button (upload, confirm, apply), SAVE writes it to the CMS (`POST /api/v2/page-elements`). Saved content is applied for every visitor (`GET /api/v2/page-elements/<page>`). Footer / logo items use the backend's global keys, so one edit shows on all pages.
- **Dashboard** (`dashboard.html`): Applications, Solutions, Project Highlights, Resources (add / edit / delete, photo + document upload). Opens inside the live page from the DASHBOARD button; the CMS-managed lists show a "Edit … in the Dashboard" badge in edit mode.
- **Public pages read the CMS** (`js/rg-content.js`): home cards, solutions, applications, project highlights (list + `project-highlight.html?slug=`), resources are filled from `/api/v2/applications|solutions|stories|resources`. The content that was on the pages was seeded with `tools/seed-content.js`.
- **Stable CMS keys** (`tools/cms-tag.js`, registry `tools/cms-keys.json`): every editable text / image has a fixed readable key in the HTML (`data-cms="txt-engineered-to-perform-94a4"`). Keys come from what the element IS (kind + default text / image file), never from its position, and every key ever given is kept in `tools/cms-keys.json` (commit it). Nothing is numbered at run time; the editor only touches elements that already have a key. A rebuild does not change existing keys (checked: registry identical after rebuild). If the default text of an element is changed in the source, it becomes a NEW element (old saved text stays unused).
- Tests: `node tools/test-cms.js` (login, edit, save, other page, anonymous view, dashboard popup, image replace; cleans up), `node tools/test-public.js`, `node tools/test-dashboard.js`, `node tools/test-pages.js`, `node tools/test-responsive.js`.
- Note: the "I'm not a robot" box only has to be ticked (same as the ind-fab CMS: it is not a real captcha).

## Reference pages for items made in the dashboard (2026-10-15)
- New template pages (generated by `tools/build-pages.js`): `solution-reference.html`, `application-reference.html`, `blog-details.html`, `webinar-details.html`; `project-highlight.html` is the template for project highlights.
- Routes (`vercel.json` rewrites, same in `netlify.toml`, emulated by `tools/dev-server.js`): `/product-detail-<slug>.html`, `/application-<slug>.html`, `/project-highlight-<slug>.html`, `/blog-<slug>.html`, `/webinar-<slug>.html`. A real file always wins (e.g. `project-highlight-1.html`). `?slug=` also works.
- `js/rg-content.js`: renderers for these pages (drawn from the CMS item of the slug, editable live with the same inline editor); resource cards of type Blog Post / Webinar link to their own page. Blog / webinar text keeps line breaks (`data-multi`).
- `js/rg-edit.js`: `data-multi` multi-line fields. `js/dashboard.js`: "Page" column (address of each item's page) and a help text for Blog Post / Webinar.

## Dashboard settings: change password, email configuration, change history (2026-10-16)
- `dashboard.html` / `js/dashboard.js` / `css/dashboard.css`: new "Settings" group in the sidebar (also in the live-editor popup).
  - **Change Password**: modal (current / new / confirm, show-hide), `POST /api/admin/change-password`, min. 8 characters.
  - **Email Configuration**: SMTP host / port / username / password (blank keeps the saved one), CC rows per form (Contact, Lunch & Learn, Credit Application) by product and / or region, "Send test" mail. `GET/PUT /api/v2/email-config`, `POST /api/v2/email-config/test`.
  - **Change History**: all saves of pages and lists, newest first, filter by page, "View" shows what was saved. `GET /api/v2/history/<slug>`.
- History is written on every save: live-editor SAVE (`js/cms.js`, whole page snapshot + changed keys), list edits (`js/rg-edit.js` `RGE.history`: Added / Updated / Deleted items) and dashboard add / edit / delete.

## Forms now send mail (2026-10-16)
- `js/site.js`: Contact, Lunch & Learn and Credit Application forms post to `/api/contact` (form_type `support` / `lunch_learn` / `credit_application`). The backend mails them through the SMTP account of Dashboard > Email Configuration and copies the CC rows of that form. The "sent" screen shows only after the mail went out; on a failure an error message is shown under the button and the form keeps its data.

## Team & Access, Pending Approvals, roles (2026-10-16)
- Dashboard (admin login only; editors never see them): **Pending Approvals** (diff of current vs proposed, Approve & publish / Reject, red count in the sidebar), **Team & Access** (add user as editor / admin, edit, reset password, remove; the last admin and yourself cannot be removed), **Email Configuration**. Uses `/api/v2/approvals` and `/api/v2/team-access/users` of the backend.
- An editor's saves (dashboard, list editing, live SAVE) are queued by the backend (PENDING_APPROVAL): the messages say "Submitted for admin approval" and no change history is written until an admin approves.
- Overview cards no longer show the grey description text.

## Page loader (2026-10-16)
- Every generated page shows a loader (shield logo + sliding bar) from the first paint until the CMS data is in: the page texts / images (`js/cms.js`) and the lists of the dynamic pages (`js/rg-content.js`). It is built into the page head / body by `tools/build-pages.js` (`window.RGL.hold()/release()`), fades out when nothing is pending (min. ~0.4 s, never longer than 12 s, hidden without JavaScript). The login and dashboard pages are not affected.

## Link editor + solutions form (2026-10-16)
- Every link / link button now carries a stable `data-cms-link` key (`tools/cms-tag.js`, registry `tools/cms-keys.json`; header / footer links are shared by all pages: `lnk-g-...`). In edit mode a click on a link or link button opens the **Edit link** dialog (`js/cms.js`): button text (when it has a text key), link address, quick "pick a page" list. SAVE stores the address as a page element under that key (shared ones under the home page); visitors get it applied on load. A click on an inner text of a link still edits the text.
- Dashboard > Solutions form: separate **Description** and **Tick points** fields (one per line) instead of the raw "- " text, so a new solution shows on the Solutions page (and home) exactly like the existing ones: photo, small heading, name, text, ✓ points, "View Solution" button.

## CMS images moved from the bucket to local files (2026-10-16)
- The 13 images the CMS lists used from the Supabase bucket (applications, solutions, project highlights, resources) were downloaded into `images/` (`images/cms-*.webp`, the optimised copies the backend made, ~90 KB each instead of 150-700 KB) and the CMS rows now point to `/images/<file>` (local-testing project only; 21 rows: image / thumbnail / gallery links, nothing else changed). The old bucket files are not deleted. Photos uploaded later from the dashboard / live editor still go to the bucket (that is how uploads work); they can be moved the same way.

- The 13 now-unused image files were deleted from the bucket `cms_upload_roadglas` (local-testing project only); the site uses the local copies in `images/cms-*.webp`.

- Loader restyled (2026-10-16): deep-blue gradient screen, spinning red/white ring with glow around the shield, "ROADGLAS®" wordmark and tagline sliding in, shimmering progress bar and a moving road-lane line; fades out with a slight zoom. It uses a small logo (`images/logo-shield-sm.webp`, 17 KB instead of the 550 KB original). Respects "reduce motion". Defined in `tools/build-pages.js` (LOADER_HEAD / LOADER_BODY).

- Edit mode (2026-10-16): the grey / dashed "edit this item" boxes (`.app-strip`: product, page it opens, order, tab name, delete, help text) are no longer shown on the project, solution, application, resource, blog and webinar pages. Those settings and Delete are in the Dashboard. Inline text / photo / point editing is unchanged.

- Top bar phone + address (2026-10-16): the two texts in the blue strip above the header are CMS keys `g-topbar-phone` / `g-topbar-address` on every page (`tools/build-pages.js`). Keys starting with `g-` (like `lnk-g-` links and the footer keys) are saved with the home page and loaded on every page (`js/cms.js`, `isGlobalKey`), so editing them on one page changes them everywhere.

## Data cache: loader only on the first visit (2026-10-16)
- New `js/rg-cache.js` (`window.RGC`): the CMS data (texts / images / links of every page + the lists) is kept in the browser (localStorage). First visit: loader as before; as soon as the page is shown the data of ALL other pages and lists is fetched in the background. Afterwards every page is drawn at once from the cache without the loader (the page is only kept invisible for a few ms until it is drawn, no flash of default texts) and refreshed from the CMS in the background: changed page texts are applied at once, changed lists show on the next page. Entries older than 10 minutes are refreshed by the background fetch, the whole cache expires after 24 h.
- A signed-in admin never uses the cache (always fresh data): login sets a flag and clears the cache, logout clears it; an admin whose first view came from the cache is reloaded once.
- Hooks: `tools/build-pages.js` (head script decides "cached" before the first paint, adds the script tag), `js/cms.js` (`loadSaved`), `js/rg-content.js` (`get`), `js/login.js`. Test: `node tools/test-cache.js`.

- Dashboard (2026-10-16): the Add / Edit form no longer closes when its scrollbar (or the area around it) is clicked; it closes only with X, Cancel, Esc or after Save. The small dialogs (user, password, history view) ignore clicks on the scrollbar.

- Cache (2026-10-16): a page reload (F5, Ctrl+R or hard refresh) clears the data cache first, so the page is loaded with fresh data from the CMS (loader shown once); the other pages are cached again in the background. Normal navigation keeps using the cache. (`tools/build-pages.js` head script.)

## Images under 100 KB (2026-10-16)
- `tools/compress-images.js` (same rule as the CMS upload: WebP, max 1920 px, quality 80 down to 50, then smaller picture until it fits): the 15 design images over 100 KB are now 78-100 KB each (3.8 MB -> 1.4 MB; `images/` folder 5.2 MB -> 2.8 MB), transparency kept. Originals are in `D:projectsRoadGlas_images_backupimages-before-compress` (outside the project folder). Same file names, so no page needed a change. Biggest wins: `img_p27_1` 688 -> 87 KB, `logo-shield` 537 -> 78 KB, `img_p19_1` 370 -> 94 KB. Run the script again after adding new images.

- The backup of the original (uncompressed) images was moved out of the project: `D:\projects\RoadGlas_images_backup\images-before-compress\` (15 files, 3.8 MB). `tools/compress-images.js` writes its backups there now.

## Text format toolbar like ind-fab (2026-10-16)
- New `js/rg-toolbar.js` replaces the small B / I / U toolbar in the admin bar: **Bold, Italic | Align (left / centre / right / justify) | Change case | Font (Barlow / Barlow Condensed + 45 more, loaded on demand) | Size with - / + | Text colour with a picker (saturation, hue, R G B, Cancel / Apply) | Reset**.
- When a text is selected (or the cursor is put into it) the toolbar shows its formatting: bold / italic state, alignment, font, size and colour. The change is applied to the selection (or to the whole text when nothing is selected), the text is marked as changed and saved with SAVE. Dim in preview mode, active in edit mode.
- Works on the page texts (data-cms keys). The list fields (applications, solutions ...) are plain text and stay unformatted; links are edited with the Link editor. `js/cms.js` exposes `RGCMS.markDirty`; styles in `css/cms.css`; test: `node tools/test-toolbar.js`.

## Solution page of a CMS solution looks like the product pages; menu fix (2026-10-16)
- `js/rg-content.js` (`solutionRef`): a solution made in the dashboard (`product-detail-<name>.html`) now has the same layout as the other product pages: hero with photo (default road photo until the solution has its own), breadcrumb, small heading, title, text and the two buttons; **Key Features** cards (one numbered card per tick point, editable in edit mode, + Add feature); and the blue "Specify ..." contact band with the shield button. Texts, photo and points are editable live as before.
- `tools/build-pages.js`: the menu of the reference pages marks its own section (Solutions for a solution page, Applications for an application page, Resources for blog / webinar pages) instead of Project Highlights.

## Solution template with all product-page sections; footer credit (2026-10-16)
- `solution-reference.html` (route `/product-detail-<name>.html`) is now generated from the layout of `paving-mat.html` with generic placeholder texts (`solutionTemplate()` in `tools/build-pages.js`): hero (from the solution row: title, small heading, text, photo), figures strip, Overview (heading, 2 texts, image), Key Features (3 cards), Product Types (2 editable tabs + descriptions + "View Resources"), Advanced Coating (heading, text, 3 items), Product Application Guide (table + note) and Installation steps (+ guide link), Q&A (6 questions / answers, `details`), and the "Specify" contact band. Every text, photo and link in it is a normal CMS key of THAT solution's own page (`product-detail-<name>`): click, edit, SAVE; links via the link editor. (`js/cms.js` uses the `?slug=` name too; `tools/cms-tag.js` lets the product-type tab labels be edited.)
- Footer: smaller gap above the divider line; new last line "Designed and Developed by Qpaix Infitech Private Limited" (company name in blue, link https://www.qpaix.com, opens in a new tab) on every page (`tools/footer.html`, `css/site.css`).

## Solution template: add / remove for every list, FAQ of the Paving Mat, sections on / off (2026-10-16)
- New `js/rg-solution-tpl.js` (only on `solution-reference.html`): the repeating parts of the template are lists drawn from the data of THAT solution page (page element `tpl-<list>`, JSON): **figures strip, key feature cards, product type tabs, coating items, application table (rows + columns), installation steps, Q&A**. In edit mode every item has a remove (x) and every list an add button (Add figure / feature / product type / item / row / column / step / question); texts are edited in place; SAVE stores the changed lists (also in the change history; editors go to approval). The Q&A starts with the 6 questions + answers of `paving-mat.html`.
- **Sections on / off per solution:** Dashboard > Solutions > Add / Edit > "Sections shown on this solution's page" (Figures strip, Overview, Product Types, Advanced Coating, Application guide + installation steps, Q&A). Saved as the page element `tpl-sections` of the solution page; unticked sections are hidden for everybody. `js/dashboard.js`, `css/dashboard.css`.
- `tools/build-pages.js` (`solutionTemplate`): lists become empty hosts, sections get `data-tsec`; test: `node tools/test-soltpl.js` (it saves to the CMS: the rows `tpl-*` / the page `product-detail-roadglas-paving-mat` must be deleted afterwards).

- Home page solutions slider (2026-10-16): when there are more solutions than fit in a row (3 on desktop, 2 on tablet, 1 on mobile) they are shown in a slider with left / right arrows at the sides; it moves by one card every 4 seconds, goes back to the first after the last, stops while the mouse is over it and in edit mode (where the cards are a plain grid so they can be edited). With 3 or fewer solutions nothing changes. `js/rg-content.js` (`home`), `css/site.css`; test: `node tools/test-slider.js`.

- Home solutions slider: the arrows now sit in the free space at the left and right side of the cards (the slider has a side margin), not over the photos (`css/site.css`).

- Home (2026-10-16): the white gap between "Why choose RoadGlas" and "Top 10 benefits" is smaller (200 px -> 72 px, `css/site.css`). The home applications now use the same slider as the solutions (all applications, arrows at the sides, 4 s auto move).

- Sections on/off also on the real product pages (2026-10-16): `paving-mat.html` and `reinforcement-grid.html` now have the same section names (`data-tsec`, `markSections()` in `tools/build-pages.js`) and `js/rg-content.js` (`productPage`) hides the sections that the Dashboard switched off for the solution whose "View Solution" button opens that page (page element `tpl-sections` of `product-detail-<solution slug>`). Works with the data cache (no loader on later visits). Before this the switches only worked on the template page (`product-detail-<name>.html`).

- Solution template, Overview photo (2026-10-16): the photo now fills its whole box (`object-fit: cover`, default photo `images/img_p27_1.webp`) instead of a thin strip inside a white box; a photo uploaded from the CMS ("Change image") is cropped to the same box. (`solutionTemplate()` in `tools/build-pages.js`; the real product pages keep their diagram.)

## Products = the solutions (2026-10-16)
- Every solution made in the Dashboard is a product everywhere (the value is the solution's slug): **Project Highlights** filter tabs (All + one tab per solution), **Resources** "Browse by Product" cards (All + one card per solution with its photo and document count) and the product selects of Dashboard > Resources and Dashboard > Project Highlights (+ the selects of the inline editor / blog and webinar pages). Old saved values `mat` / `grid` (and `?prod=mat` links on the product pages) are mapped to the solutions whose product family is mat / grid. `js/rg-content.js` (`prodList`, `normProd`, `getProducts`), `js/dashboard.js` (`productOptions`, `normProd`). Resources keep `[product:<slug>]` in their description, project highlights `prod` in their JSON; nothing in the DB had to be changed.
- Not yet connected to the solutions: the product list of the contact form (static) and the Products of the Email Configuration CC rows.

- Resources page (2026-10-16): the line "Pavement Reinforcement Resources" beside the "Browse by Product" heading was removed from `resources.html` (build) and from the drawn page (`js/rg-content.js`).

- Dashboard (2026-10-16): the Product dropdowns of Resources and Project Highlights list only the solutions (no "All products / other" / "Other" option: the "All" filter on the site shows everything anyway). An old item that was saved without a product keeps its old value, shown only in that item.

- `netlify.toml` was removed (2026-10-16): the site is deployed on Vercel; the routing (API proxy, item pages) lives in `vercel.json`. Netlify is not used.

- Email Configuration (2026-10-16): saving failed with "manufacturer: choose a product or a region for ..." when the saved config had CC rows of a form this site does not have (e.g. Manufacturer, copied from ind-fab): they were not shown in any tab but were still checked. Now every form that has rows gets its own tab (Manufacturer, Career ... appear after Contact / Lunch & Learn / Credit Application) and "a product or a region is required" is checked only for Contact and Credit Application (like the ind-fab CMS). The email address of every row is still checked. `js/dashboard.js` (`ccForms`, `saveEmail`).

## Blog / webinar pages (2026-10-16)
- Two items added to the local CMS (Dashboard > Resources): the Blog Post "How a Paving Mat Helps Delay Reflective Cracking" (`blog-how-a-paving-mat-helps-delay-reflective-cracking.html`) and the Webinar "Installing ROADGLAS® Paving Mat: Tack Coat, Placement and Rolling" (`webinar-installing-roadglas-paving-mat-tack-coat-placement-and-rolling.html`, button "Watch / Register" -> contact.html). The text only uses what `paving-mat.html` already says. Product: Paving Mat.
- The article text is shown formatted (`fmtArticle` in `js/rg-content.js`): a short first line of a block = sub-heading, lines starting with "•" / "-" = bullet list, blank line = new paragraph. In edit mode it stays plain text. Styles: `.art` in `css/site.css`.
- The Resources cards of a blog post / webinar show only the start of the text (170 characters) and link to the page.
- **Fix:** `blog-details.html`, `webinar-details.html` and `application-reference.html` had no footer (the shell of the reference pages had none); `withFooter()` in `tools/build-pages.js` now adds it.

## Webinar + blog pages with images; no text on the Resources cards (2026-10-16)
- `js/rg-content.js` (`webinarPage`, `blogPage`, `fmtArticle`), `css/site.css`: **Webinar** page = hero with the cover photo and a "Webinar" tag, the text beside a card with the cover photo + play button, the facts (product, posted date, phone) and the red "Watch / Register" button, the session list as numbered cards, and a contact band. **Blog** page = hero with "Blog Post" tag, date and reading time, the cover photo on top of the text, numbered cards for numbered lines, sub-headings, a side card (product, posted, reading time, "More about <product>") and a help box, and the contact band. The cover photo is changed in edit mode ("Change photo"); a default road photo is used when none is set. In edit mode the text is plain text.
- The Resources cards of a blog post / webinar show no description any more (title, product, type and the "Read article" / "View webinar" link only); the text is on the page itself.

- Pictures inside the text of a blog post / webinar (2026-10-16): a line `[image: /images/photo.webp | caption]` (own images or https links; the caption is optional) becomes a full-width picture with a caption (`fmtArticle`, `.art-fig`). In edit mode the article page has "＋ Insert image in the text": it uploads a photo and puts its line at the cursor (or at the end); the line can be moved / deleted like any text. The two sample items got 3 (blog) and 2 (webinar) pictures from the site's own photos.

- Dashboard > Resources filters (2026-10-16): above the list the same tabs as the Resources page (All · Downloads · Technical Datasheets · Webinars · Videos · Blog Posts · Technical Notes) and a Product row (All products + one chip per solution), each with a count; they combine. "+ Add resource" starts with the selected tab's type (e.g. Webinars -> Webinar) and the selected product. `js/dashboard.js` (`resBar`, `resTab`, `resProd`), `css/dashboard.css`.

## Blog / webinar: short description (card) and page text are separate (2026-10-16)
- A resource now has two texts: the **short description** (shown on the card of the Resources page) and, for a Blog Post / Webinar, the **text of its own page** (shown on the blog / webinar page). Both are stored in the one `description` column: `[product:<solution>] short text` + a line `[page]` + the page text (the backend has no second text column). `js/rg-content.js` (`splitDesc`), `js/dashboard.js` (`splitDesc`).
- Dashboard > Resources > Add / Edit: "Short description" (always) and "Text of its own page" (only visible when the Type is Blog Post or Webinar; it keeps the formatting help: blank line = paragraph, short first line = sub-heading, "•" = list, `[image: ...]` = picture). The list shows the short description under the title.
- The Resources cards show the short description (blank when there is none); the blog / webinar page edits the page text in place. An older blog / webinar that has only one text keeps it as the page text and has an empty short description until one is written.

- Sample Project Highlights (2026-10-16): two entries added in the local CMS (Dashboard > Project Highlights): "Interstate Corridor Overlay: Delaying Reflective Cracking" (ROADGLAS® Paving Mat) and "Airfield Taxiway Rehabilitation with Reinforcement Grid" (ROADGLAS® Reinforcement Grid), each with 4 photos, a challenge text and a solution text written only from the product content of the site. Their Year is "Sample"; the place / owner are generic. Replace them with real projects (name, place, year, owner) before going live.
